import time
import queue
import threading
import requests
import functools
import json
from urllib.parse import urlencode, quote

DEFAULT_ENDPOINT = "https://rabbitize-api.rabbitt.ai"

def _header_value(headers: dict, name: str):
    return headers.get(name) or headers.get(name.lower())

def _apply_header(headers: dict, name: str, value):
    if value is not None and str(value).strip():
        headers[name] = str(value)

def _prompt_from_headers(headers: dict):
    slug = _header_value(headers, "x-rabbittize-prompt-slug")
    version = _header_value(headers, "x-rabbittize-prompt-version")
    label = _header_value(headers, "x-rabbittize-prompt-label")
    hash_value = _header_value(headers, "x-rabbittize-prompt-hash")
    if not any([slug, version, label, hash_value]):
        return None
    return {
        "slug": slug,
        "version": version,
        "label": label,
        "hash": hash_value,
    }

class TelemetryClient:
    def __init__(self, api_key: str, endpoint: str = None, max_batch_size: int = 50, flush_interval_ms: float = 5000, debug: bool = False, retries: int = 2, prompt_cache_ttl_ms: float = 60000):
        self.api_key = api_key
        self.endpoint = (endpoint or DEFAULT_ENDPOINT).rstrip("/")
        self.max_batch_size = max_batch_size
        self.flush_interval = flush_interval_ms / 1000.0
        self.debug = debug
        self.retries = retries
        self.prompt_cache_ttl = prompt_cache_ttl_ms / 1000.0
        self._prompt_cache = {}
        self._prompt_cache_lock = threading.Lock()

        self.plugins = []
        self.queue = queue.Queue()
        self.stop_event = threading.Event()
        
        if self.flush_interval > 0:
            self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
            self.worker_thread.start()
        else:
            self.worker_thread = None

    def enqueue(self, envelope: dict):
        if self.debug:
            print(f"[rabbittwatch] Enqueuing trace envelope: {envelope.get('trace', {}).get('traceId')}")
        self.queue.put(envelope)
        if self.queue.qsize() >= self.max_batch_size:
            self.flush()

    def send(self, envelope: dict):
        self._post("/api/ai-observability/traces", envelope)

    def post_score(self, payload: dict):
        self._post("/api/ai-observability/scores", payload)

    def resolve_prompt(self, slug: str, version: str = None, label: str = None, environment: str = None, state: str = None, cache_ttl_ms: float = None, fallback: dict = None) -> dict:
        params = {}
        if version:
            params["version"] = version
        if label:
            params["label"] = label
        if environment:
            params["environment"] = environment
        if state:
            params["state"] = state
        query = f"?{urlencode(params)}" if params else ""
        cache_key = f"{slug}{query}"
        ttl = (cache_ttl_ms / 1000.0) if cache_ttl_ms is not None else self.prompt_cache_ttl

        with self._prompt_cache_lock:
            cached = self._prompt_cache.get(cache_key)
        if cached and ttl > 0 and cached["expires_at"] > time.time():
            return cached["context"]

        try:
            body = self._get(f"/api/prompts/registry/{quote(slug)}/resolve{query}")
        except Exception as error:
            # Keep serving the last known good prompt when the API is unavailable.
            if cached:
                if self.debug:
                    print(f"[rabbittwatch] prompt resolve failed; serving stale cache for {slug}: {error}")
                return cached["context"]
            if fallback:
                if self.debug:
                    print(f"[rabbittwatch] prompt resolve failed; using inline fallback for {slug}: {error}")
                return {
                    "slug": slug,
                    "label": label,
                    "environment": environment,
                    "template": fallback.get("template"),
                    "systemPrompt": fallback.get("systemPrompt"),
                    "variables": fallback.get("variables"),
                    "version": fallback.get("version"),
                    "metadata": {"fallback": True},
                }
            raise

        prompt = body.get("prompt") or {}
        prompt_version = body.get("version") or {}
        context = {
            "templateId": str(prompt.get("_id") or prompt_version.get("templateId") or ""),
            "versionId": str(prompt_version.get("_id") or ""),
            "slug": prompt_version.get("slug") or prompt.get("slug") or slug,
            "version": prompt_version.get("version"),
            "label": label,
            "environment": prompt_version.get("environment") or environment,
            "state": prompt_version.get("state"),
            "contentHash": prompt_version.get("contentHash"),
            "hash": prompt_version.get("contentHash"),
            "template": prompt_version.get("template"),
            "systemPrompt": prompt_version.get("systemPrompt"),
            "variables": prompt_version.get("variables"),
            "metadata": {"prompt": prompt, "version": prompt_version},
        }
        with self._prompt_cache_lock:
            self._prompt_cache[cache_key] = {"context": context, "expires_at": time.time() + max(ttl, 0)}
        return context

    def flush(self):
        batch = []
        while not self.queue.empty() and len(batch) < self.max_batch_size:
            try:
                batch.append(self.queue.get_nowait())
            except queue.Empty:
                break
        
        if not batch:
            return

        # Run plugin on_flush hooks
        for envelope in batch:
            for plugin in self.plugins:
                try:
                    plugin.on_flush(envelope)
                except Exception as e:
                    if self.debug:
                        print(f"[rabbittwatch] Plugin {getattr(plugin, 'name', 'unknown')} error in on_flush: {e}")

        try:
            if len(batch) == 1:
                self.send(batch[0])
            else:
                self._post("/api/ai-observability/traces/batch", {"traces": batch})
        except Exception as e:
            if self.debug:
                print(f"[rabbittwatch] Telemetry flush failed: {e}")
            # Requeue items
            for item in reversed(batch):
                self.queue.put(item)

    def close(self):
        self.stop_event.set()
        if self.worker_thread:
            self.worker_thread.join(timeout=2.0)
        self.flush()

    def _worker_loop(self):
        while not self.stop_event.is_set():
            time.sleep(self.flush_interval)
            self.flush()

    def _post(self, path: str, body: dict):
        url = f"{self.endpoint}{path}"
        headers = {
            "Content-Type": "application/json",
            "X-Rabbittize-Ingest-Key": self.api_key
        }
        
        last_error = None
        for attempt in range(self.retries + 1):
            try:
                response = requests.post(url, json=body, headers=headers, timeout=10)
                if response.status_code >= 400:
                    raise Exception(f"RabbittWatch telemetry HTTP {response.status_code}: {response.text}")
                return
            except Exception as e:
                last_error = e
                if attempt < self.retries:
                    time.sleep(0.2 * (attempt + 1))
        
        if last_error:
            raise last_error

    def _get(self, path: str) -> dict:
        url = f"{self.endpoint}{path}"
        headers = {
            "Content-Type": "application/json",
            "X-Rabbittize-Ingest-Key": self.api_key
        }
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code >= 400:
            raise Exception(f"RabbittWatch prompt HTTP {response.status_code}: {response.text}")
        return response.json()

class RabbittWatchAI:
    def __init__(self, apiKey: str, endpoint: str = None, serviceName: str = "app", environment: str = "prod", captureInput: bool = False, captureOutput: bool = False, previewMaxChars: int = 102400, flushIntervalMs: float = 5000, maxBatchSize: int = 50, debug: bool = False, retries: int = 2, redactPatterns: list = None, customRedactFn = None, promptCacheTtlMs: float = 60000):
        if not apiKey:
            raise ValueError("RabbittWatchAI requires apiKey")
        
        self.options = {
            "apiKey": apiKey,
            "endpoint": endpoint,
            "serviceName": serviceName,
            "environment": environment,
            "captureInput": captureInput,
            "captureOutput": captureOutput,
            "previewMaxChars": previewMaxChars,
            "flushIntervalMs": flushIntervalMs,
            "maxBatchSize": maxBatchSize,
            "debug": debug,
            "retries": retries,
            "redactPatterns": redactPatterns or [],
            "customRedactFn": customRedactFn
        }
        
        self.client = TelemetryClient(
            api_key=apiKey,
            endpoint=endpoint,
            max_batch_size=maxBatchSize,
            flush_interval_ms=flushIntervalMs,
            debug=debug,
            retries=retries,
            prompt_cache_ttl_ms=promptCacheTtlMs
        )

        # Flush buffered traces on interpreter shutdown.
        import atexit
        atexit.register(self.client.close)

    def register_plugin(self, plugin):
        self.client.plugins.append(plugin)

    def inject_headers(self, headers: dict, context) -> dict:
        propagation = context.to_propagation_context()
        next_headers = {**headers}
        prompt = propagation.get("prompt") or {}
        tags = propagation.get("tags") or []
        _apply_header(next_headers, "x-rabbittize-trace-id", propagation.get("traceId"))
        _apply_header(next_headers, "x-rabbittize-span-id", propagation.get("spanId"))
        _apply_header(next_headers, "x-rabbittize-parent-span-id", propagation.get("parentSpanId"))
        _apply_header(next_headers, "x-rabbittize-session-id", propagation.get("sessionId"))
        _apply_header(next_headers, "x-rabbittize-end-user-id", propagation.get("endUserId"))
        _apply_header(next_headers, "x-rabbittize-release", propagation.get("release"))
        _apply_header(next_headers, "x-rabbittize-tags", ",".join(tags) if tags else None)
        _apply_header(next_headers, "x-rabbittize-prompt-slug", prompt.get("slug"))
        _apply_header(next_headers, "x-rabbittize-prompt-version", prompt.get("version"))
        _apply_header(next_headers, "x-rabbittize-prompt-label", prompt.get("label"))
        _apply_header(next_headers, "x-rabbittize-prompt-hash", prompt.get("hash") or prompt.get("contentHash"))
        _apply_header(next_headers, "x-opencode-session-id", propagation.get("sessionId"))
            
        return next_headers

    def extract_headers(self, headers: dict) -> dict:
        normalized_headers = {k.lower(): v for k, v in headers.items()}
        trace_id = _header_value(normalized_headers, "x-rabbittize-trace-id")
        parent_span_id = _header_value(normalized_headers, "x-rabbittize-parent-span-id") or _header_value(normalized_headers, "x-rabbittize-span-id")
        session_id = _header_value(normalized_headers, "x-rabbittize-session-id") or _header_value(normalized_headers, "x-opencode-session-id")
        raw_tags = _header_value(normalized_headers, "x-rabbittize-tags")
        
        metadata = {}
        if session_id:
            metadata["sessionId"] = session_id
            metadata["threadId"] = session_id
            
        return {
            "traceId": trace_id,
            "parentSpanId": parent_span_id,
            "sessionId": session_id,
            "endUserId": _header_value(normalized_headers, "x-rabbittize-end-user-id"),
            "release": _header_value(normalized_headers, "x-rabbittize-release"),
            "tags": [tag.strip() for tag in raw_tags.split(",") if tag.strip()] if raw_tags else None,
            "prompt": _prompt_from_headers(normalized_headers),
            "name": "propagated-trace",
            "metadata": metadata
        }

    def start_trace(self, name: str, **kwargs):
        from .trace import Trace
        trace_options = {
            "name": name,
            "traceId": kwargs.get("traceId"),
            "endpoint": kwargs.get("endpoint"),
            "serviceName": kwargs.get("serviceName"),
            "environment": kwargs.get("environment"),
            "sessionId": kwargs.get("sessionId"),
            "endUserId": kwargs.get("endUserId"),
            "release": kwargs.get("release"),
            "metadata": kwargs.get("metadata"),
            "tags": kwargs.get("tags"),
            "prompt": kwargs.get("prompt"),
        }
        return Trace(self.client, trace_options, self.options)

    def score(self, name: str, **kwargs):
        """Attach a score to a trace, span, request, session, or end user.

        Numeric via ``value``, boolean via ``bool_value``, categorical/text via
        ``string_value``.
        """
        span_id = kwargs.get("spanId") or kwargs.get("span_id")
        request_id = kwargs.get("requestId") or kwargs.get("request_id")
        session_id = kwargs.get("sessionId") or kwargs.get("session_id")
        end_user_id = kwargs.get("endUserId") or kwargs.get("end_user_id")
        target_type = kwargs.get("targetType") or kwargs.get("target_type")
        if not target_type:
            if span_id:
                target_type = "span"
            elif request_id:
                target_type = "request"
            elif session_id:
                target_type = "session"
            elif end_user_id:
                target_type = "end_user"
            else:
                target_type = "trace"

        bool_value = kwargs.get("boolValue")
        if bool_value is None:
            bool_value = kwargs.get("bool_value")
        string_value = kwargs.get("stringValue") or kwargs.get("string_value")
        value = kwargs.get("value")

        data_type = kwargs.get("dataType") or kwargs.get("data_type")
        if not data_type:
            if isinstance(bool_value, bool):
                data_type = "boolean"
            elif string_value is not None:
                data_type = "categorical"
            else:
                data_type = "numeric"

        self.client.post_score({
            "name": name,
            "targetType": target_type,
            "dataType": data_type,
            "traceId": kwargs.get("traceId") or kwargs.get("trace_id"),
            "spanId": span_id,
            "requestId": request_id,
            "sessionId": session_id,
            "endUserId": end_user_id,
            "score": value,
            "stringValue": string_value,
            "boolValue": bool_value,
            "comment": kwargs.get("comment"),
            "metadata": kwargs.get("metadata"),
            "source": "api",
        })

    def get_prompt(self, slug: str, **kwargs) -> dict:
        return self.client.resolve_prompt(
            slug,
            version=kwargs.get("version"),
            label=kwargs.get("label"),
            environment=kwargs.get("environment"),
            state=kwargs.get("state"),
            cache_ttl_ms=kwargs.get("cache_ttl_ms"),
            fallback=kwargs.get("fallback"),
        )

    def trace(self, name: str, **kwargs):
        from .trace import TraceContext
        return TraceContext(self, name, **kwargs)

    def trace_decorator(self, name: str = None, **decorator_kwargs):
        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args, **func_kwargs):
                trace_name = name or func.__name__
                trace_input = {"args": args, "kwargs": func_kwargs} if self.options.get("captureInput") else None
                from .trace import TraceContext
                with TraceContext(self, trace_name, input=trace_input, **decorator_kwargs) as trace:
                    result = func(*args, **func_kwargs)
                    return result
            return wrapper
        return decorator

    def flush(self):
        self.client.flush()

    def close(self):
        self.client.close()

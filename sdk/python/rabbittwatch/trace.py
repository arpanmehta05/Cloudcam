import time
import json
import re
from datetime import datetime

def generate_id(prefix: str) -> str:
    import random
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    t_base36 = ""
    t = int(time.time() * 1000)
    while t > 0:
        t_base36 = chars[t % 36] + t_base36
        t //= 36
    rand = "".join(random.choices(chars, k=12))
    return f"{prefix}_{t_base36}{rand}"

def get_prompt_hash(value) -> str:
    if value is None:
        return None
    if isinstance(value, str):
        raw = value
    else:
        try:
            raw = json.dumps(value, sort_keys=True)
        except Exception:
            raw = str(value)
    
    hash_val = 5381
    for char in raw:
        hash_val = ((hash_val << 5) + hash_val) & 0xFFFFFFFF
        hash_val = (hash_val ^ ord(char)) & 0xFFFFFFFF
    
    return f"djb2_{hash_val:x}"

def redact_text(text: str, config: dict = None) -> str:
    if not text:
        return text
    
    # 1. Default regex rules
    text = re.sub(r"sk-[A-Za-z0-9_-]{12,}", "sk_[redacted]", text)
    text = re.sub(r"AKIA[0-9A-Z]{16}", "AKIA[redacted]", text)
    text = re.sub(r"(api[_-]?key|authorization|password)[\"':=\s]+[^\",\s]+", r"\1=[redacted]", text, flags=re.IGNORECASE)
    
    # 2. Custom regex patterns
    if config and config.get("redactPatterns"):
        for pattern in config["redactPatterns"]:
            if isinstance(pattern, str):
                compiled = re.compile(pattern, re.IGNORECASE)
            else:
                compiled = pattern
            text = compiled.sub("[redacted]", text)
            
    # 3. Custom redact function
    if config and config.get("customRedactFn"):
        try:
            text = config["customRedactFn"](text)
        except Exception:
            pass
            
    return text

def deep_redact(value, config: dict = None, depth: int = 0):
    if depth > 20:
        return "[Max Depth Exceeded]"
    if value is None:
        return None

    if isinstance(value, str):
        return redact_text(value, config)

    if isinstance(value, list):
        return [deep_redact(item, config, depth + 1) for item in value]

    if isinstance(value, dict):
        result = {}
        sensitive_keys = {"api_key", "apikey", "api-key", "authorization", "password", "token", "secret"}
        for k, v in value.items():
            k_str = str(k).lower()
            if any(s in k_str for s in sensitive_keys):
                result[k] = "[redacted]"
            else:
                result[k] = deep_redact(v, config, depth + 1)
        return result

    return value

def metadata_string(metadata: dict, *keys):
    if not metadata:
        return None
    for key in keys:
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None

class TraceSpan:
    def __init__(self, trace, options: dict, config: dict):
        self.trace = trace
        self.config = config
        self.ended = False
        self.started_at = datetime.utcnow()
        self.first_token_at = None
        
        input_val = options.get("input")
        input_preview = None
        if config.get("captureInput"):
            sanitized_input = deep_redact(input_val, config)
            input_preview = self._stringify_preview(sanitized_input, config.get("previewMaxChars", 102400))
            if input_preview:
                input_preview = redact_text(input_preview, config)

        self.data = {
            "spanId": options.get("spanId") or generate_id("span"),
            "parentSpanId": options.get("parentSpanId"),
            "name": options.get("name"),
            "kind": options.get("kind", "llm"),
            "provider": options.get("provider"),
            "modelName": options.get("modelName") or options.get("model"),
            "sessionId": options.get("sessionId") or trace.context.get("sessionId"),
            "endUserId": options.get("endUserId") or trace.context.get("endUserId"),
            "status": "success",
            "startedAt": self.started_at.isoformat() + "Z",
            "promptTokens": 0,
            "completionTokens": 0,
            "totalTokens": 0,
            "inputPreview": input_preview,
            "promptHash": get_prompt_hash(input_val),
            "prompt": options.get("prompt"),
            "metadata": options.get("metadata") or {}
        }

        # Invoke plugin on_span_start
        plugins = getattr(self.trace.client, "plugins", [])
        for plugin in plugins:
            try:
                plugin.on_span_start(self, {**options})
            except Exception as e:
                if config.get("debug"):
                    print(f"[rabbittwatch] Plugin {getattr(plugin, 'name', 'unknown')} error in on_span_start: {e}")

    def _stringify_preview(self, value, max_chars: int):
        if value is None:
            return None
        if isinstance(value, str):
            raw = value
        else:
            try:
                raw = json.dumps(value)
            except Exception:
                raw = str(value)
        return raw[:max_chars]

    def first_token(self, at: datetime = None):
        """Mark the arrival of the first streamed output token (TTFT)."""
        if self.first_token_at is None:
            self.first_token_at = at or datetime.utcnow()

    def end(self, **kwargs):
        if self.ended:
            return
        self.ended = True
        ended_at = datetime.utcnow()
        duration_ms = int((ended_at - self.started_at).total_seconds() * 1000)

        completion_start = kwargs.get("completionStartTime") or kwargs.get("completion_start_time")
        if completion_start is None and self.first_token_at is not None:
            completion_start = self.first_token_at.isoformat() + "Z"
        elif isinstance(completion_start, datetime):
            completion_start = completion_start.isoformat() + "Z"
        
        output_val = kwargs.get("output")
        output_preview = None
        if self.config.get("captureOutput"):
            sanitized_output = deep_redact(output_val, self.config)
            output_preview = self._stringify_preview(sanitized_output, self.config.get("previewMaxChars", 102400))
            if output_preview:
                output_preview = redact_text(output_preview, self.config)

        usage = self._extract_usage(output_val)
        prompt_tokens = kwargs.get("promptTokens") or kwargs.get("prompt_tokens") or usage.get("promptTokens", 0)
        completion_tokens = kwargs.get("completionTokens") or kwargs.get("completion_tokens") or usage.get("completionTokens", 0)
        total_tokens = kwargs.get("totalTokens") or kwargs.get("total_tokens") or usage.get("totalTokens") or (prompt_tokens + completion_tokens)

        meta = {**self.data.get("metadata", {}), **(kwargs.get("metadata") or {})}
        
        error_val = kwargs.get("error")
        error_msg = kwargs.get("errorMessage") or kwargs.get("error_message")
        if error_val and not error_msg:
            if isinstance(error_val, Exception):
                error_msg = str(error_val)
            else:
                error_msg = repr(error_val)

        status = kwargs.get("status")
        if not status:
            status = "error" if (error_val or error_msg) else "success"

        self.data.update({
            "status": status,
            "endedAt": ended_at.isoformat() + "Z",
            "durationMs": duration_ms,
            "completionStartTime": completion_start,
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "totalTokens": total_tokens,
            "cost": kwargs.get("cost"),
            "errorMessage": error_msg,
            "outputPreview": output_preview,
            "metadata": meta
        })
        self.trace.add_span(self.data)

        # Invoke plugin on_span_end
        plugins = getattr(self.trace.client, "plugins", [])
        for plugin in plugins:
            try:
                plugin.on_span_end(self, kwargs)
            except Exception as e:
                if self.config.get("debug"):
                    print(f"[rabbittwatch] Plugin {getattr(plugin, 'name', 'unknown')} error in on_span_end: {e}")

    def _extract_usage(self, output):
        if not output:
            return {}
        
        if isinstance(output, dict):
            usage = output.get("usage")
            if isinstance(usage, dict):
                return {
                    "promptTokens": usage.get("prompt_tokens") or usage.get("input_tokens") or 0,
                    "completionTokens": usage.get("completion_tokens") or usage.get("output_tokens") or 0,
                    "totalTokens": usage.get("total_tokens") or 0
                }
            token_usage = output.get("token_usage") or output.get("tokenUsage")
            if isinstance(token_usage, dict):
                return {
                    "promptTokens": token_usage.get("prompt_tokens") or token_usage.get("promptTokens") or token_usage.get("input_tokens") or 0,
                    "completionTokens": token_usage.get("completion_tokens") or token_usage.get("completionTokens") or token_usage.get("output_tokens") or 0,
                    "totalTokens": token_usage.get("total_tokens") or token_usage.get("totalTokens") or 0
                }
        
        usage = getattr(output, "usage", None)
        if usage:
            return {
                "promptTokens": getattr(usage, "prompt_tokens", 0) or getattr(usage, "input_tokens", 0),
                "completionTokens": getattr(usage, "completion_tokens", 0) or getattr(usage, "output_tokens", 0),
                "totalTokens": getattr(usage, "total_tokens", 0)
            }
        
        return {}

    @property
    def span_id(self):
        return self.data["spanId"]

    def to_propagation_context(self) -> dict:
        context = {**self.trace.to_propagation_context()}
        context["spanId"] = self.data.get("spanId")
        context["parentSpanId"] = self.data.get("spanId")
        return context

class TraceSpanContext:
    def __init__(self, trace, name: str, **kwargs):
        self.trace = trace
        self.name = name
        self.kwargs = kwargs
        self.span = None

    def __enter__(self):
        span_options = {
            "name": self.name,
            "spanId": self.kwargs.get("spanId"),
            "parentSpanId": self.kwargs.get("parentSpanId"),
            "kind": self.kwargs.get("kind", "llm"),
            "provider": self.kwargs.get("provider"),
            "modelName": self.kwargs.get("modelName") or self.kwargs.get("model"),
            "input": self.kwargs.get("input"),
            "metadata": self.kwargs.get("metadata"),
            "prompt": self.kwargs.get("prompt"),
            "sessionId": self.kwargs.get("sessionId"),
            "endUserId": self.kwargs.get("endUserId"),
        }
        self.span = self.trace.start_span(span_options)
        return self.span

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.span.end(error=exc_val)
        else:
            self.span.end()
        return False

class Trace:
    def __init__(self, client, options: dict, config: dict):
        self.client = client
        self.options = options
        self.config = config
        self.trace_id = options.get("traceId") or generate_id("trace")
        self.spans = []
        self.started_at = datetime.utcnow()
        self.flushed = False

        # Invoke plugin on_trace_start
        plugins = getattr(self.client, "plugins", [])
        for plugin in plugins:
            try:
                plugin.on_trace_start(self, {**options})
            except Exception as e:
                if config.get("debug"):
                    print(f"[rabbittwatch] Plugin {getattr(plugin, 'name', 'unknown')} error in on_trace_start: {e}")

    def start_span(self, options: dict) -> TraceSpan:
        return TraceSpan(self, options, self.config)

    def span(self, name: str, **kwargs) -> TraceSpanContext:
        return TraceSpanContext(self, name, **kwargs)

    def add_span(self, span_data: dict):
        self.spans.append(span_data)

    def to_envelope(self) -> dict:
        ended_at = datetime.utcnow()
        return {
            "trace": {
                "traceId": self.trace_id,
                "name": self.options.get("name"),
                "serviceName": self.options.get("serviceName") or self.config.get("serviceName") or "app",
                "endpoint": self.options.get("endpoint"),
                "environment": self.options.get("environment") or self.config.get("environment") or "prod",
                "sessionId": self.options.get("sessionId"),
                "endUserId": self.options.get("endUserId"),
                "release": self.options.get("release"),
                "startedAt": self.started_at.isoformat() + "Z",
                "endedAt": ended_at.isoformat() + "Z",
                "metadata": self.options.get("metadata"),
                "tags": self.options.get("tags") or [],
                "prompt": self.options.get("prompt"),
            },
            "spans": self.spans,
        }

    @property
    def context(self) -> dict:
        metadata = self.options.get("metadata") or {}
        return {
            "traceId": self.trace_id,
            "sessionId": self.options.get("sessionId") or metadata_string(metadata, "sessionId", "threadId"),
            "endUserId": self.options.get("endUserId") or metadata_string(metadata, "endUserId", "userId"),
            "release": self.options.get("release"),
            "tags": self.options.get("tags"),
            "prompt": self.options.get("prompt"),
        }

    def to_propagation_context(self) -> dict:
        return self.context

    def flush(self):
        if self.flushed:
            return
        self.flushed = True
        self.client.enqueue(self.to_envelope())

        # Invoke plugin on_trace_end
        plugins = getattr(self.client, "plugins", [])
        for plugin in plugins:
            try:
                plugin.on_trace_end(self)
            except Exception as e:
                if self.config.get("debug"):
                    print(f"[rabbittwatch] Plugin {getattr(plugin, 'name', 'unknown')} error in on_trace_end: {e}")

        self.client.flush()

class TraceContext:
    def __init__(self, rw_ai, name: str, **kwargs):
        self.rw_ai = rw_ai
        self.name = name
        self.kwargs = kwargs
        self.trace = None
        self.span = None

    def __enter__(self):
        self.trace = self.rw_ai.start_trace(self.name, **self.kwargs)
        self.span = self.trace.start_span({
            "name": self.name,
            "kind": "chain",
            "provider": self.kwargs.get("provider"),
            "model": self.kwargs.get("model"),
            "input": self.kwargs.get("input"),
            "metadata": self.kwargs.get("metadata"),
            "prompt": self.kwargs.get("prompt"),
            "sessionId": self.kwargs.get("sessionId"),
            "endUserId": self.kwargs.get("endUserId"),
        })
        return self.trace

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.span.end(error=exc_val)
        else:
            self.span.end()
        self.trace.flush()
        return False

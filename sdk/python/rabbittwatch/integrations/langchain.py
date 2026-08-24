import json

try:
    from langchain_core.tracers.base import BaseTracer
    from langchain_core.tracers.schemas import Run
    HAS_LANGCHAIN = True
except ImportError:
    class BaseTracer:
        pass
    class Run:
        pass
    HAS_LANGCHAIN = False

class RabbittWatchLangChainTracer(BaseTracer):
    def __init__(self, rw_ai, environment="prod", service_name="app", tags=None):
        if not HAS_LANGCHAIN:
            raise ImportError("langchain-core is required to use RabbittWatchLangChainTracer. Install it using pip install langchain-core")
        super().__init__()
        self.rw_ai = rw_ai
        self.environment = environment
        self.service_name = service_name
        self.tags = tags or []

    def _persist_run(self, run: Run) -> None:
        spans = []
        self._collect_spans(run, None, spans)
        
        started_at = run.start_time.isoformat() + "Z" if run.start_time else None
        ended_at = run.end_time.isoformat() + "Z" if run.end_time else None
        
        envelope = {
            "trace": {
                "traceId": str(run.id),
                "name": run.name,
                "serviceName": self.service_name,
                "environment": self.environment,
                "startedAt": started_at,
                "endedAt": ended_at,
                "tags": self.tags,
            },
            "spans": spans,
        }
        
        self.rw_ai.client.enqueue(envelope)
        self.rw_ai.client.flush()

    def _collect_spans(self, run: Run, parent_span_id, spans: list):
        started_at = run.start_time.isoformat() + "Z" if run.start_time else None
        ended_at = run.end_time.isoformat() + "Z" if run.end_time else None
        duration_ms = int((run.end_time - run.start_time).total_seconds() * 1000) if (run.end_time and run.start_time) else 0
        
        kind = "custom"
        if run.run_type == "llm":
            kind = "llm"
        elif run.run_type == "chain":
            kind = "chain"
        elif run.run_type == "tool":
            kind = "tool"
            
        prompt_tokens, completion_tokens, total_tokens = self._get_tokens(run)
        
        capture_input = self.rw_ai.options.get("captureInput", False)
        capture_output = self.rw_ai.options.get("captureOutput", False)
        max_chars = self.rw_ai.options.get("previewMaxChars", 102400)
        
        input_preview = None
        if capture_input and run.inputs:
            input_preview = json.dumps(run.inputs)[:max_chars]
            
        output_preview = None
        if capture_output and run.outputs:
            output_preview = json.dumps(run.outputs)[:max_chars]
            
        provider = None
        model = None
        if run.extra:
            metadata = run.extra.get("metadata") or {}
            invocation_params = run.extra.get("invocation_params") or {}
            provider = metadata.get("ls_provider") or invocation_params.get("_type")
            model = metadata.get("ls_model_name") or invocation_params.get("model_name") or invocation_params.get("model")

        spans.append({
            "spanId": str(run.id),
            "parentSpanId": str(parent_span_id) if parent_span_id else None,
            "name": run.name,
            "kind": kind,
            "provider": provider,
            "model": model,
            "status": "error" if run.error else "success",
            "startedAt": started_at,
            "endedAt": ended_at,
            "durationMs": duration_ms,
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "totalTokens": total_tokens,
            "errorMessage": run.error,
            "inputPreview": input_preview,
            "outputPreview": output_preview,
            "metadata": {
                "run_type": run.run_type,
                "extra": run.extra,
            }
        })
        
        if run.child_runs:
            for child in run.child_runs:
                self._collect_spans(child, run.id, spans)

    def _get_tokens(self, run: Run):
        prompt_tokens = 0
        completion_tokens = 0
        if run.run_type == "llm" and run.outputs:
            generations = run.outputs.get("generations")
            token_usage = None
            if generations and len(generations) > 0 and len(generations[0]) > 0:
                gen_info = generations[0][0].get("generation_info") or {}
                token_usage = gen_info.get("token_usage") or gen_info.get("usage_metadata")
            
            if not token_usage and run.outputs.get("llm_output"):
                token_usage = run.outputs.get("llm_output", {}).get("token_usage")
                
            if token_usage:
                prompt_tokens = token_usage.get("prompt_tokens") or token_usage.get("input_tokens") or token_usage.get("promptTokens") or 0
                completion_tokens = token_usage.get("completion_tokens") or token_usage.get("output_tokens") or token_usage.get("completionTokens") or 0
                
        return prompt_tokens, completion_tokens, prompt_tokens + completion_tokens

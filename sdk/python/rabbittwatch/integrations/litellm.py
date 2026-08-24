class RabbittWatchLiteLLMHandler:
    def __init__(self, rw_ai):
        self.rw_ai = rw_ai

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        metadata = kwargs.get("metadata") or {}
        trace_id = metadata.get("traceId") or metadata.get("trace_id")
        trace_name = metadata.get("traceName") or metadata.get("trace_name") or f"litellm.{kwargs.get('model', 'completion')}"
        
        model = kwargs.get("model")
        messages = kwargs.get("messages")
        
        trace = self.rw_ai.start_trace(
            name=trace_name,
            traceId=trace_id,
            metadata={
                "litellm_call_id": kwargs.get("litellm_call_id"),
                "user": kwargs.get("user")
            }
        )
        
        span = trace.start_span({
            "name": trace_name,
            "kind": "llm",
            "provider": "custom",
            "modelName": model,
            "input": messages,
        })
        
        usage = {}
        if response_obj:
            if hasattr(response_obj, "usage"):
                u = response_obj.usage
                if u:
                    usage = {
                        "promptTokens": getattr(u, "prompt_tokens", 0) or getattr(u, "input_tokens", 0),
                        "completionTokens": getattr(u, "completion_tokens", 0) or getattr(u, "output_tokens", 0),
                        "totalTokens": getattr(u, "total_tokens", 0)
                    }
            elif isinstance(response_obj, dict):
                u = response_obj.get("usage")
                if isinstance(u, dict):
                    usage = {
                        "promptTokens": u.get("prompt_tokens") or u.get("input_tokens") or 0,
                        "completionTokens": u.get("completion_tokens") or u.get("output_tokens") or 0,
                        "totalTokens": u.get("total_tokens") or 0
                    }
        
        span.end(
            status="success",
            output=response_obj,
            **usage
        )
        trace.flush()

    def log_failure_event(self, kwargs, exception, start_time, end_time):
        metadata = kwargs.get("metadata") or {}
        trace_id = metadata.get("traceId") or metadata.get("trace_id")
        trace_name = metadata.get("traceName") or metadata.get("trace_name") or f"litellm.{kwargs.get('model', 'completion')}.error"
        
        model = kwargs.get("model")
        messages = kwargs.get("messages")
        
        trace = self.rw_ai.start_trace(
            name=trace_name,
            traceId=trace_id,
            metadata={
                "litellm_call_id": kwargs.get("litellm_call_id"),
                "user": kwargs.get("user")
            }
        )
        
        span = trace.start_span({
            "name": trace_name,
            "kind": "llm",
            "provider": "custom",
            "modelName": model,
            "input": messages,
        })
        
        span.end(
            status="error",
            error=exception,
        )
        trace.flush()

def register_litellm(rw_ai):
    try:
        import litellm
        handler = RabbittWatchLiteLLMHandler(rw_ai)
        if not hasattr(litellm, "success_callback"):
            litellm.success_callback = []
        if not hasattr(litellm, "failure_callback"):
            litellm.failure_callback = []
            
        litellm.success_callback.append(handler.log_success_event)
        litellm.failure_callback.append(handler.log_failure_event)
        return handler
    except ImportError:
        # LiteLLM not installed, ignore or log
        if rw_ai.options.get("debug"):
            print("[rabbittwatch] LiteLLM not installed, cannot register callback.")
        return None

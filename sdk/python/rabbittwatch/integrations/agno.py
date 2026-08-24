class RabbittWatchAgno:
    def __init__(self, rw_ai):
        self.rw_ai = rw_ai

    def instrument_agent(self, agent, agent_name=None):
        """
        Wraps an Agno Agent instance run method to capture prompts, completions, and token usage metrics.
        """
        name = agent_name or f"Agno Agent: {getattr(agent, 'name', 'Agent')}"
        original_run = getattr(agent, "run", None)
        if not original_run:
            return agent

        def wrapped_run(*args, **kwargs):
            prompt = args[0] if args else kwargs.get("message")
            
            trace = self.rw_ai.start_trace(name)
            span = trace.start_span({
                "name": name,
                "kind": "chain",
                "input": prompt,
                "model": getattr(agent, "model", None) or getattr(agent, "llm", None)
            })
            
            try:
                response = original_run(*args, **kwargs)
                content = getattr(response, "content", str(response))
                
                prompt_tokens = 0
                completion_tokens = 0
                metrics = getattr(response, "metrics", None)
                if metrics:
                    if isinstance(metrics, dict):
                        prompt_tokens = metrics.get("prompt_tokens") or metrics.get("input_tokens") or 0
                        completion_tokens = metrics.get("completion_tokens") or metrics.get("output_tokens") or 0
                    else:
                        prompt_tokens = getattr(metrics, "prompt_tokens", 0) or getattr(metrics, "input_tokens", 0)
                        completion_tokens = getattr(metrics, "completion_tokens", 0) or getattr(metrics, "output_tokens", 0)
                
                span.end(
                    status="success",
                    output=content,
                    promptTokens=prompt_tokens,
                    completionTokens=completion_tokens
                )
                return response
            except Exception as e:
                span.end(status="error", error=e)
                raise e
            finally:
                trace.flush()
                setattr(agent, "run", original_run)
                
        setattr(agent, "run", wrapped_run)
        return agent

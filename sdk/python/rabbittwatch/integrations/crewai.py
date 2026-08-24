class RabbittWatchCrewAI:
    def __init__(self, rw_ai):
        self.rw_ai = rw_ai

    def trace_crew(self, crew, trace_name=None):
        """
        Dynamically wraps a CrewAI Crew instance kickoff method to capture tasks and execution flow.
        """
        name = trace_name or f"CrewAI: {getattr(crew, 'name', 'Crew Run')}"
        original_kickoff = getattr(crew, "kickoff", None)
        if not original_kickoff:
            return crew

        def wrapped_kickoff(*args, **kwargs):
            trace = self.rw_ai.start_trace(name)
            root_span = trace.start_span({
                "name": name,
                "kind": "chain",
                "input": {"args": args, "kwargs": kwargs}
            })
            
            original_task_callback = getattr(crew, "task_callback", None)
            task_spans = {}
            
            def rw_task_callback(task_output):
                task_desc = getattr(task_output, "description", "Task")
                span = task_spans.get(task_desc)
                if span:
                    span.end(output=getattr(task_output, "raw", str(task_output)))
                else:
                    span = trace.start_span({
                        "name": f"Task: {task_desc[:50]}",
                        "kind": "chain",
                    })
                    span.end(output=getattr(task_output, "raw", str(task_output)))
                
                if original_task_callback:
                    try:
                        original_task_callback(task_output)
                    except Exception:
                        pass
                    
            crew.task_callback = rw_task_callback
            
            # Pre-start task spans
            for task in getattr(crew, "tasks", []):
                task_desc = getattr(task, "description", "Task")
                agent_role = getattr(getattr(task, "agent", None), "role", "unknown") if hasattr(task, "agent") else "unknown"
                span = trace.start_span({
                    "name": f"Task: {task_desc[:50]}",
                    "kind": "chain",
                    "input": task_desc,
                    "metadata": {
                        "agent_role": agent_role
                    }
                })
                task_spans[task_desc] = span
                
            try:
                result = original_kickoff(*args, **kwargs)
                root_span.end(output=str(result))
                return result
            except Exception as e:
                root_span.end(status="error", error=e)
                raise e
            finally:
                trace.flush()
                # Restore original callbacks/methods
                setattr(crew, "kickoff", original_kickoff)
                if original_task_callback:
                    setattr(crew, "task_callback", original_task_callback)
                    
        setattr(crew, "kickoff", wrapped_kickoff)
        return crew

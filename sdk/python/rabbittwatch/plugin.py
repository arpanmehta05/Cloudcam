class RabbittWatchPlugin:
    def __init__(self, name: str):
        self.name = name

    def on_trace_start(self, trace, options: dict) -> None:
        pass

    def on_trace_end(self, trace) -> None:
        pass

    def on_span_start(self, span, options: dict) -> None:
        pass

    def on_span_end(self, span, options: dict) -> None:
        pass

    def on_flush(self, envelope: dict) -> None:
        pass

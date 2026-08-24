import { Trace, TraceSpan } from "./trace.js";
import { TraceOptions, SpanOptions, SpanEndOptions, TraceEnvelope } from "./types.js";

export interface RabbittWatchAIPlugin {
    name: string;
    onTraceStart?(trace: Trace, options: TraceOptions): void;
    onTraceEnd?(trace: Trace): void;
    onSpanStart?(span: TraceSpan, options: SpanOptions): void;
    onSpanEnd?(span: TraceSpan, options: SpanEndOptions): void;
    onFlush?(envelope: TraceEnvelope): void;
}

"""OpenAI-style streaming with TTFT capture, prompt resolve, and score helpers.

Run: RABBITTWATCH_API_KEY=... python examples/streaming_and_scores.py
"""
import os
import time

from rabbittwatch.client import RabbittWatchAI


def fake_openai_stream():
    for token in ["Hello", ",", " world", "!"]:
        time.sleep(0.04)
        yield {"choices": [{"delta": {"content": token}}]}


def main():
    rw = RabbittWatchAI(
        apiKey=os.environ.get("RABBITTWATCH_API_KEY", "demo-key"),
        endpoint=os.environ.get("RABBITTWATCH_ENDPOINT"),
        serviceName="python-streaming-example",
        captureOutput=True,
    )

    # Prompt resolve with cache + inline fallback.
    prompt = rw.get_prompt(
        "support-answer",
        label="production",
        fallback={"template": "Answer: {{question}}"},
    )

    trace = rw.start_trace("chat.stream", sessionId="sess-9", endUserId="user-3", prompt=prompt)
    span = trace.start_span({"name": "openai.chat", "kind": "llm", "provider": "openai", "model": "gpt-4o"})

    output = ""
    first_seen = False
    for chunk in fake_openai_stream():
        delta = chunk["choices"][0]["delta"].get("content")
        if delta:
            if not first_seen:
                span.first_token()  # record TTFT
                first_seen = True
            output += delta

    span.end(status="success", output=output, promptTokens=12, completionTokens=4)
    trace.flush()

    # Numeric score attached to the trace.
    try:
        rw.score("helpfulness", trace_id=trace.trace_id, value=88, comment="fast and correct")
    except Exception as error:  # noqa: BLE001
        print("score failed:", error)

    rw.close()
    print("Streamed output:", output)


if __name__ == "__main__":
    main()

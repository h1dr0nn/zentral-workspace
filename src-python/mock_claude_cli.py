#!/usr/bin/env python3
"""
Mock Claude CLI — drop-in replacement for testing agent spawning.

Usage:
    python mock_claude_cli.py -p --output-format stream-json [options]

Modes:
    --mock-mode echo      Echo back the stdin input (default)
    --mock-mode lorem     Generate lorem ipsum response
    --mock-mode code      Generate a fake code snippet
    --mock-mode error     Simulate CLI error (exit 1)
    --mock-mode timeout   Hang indefinitely (test timeout handling)
    --mock-mode tool_use  Simulate tool invocation sequence

The script reads stdin, then streams NDJSON to stdout matching the
exact protocol from the streaming-protocol spec.
"""

import sys
import json
import time
import uuid
import random
import argparse

LOREM_PARAGRAPHS = [
    "This is a simulated response from the mock Claude CLI agent. "
    "It demonstrates how text streaming works in the Zentral application.",
    "The response is broken into multiple delta events to simulate "
    "realistic streaming behavior with configurable delay between chunks.",
    "Each content_block_delta event contains a small fragment of text "
    "that the frontend appends to the chat message in real time.",
]

CODE_SNIPPET = '''\
fn fibonacci(n: u64) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn main() {
    for i in 0..10 {
        println!("fib({}) = {}", i, fibonacci(i));
    }
}
'''


def emit(obj: dict) -> None:
    """Write a JSON line to stdout and flush."""
    print(json.dumps(obj), flush=True)


def emit_system(session_id: str) -> None:
    emit({
        "type": "system",
        "subtype": "init",
        "session_id": session_id,
    })


def emit_content_block_start(index: int, block_type: str = "text", **kwargs) -> None:
    block = {"type": block_type, "text": ""}
    block.update(kwargs)
    emit({
        "type": "content_block_start",
        "index": index,
        "content_block": block,
    })


def emit_text_delta(index: int, text: str) -> None:
    emit({
        "type": "content_block_delta",
        "index": index,
        "delta": {"type": "text_delta", "text": text},
    })


def emit_input_json_delta(index: int, partial_json: str) -> None:
    emit({
        "type": "content_block_delta",
        "index": index,
        "delta": {"type": "input_json_delta", "partial_json": partial_json},
    })


def emit_content_block_stop(index: int) -> None:
    emit({"type": "content_block_stop", "index": index})


def emit_assistant(full_text: str) -> None:
    emit({
        "type": "assistant",
        "message": {
            "content": [{"type": "text", "text": full_text}]
        },
    })


def emit_result(full_text: str, session_id: str, input_tokens: int, output_tokens: int) -> None:
    cost = round(input_tokens * 0.000003 + output_tokens * 0.000015, 6)
    emit({
        "type": "result",
        "message": {
            "content": [{"type": "text", "text": full_text}]
        },
        "session_id": session_id,
        "cost": cost,
        "usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        },
    })


def stream_text(text: str, session_id: str, delay: float, index: int = 0) -> None:
    """Stream text as a series of delta events."""
    emit_content_block_start(index)

    # Split text into word-based chunks
    words = text.split(" ")
    chunks = []
    current = ""
    for word in words:
        current += (" " if current else "") + word
        if len(current) >= 15 or random.random() < 0.3:
            chunks.append(current)
            current = ""
    if current:
        chunks.append(current)

    for chunk in chunks:
        emit_text_delta(index, chunk)
        time.sleep(delay)

    emit_content_block_stop(index)
    return text


def mode_echo(user_input: str, session_id: str, delay: float) -> None:
    response = f"[Echo] You said: {user_input}"
    full_text = stream_text(response, session_id, delay)
    emit_assistant(full_text)
    emit_result(full_text, session_id, len(user_input.split()), len(full_text.split()))


def mode_lorem(user_input: str, session_id: str, delay: float) -> None:
    response = "\n\n".join(LOREM_PARAGRAPHS)
    full_text = stream_text(response, session_id, delay)
    emit_assistant(full_text)
    emit_result(full_text, session_id, len(user_input.split()), len(full_text.split()))


def mode_code(user_input: str, session_id: str, delay: float) -> None:
    intro = "Here's a Fibonacci implementation in Rust:\n\n```rust\n"
    outro = "\n```\n\nThis uses pattern matching for the base cases."
    response = intro + CODE_SNIPPET + outro
    full_text = stream_text(response, session_id, delay)
    emit_assistant(full_text)
    emit_result(full_text, session_id, len(user_input.split()), len(full_text.split()))


def mode_error(_user_input: str, _session_id: str, _delay: float) -> None:
    print("Error: Mock error mode activated. Authentication failed.", file=sys.stderr)
    sys.exit(1)


def mode_timeout(_user_input: str, _session_id: str, _delay: float) -> None:
    print("Mock: entering infinite hang (timeout test)", file=sys.stderr)
    while True:
        time.sleep(60)


def mode_tool_use(user_input: str, session_id: str, delay: float) -> None:
    # First: stream some intro text
    intro = "Let me read that file for you."
    stream_text(intro, session_id, delay, index=0)

    # Second: tool_use block
    emit_content_block_start(
        1,
        block_type="tool_use",
        id=f"toolu_{uuid.uuid4().hex[:12]}",
        name="Read",
        input={},
    )
    emit_input_json_delta(1, '{"file_path":')
    time.sleep(delay)
    emit_input_json_delta(1, '"/src/main.rs"}')
    time.sleep(delay)
    emit_content_block_stop(1)

    # Third: stream result text
    result_text = "The file contains the main entry point for the application."
    stream_text(result_text, session_id, delay, index=2)

    full_text = intro + "\n\n" + result_text
    emit_assistant(full_text)
    emit_result(full_text, session_id, len(user_input.split()), len(full_text.split()))


MODES = {
    "echo": mode_echo,
    "lorem": mode_lorem,
    "code": mode_code,
    "error": mode_error,
    "timeout": mode_timeout,
    "tool_use": mode_tool_use,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Mock Claude CLI for Zentral development")
    parser.add_argument("-p", action="store_true", help="Prompt mode (read stdin)")
    parser.add_argument("--output-format", default="stream-json")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--resume", type=str, default=None, help="Resume session ID")
    parser.add_argument("--system-prompt", type=str, default=None)
    parser.add_argument("--model", type=str, default=None)
    parser.add_argument("--mock-mode", type=str, default="echo", choices=MODES.keys())
    parser.add_argument("--mock-delay", type=float, default=0.05, help="Delay between deltas (seconds)")

    args = parser.parse_args()

    # Log received flags to stderr for debugging
    print(f"Mock CLI started: mode={args.mock_mode}, delay={args.mock_delay}s", file=sys.stderr)
    if args.resume:
        print(f"  --resume {args.resume}", file=sys.stderr)
    if args.system_prompt:
        print(f"  --system-prompt {args.system_prompt[:80]}...", file=sys.stderr)
    if args.model:
        print(f"  --model {args.model}", file=sys.stderr)

    # Read all stdin
    user_input = sys.stdin.read().strip()
    print(f"  stdin: {user_input[:100]}{'...' if len(user_input) > 100 else ''}", file=sys.stderr)

    # Session ID
    session_id = args.resume or f"sess_{uuid.uuid4().hex[:12]}"

    # Emit system init
    emit_system(session_id)

    # Run the selected mode
    handler = MODES[args.mock_mode]
    handler(user_input, session_id, args.mock_delay)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
NDJSON Stream Validator — validates Claude CLI streaming output.

Usage:
    claude -p "hello" --output-format stream-json | python stream_validator.py
    python stream_validator.py --replay captured_output.ndjson
    python stream_validator.py --generate > example.ndjson

Validates:
    - Each line is valid JSON
    - Every object has a "type" field
    - Event sequence: system first, result last
    - Required fields per event type
    - Prints stats at the end
"""

import sys
import json
import time
import argparse

try:
    from colorama import init as colorama_init, Fore, Style
    colorama_init()
except ImportError:
    # Graceful fallback if colorama not installed
    class Fore:
        GREEN = RED = YELLOW = CYAN = RESET = ""
    class Style:
        BRIGHT = RESET_ALL = ""

REQUIRED_FIELDS = {
    "system": ["subtype"],
    "content_block_start": ["index", "content_block"],
    "content_block_delta": ["index", "delta"],
    "content_block_stop": ["index"],
    "assistant": ["message"],
    "result": ["session_id"],
}

KNOWN_TYPES = {"system", "content_block_start", "content_block_delta",
               "content_block_stop", "assistant", "result"}


def ok(msg: str) -> None:
    print(f"{Fore.GREEN}  OK{Fore.RESET}  {msg}")


def warn(msg: str) -> None:
    print(f"{Fore.YELLOW}WARN{Fore.RESET}  {msg}")


def err(msg: str) -> None:
    print(f"{Fore.RED} ERR{Fore.RESET}  {msg}")


def validate_stream(lines: list[str], strict: bool = False) -> bool:
    errors = 0
    warnings = 0
    type_counts: dict[str, int] = {}
    total_text = ""
    session_id = None
    cost = None
    usage = None
    seen_system = False
    seen_result = False
    active_blocks: dict[int, str] = {}  # index -> block type
    start_time = time.time()

    print(f"\n{Style.BRIGHT}Validating {len(lines)} lines...{Style.RESET_ALL}\n")

    for i, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue

        # Parse JSON
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            err(f"Line {i}: Invalid JSON — {e}")
            errors += 1
            continue

        # Check type field
        event_type = obj.get("type")
        if not event_type:
            err(f"Line {i}: Missing 'type' field")
            errors += 1
            continue

        type_counts[event_type] = type_counts.get(event_type, 0) + 1

        # Unknown type
        if event_type not in KNOWN_TYPES:
            warn(f"Line {i}: Unknown event type '{event_type}'")
            warnings += 1
            continue

        # Sequence checks
        if event_type == "system":
            if seen_system:
                warn(f"Line {i}: Duplicate 'system' event")
                warnings += 1
            seen_system = True
            session_id = obj.get("session_id", session_id)
            ok(f"Line {i}: system (session={obj.get('session_id', 'N/A')})")

        elif not seen_system and event_type != "system":
            warn(f"Line {i}: '{event_type}' before 'system' event")
            warnings += 1

        if event_type == "result":
            seen_result = True
            cost = obj.get("cost")
            usage = obj.get("usage")
            session_id = obj.get("session_id", session_id)

        # Required fields
        required = REQUIRED_FIELDS.get(event_type, [])
        for field in required:
            if field not in obj:
                err(f"Line {i}: '{event_type}' missing required field '{field}'")
                errors += 1

        # Block tracking
        if event_type == "content_block_start":
            idx = obj.get("index")
            block = obj.get("content_block", {})
            block_type = block.get("type", "unknown")
            active_blocks[idx] = block_type
            ok(f"Line {i}: content_block_start index={idx} type={block_type}")

        elif event_type == "content_block_delta":
            idx = obj.get("index")
            delta = obj.get("delta", {})
            delta_type = delta.get("type", "unknown")

            if idx not in active_blocks:
                warn(f"Line {i}: Delta for index={idx} without prior start")
                warnings += 1

            if delta_type == "text_delta":
                text = delta.get("text", "")
                total_text += text
                ok(f"Line {i}: text_delta index={idx} len={len(text)}")
            elif delta_type == "input_json_delta":
                ok(f"Line {i}: input_json_delta index={idx}")
            else:
                warn(f"Line {i}: Unknown delta type '{delta_type}'")
                warnings += 1

        elif event_type == "content_block_stop":
            idx = obj.get("index")
            if idx in active_blocks:
                del active_blocks[idx]
            else:
                warn(f"Line {i}: Stop for index={idx} without active block")
                warnings += 1
            ok(f"Line {i}: content_block_stop index={idx}")

        elif event_type == "assistant":
            ok(f"Line {i}: assistant message")

        elif event_type == "result":
            ok(f"Line {i}: result (session={session_id})")

    # Check unclosed blocks
    if active_blocks:
        for idx, btype in active_blocks.items():
            err(f"Unclosed content block: index={idx} type={btype}")
            errors += 1

    # Stats
    elapsed = time.time() - start_time
    print(f"\n{Style.BRIGHT}{'=' * 50}")
    print(f"Stream Validation Summary")
    print(f"{'=' * 50}{Style.RESET_ALL}")
    print(f"  Total lines:    {len(lines)}")
    print(f"  Event types:    {dict(sorted(type_counts.items()))}")
    print(f"  Total text:     {len(total_text)} chars")
    print(f"  Session ID:     {session_id or 'N/A'}")
    print(f"  Cost:           {cost or 'N/A'}")
    if usage:
        print(f"  Input tokens:   {usage.get('input_tokens', 'N/A')}")
        print(f"  Output tokens:  {usage.get('output_tokens', 'N/A')}")
    print(f"  Errors:         {Fore.RED if errors else Fore.GREEN}{errors}{Fore.RESET}")
    print(f"  Warnings:       {Fore.YELLOW if warnings else Fore.GREEN}{warnings}{Fore.RESET}")
    print(f"  Validated in:   {elapsed:.3f}s")

    if not seen_result:
        warn("Stream did not contain a 'result' event (incomplete?)")
        warnings += 1

    if strict and errors > 0:
        print(f"\n{Fore.RED}STRICT MODE: Exiting with error code 1{Fore.RESET}")
        return False

    return errors == 0


def generate_example() -> None:
    """Generate a valid example NDJSON stream."""
    session_id = "sess_example123"
    lines = [
        {"type": "system", "subtype": "init", "session_id": session_id},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello! "}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "This is a "}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "valid stream."}},
        {"type": "content_block_stop", "index": 0},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "Hello! This is a valid stream."}]}},
        {"type": "result", "message": {"content": [{"type": "text", "text": "Hello! This is a valid stream."}]},
         "session_id": session_id, "cost": 0.0003, "usage": {"input_tokens": 10, "output_tokens": 8}},
    ]
    for line in lines:
        print(json.dumps(line))


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate Claude CLI NDJSON stream output")
    parser.add_argument("--replay", type=str, help="Path to saved NDJSON file")
    parser.add_argument("--generate", action="store_true", help="Generate a valid example stream")
    parser.add_argument("--strict", action="store_true", help="Exit with code 1 on any error")
    args = parser.parse_args()

    if args.generate:
        generate_example()
        return

    if args.replay:
        with open(args.replay, "r") as f:
            lines = f.readlines()
    else:
        print(f"{Fore.CYAN}Reading from stdin (pipe Claude CLI output here)...{Fore.RESET}")
        lines = sys.stdin.readlines()

    success = validate_stream(lines, strict=args.strict)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

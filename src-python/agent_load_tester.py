#!/usr/bin/env python3
"""
Agent Concurrency Load Tester — stress-tests agent spawning.

Usage:
    python agent_load_tester.py --count 5
    python agent_load_tester.py --count 10 --mock-mode lorem --delay 0.02
    python agent_load_tester.py --count 8 --chaos

Spawns multiple mock_claude_cli.py instances simultaneously and
measures spawn latency, time-to-first-token, and total response time.
"""

import os
import sys
import json
import time
import uuid
import subprocess
import threading
import argparse
from dataclasses import dataclass, field

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

MOCK_CLI_PATH = os.path.join(os.path.dirname(__file__), "mock_claude_cli.py")


@dataclass
class AgentResult:
    agent_id: str
    spawn_time: float = 0.0
    first_output_time: float = 0.0
    completion_time: float = 0.0
    exit_code: int | None = None
    output_lines: int = 0
    output_bytes: int = 0
    peak_memory_mb: float = 0.0
    error: str | None = None
    killed: bool = False


def spawn_agent(
    agent_id: str,
    mock_mode: str,
    delay: float,
    message: str,
    chaos: bool,
    results: dict[str, AgentResult],
) -> None:
    """Spawn a single mock agent and collect metrics."""
    result = AgentResult(agent_id=agent_id)
    results[agent_id] = result

    cmd = [
        sys.executable, MOCK_CLI_PATH,
        "-p",
        "--output-format", "stream-json",
        "--mock-mode", mock_mode,
        "--mock-delay", str(delay),
    ]

    t_start = time.time()
    result.spawn_time = t_start

    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Write message and close stdin
        proc.stdin.write(message.encode())
        proc.stdin.close()

        first_output = False
        lines = 0
        total_bytes = 0

        # Track memory if psutil available
        ps_proc = None
        if HAS_PSUTIL:
            try:
                ps_proc = psutil.Process(proc.pid)
            except psutil.NoSuchProcess:
                pass

        # Chaos mode: randomly kill some agents
        if chaos and agent_id.endswith(("3", "7")):
            time.sleep(0.2)
            proc.kill()
            result.killed = True
            result.error = "Killed by chaos mode"

        # Read stdout
        for line in proc.stdout:
            if not first_output:
                result.first_output_time = time.time()
                first_output = True

            lines += 1
            total_bytes += len(line)

            # Sample memory
            if ps_proc and HAS_PSUTIL and lines % 5 == 0:
                try:
                    mem = ps_proc.memory_info().rss / (1024 * 1024)
                    result.peak_memory_mb = max(result.peak_memory_mb, mem)
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass

        proc.wait()
        result.completion_time = time.time()
        result.exit_code = proc.returncode
        result.output_lines = lines
        result.output_bytes = total_bytes

        # Read stderr
        stderr = proc.stderr.read().decode(errors="replace").strip()
        if stderr and proc.returncode != 0:
            result.error = stderr[:200]

    except Exception as e:
        result.completion_time = time.time()
        result.error = str(e)


def print_results(results: dict[str, AgentResult], wall_time: float) -> None:
    print(f"\n{'='*70}")
    print(f"Load Test Results")
    print(f"{'='*70}")

    # Summary
    total = len(results)
    succeeded = sum(1 for r in results.values() if r.exit_code == 0 and not r.killed)
    failed = sum(1 for r in results.values() if r.exit_code != 0 or r.killed)

    print(f"\n  Total agents:   {total}")
    print(f"  Succeeded:      {succeeded}")
    print(f"  Failed/Killed:  {failed}")
    print(f"  Wall time:      {wall_time:.2f}s")

    # Per-agent details
    print(f"\n{'-'*70}")
    print(f"  {'Agent':<12} {'Spawn>1st':>10} {'Total':>8} {'Lines':>6} "
          f"{'Bytes':>8} {'Mem(MB)':>8} {'Exit':>5} {'Status'}")
    print(f"{'-'*70}")

    for agent_id, r in sorted(results.items()):
        ttft = (r.first_output_time - r.spawn_time) if r.first_output_time else 0
        total_time = (r.completion_time - r.spawn_time) if r.completion_time else 0
        mem = f"{r.peak_memory_mb:.1f}" if r.peak_memory_mb > 0 else "N/A"
        status = "OK" if r.exit_code == 0 and not r.killed else (
            "KILLED" if r.killed else f"ERR: {r.error[:30] if r.error else '?'}"
        )

        print(f"  {agent_id[:10]:<12} {ttft:>9.3f}s {total_time:>7.2f}s {r.output_lines:>6} "
              f"{r.output_bytes:>8} {mem:>8} {r.exit_code or 0:>5} {status}")

    # Timing stats
    ttfts = [r.first_output_time - r.spawn_time for r in results.values() if r.first_output_time]
    totals = [r.completion_time - r.spawn_time for r in results.values() if r.completion_time]

    if ttfts:
        print(f"\n  Time to first token:")
        print(f"    Min:  {min(ttfts):.3f}s")
        print(f"    Max:  {max(ttfts):.3f}s")
        print(f"    Avg:  {sum(ttfts)/len(ttfts):.3f}s")

    if totals:
        print(f"\n  Total response time:")
        print(f"    Min:  {min(totals):.2f}s")
        print(f"    Max:  {max(totals):.2f}s")
        print(f"    Avg:  {sum(totals)/len(totals):.2f}s")

    # Concurrency timeline
    print(f"\n{'-'*70}")
    print(f"  Concurrency Timeline (50ms buckets):")
    if totals:
        t_min = min(r.spawn_time for r in results.values())
        t_max = max(r.completion_time for r in results.values() if r.completion_time)
        bucket_size = 0.05  # 50ms
        for t in range_float(0, t_max - t_min + bucket_size, bucket_size):
            active = sum(
                1 for r in results.values()
                if r.spawn_time - t_min <= t < (r.completion_time - t_min if r.completion_time else float('inf'))
            )
            bar = "#" * active
            if active > 0:
                print(f"    {t:>6.2f}s |{bar}")


def range_float(start, stop, step):
    current = start
    while current < stop:
        yield round(current, 3)
        current += step


def main():
    parser = argparse.ArgumentParser(description="Agent Concurrency Load Tester for Zentral")
    parser.add_argument("--count", type=int, default=5, help="Number of agents to spawn")
    parser.add_argument("--mock-mode", type=str, default="lorem", help="Mock CLI mode")
    parser.add_argument("--delay", type=float, default=0.03, help="Delay between deltas")
    parser.add_argument("--chaos", action="store_true", help="Randomly kill some agents")
    parser.add_argument("--output-json", type=str, help="Save results to JSON file")
    args = parser.parse_args()

    if not os.path.exists(MOCK_CLI_PATH):
        print(f"ERROR: mock_claude_cli.py not found at {MOCK_CLI_PATH}")
        sys.exit(1)

    print(f"Spawning {args.count} agents (mode={args.mock_mode}, delay={args.delay}s, chaos={args.chaos})")

    results: dict[str, AgentResult] = {}
    threads = []

    t_wall_start = time.time()

    for i in range(args.count):
        agent_id = f"agent_{i:03d}"
        message = f"Test message for agent {agent_id}: Please analyze the codebase."

        t = threading.Thread(
            target=spawn_agent,
            args=(agent_id, args.mock_mode, args.delay, message, args.chaos, results),
        )
        threads.append(t)
        t.start()

    # Wait for all
    for t in threads:
        t.join()

    wall_time = time.time() - t_wall_start
    print_results(results, wall_time)

    # Optional JSON output
    if args.output_json:
        json_data = {
            agent_id: {
                "agent_id": r.agent_id,
                "spawn_latency": r.first_output_time - r.spawn_time if r.first_output_time else None,
                "total_time": r.completion_time - r.spawn_time if r.completion_time else None,
                "exit_code": r.exit_code,
                "output_lines": r.output_lines,
                "output_bytes": r.output_bytes,
                "peak_memory_mb": r.peak_memory_mb,
                "error": r.error,
                "killed": r.killed,
            }
            for agent_id, r in results.items()
        }
        with open(args.output_json, "w") as f:
            json.dump(json_data, f, indent=2)
        print(f"\nResults saved to {args.output_json}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Tauri IPC Event Simulator — sends fake events for frontend UI development.

Usage:
    python ipc_event_simulator.py --mode interactive
    python ipc_event_simulator.py --mode scenario --scenario demo
    python ipc_event_simulator.py --mode scenario --file my_scenario.json

Starts a WebSocket server that the frontend can connect to for receiving
simulated backend events during development.
"""

import sys
import json
import time
import uuid
import asyncio
import argparse

try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError:
    websockets = None

AGENT_ID = "agent_mock_001"
SESSION_ID = f"sess_{uuid.uuid4().hex[:12]}"

# ---------- Event Builders ----------

def text_event(content: str) -> dict:
    return {"kind": "text", "content": content}

def tool_use_event(name: str, input_data: dict) -> dict:
    return {"kind": "tool_use", "tool_name": name, "tool_input": input_data}

def tool_result_event(tool_use_id: str, output: str) -> dict:
    return {"kind": "tool_result", "tool_use_id": tool_use_id, "output": output}

def system_init_event(session_id: str) -> dict:
    return {"kind": "system_init", "session_id": session_id}

def cost_event(total_cost: float) -> dict:
    return {"kind": "cost", "total_cost": total_cost}

def token_usage_event(input_tokens: int, output_tokens: int) -> dict:
    return {"kind": "token_usage", "input_tokens": input_tokens, "output_tokens": output_tokens}

def error_event(message: str) -> dict:
    return {"kind": "error", "message": message}

def done_event() -> dict:
    return {"kind": "done"}

def aborted_event() -> dict:
    return {"kind": "aborted"}

def status_changed_event(agent_id: str, status: str) -> dict:
    return {"type": "agent:status-changed", "agent_id": agent_id, "status": status}


# ---------- Demo Scenario ----------

DEMO_SCENARIO = [
    {"delay": 0.0, "event_name": "agent:status-changed",
     "payload": status_changed_event(AGENT_ID, "running")},
    {"delay": 0.2, "event_name": f"agent:output:{AGENT_ID}",
     "payload": system_init_event(SESSION_ID)},
    {"delay": 0.3, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("Let me analyze ")},
    {"delay": 0.1, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("your code. ")},
    {"delay": 0.15, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("I'll start by reading ")},
    {"delay": 0.1, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("the main entry point.\n\n")},
    {"delay": 0.5, "event_name": f"agent:output:{AGENT_ID}",
     "payload": tool_use_event("Read", {"file_path": "/src/main.rs"})},
    {"delay": 1.0, "event_name": f"agent:output:{AGENT_ID}",
     "payload": tool_result_event("toolu_read_001", "fn main() {\n    zentral_lib::run()\n}")},
    {"delay": 0.3, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("I can see the main entry point calls `zentral_lib::run()`. ")},
    {"delay": 0.1, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("The project structure looks clean. ")},
    {"delay": 0.15, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("Here are my recommendations:\n\n")},
    {"delay": 0.1, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("1. **Add error handling** for the run function\n")},
    {"delay": 0.1, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("2. **Set up logging** with `env_logger`\n")},
    {"delay": 0.1, "event_name": f"agent:output:{AGENT_ID}",
     "payload": text_event("3. **Configure managed state** in the builder\n")},
    {"delay": 0.5, "event_name": f"agent:output:{AGENT_ID}",
     "payload": cost_event(0.0042)},
    {"delay": 0.0, "event_name": f"agent:output:{AGENT_ID}",
     "payload": token_usage_event(150, 89)},
    {"delay": 0.0, "event_name": f"agent:output:{AGENT_ID}",
     "payload": done_event()},
    {"delay": 0.1, "event_name": "agent:status-changed",
     "payload": status_changed_event(AGENT_ID, "idle")},
]


# ---------- WebSocket Server ----------

connected_clients = set()


async def handle_client(websocket):
    connected_clients.add(websocket)
    client_addr = websocket.remote_address
    print(f"Client connected: {client_addr}")
    try:
        async for message in websocket:
            print(f"Received from client: {message}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"Client disconnected: {client_addr}")


async def broadcast(event_name: str, payload: dict):
    message = json.dumps({"event": event_name, "payload": payload})
    for ws in connected_clients.copy():
        try:
            await ws.send(message)
        except websockets.exceptions.ConnectionClosed:
            connected_clients.discard(ws)


async def run_scenario(scenario: list[dict]):
    print(f"\nPlaying scenario with {len(scenario)} events...")
    for step in scenario:
        delay = step.get("delay", 0)
        if delay > 0:
            await asyncio.sleep(delay)
        await broadcast(step["event_name"], step["payload"])
        print(f"  -> {step['event_name']}: {step['payload'].get('kind', step['payload'].get('type', '?'))}")
    print("Scenario complete.\n")


async def interactive_menu():
    """Interactive CLI for sending events."""
    menu = """
Commands:
  1  Send text event
  2  Send tool_use event
  3  Send done event
  4  Send error event
  5  Send status change (running)
  6  Send status change (idle)
  7  Run demo scenario
  8  Send aborted event
  q  Quit
"""
    print(menu)

    loop = asyncio.get_event_loop()

    while True:
        choice = await loop.run_in_executor(None, lambda: input("\n> ").strip())

        if choice == "1":
            text = await loop.run_in_executor(None, lambda: input("  Text: ").strip())
            await broadcast(f"agent:output:{AGENT_ID}", text_event(text))
        elif choice == "2":
            name = await loop.run_in_executor(None, lambda: input("  Tool name: ").strip())
            await broadcast(f"agent:output:{AGENT_ID}", tool_use_event(name, {}))
        elif choice == "3":
            await broadcast(f"agent:output:{AGENT_ID}", done_event())
        elif choice == "4":
            msg = await loop.run_in_executor(None, lambda: input("  Error msg: ").strip())
            await broadcast(f"agent:output:{AGENT_ID}", error_event(msg))
        elif choice == "5":
            await broadcast("agent:status-changed", status_changed_event(AGENT_ID, "running"))
        elif choice == "6":
            await broadcast("agent:status-changed", status_changed_event(AGENT_ID, "idle"))
        elif choice == "7":
            await run_scenario(DEMO_SCENARIO)
        elif choice == "8":
            await broadcast(f"agent:output:{AGENT_ID}", aborted_event())
        elif choice == "q":
            break
        else:
            print(menu)


async def main_server(port: int, mode: str, scenario_file: str | None):
    if websockets is None:
        print("ERROR: websockets is required.")
        print("  pip install websockets")
        sys.exit(1)

    async with serve(handle_client, "localhost", port):
        print(f"WebSocket server running on ws://localhost:{port}")
        print(f"Connected clients: {len(connected_clients)}")

        if mode == "scenario":
            # Wait a bit for client to connect
            print("Waiting 3s for client connection...")
            await asyncio.sleep(3)

            if scenario_file:
                with open(scenario_file) as f:
                    scenario = json.load(f)
            else:
                scenario = DEMO_SCENARIO

            await run_scenario(scenario)
            # Keep running after scenario
            await interactive_menu()
        else:
            await interactive_menu()


def main():
    parser = argparse.ArgumentParser(description="Tauri IPC Event Simulator for Zentral")
    parser.add_argument("--mode", default="interactive", choices=["interactive", "scenario"])
    parser.add_argument("--port", type=int, default=9999)
    parser.add_argument("--scenario", type=str, default=None, help="Built-in scenario name or 'demo'")
    parser.add_argument("--file", type=str, default=None, help="JSON scenario file path")
    args = parser.parse_args()

    scenario_file = args.file
    if args.scenario == "demo":
        scenario_file = None  # Use built-in DEMO_SCENARIO

    asyncio.run(main_server(args.port, args.mode, scenario_file))


if __name__ == "__main__":
    main()

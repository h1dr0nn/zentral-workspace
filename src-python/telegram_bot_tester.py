#!/usr/bin/env python3
"""
Telegram Bot Integration Tester for Zentral.

Modes:
    python telegram_bot_tester.py --mode mock-server          # Mock Telegram API server
    python telegram_bot_tester.py --mode client --token TOKEN  # Real bot client
    python telegram_bot_tester.py --mode webhook-debug         # Dump webhook payloads

Mock server implements getUpdates, sendMessage, getMe endpoints
so you can test the Rust polling client without a real bot token.
"""

import sys
import json
import time
import argparse
import threading
from collections import deque

try:
    from flask import Flask, request, jsonify
except ImportError:
    Flask = None

try:
    import requests
except ImportError:
    requests = None


# ==================== Mock Server ====================

def create_mock_server(port: int, chat_id: int):
    if Flask is None:
        print("ERROR: Flask is required for mock-server mode.")
        print("  pip install flask")
        sys.exit(1)

    app = Flask(__name__)
    app.config["PROPAGATE_EXCEPTIONS"] = True

    message_queue = deque()
    sent_messages = []
    update_id_counter = [1000]
    pending_event = threading.Event()

    @app.route("/bot<token>/getMe", methods=["GET", "POST"])
    def get_me(token):
        print(f"[getMe] token={token[:10]}...")
        return jsonify({
            "ok": True,
            "result": {
                "id": 999999,
                "is_bot": True,
                "first_name": "Zentral Mock Bot",
                "username": "zentral_mock_bot",
            }
        })

    @app.route("/bot<token>/getUpdates", methods=["GET", "POST"])
    def get_updates(token):
        data = request.args if request.method == "GET" else (request.json or request.args)
        offset = int(data.get("offset", 0))
        timeout = int(data.get("timeout", 0))

        print(f"[getUpdates] offset={offset}, timeout={timeout}")

        # Wait for messages or timeout
        if not message_queue and timeout > 0:
            pending_event.clear()
            pending_event.wait(timeout=min(timeout, 10))

        updates = []
        while message_queue:
            msg = message_queue.popleft()
            if msg["update_id"] >= offset:
                updates.append(msg)

        print(f"[getUpdates] returning {len(updates)} update(s)")
        return jsonify({"ok": True, "result": updates})

    @app.route("/bot<token>/sendMessage", methods=["POST"])
    def send_message(token):
        data = request.json or {}
        target_chat_id = data.get("chat_id")
        text = data.get("text", "")
        parse_mode = data.get("parse_mode", "")

        print(f"\n{'='*50}")
        print(f"[sendMessage] chat_id={target_chat_id}")
        print(f"  parse_mode: {parse_mode}")
        print(f"  text: {text[:200]}{'...' if len(text) > 200 else ''}")
        print(f"{'='*50}\n")

        sent_messages.append(data)

        return jsonify({
            "ok": True,
            "result": {
                "message_id": len(sent_messages) + 1000,
                "chat": {"id": target_chat_id, "type": "private"},
                "text": text,
                "date": int(time.time()),
            }
        })

    def input_loop():
        """Interactive prompt to queue messages."""
        print(f"\n{'='*50}")
        print(f"Mock Telegram API Server running on port {port}")
        print(f"Default chat_id: {chat_id}")
        print(f"Endpoint: http://localhost:{port}/bot<TOKEN>/getUpdates")
        print(f"\nType messages to queue as Telegram updates.")
        print(f"Commands:")
        print(f"  !chatid <id>   - Change sender chat_id")
        print(f"  !quit          - Stop server")
        print(f"{'='*50}\n")

        current_chat_id = chat_id

        while True:
            try:
                text = input(f"[chat:{current_chat_id}] > ")
            except (EOFError, KeyboardInterrupt):
                break

            if not text.strip():
                continue

            if text.startswith("!chatid "):
                current_chat_id = int(text.split()[1])
                print(f"  Chat ID set to {current_chat_id}")
                continue

            if text.strip() == "!quit":
                print("Shutting down...")
                break

            uid = update_id_counter[0]
            update_id_counter[0] += 1

            update = {
                "update_id": uid,
                "message": {
                    "message_id": uid,
                    "chat": {"id": current_chat_id, "type": "private"},
                    "text": text,
                    "date": int(time.time()),
                    "from": {
                        "id": current_chat_id,
                        "first_name": "Test User",
                        "is_bot": False,
                    }
                }
            }

            message_queue.append(update)
            pending_event.set()
            print(f"  Queued update_id={uid}")

    # Start input loop in background
    input_thread = threading.Thread(target=input_loop, daemon=True)
    input_thread.start()

    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)


# ==================== Real Bot Client ====================

def run_client(token: str, interactive: bool = True):
    if requests is None:
        print("ERROR: requests is required for client mode.")
        print("  pip install requests")
        sys.exit(1)

    base_url = f"https://api.telegram.org/bot{token}"

    # Test connection
    print("Testing connection...")
    resp = requests.get(f"{base_url}/getMe")
    data = resp.json()
    if not data.get("ok"):
        print(f"ERROR: {data.get('description', 'Unknown error')}")
        sys.exit(1)

    bot_info = data["result"]
    print(f"Connected: @{bot_info.get('username')} ({bot_info.get('first_name')})")

    if interactive:
        print("\nType messages to send to the bot. Type '!quit' to exit.")
        print("Use '!commands' to send the test command suite.\n")

        while True:
            try:
                text = input("> ")
            except (EOFError, KeyboardInterrupt):
                break

            if text.strip() == "!quit":
                break

            if text.strip() == "!commands":
                test_commands = ["/start", "/status", "/agents", "/ask What files are in this project?"]
                for cmd in test_commands:
                    send_and_measure(base_url, cmd)
                continue

            if text.strip():
                send_and_measure(base_url, text)


def send_and_measure(base_url: str, text: str):
    """Send a message and measure response time."""
    # We need to know the chat_id first — use getUpdates to find it
    # For simplicity, just send via sendMessage (requires chat_id from a prior /start)
    print(f"\n  Sending: {text}")
    start = time.time()

    # Note: This sends directly to the bot API, but the bot needs to have
    # received at least one message from the user to know the chat_id.
    # In practice, you'd send from Telegram and poll for the response.
    resp = requests.post(f"{base_url}/getUpdates", json={"timeout": 5})
    latency = time.time() - start

    data = resp.json()
    updates = data.get("result", [])
    print(f"  Response ({latency:.2f}s): {len(updates)} update(s)")

    for update in updates:
        msg = update.get("message", {})
        print(f"    [{msg.get('from', {}).get('first_name', '?')}]: {msg.get('text', '')}")


# ==================== Webhook Debugger ====================

def run_webhook_debug(port: int):
    if Flask is None:
        print("ERROR: Flask is required for webhook-debug mode.")
        sys.exit(1)

    app = Flask(__name__)

    @app.route("/", methods=["POST"])
    def webhook():
        data = request.json
        print(f"\n{'='*50}")
        print(f"Webhook received at {time.strftime('%H:%M:%S')}")
        print(json.dumps(data, indent=2))
        print(f"{'='*50}\n")
        return jsonify({"ok": True})

    print(f"Webhook debugger listening on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)


# ==================== Main ====================

def main():
    parser = argparse.ArgumentParser(description="Telegram Bot Integration Tester for Zentral")
    parser.add_argument("--mode", required=True, choices=["mock-server", "client", "webhook-debug"])
    parser.add_argument("--port", type=int, default=8443, help="Port for mock server / webhook debug")
    parser.add_argument("--token", type=str, default="TEST_TOKEN", help="Bot token (for client mode)")
    parser.add_argument("--chat-id", type=int, default=123456789, help="Default chat ID for mock server")
    args = parser.parse_args()

    if args.mode == "mock-server":
        create_mock_server(args.port, args.chat_id)
    elif args.mode == "client":
        run_client(args.token)
    elif args.mode == "webhook-debug":
        run_webhook_debug(args.port)


if __name__ == "__main__":
    main()

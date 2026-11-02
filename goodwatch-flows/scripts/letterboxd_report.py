"""Deliver count reports into the Ghostex conversation and its notification bell."""
import argparse
from datetime import datetime
import json
from pathlib import Path
import subprocess
import sys
from zoneinfo import ZoneInfo


def notify(cli, session_id, title, body):
    completed = subprocess.run(
        [cli, "notify", "--session-id", session_id, "--title", title, "--body", body],
        capture_output=True, text=True, timeout=30,
    )
    if completed.returncode:
        raise RuntimeError("Ghostex notification command failed")
    response = json.loads(completed.stdout)
    if response.get("ok") is not True:
        raise RuntimeError("Ghostex did not acknowledge delivery")
    return next((item.get("id") for item in response.get("feed", {}).get("items", [])
                 if item.get("sessionId") == session_id and item.get("title") == title), None)


def send_chat(cli, chat_ref, body):
    message = (
        "Scheduled Letterboxd status report requested by the user. Show this update concisely "
        "in your reply. If another task is active, give this update briefly and continue that task. "
        "Do not rerun the queries or change crawlers or schedules for this report.\n\n" + body
    )
    completed = subprocess.run([cli, "send-session-chat-message", chat_ref, message],
                               capture_output=True, text=True, timeout=30)
    if completed.returncode:
        raise RuntimeError("Ghostex chat delivery command failed")
    response = json.loads(completed.stdout)
    if response.get("ok") is not True or not response.get("sendRequestId"):
        raise RuntimeError("Ghostex did not acknowledge the chat message")
    return response["sendRequestId"]


def report(cli, session_id, state_file, chat_ref=None, snapshot=None):
    chat_ref = chat_ref or session_id

    def failed_query(error_type):
        body = f"Live Letterboxd count check failed ({error_type}). Previous delivered baseline preserved; no stale counts substituted."
        notify(cli, session_id, "Letterboxd report needs attention", body)
        send_chat(cli, chat_ref, body)
        raise RuntimeError("Live count query failed")

    # A supplied snapshot permits delivery-path verification without repeating live queries.
    if snapshot is None:
        try:
            completed = subprocess.run(
                [sys.executable, str(Path(__file__).with_name("letterboxd_status.py"))],
                capture_output=True, text=True, timeout=180,
            )
            snapshot = json.loads(completed.stdout)
        except (subprocess.TimeoutExpired, json.JSONDecodeError) as error:
            failed_query(type(error).__name__)
        if completed.returncode or snapshot.get("error"):
            failed_query(snapshot.get("error", "CountQueryFailed"))
    previous = json.loads(state_file.read_text()) if state_file.exists() else None
    mongo, crate = snapshot["mongo"], snapshot["crate"]
    checked = datetime.fromisoformat(snapshot["checked_at"]).astimezone(ZoneInfo("Europe/Berlin"))
    title = f"Letterboxd: Mongo {mongo['scored']:,} / Crate {crate['scored']:,}"
    lines = [
        checked.strftime("%Y-%m-%d %H:%M %Z"),
        f"Mongo: {mongo['scored']:,} scored; {mongo['attempted']:,}/{mongo['queued']:,} attempted.",
        f"Crate: {crate['scored']:,} scored, {crate['with_vote_count']:,} with votes; {crate['with_url']:,} URLs.",
    ]
    if previous:
        delta = {key: snapshot[key]["scored"] - previous[key]["scored"] for key in ("mongo", "crate")}
        snapshot["since_previous"] = {"checked_at": previous["checked_at"], "scored": delta}
        lines.append(f"Since last delivered report: Mongo {delta['mongo']:+,}; Crate {delta['crate']:+,}.")
    lines.append(f"Unrated: {mongo['unrated']:,}; errors: {mongo['error']:,}; score-count gap: {snapshot['score_count_gap']:,}.")
    block = snapshot.get("source_block")
    lines.append(f"Source block: {block['reason']} until {block['until']}." if block else "No active source block.")
    notification_id = notify(cli, session_id, title, "\n".join(lines))
    chat_request_id = send_chat(cli, chat_ref, "\n".join(lines))
    # A bell entry alone is not a delivered conversation report.
    snapshot["last_notification"] = {"id": notification_id, "session_id": session_id}
    snapshot["last_chat_delivery"] = {"send_request_id": chat_request_id, "chat_ref": chat_ref}
    state_file.parent.mkdir(parents=True, exist_ok=True)
    temporary = state_file.with_name(state_file.name + ".tmp")
    temporary.write_text(json.dumps(snapshot, indent=2) + "\n")
    temporary.replace(state_file)
    return snapshot


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ghostex-cli", default="/usr/bin/ghostex")
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--chat-ref", help="Conversation routing reference; defaults to the session id")
    parser.add_argument("--state-file", type=Path,
                        default=Path.home() / ".local/state/goodwatch/letterboxd-report-state.json")
    args = parser.parse_args()
    try:
        snapshot = report(args.ghostex_cli, args.session_id, args.state_file, args.chat_ref)
        print(json.dumps({"delivered": True, "checked_at": snapshot["checked_at"],
                          "mongo_scored": snapshot["mongo"]["scored"], "crate_scored": snapshot["crate"]["scored"],
                          "notification_id": snapshot["last_notification"]["id"],
                          "chat_request_id": snapshot["last_chat_delivery"]["send_request_id"]}))
    except Exception as error:
        # Never log credentials embedded in database/client error messages.
        print(json.dumps({"delivered": False, "error": type(error).__name__}))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

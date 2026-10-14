"""Enqueue only explicitly configured preview members; imports no database connector.

Called after snapshot publication and by the snapshot publisher's existing nightly
schedule (even if no snapshot changed). An absent/empty config disables the trigger.
"""
import json

MEMBERS_VARIABLE = "f/sync/g1_preview_members"
G1_SCRIPT = "f/sync/copy/g1_order"


def start_preview_g1(get_variable, enqueue):
    try:
        raw = get_variable(MEMBERS_VARIABLE)
    except Exception as error:
        print(f"G1 trigger disabled: preview variable unavailable: {error}", flush=True)
        return {"started": False, "reason": "preview variable unavailable"}
    if not raw:
        return {"started": False, "reason": "no preview members"}
    try:
        members = json.loads(raw)
        if members == []:
            return {"started": False, "reason": "no preview members"}
        if (not isinstance(members, list) or not members
                or any(not isinstance(m, str) or not m.strip() or m != m.strip()
                       or m.lower() == "all" or ":" in m or "*" in m for m in members)
                or len(set(members)) != len(members)):
            raise ValueError("Expected distinct explicit preview member ids")
        job = enqueue(path=G1_SCRIPT, args={"member_ids": members, "dry_run": False})
        return {"started": True, "job": job}
    except Exception as error:
        print(f"G1 trigger failed: {error}", flush=True)
        return {"started": False, "reason": str(error)}


def main():
    import wmill
    return start_preview_g1(wmill.get_variable, wmill.run_script_by_path_async)

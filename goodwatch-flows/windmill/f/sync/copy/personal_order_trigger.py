"""Queue one serialized personal order build after snapshots/nightly, or for the dirty schedule."""
import json

MEMBERS_VARIABLE = "f/sync/personal_order_members"
PERSONAL_ORDER_SCRIPT = "f/sync/copy/personal_order"
DIRTY_KEY = "personal-order:dirty"


def validate_members(members):
    if (not isinstance(members, list)
            or any(not isinstance(m, str) or not m.strip() or m != m.strip()
                   or m.lower() == "all" or ":" in m or "*" in m for m in members)
            or len(set(members)) != len(members)):
        raise ValueError("Expected distinct explicit member ids, or the rollout string all")


def rollout_members(raw):
    # Windmill string variables may contain literal all or its JSON encoding.
    members = "all" if raw == "all" else json.loads(raw or "[]")
    if members != "all":
        validate_members(members)
    return members


def start_personal_order(get_variable, enqueue, *, dirty_only=False):
    try:
        members = rollout_members(get_variable(MEMBERS_VARIABLE))
        if members == []:
            return {"started": False, "reason": "no rollout members"}
        args = {"member_ids": members, "dry_run": False}
        if dirty_only:
            args["dirty_only"] = True
        job = enqueue(path=PERSONAL_ORDER_SCRIPT, args=args)
        return {"started": True, "job": job}
    except Exception as error:
        print(f"Personal order trigger failed: {error}", flush=True)
        return {"started": False, "reason": str(error)}


def main(dirty_only: bool = False):
    import wmill
    return start_personal_order(wmill.get_variable, wmill.run_script_by_path_async,
                    dirty_only=False if dirty_only is None else dirty_only)

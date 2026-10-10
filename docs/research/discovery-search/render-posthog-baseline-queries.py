#!/usr/bin/env python3
"""Render private keep-filters locally; never commit this command's output."""

import argparse
import json
from pathlib import Path


def quote(value):
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def render_filter(entry):
    key = entry["key"]
    if entry.get("type") != "event" or key not in {"$host", "$ip", "$user_id"}:
        raise ValueError("Unrecognized filter: review the project settings before rerunning")
    prop = f"ifNull(toString(properties.{key}), '')"
    value = entry["value"]
    if entry["operator"] == "not_regex" and isinstance(value, str):
        return f"NOT match({prop}, {quote(value)})"
    if entry["operator"] == "is_not" and isinstance(value, list) and value:
        return f"{prop} NOT IN ({', '.join(quote(v) for v in value)})"
    raise ValueError("Unrecognized operator/value: review the settings before rerunning")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--filters", required=True, type=Path,
                        help="Private JSON array from system.teams.test_account_filters")
    args = parser.parse_args()
    entries = json.loads(args.filters.read_text())
    if not isinstance(entries, list) or not entries:
        raise ValueError("Expected a nonempty configured filter array")
    predicate = "\n  AND ".join(render_filter(entry) for entry in entries)
    template = Path(__file__).with_name("posthog-baseline-queries.sql").read_text()
    print(template.replace("{{test_account_keep_predicate}}", predicate))

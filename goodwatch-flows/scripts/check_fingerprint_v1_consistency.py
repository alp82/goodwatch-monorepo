"""Count how many points listed for issue #223 have a fingerprint_v1 that matches their raw scores.

Read-only, and independent of repair_stale_fingerprint_v1.py: it talks to Qdrant's REST API
with the standard library, takes the score order from the CoreScores source text, and judges a
point by the angle between fingerprint_v1 and the payload scores (the repair judges by the
largest component difference to fingerprint_v1_raw).

A point is `consistent` when the cosine similarity of fingerprint_v1 and the payload's
`fingerprint_scores_v1` (in CoreScores order) is at least 1 - 1e-6. One score changing by 1
lowers it by at least about 5e-5; float32 storage noise is below 1e-7. The report also says
whether fingerprint_v1_raw equals the payload scores.

Settings: QDRANT_REST_URL, or QDRANT_URL (a :6334 gRPC port is replaced by :6333), and
QDRANT_API_KEY, from the environment or from `--env-file`. Exit code 1 when `--expect` is
given and the listed points are not all in that state.
"""
import argparse
import ast
import json
import os
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

CATEGORY = "mongo_vector_fingerprint_stale"
COLLECTION = "media_fingerprint_v1"
MIN_COSINE = 1 - 1e-6
PAGE = 250
MODELS = Path(os.environ.get("GOODWATCH_WINDMILL_DIR") or Path(__file__).resolve().parents[1] / "windmill") / "f/dna/models.py"


def score_names() -> list[str]:
    for node in ast.parse(MODELS.read_text()).body:
        if isinstance(node, ast.ClassDef) and node.name == "CoreScores":
            names = [item.target.id for item in node.body if isinstance(item, ast.AnnAssign)]
            if len(names) != 74:
                raise SystemExit(f"CoreScores has {len(names)} fields, expected 74")
            return names
    raise SystemExit("CoreScores not found")


def settings(env_file: str | None) -> tuple[str, str | None]:
    values = dict(os.environ)
    if env_file:
        for line in Path(env_file).read_text().splitlines():
            key, separator, value = line.strip().partition("=")
            if separator and key.startswith("QDRANT_"):
                values.setdefault(key, value.strip().strip("\"'"))
    url = values.get("QDRANT_REST_URL") or values.get("QDRANT_URL")
    if not url:
        raise SystemExit("QDRANT_URL is not set")
    if url.endswith(":6334"):
        url = url[:-5] + ":6333"
    return url.rstrip("/"), values.get("QDRANT_API_KEY")


def fetch(url: str, api_key: str | None, collection: str, ids: list[int]) -> list[dict]:
    body = json.dumps({"ids": ids, "with_payload": ["fingerprint_scores_v1"],
                       "with_vector": ["fingerprint_v1", "fingerprint_v1_raw"]}).encode()
    headers = {"Content-Type": "application/json", **({"api-key": api_key} if api_key else {})}
    request = urllib.request.Request(f"{url}/collections/{collection}/points", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read())["result"]


def state(point: dict | None, names: list[str]) -> tuple[str, float | None, bool | None]:
    """(state, cosine, raw equals payload scores)"""
    if point is None:
        return "missing", None, None
    vectors = point.get("vector") or {}
    stored, raw = vectors.get("fingerprint_v1"), vectors.get("fingerprint_v1_raw")
    scores = (point.get("payload") or {}).get("fingerprint_scores_v1")
    if not isinstance(scores, dict) or any(not isinstance(scores.get(name), (int, float)) for name in names):
        return "no_payload_scores", None, None
    wanted = [float(scores[name]) for name in names]
    raw_equal = raw == wanted if raw is not None else None
    if not stored or len(stored) != len(wanted):
        return "no_fingerprint_v1", None, raw_equal
    dot = sum(a * b for a, b in zip(stored, wanted))
    lengths = (sum(a * a for a in stored) * sum(b * b for b in wanted)) ** 0.5
    if lengths == 0:
        return "zero_vector", None, raw_equal
    similarity = dot / lengths
    return ("consistent" if similarity >= MIN_COSINE else "inconsistent"), similarity, raw_equal


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("list", help="stale_points.jsonl of issue #223")
    parser.add_argument("--collection", default=COLLECTION)
    parser.add_argument("--env-file")
    parser.add_argument("--expect", choices=["consistent", "inconsistent"])
    parser.add_argument("--out", help="write one line per point that is not consistent")
    args = parser.parse_args()
    names = score_names()
    url, api_key = settings(args.env_file)
    ids = [json.loads(line)["point_id"] for line in open(args.list)
           if line.strip() and json.loads(line).get("category") == CATEGORY]
    states, raw_states, lowest, rows = Counter(), Counter(), [], []
    for start in range(0, len(ids), PAGE):
        page = ids[start:start + PAGE]
        found = {point["id"]: point for point in fetch(url, api_key, args.collection, page)}
        for point_id in page:
            name, similarity, raw_equal = state(found.get(point_id), names)
            states[name] += 1
            raw_states[{True: "raw_equals_payload", False: "raw_differs_from_payload", None: "raw_not_compared"}[raw_equal]] += 1
            if similarity is not None:
                lowest.append(similarity)
            if name != "consistent":
                rows.append({"point_id": point_id, "state": name, "cosine": similarity, "raw_equals_payload": raw_equal})
        time.sleep(0.2)
    if args.out:
        with open(args.out, "w") as out:
            out.writelines(json.dumps(row) + "\n" for row in rows)
    lowest.sort()
    print(json.dumps({
        "listed": len(ids), **dict(sorted(states.items())), **dict(sorted(raw_states.items())),
        "cosine_min": lowest[0] if lowest else None, "cosine_median": lowest[len(lowest) // 2] if lowest else None,
        "cosine_max": lowest[-1] if lowest else None,
    }, indent=1))
    if args.expect and states[args.expect] != len(ids):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

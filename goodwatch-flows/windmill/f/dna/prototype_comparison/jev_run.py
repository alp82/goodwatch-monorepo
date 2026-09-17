"""Throwaway Jev (TypeSafe System One) scoring experiment over the frozen benchmark.

Scores only: Jev does not generate essence text or tags. Raw captures stay in the
git-ignored private directory; jev_report.py exports the sanitized comparison.
"""

import argparse
import http.client
import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
BENCH = ROOT / "docs/benchmarks/fingerprint"
PRIVATE = BENCH / "jev/private"
HOST = "api.typesafe.ai"
PATH = "/v1/systemone"
MODEL = "jev-1.13.0"
USD_PER_INPUT_TOKEN = 0.042 / 1_000_000
TOKEN_BUDGET = 20_000_000  # hard stop, about $0.84
BATCH_SIZES = [1, 2, 5, 10, 20, 37, 74]

LADDER10 = [
    "Not present at all, or irrelevant to this title",
    "Minimal presence: a fleeting moment or a trace that most viewers would not remember",
    "Slight presence: appears a few times but has no real influence on the experience",
    "Minor element: noticeable, but clearly in the background of the title",
    "Modest element: a recurring side aspect that some viewers would mention",
    "Moderate element: a steady part of the experience, though not what the title is about",
    "Significant element: shapes many scenes or episodes and most viewers would mention it",
    "Major element: one of the main things the title delivers",
    "Dominant element: central to the title's identity and appeal",
    "Defining attribute: the title is a prime example and is known above all for this",
]
LADDER6 = [
    "Not present at all, or irrelevant to this title",
    "Minimal presence: a trace or a few moments with no real influence on the experience",
    "Minor element: a noticeable, recurring side aspect in the background",
    "Moderate element: a steady part of the experience, though not what the title is about",
    "Major element: one of the main things the title delivers",
    "Defining attribute: the title is a prime example and is known above all for this",
]


def load_key():
    for line in (PRIVATE / "experiment.env").read_text().splitlines():
        if line.startswith("TYPESAFE_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("TYPESAFE_API_KEY missing from private/experiment.env")


def load_glossary():
    keys = json.loads((BENCH / "score-keys.json").read_text())
    keys = keys["score_keys"] if isinstance(keys, dict) else keys
    text = (BENCH / "system-instructions.txt").read_text()
    found = dict(re.findall(r"^\* \*\*`(\w+)`\*\*: (.+)$", text, flags=re.M))
    missing = [k for k in keys if k not in found]
    if missing or len(keys) != 74:
        raise SystemExit(f"glossary mismatch: {len(keys)} keys, missing {missing}")
    return [(k, found[k].strip()) for k in keys]


def load_titles():
    titles = json.loads((BENCH / "titles.json").read_text())["titles"]
    return [(f"{t['media_type']}:{t['tmdb_id']}", t) for t in titles]


def make_state(title, variant):
    kind = "Movie" if title["media_type"] == "movie" else "TV show"
    if variant == "blind":
        return {"media_type": kind, "synopsis": title["overview"]}
    return {
        "title": title["title"],
        "original_title": title["original_title"],
        "release_year": title["release_year"],
        "media_type": kind,
        "synopsis": title["overview"],
    }


def make_question(design, key, definition):
    name = key.replace("_", " ")
    if design == "pres":
        return {
            "type": "noul",
            "instructions": f"Does this title contain the trait '{name}' to any noticeable degree? Trait definition: {definition}",
            "criteria": {
                "true": "The trait is present in the title, even if only as a minor element",
                "false": "The trait is absent from the title or irrelevant to it",
            },
        }
    return {
        "type": "score",
        "instructions": f"How strongly does this title express the trait '{name}'? Trait definition: {definition} Judge the whole title as viewers know it, not only the synopsis wording.",
        "criteria": LADDER10 if design == "l10" else LADDER6,
    }


class Client:
    """One keep-alive connection per thread, no implicit retries beyond the recorded ones."""

    def __init__(self, key):
        self.key = key
        self.local = threading.local()
        self.lock = threading.Lock()
        self.tokens = 0

    def post(self, body):
        payload = json.dumps(body).encode()
        headers = {
            "Authorization": "Bearer " + self.key,
            "Content-Type": "application/json",
            "User-Agent": "goodwatch-jev-bench/0.1",
        }
        attempts = []
        for attempt in range(4):
            with self.lock:
                if self.tokens > TOKEN_BUDGET:
                    raise SystemExit("token budget exhausted")
            conn = getattr(self.local, "conn", None)
            fresh = conn is None
            if fresh:
                conn = self.local.conn = http.client.HTTPSConnection(HOST, timeout=120)
            start = time.perf_counter()
            try:
                conn.request("POST", PATH, body=payload, headers=headers)
                resp = conn.getresponse()
                text = resp.read().decode()
                status = resp.status
                upstream = resp.getheader("x-envoy-upstream-service-time")
                request_id = resp.getheader("x-typesafe-request-id")
            except (OSError, http.client.HTTPException) as exc:
                self.local.conn = None
                attempts.append({"error": repr(exc), "seconds": time.perf_counter() - start})
                time.sleep(1 + attempt)
                continue
            record = {
                "status": status,
                "seconds": time.perf_counter() - start,
                "fresh_connection": fresh,
                "upstream_ms": int(upstream) if upstream else None,
                "request_id": request_id,
            }
            attempts.append(record)
            if status == 200:
                data = json.loads(text)
                with self.lock:
                    self.tokens += data["usage"]["input_tokens"]
                return data, attempts
            record["body"] = text[:500]
            if status not in (429, 529, 502, 503):
                break
            time.sleep(2 * (attempt + 1))
        return None, attempts


def chunks(items, size):
    return [items[i : i + size] for i in range(0, len(items), size)]


def run_title(client, arm, bench_id, title, questions, batch, state_variant, fanout=1):
    """Ask all questions for one title in requests of `batch` questions each."""
    state = make_state(title, state_variant)
    groups = chunks(list(questions.items()), batch)
    start = time.perf_counter()

    def ask(group):
        return client.post({"model": MODEL, "state": state, "questions": dict(group)})

    if fanout > 1:
        with ThreadPoolExecutor(fanout) as pool:
            results = list(pool.map(ask, groups))
    else:
        results = [ask(g) for g in groups]
    wall = time.perf_counter() - start
    answers, requests, tokens, out_tokens, models = {}, [], 0, 0, set()
    for data, attempts in results:
        requests.append(attempts)
        if data is None:
            continue
        models.add(data["model"])
        tokens += data["usage"]["input_tokens"]
        out_tokens += data["usage"]["output_tokens"]
        for qid, ans in data["answers"].items():
            ans.pop("legend", None)
            answers[qid] = ans
    return {
        "arm": arm,
        "benchmark_id": bench_id,
        "batch": batch,
        "fanout": fanout,
        "state_variant": state_variant,
        "question_count": len(questions),
        "answered": len(answers),
        "request_count": len(groups),
        "wall_seconds": wall,
        "input_tokens": tokens,
        "output_tokens": out_tokens,
        "models": sorted(models),
        "requests": requests,
        "answers": answers,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", required=True, choices=["sweep", "designs", "mega", "repeat", "fanout", "throughput"])
    parser.add_argument("--titles", type=int, default=10)
    args = parser.parse_args()

    client = Client(load_key())
    glossary = load_glossary()
    titles = load_titles()[: args.titles]
    sets = {d: {f"{d}.{k}": make_question(d, k, text) for k, text in glossary} for d in ("l10", "l6", "pres")}
    out = PRIVATE / "runs"
    out.mkdir(parents=True, exist_ok=True)
    records = []

    def each(arm, questions, batch, variant="parity", fanout=1):
        for bench_id, title in titles:
            rec = run_title(client, arm, bench_id, title, questions, batch, variant, fanout)
            records.append(rec)
            print(f"{arm:>16} {bench_id:<14} batch={batch:<3} req={rec['request_count']:<3} "
                  f"answered={rec['answered']}/{rec['question_count']} wall={rec['wall_seconds']:.2f}s tokens={rec['input_tokens']}", flush=True)

    if args.stage == "sweep":
        for batch in BATCH_SIZES:
            each(f"l10-b{batch}", sets["l10"], batch)
    elif args.stage == "designs":
        each("l6-b74", sets["l6"], 74)
        each("pres-b74", sets["pres"], 74)
        each("l10-blind-b74", sets["l10"], 74, variant="blind")
    elif args.stage == "mega":
        each("mega-b148", {**sets["l10"], **sets["pres"]}, 148)
        each("mega-b222", {**sets["l10"], **sets["pres"], **sets["l6"]}, 222)
    elif args.stage == "repeat":
        each("l10-b74-repeat", sets["l10"], 74)
    elif args.stage == "fanout":
        for batch in (1, 5, 10):
            each(f"l10-b{batch}-fanout16", sets["l10"], batch, fanout=16)
    elif args.stage == "throughput":
        start = time.perf_counter()
        with ThreadPoolExecutor(len(titles)) as pool:
            recs = list(pool.map(lambda bt: run_title(client, "l10-b74-parallel-titles", bt[0], bt[1], sets["l10"], 74, "parity"), titles))
        records.extend(recs)
        records.append({"arm": "throughput-summary", "titles": len(recs), "wall_seconds": time.perf_counter() - start})
        print(f"{len(recs)} titles in {records[-1]['wall_seconds']:.2f}s")

    path = out / f"{args.stage}-{time.strftime('%Y%m%dT%H%M%S')}.json"
    path.write_text(json.dumps({"stage": args.stage, "model": MODEL, "records": records}, indent=1))
    print(f"wrote {path.relative_to(ROOT)}; input tokens this stage: {client.tokens} (${client.tokens * USD_PER_INPUT_TOKEN:.4f})")


if __name__ == "__main__":
    main()

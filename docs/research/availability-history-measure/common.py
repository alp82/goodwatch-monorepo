# Shared helpers for the read-only availability measurement of issue #678.
# Every request is a TMDB API GET with the local dev key. Nothing writes to GoodWatch.
import datetime
import gzip
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
ENV_FILE = "/home/alp/dev/projects/goodwatch/goodwatch-monorepo/goodwatch-webapp/.env"
END_DATE = "2026-11-06"  # the measurement stops itself after this UTC day

# Offer types the "New on" pages count. TMDB names them flatrate, free and ads.
TYPES = ("flatrate", "free", "ads")


def _key():
    for line in open(ENV_FILE):
        line = line.strip()
        if line.startswith("TMDB_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("TMDB_API_KEY missing")


KEY = _key()
STATS = {"requests": 0, "retries": 0, "refused": 0, "failed": 0}
_lock = threading.Lock()


def now():
    return datetime.datetime.now(datetime.UTC)


def stamp():
    return now().isoformat(timespec="seconds")


def expired():
    return now().date().isoformat() > END_DATE


def get(path, fresh=True, **params):
    """GET a TMDB API path. fresh=True adds an unknown query parameter so CloudFront
    misses its cache (TMDB responses carry max-age of up to about 8 hours)."""
    params["api_key"] = KEY
    if fresh:
        params["cb"] = f"{time.time_ns()}"
    url = "https://api.themoviedb.org/3" + path + "?" + urllib.parse.urlencode(params)
    for attempt in range(7):
        with _lock:
            STATS["requests"] += 1
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            with _lock:
                STATS["retries"] += 1
                if e.code == 429:
                    STATS["refused"] += 1
            time.sleep(min(2**attempt, 60))
        except Exception:
            with _lock:
                STATS["retries"] += 1
            time.sleep(min(2**attempt, 60))
    with _lock:
        STATS["failed"] += 1
    raise RuntimeError("failed " + path)


def offers(providers_result, region=None):
    """Turn a /watch/providers result into a set of 'CC:provider_id:type' strings."""
    out = set()
    if not providers_result:
        return out
    for cc, v in providers_result.get("results", {}).items():
        if region and cc != region:
            continue
        for t in TYPES:
            for p in v.get(t, []):
                out.add(f"{cc}:{p['provider_id']}:{t}")
    return out


def append_jsonl_gz(name, record):
    with gzip.open(os.path.join(DATA, name), "at") as f:
        f.write(json.dumps(record, separators=(",", ":")) + "\n")


def read_jsonl_gz(name):
    path = os.path.join(DATA, name)
    if not os.path.exists(path):
        return []
    out = []
    with gzip.open(path, "rt") as f:
        for line in f:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass  # a run killed mid-write leaves a partial last line
    return out

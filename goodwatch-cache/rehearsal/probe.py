# A second client loop for the rehearsal, with the client the Windmill scripts use:
# redis-py 5.2.1 RedisCluster, built as in goodwatch-flows/windmill/f/db/redis.py.
# Writes its own 5,000 keys first, then reads and writes them and prints one JSON line
# per second. Usage: REDIS_HOSTS=a,b,c REDIS_PASS=... python probe.py >> probe-py.log
import json
import os
import random
import time
from datetime import datetime, timezone

from redis.cluster import ClusterNode, RedisCluster

KEYS = 5000
RATE = int(os.environ.get("RATE", "50"))
hosts = [host for host in os.environ["REDIS_HOSTS"].split(",") if host]
r = RedisCluster(
    startup_nodes=[ClusterNode(host, 6379) for host in hosts],
    password=os.environ["REDIS_PASS"],
    decode_responses=True,
)
value = "x" * 10_000
for i in range(KEYS):
    r.set(f"cached-py:{i}", f"{i}|{value}", ex=86400)

while True:
    second = time.monotonic()
    outcomes: dict[str, int] = {}
    slowest = 0.0
    for _ in range(RATE):
        i = random.randrange(KEYS)
        started = time.monotonic()
        try:
            if random.random() < 0.8:
                got = r.get(f"cached-py:{i}")
                name = "get:ok" if got is None or got.startswith(f"{i}|") else "get:wrong"
            else:
                r.set(f"cached-py:{i}", f"{i}|{value}", ex=86400)
                name = "set:ok"
        except Exception as error:  # noqa: BLE001 - the loop records every error class
            name = f"error:{type(error).__name__}:{str(error)[:60]}"
        slowest = max(slowest, time.monotonic() - started)
        outcomes[name] = outcomes.get(name, 0) + 1
        time.sleep(max(0.0, 1 / RATE - (time.monotonic() - started)))
    print(json.dumps({"t": datetime.now(timezone.utc).isoformat(), "max_ms": round(slowest * 1000, 1), "outcomes": outcomes}), flush=True)
    time.sleep(max(0.0, 1 - (time.monotonic() - second)))

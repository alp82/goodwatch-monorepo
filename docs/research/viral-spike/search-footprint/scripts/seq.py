#!/usr/bin/env python3
"""Runs searches one at a time against the measurement instance and records, per search, the wall time and the CPU
time each thread group of the Node process used (from /proc/<pid>/task/<tid>/schedstat, nanoseconds).
usage: seq.py <queries.json> <out.jsonl> [--discover] [--pause 0.3]"""
import json, os, subprocess, sys, time, urllib.request
U = "http://172.31.252.20:3000"
pid = subprocess.check_output(["docker", "inspect", "gw-search-footprint", "--format", "{{.State.Pid}}"]).decode().strip()
def cpu():
    out = {}
    base = f"/proc/{pid}/task"
    for tid in os.listdir(base):
        try:
            comm = open(f"{base}/{tid}/comm").read().strip()
            ns = int(open(f"{base}/{tid}/schedstat").read().split()[0])
        except OSError:
            continue
        out[comm] = out.get(comm, 0) + ns
    return out
queries = json.load(open(sys.argv[1]))
discover = "--discover" in sys.argv
pause = float(sys.argv[sys.argv.index("--pause") + 1]) if "--pause" in sys.argv else 0.3
with open(sys.argv[2], "w") as out:
    for item in queries:
        body = {"q": item["q"], "filters": {}, "allTitles": False}
        if discover: body["discover"] = True
        if "--all-titles" in sys.argv: body["allTitles"] = True
        req = urllib.request.Request(U + "/api/combined-search", data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "Cookie": "gw_browser=1"})
        before = cpu(); t = time.perf_counter()
        try:
            raw = urllib.request.urlopen(req, timeout=60).read()
        except Exception as error:
            out.write(json.dumps({"type": item["type"], "error": str(error)[:80]}) + "\n"); continue
        wall = (time.perf_counter() - t) * 1000
        time.sleep(0.15)  # the history step and trailing work run after the response
        after = cpu()
        batch = next((m["batch"] for m in (json.loads(l) for l in raw.decode().splitlines() if l.strip()) if m.get("kind") == "batch"), None)
        row = {"type": item["type"], "words": len(item["q"].split()), "wallMs": round(wall, 1), "bytes": len(raw),
               "cpuMs": {k: round((after.get(k, 0) - before.get(k, 0)) / 1e6, 1) for k in after if after.get(k, 0) - before.get(k, 0) > 50_000}}
        if batch:
            row.update(basic="Showing basic search results." in batch["errors"], errors=batch["errors"], elapsedMs=batch["elapsedMs"], rows=len(batch["rows"]), reading=len(batch["reading"]), people=len(batch["people"]), mode=batch["mode"])
        out.write(json.dumps(row) + "\n"); out.flush()
        time.sleep(pause)

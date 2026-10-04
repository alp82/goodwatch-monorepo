#!/usr/bin/env python3
import json, sys, statistics as st
rows = [json.loads(l) for l in open(sys.argv[1])]
def pct(v, p):
    v = sorted(v); return v[min(len(v) - 1, int(round(p * (len(v) - 1))))] if v else float("nan")
groups = {}
for r in rows:
    if "error" in r: groups.setdefault(("ERROR", r["type"]), []).append(r); continue
    groups.setdefault(("basic" if r.get("basic") else "ranked", r["type"]), []).append(r)
    groups.setdefault(("basic" if r.get("basic") else "ranked", "ALL"), []).append(r)
threads = ["MainThread", "query-encoder", "libuv-worker", "V8Worker"]
print("path\ttype\tn\twall_p50\twall_p95\tserver_p50\t" + "\t".join(f"cpu_{t}_avg" for t in threads) + "\tcpu_total_avg\tbytes_avg")
for (path, kind), g in sorted(groups.items()):
    if path == "ERROR": print(path, kind, len(g)); continue
    cpu = {t: st.mean(r["cpuMs"].get(t, 0) for r in g) for t in threads}
    total = st.mean(sum(r["cpuMs"].values()) for r in g)
    print(f"{path}\t{kind}\t{len(g)}\t{pct([r['wallMs'] for r in g], .5):.0f}\t{pct([r['wallMs'] for r in g], .95):.0f}\t{pct([r['elapsedMs'] for r in g], .5):.0f}\t" + "\t".join(f"{cpu[t]:.1f}" for t in threads) + f"\t{total:.1f}\t{st.mean(r['bytes'] for r in g)/1024:.0f}k")

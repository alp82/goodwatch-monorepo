# One-off: the state now of every event title, fresh and cached, and its first change in the
# earlier (cached) panel snapshots of 2026-10-15 and 2026-10-16.
import json, os, sys, glob, datetime
sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, get, offers
from concurrent.futures import ThreadPoolExecutor
ev = json.load(open(os.path.join(DATA, "events.json")))
def st(e):
    pids = {str(p) for p in e["providers"]}
    out = {}
    for fresh in (True, False):
        o = [x for x in offers(get(f"/{e['media']}/{e['id']}/watch/providers", fresh=fresh)) if x.split(":")[1] in pids]
        out["fresh" if fresh else "cached"] = sorted({x.split(":")[0] for x in o})
    return e, out
with ThreadPoolExecutor(6) as ex: res = list(ex.map(st, ev))
SCR = sys.argv[1]
snaps = sorted(glob.glob(SCR + "/snap*-2026-10-1*.json"))
US = {}
for f in snaps:
    s = json.load(open(f))
    US[s["at"]] = {l["media"]: set(l["ids"]) for l in s["lists"] if l["reg"] == "US" and l["pid"] == 8}
out = []
for e, o in res:
    m = e["media"]
    hist = [(at, e["id"] in v.get(m, set())) for at, v in sorted(US.items())]
    out.append({**e, "now_fresh": o["fresh"], "now_cached": o["cached"], "panel_us": hist})
json.dump(out, open(os.path.join(DATA, "retro-2026-10-16.json"), "w"))
print("saved", len(out))

# Round 2 fixtures (start lab): browse teaser rows and similar titles, from guest Discover browse pages (read-only).
import json, os, time, urllib.request, urllib.parse
OUT = "/home/alp/.cache/start-lab/fixtures/browse2"
G = "/home/alp/.cache/start-lab/fixtures/guest.json"
os.makedirs(OUT, exist_ok=True)
def fetch(name, params):
    path = os.path.join(OUT, name + ".json")
    if os.path.exists(path):
        return json.load(open(path))["cards"]
    q = {"unseen": "0", "foryou": "0", "sort": "popular", "page": "1", "services": "all", **params}
    url = "https://goodwatch.app/api/discover/results?" + urllib.parse.urlencode(q)
    body = json.dumps({"guest": {"interactions": [], "country": "US", "services": None}}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 start-lab-fixture"})
    for attempt in range(3):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=60)); break
        except Exception as e:
            print("retry", name, e); time.sleep(2)
    else:
        return []
    cards = d.get("cards") or []
    json.dump({"params": q, "cards": cards}, open(path, "w"))
    time.sleep(0.3)
    return cards
votes = lambda c: c.get("goodwatch_overall_score_voting_count") or 0
def good(cards, mv=100_000, sv=40_000, n=16):
    out = [c for c in cards if c.get("poster_path") and votes(c) >= (mv if c["media_type"] == "movie" else sv)]
    return out[:n]
browse = {"genres": {"movie": [], "show": []}, "services": [], "best": {}, "newOn": []}
for g in ["Comedy", "Drama", "Science Fiction", "Animation", "Horror", "Thriller", "Romance", "Documentary"]:
    browse["genres"]["movie"].append({"name": g, "titles": good(fetch(f"genre-movie-{g}", {"genres": g, "type": "movie", "score": "65"}), mv=50_000 if g == "Documentary" else 100_000)})
for g in ["Comedy", "Drama", "Crime", "Sci-Fi & Fantasy", "Animation", "Mystery", "Documentary"]:
    browse["genres"]["show"].append({"name": g, "titles": good(fetch(f"genre-show-{g}", {"genres": g, "type": "show", "score": "70"}), sv=10_000 if g == "Documentary" else 40_000)})
SERVICES = [(8, "Netflix", "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg"), (9, "Prime Video", "/pvske1MyAoymrs5bguRfVqYiM9a.jpg"), (337, "Disney Plus", "/97yvRBw1GzX7fXprcF80er19ot.jpg"), (1899, "HBO Max", "/jbe4gVSfRlbPTdESXhEKpornsfu.jpg"), (15, "Hulu", "/bxBlRPEPpMVDc4jMhSrTf2339DW.jpg"), (350, "Apple TV", "/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg")]
intro = json.load(open("/home/alp/.cache/start-lab/fixtures/intro.json"))
logos = {}
for c in intro.get("pool", []):
    for s in c.get("services") or []:
        logos.setdefault(s["id"], s.get("logo_path"))
for sid, name, fallback in SERVICES:
    browse["services"].append({"id": sid, "name": name, "logo_path": logos.get(sid) or fallback, "titles": good(fetch(f"service-{sid}", {"services": str(sid), "score": "70"}), mv=60_000, sv=30_000)})
browse["best"]["movie"] = good(fetch("best-movie", {"type": "movie", "score": "85"}), mv=300_000, n=20)
browse["best"]["show"] = good(fetch("best-show", {"type": "show", "score": "87"}), sv=100_000, n=20)
newest = fetch("new-on", {"sort": "newest", "services": "8,9,337,1899,15,350", "score": "68"}) + fetch("new-on-2", {"sort": "newest", "services": "8,9,337,1899,15,350", "score": "68", "page": "2"})
browse["newOn"] = [c for c in newest if c.get("poster_path") and votes(c) >= 5_000][:16]
g = json.load(open(G))
g["browse"] = browse
# Similar titles for everything the stage and the recs can show.
seen = {}
for m in g["moods"]:
    for c in m["titles"]: seen[c["key"]] = c
for p in g["prompts"]:
    for c in p["titles"]: seen[c["key"]] = c
for c in g.get("popular", []) + g.get("topRated", []): seen[c["key"]] = c
sim = g.get("similar", {})
n = 0
for key in seen:
    if str(key) in sim and len(sim[str(key)]) >= 6: continue
    cards = fetch(f"similar-{key}", {"similar": str(key), "score": "65"})
    sim[str(key)] = [c for c in cards if c["key"] != key and c.get("poster_path") and votes(c) >= 20_000][:12]
    n += 1
g["similar"] = sim
json.dump(g, open(G, "w"), indent=1, ensure_ascii=False)
print("similar fetched", n, "total", len(sim))
for k, v in browse["genres"].items(): print(k, [(x["name"], len(x["titles"])) for x in v])
print("services", [(x["name"], len(x["titles"])) for x in browse["services"]])
print("best", {k: len(v) for k, v in browse["best"].items()}, "newOn", len(browse["newOn"]), [c["title"] for c in browse["newOn"][:8]])
print("best movies", [c["title"] for c in browse["best"]["movie"][:10]])

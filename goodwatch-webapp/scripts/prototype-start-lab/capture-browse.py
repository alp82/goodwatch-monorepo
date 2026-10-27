# Capture Discover browse pages (read-only, no search) as a guest for the start lab fixtures.
import json, sys, time, urllib.request, urllib.parse, os
OUT = "/home/alp/.cache/start-lab/fixtures/browse"
def fetch(name, params):
    path = os.path.join(OUT, name + ".json")
    if os.path.exists(path):
        return json.load(open(path))
    q = {"services": "all", "unseen": "0", "foryou": "0", "sort": "popular", "page": "1", **params}
    url = "https://goodwatch.app/api/discover/results?" + urllib.parse.urlencode(q)
    body = json.dumps({"guest": {"interactions": [], "country": "US", "services": None}}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 start-lab-fixture"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    cards = d.get("cards") or []
    json.dump({"params": q, "cards": cards}, open(path, "w"))
    time.sleep(0.4)
    return {"params": q, "cards": cards}
MOODS = ["funny","feelgood","romance","action","scary","crime","mind","heavy","worlds","history","growing"]
for m in MOODS:
    fetch(f"mood-{m}-movie", {"moods": m, "type": "movie", "score": "70"})
    fetch(f"mood-{m}-show", {"moods": m, "type": "show", "score": "75"})
PROMPTS = {
    "cozy": {"themes": "mystery", "moods": "feelgood,funny", "score": "65"},
    "cozy2": {"themes": "mystery,crime", "moods": "funny", "score": "65"},
    "severance": {"similar": "2000000095396", "moods": "funny", "score": "65"},
    "severance2": {"similar": "2000000095396", "score": "70"},
    "scifi": {"type": "movie", "themes": "mind,future", "maxRuntime": "120", "score": "70"},
    "scifi2": {"type": "movie", "themes": "future", "moods": "mind", "runtime": "0-120", "score": "70"},
    "partner": {"type": "show", "moods": "feelgood,romance", "score": "75", "released": "2010s"},
    "partner2": {"type": "show", "moods": "feelgood,funny", "score": "78"},
    "thriller": {"moods": "mind,heavy", "themes": "crime", "score": "72"},
    "thriller2": {"type": "movie", "moods": "mind", "themes": "crime,mystery", "score": "72"},
    "animated": {"type": "movie", "styles": "animated", "score": "75"},
}
for k, p in PROMPTS.items():
    fetch(f"prompt-{k}", p)
print("done")

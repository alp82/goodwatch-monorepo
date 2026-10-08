#!/usr/bin/env python3
"""warm.py <base url> <queries file> [--select <out file>]

One search at a time over the query list, against the search role. It fills the search role's in-process title
lookup cache, so that the load runs send no TMDB request per search. With --select it also writes the texts that
ended ranked (a recorded reading matched and the ranking served), which the load runs use.
Prints counts per outcome and the response times, never a search text.
"""
import json
import sys
import time
import urllib.request

base, queries_file = sys.argv[1:3]
select = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == "--select" else None
queries = json.load(open(queries_file))
counts, times, ranked = {}, [], []
for q in queries:
    body = json.dumps({"q": q, "filters": {}, "allTitles": False, "discover": True}).encode()
    request = urllib.request.Request(base + "/api/combined-search", data=body, headers={"Content-Type": "application/json"})
    started = time.time()
    result = "error"
    for attempt in range(3):
        try:
            text = urllib.request.urlopen(request, timeout=30).read().decode()
            if '{"kind":"batch"' in text:
                result = "basic" if '"errors":["Showing basic search results.' in text else "ranked"
            break
        except Exception as error:  # A 503 busy answer or a connection error: try again.
            result = f"error:{type(error).__name__}"
            time.sleep(1)
    times.append((time.time() - started) * 1000)
    counts[result] = counts.get(result, 0) + 1
    if result == "ranked":
        ranked.append(q)
times.sort()
print(json.dumps({"searches": len(queries), "outcomes": counts, "p50_ms": round(times[len(times) // 2]), "p95_ms": round(times[int(len(times) * 0.95)]), "max_ms": round(times[-1])}))
if select:
    json.dump(ranked, open(select, "w"), ensure_ascii=False)

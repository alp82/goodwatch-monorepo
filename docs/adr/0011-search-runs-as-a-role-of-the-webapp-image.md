---
status: accepted
---

# Run search as a search role of the webapp image, behind the proxy

Search moves out of the page instances into its own processes. A search role is the webapp image started with
`WEBAPP_ROLE=search`, and the proxy sends the search route and the command palette straight to it. Decided on
October 8 and 9, 2026, as part of the map "Serve a viral traffic spike", with the ticket
[Decide whether search becomes its own service](https://github.com/alp82/goodwatch-monorepo/issues/251). The
settings, and what each role loads: [search-role.md](../search-role.md).

A ranked search costs about 84 ms of the process's one main thread, next to the page renders. In one process with
today's encoder setting, 5 searches per second took the warm page p95 from 124 to 1,520 ms. The query models, the
search index, and the people index also make every page instance about 1.76 GB heavier, which is paid again for
each further instance.

## Choices

- **A role of the same image, chosen by one setting.** `WEBAPP_ROLE` is `page`, `search`, or `both`. The default is
  `both`, which is the webapp as it was. The search role runs the existing TypeScript search code, so its vectors
  and its ranking are the ones the graded queries were checked against.
- **What moves:** the query encoder, the search index, the people index, the ranking, the reading call, the
  in-flight limit, and the command palette's title lookup. A page instance loads none of it.
- **The proxy is in front.** It sends `/api/combined-search` and `/api/command-palette` to the search roles,
  balanced, with a health check on `/health/ready`. A search costs the page instances nothing.
- **Down or full means the busy answer.** A role that's full answers 503 with `Retry-After`, as the in-flight limit
  already did. When no role answers, the proxy's bare 502, 503, or 504 reaches the browser, which treats it as the
  busy answer. A page instance that gets a search anyway answers busy too. It has no basic-results fallback: 20 of
  those per second would take about half a page instance's main thread.
- **The command palette falls back to TMDB.** A page instance answers a palette lookup from the TMDB title search
  that already served while the index loaded.
- **One encoder with 2 threads per role, in-flight limit 4.** On 4 cores, 2 threads held 10 ranked searches per
  second where 4 threads held 5. The limit of 8 added 10% to 15% per role and cost 400 to 500 ms of p95. With the
  limit at 64, overload ended as basic results instead of busy answers.
- **More searches come from more roles.** The roles share nothing in memory that matters across requests: the
  reading cache, the lock, the rate counters, and the spending record were already in shared stores.

Rejected:

- **Staying in the page process.** Pages and searches share one main thread and the encoder's cores. With search in
  its own process, the warm page p95 stays between 74 and 92 ms up to 20 searches per second.
- **The webapp's route in front of the search role.** Both variants serve searches equally well. This one costs
  each page instance about 10 ms of main-thread time per search for the session check, the call, and passing the
  response through, so a flood of searches would land on pages again. It also needs a shared key and its own
  balancing.
- **An embedding server.** Every candidate wraps the same ONNX Runtime library, so none encodes faster on CPU. The
  encoder isn't what holds the main thread: the ranking is, and it would stay in the page process. Other servers'
  default model files also risk different vectors.
- **A rewrite in another runtime.** The encode runs in the same C++ library in every runtime. A port repeats the
  parity work for about 4,800 lines of ranker, and no measured comparison promises a gain.
- **Ranking inside Qdrant.** The ranker's z-score over the candidate pool, its weighted fusion, and everything that
  reads in-memory tables can't move there. Moving the rest needs a different ranker and the graded queries again.

## Consequences

- A page instance is about 1.76 GB lighter, so a further page instance costs about 0.6 GB.
- One role ranks about 9 searches per second within the 1,500 ms deadline, and each further role adds 8 to 9. Two
  roles hold about 16 at about 0.8 seconds p95. The overflow gets the busy answer with Retry.
- A role peaks at 2.1 to 3.1 GB and never needed more than 3 cores.
- When every search role is down, search answers busy and the command palette answers from TMDB. Pages are
  unaffected.
- A search role's readiness waits for the search index. The ranking doesn't read the title snapshot, so a role
  starts without one, but member taste on results needs it.
- A search role still answers every other route of the image. Only the proxy's rule keeps pages away from it.
- Members reach the search role directly, so it needs the session settings and the stores that the search route
  reads, like a page instance.
- Nothing changes until a deploy sets the roles: [Deploy two search roles on vector1 and route the search paths to
  them](https://github.com/alp82/goodwatch-monorepo/issues/400). The browser's side is
  [Treat a bare gateway error on the search paths as the busy answer](https://github.com/alp82/goodwatch-monorepo/issues/399).

Evidence:

- The [search role benchmark](https://github.com/alp82/goodwatch-monorepo/blob/bench/search-role/docs/benchmarks/search-role.md)
  on branch `bench/search-role`, for
  [Benchmark the search role behind the webapp's route and behind the proxy](https://github.com/alp82/goodwatch-monorepo/issues/390)
  and
  [Benchmark search roles on vector1 and the worker hosts behind one route](https://github.com/alp82/goodwatch-monorepo/issues/397).
- [Measure the search footprint in the webapp process](https://github.com/alp82/goodwatch-monorepo/issues/252).
- [Research: where a service boundary cuts through search](https://github.com/alp82/goodwatch-monorepo/issues/388)
  and
  [Research: serving query encoding and ranking under concurrent load](https://github.com/alp82/goodwatch-monorepo/issues/389).
- The role setting itself:
  [Add the process role setting to the webapp](https://github.com/alp82/goodwatch-monorepo/issues/398).

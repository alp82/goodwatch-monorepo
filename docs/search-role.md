# The process role: page instance, search role, or both

One webapp image starts as a page instance, as a search role, or as both. A search role holds the query models and
the indexes and does the search work, so that a page instance doesn't. This page lists the settings, what each role
loads, how the roles run in production, and how to start each role locally. The decision is
[ADR 0011](adr/0011-search-runs-as-a-role-of-the-webapp-image.md). The code is
`goodwatch-webapp/app/server/role.server.ts`.

With the default setting nothing changes: the process is both, as before.

## Settings

All are environment variables of the webapp, read while the process runs. A change needs a restart, not a build.

| Setting | Values | Default |
| --- | --- | --- |
| `WEBAPP_ROLE` | `page`, `search`, or `both`. Case and surrounding spaces don't matter. | `both` |
| `SEARCH_ENCODER_THREADS` | Threads of the query encoder, 1 to 64. | 2 in the search role. Otherwise half the cores, at most 4. |
| `SEARCH_MAX_IN_FLIGHT` | Searches that run at once in this process. One more gets the busy answer. | 4 |

- An unknown value of `WEBAPP_ROLE` counts as `both`, and the role line in the log says so.
- The first log line of a process names its role, for example `Process role: search`.
- A search role needs what search needs in any role: the Crate and Qdrant settings, `SEARCH_STORAGE_KEY`,
  `TYPESAFE_API_KEY`, and the model files (`SEARCH_MODEL_DIR`). Members reach it directly, so it also needs the
  session settings and the cache settings of a page instance.
- The two defaults come from the
  [search role benchmark](https://github.com/alp82/goodwatch-monorepo/blob/bench/search-role/docs/benchmarks/search-role.md)
  on branch `bench/search-role`: one role ranks about 9 searches per second with them.

## What each role loads

| | `page` | `search` | `both` |
| --- | --- | --- | --- |
| Query models and the encoder | No | Yes, 2 threads | Yes, half the cores, at most 4 |
| Search index | No | Yes | Yes |
| People index | No | Yes | Yes |
| Open connections for the reading call | No | Yes | Yes |
| `POST /api/combined-search` | The busy answer: 503 with `Retry-After` | Search | Search |
| `GET /api/command-palette` | Titles from the TMDB title search | Titles from the search index | Titles from the search index |
| Readiness waits for the search index | No | Yes | Yes |
| Title snapshot, page cache, static files | Yes | Yes | Yes |
| Metrics port | Yes | Yes | Yes |

- **A page instance does no search work.** Its memory is about 1.76 GB lower than with search. The proxy is meant
  to send the two search paths to the search roles. The answers in the table are what a page instance gives when a
  request for them arrives anyway.
- **A search role is a whole webapp.** It answers every route. Only the proxy's rule keeps pages away from it.
- **A search role becomes ready without a title snapshot.** The ranking doesn't read the snapshot. Without one,
  readiness is reported when the wait limit ends (`READY_MAX_WAIT_MS`, 30 seconds), and member taste on results is
  missing.
- **Every role serves metrics from its start.** Before roles, the metrics started with the first page request, which
  a search role never gets.

## How the roles run

In production, two search roles run on vector1 from a compose file,
[`goodwatch-search/docker-compose.yml`](../goodwatch-search/docker-compose.yml), not as Coolify applications.

- **Names:** the containers `goodwatch-search-a` and `goodwatch-search-b` on the `coolify` network. vector1's proxy
  balances the two search paths across them and asks `/health/ready` every 2 seconds.
- **Image:** the one that Coolify builds and pushes for every deploy of the webapp, tagged with the commit. The
  compose file sets `WEBAPP_ROLE=search`, `SEARCH_MAX_IN_FLIGHT=4`, and `SOURCE_COMMIT`. The rest comes from a
  `.env` file on the host.
- **Deploys are explicit.** A push to `main` deploys the page instances only. `./deploy.sh <commit>` in
  `goodwatch-search/` on vector1 restarts one role at a time and waits for each to be ready.
- **Behind is normal, and checked.** The roles can run an older commit than the page instances. `./bench.sh smoke`
  warns when a role is behind in a file that a search role runs.

The steps, the checks, and what Coolify can and can't do to these containers:
[search-role-deploy.md](search-role-deploy.md). A further role on a worker host:
[search-role-runbook.md](search-role-runbook.md). The commands:
[goodwatch-search/README.md](../goodwatch-search/README.md).

## Start a role locally

Build once, then start the build with the role. Run both in `goodwatch-webapp/`, with a `.env` file there:

```sh
npm run build
WEBAPP_ROLE=search PORT=3001 METRICS_PORT=9465 \
  node --env-file=.env node_modules/.bin/remix-serve ./build/server/index.js
```

- Use `WEBAPP_ROLE=page` for a page instance, and leave the setting out for both.
- Give each process its own `PORT` and `METRICS_PORT` to run two roles next to each other.
- Check a role by its first log line, by `GET /health/ready` on its port, and by `GET /metrics` on its metrics port.
- A page instance logs no `Search ranking`, `Search index`, or `People index` line. A search role logs
  `Search ranking: query models ready in … ms, 2 encoder threads`.
- Stop the process with `kill -INT`.

A started build writes its hashed files to the cache that `.env` names, so that another instance can serve them
during a deploy ([webapp-deploys.md](webapp-deploys.md)). Point the cache settings at a local or unreachable address
when that write isn't wanted. A search role then still starts, as described above.

A ranked search writes a history row to the Crate that `.env` names.

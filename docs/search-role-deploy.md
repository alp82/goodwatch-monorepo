# Deploy the search roles

The steps that put search into its own processes in production, for [Deploy two search roles on vector1 and route the search paths to them](https://github.com/alp82/goodwatch-monorepo/issues/400). Prepared on October 9, 2026. Nothing in this document is installed yet.

The decision is in [Decide whether search becomes its own service](https://github.com/alp82/goodwatch-monorepo/issues/251) and in [ADR 0011](adr/0011-search-runs-as-a-role-of-the-webapp-image.md). The measurements are in the [search role benchmark](https://github.com/alp82/goodwatch-monorepo/blob/bench/search-role/docs/benchmarks/search-role.md) on branch `bench/search-role`.

## The target

- **Two search roles on vector1.** Each is a container of the webapp image with `WEBAPP_ROLE=search`: one encoder with 2 threads, and at most 4 searches in flight.
- **The route.** abio's proxy sends `POST /api/combined-search` and `GET /api/command-palette` to the search roles. Every other request keeps going to the page instances.
- **The page instances** run with `WEBAPP_ROLE=page` afterward, and each one gets about 1.76 GB lighter.
- **Order:** search roles up, route on, checks, then the page role. Each step is undone by itself.

## What's prepared

| File | What it is |
| --- | --- |
| `goodwatch-proxy/traefik/goodwatch-search.yaml` | The route on abio's proxy: the two paths go to vector1's proxy. |
| `goodwatch-proxy/traefik/goodwatch-search-instance.yaml` | The route on vector1's proxy: it balances across the two roles and checks `/health/ready` every 2 seconds. |
| `goodwatch-proxy/traefik/test-search-local.sh` | The test of both files, with the two Traefik versions and four stubs on this machine. |
| `goodwatch-metrics/search-role.alloy`, `docker-compose.search-role.yml` | The metrics scrape for the roles on vector1. |
| `goodwatch-benchmark/smoke/search-role-urls.json`, and role handling in `./bench.sh smoke` | The smoke check for a search role, and for a page role. |

### Why two proxy files

abio's proxy reaches vector1 through one address: vector1's proxy. It can't tell two containers behind that address apart, so the balancing and the health check per role run in vector1's proxy, which sees each role by its network alias. abio's proxy only decides which requests go there.

- **A request header connects the two files.** abio's router adds `X-Gw-Role: search`, and vector1's router requires it. Without it, installing vector1's file would already move half of the searches: `goodwatch-balance.yaml` sends every second request to vector1 today, the search paths among them.
- **abio's proxy checks vector1's proxy,** not the roles: it asks for the proxy's own `/ping` every 2 seconds. With vector1 away, a search gets a 503 at once.
- **No sticky cookie** and no member router: the roles keep nothing in memory that a person's next request needs.
- **Both files have a placeholder for a private address,** because the repository is public. Replace it while pasting.

### What the test shows

`./test-search-local.sh` in `goodwatch-proxy/traefik/` passes 59 checks with Traefik v2.10.7 (abio) and v3.6.25 (vector1). It also passes against a copy of the balancing file that is installed on abio today, which is older than the one in the repository.

| Case | Result |
| --- | --- |
| Paths | `/api/combined-search` and `/api/command-palette` reach the roles, with or without a query string. `/`, `/api/search-config`, `/health/ready`, a longer path, a trailing slash, and a query string that contains a search path stay with the page instances. The method isn't matched: the app answers a wrong one. |
| Balancing | 20 requests: 10 per role, for lookups, searches, and member searches. |
| Only vector1's file installed | Nothing changes. |
| Request headers and body | The method, the path, the body, `Cookie`, `Origin`, `Content-Type`, `Accept-Language`, and a custom header arrive unchanged. `X-Real-Ip` is the visitor's address, the same value that the page instance on abio gets, and a value that the visitor sends is replaced. `X-Forwarded-For` has abio's address appended, as for the page instance on vector1. |
| Responses | A role's busy answer (503 with `Retry-After`) passes through, and takes no role out. A streamed response isn't held back: the first line arrives after 5 ms, the rest 600 ms later. The proxies add no compression and no cookie. |
| One role killed | No failed request in 10 seconds in three runs: the retry moves a refused connection to the other role. A killed container's address doesn't always refuse the connection: the benchmark saw 9 failed searches of 601 within one second. |
| One role drains (SIGTERM) | No failed request. The health check drops the role within 2 seconds, and the role serves for 8. |
| Both roles down | **503 with the body `no available server`**, `text/plain`, no `Retry-After`, in under 30 ms. In the first second some answers are 502 instead. Pages are unaffected. |
| vector1's proxy down | **503 with the body `Service Unavailable`** from abio's proxy. Up to 2 seconds of 502 before that. |
| abio's file deleted | The two paths go back to the page instances. |
| vector1's file deleted while abio's is installed | The page instance on vector1 gets every search. So delete abio's file first. |

Not covered by the test: network aliases, and a deploy that runs two containers of one role for some seconds. `test-local.sh` covers both for the page instances, with the same mechanism. Docker isn't available to agents on the development machine, so `test-local.sh` wasn't rerun after `test-stub.mjs` gained fields.

## How Coolify can run two roles

Read from Coolify 4.4.3's code and database on October 9, 2026. Nothing was changed.

### The webapp application today

| Setting | Value |
| --- | --- |
| Build | Dockerfile, from the repository's `main`, base directory `/goodwatch-webapp` |
| Source | Public GitHub, with a webhook secret on the application. Auto deploy is on. |
| Registry image name | Set. abio builds and pushes one image per commit, and vector1 pulls it. |
| Servers | abio, and vector1 as an additional server |
| Network alias | `goodwatch-webapp` |
| Health check | `/health/ready`, interval 5 s, timeout 5 s, 10 retries, start period 5 s |
| Limits | Memory 4 GB, no CPU limit |
| Environment | 32 variables, all on the application itself. None is shared at the project or team level. `WEBAPP_ROLE`, `SEARCH_MAX_IN_FLIGHT`, and `SEARCH_ENCODER_THREADS` aren't set. |
| Concurrent builds | 2 on each server |

### Can one application run two containers on vector1?

**No. Verified in the code.**

- A deployment stops every other container of the same application on that server after the new one is healthy. That's the rolling update.
- Replicas exist only for Docker Swarm servers.
- "Add another server" leaves out a server that the application already runs on, also with a second network.

So two roles on vector1 need two application resources, or one resource of the Docker Compose kind.

### The shapes

| Shape | Coolify resources | Capacity (ranked searches per second at 20 sent, in-flight limit 4) | Notes |
| --- | --- | --- | --- |
| **A. Two applications on vector1** | Two clones of the webapp application | 15.8, p95 806 ms (measured: "vector1 twice") | The decided layout. Each role deploys by itself with a rolling update. |
| **B. One Docker Compose application with two services** | One | The same two roles | Compose recreates the services in place, so a deploy has no rolling update: both roles are away while they start. Inferred from the Compose path of the deployment job, not tried. |
| **C. One role on vector1** | One clone | 9.1, p95 890 ms (measured: "vector1") | A higher CPU limit doesn't raise it: a role with the limit at 4 never used more than 2.6 cores. The limit at 8 gave 10.2 at p95 1,313 ms. More than 4 CPUs per role wasn't measured. |
| **D. One application on vector1 with a worker host as an additional server** | One | 16.6, p95 780 ms (measured: "vector1 and worker1") | One resource, one build, same settings on both. The worker hosts aren't Coolify servers, and their route and firewall rules belong to [Write the runbook for adding a search role on a worker host](https://github.com/alp82/goodwatch-monorepo/issues/401). |
| **E. One application on vector1 with abio as an additional server** | One | Not measured | It puts 2.2 to 2.6 cores of search next to the page instance and the proxy on abio's 8 cores. |

Two containers on one host are practical in Coolify as shape A. The cost is two resources with two copies of the environment.

### Which variables differ from the page application

A clone copies all 32 variables. For a search role:

| Variable | Value | Why |
| --- | --- | --- |
| `WEBAPP_ROLE` | `search` | New. The page application gets `page` in the last step. |
| `SEARCH_MAX_IN_FLIGHT` | `4` | New. It's also the search role's default. Setting it makes the decision visible. |
| `SEARCH_ENCODER_THREADS` | Not set | The search role's default is 2. |
| `REC_NAVIGATION` | As cloned | The command palette answers 404 without it. |
| `SEARCH_TRUSTED_IP_HEADER` | As cloned (`X-Real-Ip`) | The per-address scope of the reading budget reads it. |
| Crate, Valkey, Qdrant, Supabase, the reading key, the storage key, the model directory | As cloned | Members reach the search role directly, and it reads the same stores. |

Settings that differ: the network alias, no domain, a CPU limit, and no additional server.

### Does a push to `main` deploy the search roles too?

**Yes, if they're clones. Verified in the code.** The webhook handler queues a deployment for every application with that repository and branch whose webhook secret matches, and a clone keeps the secret.

- **No order between applications.** The queue is per server and per application. The page application starts on abio, and the search applications start on vector1 at the same moment. The page instance on vector1 follows when abio's deployment is done, pinned to the same commit.
- **The search applications build on vector1.** A deployment looks for the commit's image on its server, then pulls it. At that moment abio is still building, so the image isn't there, and each search application builds it. With 2 concurrent builds, both build at once. That's two image builds on the Qdrant host per push, next to the running roles. Measured for neither.
- **With the same registry image name, the builds collide.** Both hosts push the same tag, and the page instance on vector1 then starts from the image that vector1 built, not from abio's. The commit and the Dockerfile are the same. Whether the two images hold the same hashed file names isn't verified.
- **For some minutes per deploy, pages and searches run different commits,** in either order. Page processes never call a search role, so the only contract across builds is the one between the browser's script and the search response. Two page instances on different builds have the same window today.

Options for the owner:

| Option | A push to `main` | Cost |
| --- | --- | --- |
| **1. Clones with their own registry image name** | Deploys the roles. One or two extra builds on vector1. | Build load on the Qdrant host. Set vector1's concurrent builds to 1, and the second role reuses the first one's image. |
| **2. Clones with the webapp's registry image name** | Deploys the roles. Same builds, and the tag collision above. | As option 1, plus the page instance on vector1 may run vector1's build. |
| **3. Docker Image applications that run a fixed tag of the webapp's image** | Doesn't deploy the roles. The owner redeploys them after a change to search. | No build on vector1 and no role restart per push. The roles run an older commit until someone redeploys. The webapp application needs a registry image tag, such as `latest`, which Coolify then pushes with every deploy (verified in the code). A webhook doesn't reach an application without a repository (inferred). |

The role setting needs no simultaneous deploy: `WEBAPP_ROLE` is per application, and a process without it runs as `both`. What must be in order is the code: the image must hold the role setting before a search application starts, and the browser must treat a bare 502, 503, or 504 as the busy answer before the route is on.

### Suggested limits per role

| Limit | Value | From |
| --- | --- | --- |
| CPUs | 4 | The benchmark's cap, which no role reached. A full role used 2.2 to 2.6 cores. |
| Memory | 4 GB | The benchmark's cap. A full role peaked at 2.1 to 2.3 GB, and at 2.8 to 2.9 GB in the first benchmark. |

vector1 has 16 cores and about 14 GB available, with the page instance at 3.0 GB of its 4 GB. Two roles add about 4.6 GB, and about 9 GB for the seconds in which a deploy runs old and new containers of both. The Windmill worker on vector1 has a 19.6 GiB limit and used under 0.1 GB when read.

## Checklist

Each step says who does it. Agents change nothing in Coolify, in a proxy, or on a host without the owner. `<application id>` is the id that Coolify gives a new application: it's the start of its container names.

Don't push to `main` between steps 2 and 4: a clone deploys on a push as soon as it exists.

### 1. Check the prerequisites (agent)

- **Do:** confirm that [Add the process role setting to the webapp](https://github.com/alp82/goodwatch-monorepo/issues/398) and [Treat a bare gateway error on the search paths as the busy answer](https://github.com/alp82/goodwatch-monorepo/issues/399) are on `main` and deployed on both instances.
- **Verify:** `./bench.sh smoke --commit <sha>`, then with `--host abio` and `--host vector1`. Each prints `role both` and passes.
- **Undo:** nothing to undo.

### 2. Choose the shape and the deploy option (owner)

- **Do:** pick a shape and an option from the tables above. The steps below are written for shape A with option 1.
- **Verify:** the choice is written on the issue.
- **Undo:** nothing to undo.

### 3. Create search role A (owner, in Coolify)

- **Do:**
  1. Open the webapp application, then **Resource Operations**, then **Clone to another destination**, and pick vector1's `coolify` destination. Don't clone volume data. The clone starts stopped.
  2. At once, before anything else: **Network aliases** = `goodwatch-search-a`. The clone starts with `goodwatch-webapp`, and a container with that alias on vector1 gets page requests and is scraped as the page instance.
  3. **Domains:** empty. The clone gets a generated domain, which would publish the role through vector1's proxy.
  4. **Name:** `goodwatch-search-a`.
  5. **Docker registry**, image name: a name of its own (option 1).
  6. **Environment variables:** add `WEBAPP_ROLE` = `search` and `SEARCH_MAX_IN_FLIGHT` = `4`. Leave the rest.
  7. **Resource limits:** CPUs = `4`, memory = `4g`.
  8. **Healthcheck:** keep `/health/ready`.
  9. **Servers:** no additional server.
  10. Press **Deploy**.
- **Verify (agent):**
  - `./bench.sh smoke --host vector1 --container-prefix <application id>- --role search` passes: the log says `Process role: search`, the query models are verified and ready with 2 encoder threads, the search index and the people index loaded, the newest `Process:` line says `query encoder ready`, `/health/ready` answers, a palette lookup returns titles, and the search route rejects one character with 400.
  - On vector1, `docker inspect` of the new container shows the alias `goodwatch-search-a`, 4 CPUs, 4 GB, and no `traefik.http.routers` label.
  - On vector1, the alias `goodwatch-webapp` still belongs to one container: `docker network inspect coolify` lists it once.
  - `./bench.sh smoke --host vector1` still passes for the page instance.
- **Undo:** stop the application in Coolify, then delete it. No request reaches it before step 6.

### 4. Create search role B (owner, in Coolify)

- **Do:** as step 3, with `goodwatch-search-b` as the alias and the name. With option 1, give it the same registry image name as role A, and set vector1's **Concurrent builds** to 1 under **Servers**, so that role B reuses role A's image.
- **Verify (agent):** as step 3, for role B. Also: vector1 has at least 6 GB available with both roles running (`free -g`).
- **Undo:** as step 3.

### 5. Scrape the roles' metrics (agent, after the owner's go-ahead)

- **Do:** on vector1, in the repository checkout that Alloy runs from. The checkout is at an old commit with local changes, so check the two files out one by one:

  ```sh
  git fetch origin main
  git checkout FETCH_HEAD -- goodwatch-metrics/search-role.alloy goodwatch-metrics/docker-compose.search-role.yml
  cd goodwatch-metrics
  sed -i 's|^COMPOSE_FILE=docker-compose.yml:docker-compose.webapp.yml$|&:docker-compose.search-role.yml|' .env
  docker compose up -d grafana-alloy
  docker logs --since 2m grafana-alloy 2>&1 | grep -iE 'level=error|search_role'
  ```

  This recreates the Alloy container on vector1, so its node and webapp series pause for some seconds.
- **Verify:** in Grafana Cloud, `up{job="goodwatch_search"}` returns two series with the value 1, with the instances `gw-vector1-search-a` and `gw-vector1-search-b`. `count({job="goodwatch_search"})` stays far below the tenant's limit: a page instance has 757 series, and a role serves fewer routes. `up{job="goodwatch_webapp"}` still returns 1 for both page instances.
- **Undo:** remove `:docker-compose.search-role.yml` from `COMPOSE_FILE` in `.env`, and run `docker compose up -d grafana-alloy` again.

The series carry the job `goodwatch_search`, so every query for `job="goodwatch_webapp"` in [viral-spike-metrics.md](benchmarks/viral-spike-metrics.md) keeps describing the page instances. For the roles, use the same queries with the other job, for example:

```promql
sum by (instance) (rate(goodwatch_search_busy_total{job="goodwatch_search"}[5m]))
```

### 6. Install the route on vector1's proxy (owner, in Coolify)

- **Do:** **Servers** > vector1 > **Proxy** > **Dynamic configurations** > add `goodwatch-search-instance.yaml` with the content of the file in the repository. Replace `ABIO_PRIVATE_ADDRESS` with the address in the rule of `goodwatch-instance.yaml` there. No restart.
- **Verify (agent):**
  - On vector1, the saved file's rule has the address, both paths, and the header. Coolify removes the comments and rewrites the quotes.
  - vector1's proxy logs no error for the file, and its command list still has the `forwardedHeaders.trustedIPs` argument (it had on October 9, 2026).
  - Nothing changed for visitors: `./bench.sh smoke` passes.
  - From abio, one request with the header reaches a role: `curl -s -H 'Host: goodwatch.app' -H 'X-Gw-Role: search' 'http://<vector1's private address>/api/command-palette?q=mat'` returns titles, and one of the roles logs the request.
- **Undo:** delete the file in the same place. Do it only while abio's file from step 7 isn't installed.

### 7. Install the route on abio's proxy (owner, in Coolify)

This is the step that moves traffic.

- **Do:** **Servers** > abio > **Proxy** > **Dynamic configurations** > add `goodwatch-search.yaml` with the content of the file in the repository. Replace `VECTOR1_PRIVATE_ADDRESS` with the address of the second server in `goodwatch-balance.yaml` there. No restart, and no change to `goodwatch-balance.yaml`.
- **Verify (agent):**
  - On abio, the saved file's rule has both paths and the priority 1100.
  - `./bench.sh smoke` passes. Its palette lookup and its rejected search now go through the route.
  - Ten palette lookups over the public address: both roles log some of them, and neither page instance logs one.
  - `sum by (instance) (rate(goodwatch_http_responses_total{job="goodwatch_search"}[5m]))` rises for both roles.
- **Verify (owner):** in a browser, one search signed out and one signed in return ranked results with the reading line, and the header search returns titles. These are real searches: each writes its history row as always.
- **Undo:** delete the file on abio. The two paths go back to the page instances at once, which still run as `both` until step 10.

Not verified by any of this: that the role sees the visitor's address in production. The local test shows it for both Traefik versions, and the setting is in vector1's proxy. A check in production needs a log line or a response that names the address, which doesn't exist.

### 8. Stop one role and watch the route (owner stops, agent watches)

- **Do:** the agent sends one palette lookup per second over the public address for two minutes and records every status. After 30 seconds, the owner stops role B in Coolify (**Stop**). After another 30 seconds, the owner starts it again (**Deploy**).
- **Verify:** no failed lookup, or failures within one or two seconds of the stop only. While B is away, role A logs every lookup. After the start, B is ready within about a minute and gets lookups again. `./bench.sh smoke` passes at the end.
- **Undo:** start role B.

### 9. Load run at 20 searches per second (agent, only with the owner's go-ahead)

This step isn't prepared as a command. `./bench.sh load` sends GET requests only, and the search load script is on branch `bench/search-role` (`docs/benchmarks/search-role/scripts/mixed.js`), written for a build that doesn't write.

What the owner agrees to, because production has no such switch:

- **History rows.** Every search that runs writes one row to `search_history`: about 1,200 rows for 60 seconds at 20 per second, without an account.
- **Reading calls.** A text without a stored reading starts a paid call, bounded by the budget per address and in total. The benchmark's 140 queries had recorded readings. Whether production's store holds them isn't checked.
- **One address.** All searches come from the generator host, so they share one per-address budget.
- **Load on Crate and Qdrant** from 20 ranked searches per second, next to the page mix.

- **Do:** the benchmark's script against the public address: 20 searches per second for 60 seconds, next to 2 warm title pages and 2 title page misses per second. No deploy during the run, and not within the data job windows.
- **Verify:** about 16 searches per second end ranked within 1,500 ms at a p95 near 0.8 seconds, the rest get the busy answer, and no search ends as a 5xx other than busy. The warm page p95 stays where it is without searches. Each role stays under 4 cores and 4 GB.
- **Undo:** delete the test's history rows only if the owner asks for it. That's a write to production Crate.

### 10. Switch the page instances to the page role (owner, in Coolify)

- **Do:** in the webapp application, add `WEBAPP_ROLE` = `page`, then **Redeploy**. abio restarts first, then vector1, each with a rolling update.
- **Verify (agent):**
  - `./bench.sh smoke --commit <sha>`, then with `--host abio` and `--host vector1`: each prints `role page`, the log says `Process role: page`, and the search checks are skipped for the instance and pass over the public route.
  - Each page instance's `goodwatch_process_resident_memory_bytes` is about 1.76 GB lower than before.
  - The owner's browser check of step 7 again.
- **Undo:** remove the variable, or set it to `both`, and redeploy.

After this step, the order of undoing matters: a page instance answers a search with the busy answer and a palette lookup from TMDB. So set the page instances back to `both` before you delete abio's route file.

### 11. Afterward (agent)

- **Do:** add `SMOKE_SEARCH_ROLES='vector1:<id of role A>-,vector1:<id of role B>-'` to `goodwatch-benchmark/config.env` on the development machine. Every `./bench.sh smoke` then checks both roles.
- **Verify:** `./bench.sh smoke` prints two `search-role:` lines and passes.
- **Undo:** remove the line.

Left for the owner to decide later: the webapp application's 4 GB memory limit, which a page role no longer needs, and the empty network `gw-search-role-net` on vector1 with its firewall rule, which stay for further measurements.

## Not verified

- Anything with a real search role: the clone in Coolify's UI, the first deploy of a clone (whether it builds or pulls), the role's startup log lines, and the smoke check against a real role. The smoke check's role handling was tried against local stubs, and its default run passes on production as it is today.
- The field names in Coolify's UI for the clone, the registry image name, and the limits. They're from 4.4.3's code and from earlier tickets.
- The role's log lines against a real build. The smoke check expects `Process role: search` and `Search ranking: query models ready in N ms, 2 encoder threads`, as [Add the process role setting to the webapp](https://github.com/alp82/goodwatch-monorepo/issues/398) writes them. `scripts/test-smoke-roles.sh` tests the rules per role against fixture logs.
- Coolify's rewrite of the two proxy files. The rules have no backslash, like the installed ones.
- The roles behind network aliases, and a deploy of one role, in a proxy test.
- The label values of the roles' series in Grafana Cloud. The Alloy file loads in Alloy v1.7.5 next to the two existing files, and both targets are scraped.
- Build load on vector1 during a deploy, and whether two builds of one commit produce the same hashed file names.

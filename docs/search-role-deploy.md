# Deploy the search roles

The steps that put search into its own processes in production, for [Deploy two search roles on vector1 and route the search paths to them](https://github.com/alp82/goodwatch-monorepo/issues/400). Prepared and carried out on October 9, 2026: both search roles run on vector1, both proxy files are installed, the two search paths reach the roles, and the page instances run as `WEBAPP_ROLE=page`. The ticket's resolution has the results. Sections below that describe a state "today" or a step to come were written before the deploy and are kept as the record of it. To add a role on another host, see [search-role-runbook.md](search-role-runbook.md).

The decision is in [Decide whether search becomes its own service](https://github.com/alp82/goodwatch-monorepo/issues/251) and in [ADR 0011](adr/0011-search-runs-as-a-role-of-the-webapp-image.md). The measurements are in the [search role benchmark](https://github.com/alp82/goodwatch-monorepo/blob/bench/search-role/docs/benchmarks/search-role.md) on branch `bench/search-role`.

## The target

- **Two search roles on vector1.** Each is a container of the webapp image with `WEBAPP_ROLE=search`: one encoder with 2 threads, and at most 4 searches in flight. They run from a compose file and are deployed by a command, not by a push.
- **The route.** abio's proxy sends `POST /api/combined-search` and `GET /api/command-palette` to the search roles. Every other request keeps going to the page instances.
- **The page instances** run with `WEBAPP_ROLE=page` afterward, and each one gets about 1.76 GB lighter.
- **Order:** search roles up, route on, checks, then the page role. Each step is undone by itself.

## What's prepared

| File | What it is |
| --- | --- |
| `goodwatch-search/docker-compose.yml`, `.env.example` | The two roles, and the names of their settings. |
| `goodwatch-search/deploy.sh`, `test-deploy.sh` | Deploy a commit one role at a time, status, stop, start, and the settings file from the page instance. The test runs it against a stand-in for Docker. |
| `goodwatch-proxy/traefik/goodwatch-search.yaml` | The route on abio's proxy: the two paths go to vector1's proxy. |
| `goodwatch-proxy/traefik/goodwatch-search-instance.yaml` | The route on vector1's proxy: it balances across the two roles and checks `/health/ready` every 2 seconds. |
| `goodwatch-proxy/traefik/test-search-local.sh` | The test of both files, with the two Traefik versions and four stubs on this machine. |
| `goodwatch-metrics/search-role.alloy`, `docker-compose.search-role.yml` | The metrics scrape for the roles on vector1. |
| `goodwatch-benchmark/smoke/search-role-urls.json`, `search-role-paths.json`, and role handling in `./bench.sh smoke` | The smoke check for a search role and for a page role, and the warning when a role is behind in search code. |

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

Not covered by the test: network aliases. `test-local.sh` covers them for the page instances, with the same mechanism. A role from the compose file never runs two containers at once. Docker isn't available to agents on the development machine, so `test-local.sh` wasn't rerun after `test-stub.mjs` gained fields.

## How the roles run

Decided with the owner on October 9, 2026: the two search roles run from a compose file on vector1, [`goodwatch-search/docker-compose.yml`](../goodwatch-search/docker-compose.yml), like the repository's other services. They aren't Coolify applications.

- **Why not Coolify:** Coolify 4.4.3 can't run two containers of one application on one server. A deployment stops every other container of the application there, and replicas exist only for Docker Swarm (verified in its code). Two roles would be two cloned applications, each with its own copy of the 32 variables, the page instance's network alias until someone changes it, a generated domain, a deploy on every push to `main`, and an image build on vector1.
- **What compose gives:** one file with two services, one copy of the settings, no build on vector1, no restart of the roles on a push, and fixed container names.
- **What it costs:** a deploy of the roles is a command (`./deploy.sh <commit>`), so the roles can run an older commit than the page instances. The smoke check warns when that matters: see [Tell that the roles are behind](#tell-that-the-roles-are-behind).

Unchanged by the decision: two roles on vector1, one encoder with 2 threads and at most 4 searches in flight each, the two proxy files, and the order of the steps.

### The compose file

| Setting | Value | Why |
| --- | --- | --- |
| Services | `search-a` and `search-b`, the same but for their names | The proxy balances across two roles. |
| Image | The webapp's registry image, tagged with the commit in `.env` (`SEARCH_COMMIT`) | The image that Coolify builds on abio for every deploy of the webapp. Nothing is built on vector1. |
| Container names and network aliases | `goodwatch-search-a` and `goodwatch-search-b`, on the external network `coolify` | The proxy file `goodwatch-search-instance.yaml` and the Alloy file address them by these names. |
| Ports | 3000 for requests and 9464 for metrics, inside the network only | No port is published, and the containers have no proxy label and no domain. |
| Environment | `WEBAPP_ROLE=search`, `SEARCH_MAX_IN_FLIGHT=4`, `SOURCE_COMMIT` = the deployed commit, and the rest from `.env` on the host | `.env` isn't in the repository. [`.env.example`](../goodwatch-search/.env.example) lists its names. |
| Limits | 4 CPUs and 4 GB per role | The benchmark's caps. A full role used 2.2 to 2.6 cores and peaked at 2.1 to 3.1 GB. |
| Health check | `wget` on `/health/ready` inside the container, every 5 seconds, 10 retries, 120 seconds of start period | The image has no curl. Its `wget` is BusyBox, as for Coolify's check of the page instances. |
| Stop | SIGTERM, then 30 seconds | The app serves for 8 more seconds, drains, and exits by itself within 25. |
| Restart and log | `unless-stopped`, and JSON log files of 5 times 50 MB | As the other compose services. A role comes back after a restart of the host or of Docker. |

`SOURCE_COMMIT` is how a process knows its build: the image doesn't hold the commit. Coolify sets the variable for the page instances, and the compose file sets it from `SEARCH_COMMIT`. The metric `goodwatch_build_info` and the smoke check read it ([The build's commit](webapp-deploys.md#the-builds-commit)).

### The image and the registry

Read on October 9, 2026, from Coolify's database, and from Docker on vector1 and abio. Nothing was changed.

- **One image per deployed commit.** The webapp application has a registry image name and no fixed tag. abio builds the image, pushes it with the full commit as its tag, and vector1 pulls it. Both hosts held the same 8 tags (verified).
- **Only deployed commits have an image.** A push of several commits deploys the newest one. So `./deploy.sh` takes a commit that the page instances run or ran.
- **vector1 can pull by commit outside a Coolify deployment.** The package is private, and Docker on vector1 is logged in to the registry as root. `docker manifest inspect` for the commit of `main` succeeded there (verified). A pull itself wasn't run.
- **Old tags stay in the registry, as far as it was read.** Tags from October 5 were still there on October 9, when neither host held their images anymore. Coolify has no code that deletes a tag from a registry (searched, not proven). Whether the registry has a retention rule of its own wasn't read: that needs access to the package settings.
- **The image name isn't in the repository.** It carries an account name. `.env` on the host has it as `SEARCH_IMAGE`, and `./deploy.sh copy-env` reads it from the page instance's container.

### What Coolify can do to these containers

Coolify manages vector1 as a server, and the roles sit on its network. Read from Coolify 4.4.3's code and vector1's proxy on October 9, 2026.

| What | Effect on the roles | Status |
| --- | --- | --- |
| The nightly Docker cleanup (on for vector1, at midnight) removes stopped containers | None. The command only takes containers with the label `coolify.managed=true`, and the roles have no Coolify label. | Verified in the code. Not observed with a role. |
| The same cleanup removes old webapp images from the host | It runs `docker rmi` without force, which Docker refuses for an image that a container uses, running or stopped. The image of the commit before is removed sooner or later, so going back pulls it again. | The command is verified in the code. Docker's refusal is its documented behavior, not tried here. |
| The cleanup prunes networks and volumes | Off for vector1. The roles have no volume, and a network with containers isn't unused. | Verified in the settings. |
| A deploy of the webapp stops the application's other containers | None. It finds them by their Coolify labels. | Verified in the code. |
| The proxy's Docker provider reads labels | None. The provider runs with `exposedbydefault=false`, and the roles have no `traefik.enable` label. Only the dynamic file of step 6 routes to them. | Verified in the proxy's arguments on vector1. |
| The server's **Resources** page lists containers that Coolify doesn't manage | A person can press **Stop** or **Restart** there, as for Qdrant and Alloy today. Nothing does it by itself. | Verified in the code. |
| A restart of the proxy | The roles stay. The proxy reads the dynamic file again and finds them by name. | Inferred. |

### What the page instance gets from Coolify, and what a role needs

Read from the page instance's container on vector1 on October 9, 2026, names only.

- **No volume, no bind mount, and no extra host.** The query models are in the image, at the `SEARCH_MODEL_DIR` that the image sets.
- **Labels:** Coolify's own and the proxy's. The app reads none.
- **Variables that Coolify adds:** `SOURCE_COMMIT`, `HOST` (all interfaces), `PORT`, and five `COOLIFY_*` names. The compose file sets the first three.
- **The application's 32 variables.** A role gets 26 of them (the list in `.env.example`): the Crate, Qdrant, and cache settings, the two Supabase settings for the session check, `TYPESAFE_API_KEY`, `SEARCH_STORAGE_KEY`, `SEARCH_TRUSTED_IP_HEADER`, `TMDB_API_KEY`, and the nine `REC_*` flags. The command palette answers 404 without `REC_NAVIGATION`.
- **Left out:** `NODE_ENV` and `SEARCH_MODEL_DIR` (the image sets the same values), `STATIC_ASSETS` and `STATIC_ASSETS_HOST` (they shape pages, which a role doesn't serve to visitors), `HOMEPAGE_WARMUP_SECRET` (a page route), and `SUPABASE_DB_PASS` (no code reads it).
- **New for a role:** `WEBAPP_ROLE` and `SEARCH_MAX_IN_FLIGHT`, set in the compose file. `SEARCH_ENCODER_THREADS` stays unset: the role's default is 2.

The roles are on the same Docker network as the page instance, so they reach Crate, Qdrant, and the cache through the firewall rules that exist for that network (inferred from the rules' comments, not tried with a role).

### Memory on vector1

vector1 has 16 cores and 30 GB, with about 14 GB available on October 9, 2026, and the page instance at about 3 GB of its 4 GB. Two roles add about 4.6 GB. A deploy restarts a role in place, so old and new containers of a role never run at the same time.

## Deploy the roles after a change to search

A push to `main` deploys the page instances and leaves the roles alone. Deploy the roles when the smoke check warns that they're behind, or when a change is meant for them.

1. Wait until the page instances run the commit: `./bench.sh smoke --commit <sha>` passes. Only then does the registry have the image.
2. On vector1, in the checkout's `goodwatch-search/`:

   ```sh
   ./deploy.sh <full commit>
   ```

   It pulls the image, writes the commit to `.env`, restarts `search-a`, waits until it's ready, and then does the same for `search-b`. Ready means that the health check passes and that the log says `Search ranking: query models ready`.
3. On the development machine: `./bench.sh smoke`. Both `search-role:` lines pass, and `deploy:search-code` says that the roles run the page instances' commit.

- **One role is away for about a minute at a time.** The other one answers, at about 9 ranked searches per second instead of 16. The proxy's health check takes the restarting role out within 2 seconds.
- **When a role doesn't become ready,** the script stops and says which role runs what. The other role isn't touched. Read the log, then deploy the commit before: the script prints the command.
- **For some minutes, pages and searches run different commits.** The only contract between them is the search response that the browser's script reads. A change that breaks it needs both shapes accepted for one deploy.
- **A change to `.env`** takes the same command with the commit that already runs: compose recreates a service whose settings changed (compose's documented behavior, not tried here).
- **A change to `goodwatch-search/` itself** needs the files on vector1 first: `git fetch origin main && git checkout FETCH_HEAD -- goodwatch-search` in the checkout, which is at an old commit with local changes.
- **Don't run `docker compose up -d` by hand** after a change: it restarts both roles at once, and search answers busy until one is ready.

### Tell that the roles are behind

- **The smoke check.** Every `./bench.sh smoke` compares each role's commit with the page instance's. Behind in a file that a role runs: `WARN  deploy:search-code` with the files and the deploy command. Behind in other files only: a `PASS` line with the number of commits. The files are listed in [`goodwatch-benchmark/smoke/search-role-paths.json`](../goodwatch-benchmark/smoke/search-role-paths.json). A warning doesn't fail the check.
- **On vector1:** `./deploy.sh status` prints the commit, the health, the uptime, and the memory of each role, and says when a role doesn't run the commit in `.env`.
- **In Grafana Cloud:** `goodwatch_build_info{job="goodwatch_search"}` carries each role's commit, next to `goodwatch_build_info{job="goodwatch_webapp"}` for the page instances.

## Checklist

Each step says who does it. Agents change nothing in Coolify or in a proxy, and start nothing on a host without the owner's go-ahead. Steps 2 to 4 run on vector1 as root.

### 1. Check the prerequisites (agent)

- **Do:** confirm that [Add the process role setting to the webapp](https://github.com/alp82/goodwatch-monorepo/issues/398) and [Treat a bare gateway error on the search paths as the busy answer](https://github.com/alp82/goodwatch-monorepo/issues/399) are on `main` and deployed on both instances, and that `goodwatch-search/` is on `main`.
- **Verify:** `./bench.sh smoke --commit <sha>`, then with `--host abio` and `--host vector1`. Each prints `role both` and passes.
- **Undo:** nothing to undo.

### 2. Place the files and the settings on vector1 (agent, after the owner's go-ahead)

- **Do:** in the repository checkout on vector1. It's at an old commit with local changes, so check the one directory out:

  ```sh
  git fetch origin main
  git checkout FETCH_HEAD -- goodwatch-search
  cd goodwatch-search
  ./deploy.sh copy-env
  ```

  `copy-env` writes `.env` with mode 600 from the page instance's container: the image name, the commit that it runs, and the variables that `.env.example` names. It prints names, never values, and doesn't overwrite a file.
- **Verify:**
  - The output lists 26 copied variables and none as left out.
  - `docker compose config -q` prints nothing.
  - `docker manifest inspect "$(sed -n 's/^SEARCH_IMAGE=//p' .env):$(sed -n 's/^SEARCH_COMMIT=//p' .env)" > /dev/null` succeeds: the image can be pulled.
  - `./deploy.sh status` prints `no container` for both roles.
- **Undo:** delete `goodwatch-search/.env`. Nothing runs yet.

### 3. Start search role A (agent, after the owner's go-ahead)

- **Do:** `./deploy.sh start a`. It waits until the role is ready, which takes about a minute.
- **Verify:**
  - On the development machine, `./bench.sh smoke --host vector1 --container-prefix goodwatch-search-a --role search` passes: the log says `Process role: search`, the query models are verified and ready with 2 encoder threads, the search index and the people index loaded, the newest `Process:` line says `query encoder ready`, `/health/ready` answers, a palette lookup returns titles, and the search route rejects one character with 400.
  - On vector1, `docker inspect goodwatch-search-a` shows the alias `goodwatch-search-a` on the network `coolify`, 4 CPUs, 4 GB, no published port, and no `traefik` label.
  - On vector1, the alias `goodwatch-webapp` still belongs to one container: `docker network inspect coolify` lists it once.
  - `./bench.sh smoke --host vector1` still passes for the page instance.
- **Undo:** `./deploy.sh stop a`, then `docker compose rm -f search-a`. No request reaches the role before step 6.

### 4. Start search role B (agent, after the owner's go-ahead)

- **Do:** `./deploy.sh start b`.
- **Verify:** as step 3, for `goodwatch-search-b`. Also: `./deploy.sh status` prints both roles as healthy with the same commit and `query models ready`, and vector1 has at least 6 GB available with both running (`free -g`).
- **Undo:** as step 3, for role B.

### 5. Scrape the roles' metrics (agent, after the owner's go-ahead)

The Alloy file's two targets are the fixed names with the metrics port, `goodwatch-search-a:9464` and `goodwatch-search-b:9464`. The compose file sets both the names and the port.

- **Do:** on vector1, in the repository checkout that Alloy runs from. Check the two files out one by one:

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

### 8. Stop one role and watch the route (agent, after the owner's go-ahead)

- **Do:** send one palette lookup per second over the public address for two minutes and record every status. After 30 seconds, on vector1: `./deploy.sh stop b`. After another 30 seconds: `./deploy.sh start b`.
- **Verify:** no failed lookup, or failures within one or two seconds of the stop only. While B is away, role A logs every lookup. After the start, B is ready within about a minute and gets lookups again. `./bench.sh smoke` passes at the end.
- **Undo:** `./deploy.sh start b`.

### 9. Removed: the load run at 20 searches per second

Not run: it would write about 1,200 history rows per minute to production Crate and could start paid reading calls, and the two benchmarks plus the check of step 8 cover what it would show.

### 10. Switch the page instances to the page role (owner, in Coolify)

- **Do:** in the webapp application, add `WEBAPP_ROLE` = `page`, then **Redeploy**. abio restarts first, then vector1, each with a rolling update. The roles aren't touched.
- **Verify (agent):**
  - `./bench.sh smoke --commit <sha>`, then with `--host abio` and `--host vector1`: each prints `role page`, the log says `Process role: page`, and the search checks are skipped for the instance and pass over the public route.
  - Each page instance's `goodwatch_process_resident_memory_bytes` is about 1.76 GB lower than before.
  - The owner's browser check of step 7 again.
- **Undo:** remove the variable, or set it to `both`, and redeploy.

After this step, the order of undoing matters: a page instance answers a search with the busy answer and a palette lookup from TMDB. So set the page instances back to `both` before you delete abio's route file or stop both roles.

### 11. Afterward (agent)

- **Do:** add `SMOKE_SEARCH_ROLES='vector1:goodwatch-search-a,vector1:goodwatch-search-b'` to `goodwatch-benchmark/config.env` on the development machine. Every `./bench.sh smoke` then checks both roles and compares their commit with the page instances'.
- **Verify:** `./bench.sh smoke` prints two `search-role:` lines and passes.
- **Undo:** remove the line.

Left for the owner to decide later: the webapp application's 4 GB memory limit, which a page role no longer needs, and the empty network `gw-search-role-net` on vector1 with its firewall rule, which stay for further measurements.

## Not verified

This list was written before the deploy. The deploy has since shown, as the ticket's resolution records: a start of both roles from the compose file with a pull of the image, the roles' startup and the time until they're ready (15 to 22 seconds), the smoke check against both real roles, `./deploy.sh` with `start`, `stop`, and `status`, `copy-env` against the real container, that the roles reach the stores from the `coolify` network (they answer lookups, and the owner's searches in a browser worked), and one role stopped behind the live proxy. Still not verified after the deploy: `./deploy.sh <commit>` against real roles, the roles' series in Grafana Cloud, that a role sees the visitor's address in production, search under load on the deployed roles, and the items below about the nightly cleanup, the registry's retention, and Coolify's rewrite of the proxy files.

- Anything with a real search role: a start from the compose file, the pull of the image outside a Coolify deployment (only the manifest was read), the role's startup log lines and how long it takes to become ready, the health check inside a role, and the smoke check against a real role. The health check's command passed inside the page instance's container on vector1. The compose file validates with Docker Compose v2.40.2 on worker3 and v5.5.1 on the development machine, and vector1 has v2.40.1.
- `deploy.sh` against Docker. `goodwatch-search/test-deploy.sh` runs it against a stand-in for the `docker` command: the order of the roles, each way a role can fail to become ready, the pull that fails, and `copy-env`.
- `copy-env` against the real container. It reads the same `docker inspect` output that listed the names for this document.
- That a role reaches Crate, Qdrant, and the cache from the `coolify` network. The page instance does, from the same network.
- The nightly cleanup with a role present, and how long the registry keeps a tag beyond the four days that were read.
- The smoke check's role handling against a real role. Its rules were tried against local stubs, its commit comparison against a throwaway repository, and the whole-name match against the page instance's container on vector1. Its default run passes on production as it is today.
- The role's log lines against a real build. The smoke check expects `Process role: search` and `Search ranking: query models ready in N ms, 2 encoder threads`, as [Add the process role setting to the webapp](https://github.com/alp82/goodwatch-monorepo/issues/398) writes them. `scripts/test-smoke-roles.sh` tests the rules per role against fixture logs.
- Coolify's rewrite of the two proxy files. The rules have no backslash, like the installed ones.
- The roles behind network aliases, and a restart of one role, in a proxy test. With compose, a role never runs two containers at once.
- The label values of the roles' series in Grafana Cloud. The Alloy file loads in Alloy v1.7.5 next to the two existing files, and both targets are scraped.

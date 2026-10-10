# Add a search role on a worker host

How search gets more capacity than the two search roles on vector1 give: what a further role needs, what it buys, when to add one, how to check it, and how to remove it. Written on October 10, 2026 for [Write the runbook for adding a search role on a worker host](https://github.com/alp82/goodwatch-monorepo/issues/401).

**This procedure isn't rehearsed.** The ticket asks for one rehearsal with a role on worker1. It wasn't done: it needs the owner to register the host in Coolify and to change the live proxy configuration. Every step below is derived from the two roles on vector1, from the benchmark, and from the files in the repository. [Not rehearsed](#not-rehearsed) lists what is therefore unverified. Read that section before you start, and write down what differs.

Background:

- What a search role is and its settings: [search-role.md](search-role.md).
- How the two roles on vector1 were set up: [search-role-deploy.md](search-role-deploy.md).
- The decision: [ADR 0011](adr/0011-search-runs-as-a-role-of-the-webapp-image.md) and [Decide whether search becomes its own service](https://github.com/alp82/goodwatch-monorepo/issues/251).
- The measurements: the [search role benchmark](https://github.com/alp82/goodwatch-monorepo/blob/bench/search-role/docs/benchmarks/search-role.md) on branch `bench/search-role`, section "Roles on several hosts", for [Benchmark search roles on vector1 and the worker hosts behind one route](https://github.com/alp82/goodwatch-monorepo/issues/397).

In this page, "measured" means a figure from that benchmark or from the deploy ticket, "inferred" means reasoning from the code or the configuration files, and "not verified" means that nobody tried it.

## What one more role buys

Measured on October 9, 2026, with a benchmark build and not with production's roles. Each role has one encoder with 2 threads and the in-flight limit at 4. "Ranked" is searches per second that end ranked within the 1,500 ms deadline. The p95 is that of the ranked searches. The rest of the searches sent get the busy answer.

| Roles | 10 sent per second | 20 sent per second | 40 sent per second |
| --- | --- | --- | --- |
| One on vector1 | 7.9 ranked, 837 ms | 9.1 ranked, 890 ms | 9.3 ranked, 850 ms |
| Two on vector1 (production today) | 9.9 ranked, 624 ms | 15.8 ranked, 806 ms | 16.8 ranked, 922 ms |
| vector1 and worker1 | 10.0 ranked, 574 ms | 16.6 ranked, 780 ms | 18.6 ranked, 798 ms |
| vector1, worker1, and worker2 | 10.0 ranked, 549 ms | 19.3 ranked, 668 ms | 25.9 ranked, 782 ms |

- **One role ranks about 9 searches per second, and each further role adds 8 to 9.**
- **A role on a 4-core worker does as well as a role on vector1** that is capped at 4 CPUs.
- **Three roles reach the design target** of 20 ranked searches per second: 19.3 at 20 sent, and 25.9 under a flood of 40.
- **A full role uses 2.2 to 2.6 cores and peaks at 2.1 to 2.3 GB** with the limit at 4. No role needed more than 3 cores or more than 3.1 GB in any run.
- **Overload stays graceful.** At 80 sent per second on three hosts (measured with the limit at 8 only), 27 to 31 searches per second ended ranked and about 60% got the busy answer.

What these figures don't cover:

- **Two roles on vector1 plus one on a worker,** which is the layout after this runbook. The benchmark's largest layout was one role on each of three hosts. Four roles weren't measured.
- **The route of this runbook.** The benchmark's balancer listed every role directly and gave each the same share. In production a second host gets a share per host, not per role: see [The route to a second host](#the-route-to-a-second-host).
- **Production's roles under load.** The load run on the deployed roles was dropped, because it would write history rows to production and could start paid reading calls.
- **The reading call.** The benchmark served recorded readings.

## The other levers

Both are settings of a role that already runs. Both are measured, and both were rejected for the two roles on vector1.

| Lever | What it buys | What it costs | How |
| --- | --- | --- | --- |
| In-flight limit at 8 instead of 4 | 10% to 15% more ranked searches per role. Two roles on vector1: 18.3 instead of 15.8 at 20 sent per second | 400 to 500 ms of p95. Two roles: 1,166 ms instead of 806 ms, and 1,430 ms at 40 sent, close to the deadline. Basic-result fallbacks rise from at most 10 to at most 56 of 7,200 searches. A full role uses 2.6 to 3.0 cores | `SEARCH_MAX_IN_FLIGHT` in `goodwatch-search/docker-compose.yml`, then a deploy of the roles |
| A second encoder in a role | Little. At 10 searches per second on one 4-core host, p95 went from 1,106 ms to 981 ms (two encoders with 1 thread each) | 1.7 GB more peak memory per role: 4.6 GB instead of 2.8 to 2.9 GB, which is above the role's 4 GB cap | Not a setting on `main`: only the benchmark build had it |

- **A limit between 4 and 8 wasn't measured,** and neither was more than 4 CPUs per role.
- **A limit of 64 isn't a lever.** At 20 searches per second, most searches then miss the deadline and end as basic results.
- **More encoder threads aren't a lever either.** One encoder with 4 threads held 5 ranked searches per second where 2 threads held 10.
- **One process tops out near 18 to 20 searches per second** whatever the encoder does, because its main thread does the ranking. That figure is extrapolated from the main thread's use at 10 per second, not measured.

A further role costs about 3 cores and 3.5 GB on another host and no latency. Raising the limit costs nothing but latency, and it's undone by one deploy. So the limit is the quick lever for a spike that is happening now, and a role is the lever for load that stays.

## When to add one

No alert watches search, and nobody has read the roles' series in Grafana Cloud yet. So the first reading is also the check that the series exist. The names below are from the code and from the Alloy file. The label values are inferred and not verified.

### The readings

| Reading | Metric | What it is |
| --- | --- | --- |
| Busy answers per role | `goodwatch_search_busy_total`, a counter without labels | One count for each search that a process answered with 503 and `Retry-After`, because its in-flight limit was reached |
| Searches per role | `goodwatch_http_responses_total` with `route="/api/combined-search"`, by `status_class` | Every finished response on the search route. A ranked search and a basic-results answer are `2xx`, a busy answer is `5xx` |
| Search time | `goodwatch_http_request_duration_seconds` with the same `route` and `status_class="2xx"` | Request start to the last byte of the streamed answer |

The roles' series carry `job="goodwatch_search"`. The instances are meant to be `gw-vector1-search-a` and `gw-vector1-search-b`.

```promql
# Busy answers per second, per role.
sum by (instance) (rate(goodwatch_search_busy_total{job="goodwatch_search"}[5m]))

# The share of searches that got the busy answer, over all roles.
sum(rate(goodwatch_search_busy_total{job="goodwatch_search"}[5m]))
/
sum(rate(goodwatch_http_responses_total{job="goodwatch_search", route="/api/combined-search"}[5m]))

# Answered searches per second, per role. A role is full at about 8 to 9.
sum by (instance) (rate(goodwatch_http_responses_total{job="goodwatch_search", route="/api/combined-search", status_class="2xx"}[5m]))

# The p95 of answered searches, in seconds.
histogram_quantile(0.95, sum by (le) (rate(goodwatch_http_request_duration_seconds_bucket{job="goodwatch_search", route="/api/combined-search", status_class="2xx"}[5m])))
```

- **The `route` value is inferred** from how the webapp labels a request: by the pattern of the route that matched. List the real values with `count by (route) (goodwatch_http_responses_total{job="goodwatch_search"})`.
- **The busy counter misses a search that no role took.** When every role is down, the proxy answers a bare 503 and no process counts it. The proxy writes no access log.
- **The p95 here isn't the benchmark's p95.** It includes basic-results answers and the real reading call, and the benchmark's is the load generator's time for ranked searches with recorded readings. No production value is recorded. Read one at normal traffic before you compare.

### What the benchmark says about them

Computed from the capacity table: the busy share is what was sent minus what ended ranked. The limit is 4.

| Roles | Sent per second | Busy share | Ranked p95 |
| --- | --- | --- | --- |
| Two on vector1 | 10 | 1% | 624 ms |
| Two on vector1 | 20 | 21% | 806 ms |
| Two on vector1 | 40 | 58% | 922 ms |
| Three, on three hosts | 20 | 4% | 668 ms |
| Three, on three hosts | 40 | 35% | 782 ms |

Two things follow:

- **The busy share is the signal.** It goes from 1% to 21% between 10 and 20 searches sent per second, because two roles rank about 16.
- **The p95 isn't.** With the limit at 4 it stayed between 549 and 922 ms in every cell, also under a flood: the limit turns overload into busy answers, not into slow ones. It rises by about 200 to 300 ms as the roles fill, and no more.

### The rule

This rule is inferred from those figures. Nobody has tried a threshold in production, and the owner decides.

| Reading | Meaning | What to do |
| --- | --- | --- |
| One role counts busy answers and the other one doesn't, or both do for a minute or two | A burst, or one role was away for a deploy | Nothing |
| Both roles count busy answers in the same 5-minute windows, the busy share stays above about 5% over an hour of ordinary traffic, and each role answers 8 or more searches per second | More searches arrive than two roles rank | Add a role. During a spike that is happening now, the limit at 8 is faster |
| The busy share is above 20% | The load is at 20 per second or beyond | One more role brings the share to a few percent at 20 sent. At 40 sent, three roles still answer a third as busy |
| The p95 of answered searches is above about 1 second, and the busy share is low | Not the number of roles. No layout with the limit at 4 showed this | Look at Qdrant, Crate, the reading call, and what else runs on the role's host. A further role doesn't help |
| The busy share is high, and each role answers far fewer than 8 searches per second | The roles are slow, not full of work. Not seen in the benchmark | The same. A further role doesn't help |

- **Check what sends the searches first.** A flood from one source is a case for the search limits, not for capacity.
- **Two roles at about 16 per second with the overflow as busy answers is the state that the owner chose** over a third role. A busy answer under a short peak is the design, not a fault.

## What a role needs on a worker host

| Need | Detail | Who | State |
| --- | --- | --- | --- |
| The host registered in Coolify | Gives the host the `coolify` Docker network and a Coolify proxy, which the route below uses. Whether it also logs the host in to the image registry isn't verified | Owner, in the Coolify UI | Not done for any worker host |
| 3 CPUs and 3.5 GB of headroom | A full role used 2.2 to 2.6 cores and peaked at 2.1 to 2.3 GB (measured). The largest peak in any run was 3.1 GB. The worker hosts have 4 cores, and each runs a Windmill worker | Agent reads, owner decides | In the benchmark, a role ran on worker1 and on worker2 next to the Windmill worker |
| The image | The webapp's registry image with the commit as its tag. The host must be logged in to the registry, as vector1 is | Owner, if a login is needed | Not verified on a worker |
| The settings | The same `.env` as on vector1: the image name, the commit, and the 26 variables that [`goodwatch-search/.env.example`](../goodwatch-search/.env.example) names. The compose file adds `WEBAPP_ROLE=search`, `SEARCH_MAX_IN_FLIGHT=4`, and the ports | Agent, after the owner's go-ahead | `./deploy.sh copy-env` can't write it on a worker: it reads a page instance's container on the same host |
| Crate, from the role's container | The three Crate nodes on their HTTP port: the search index, the history rows, and the reading store | Nothing to do, if the existing rules hold | Measured for a container on worker1 and worker2, from another Docker network than `coolify` |
| Qdrant on vector1, from the role's container | Qdrant's HTTP port on vector1. Every ranked search calls it | The same | The same |
| The cache nodes, from the role's container | The reading cache, the lock, the rate counters, the spending record, and the title snapshot | The same | A TCP connection from the Windmill worker's container passed on September 10, 2026. Not tried with a search role: the benchmark's roles had a throwaway cache |
| Outbound to the internet | The session check, the reading call, and the TMDB title search | Nothing to do | Not tried from a role on a worker |
| The proxy's server list | abio's proxy needs the worker's private address as a second server of the search route, and the worker's proxy needs a route to the role | Owner, in the Coolify UI | Not prepared. See the next section |
| The metrics scrape | Alloy on the worker, attached to the `coolify` network, with the role as a target | Agent, after the owner's go-ahead | Not prepared. `goodwatch-metrics/search-role.alloy` names the two roles on vector1 |

- **A firewall rule is the owner's,** and each one carries a short comment that names the owner and the purpose: see [worker-firewall.md](worker-firewall.md). This runbook expects one new rule at most, on the worker: abio's private address to the worker's proxy on port 80. Whether the worker's firewall already lets that through isn't known.
- **No rule on vector1 is expected.** A container on another host reaches vector1 from its host's private address, which the existing rules for private clients cover (inferred, and consistent with the benchmark). The rule that the search roles on vector1 use is for the same-host case.
- **worker1 and worker3 are the load generators** of the page view benchmarks, and worker1 was "near its limit" in several runs. A role there takes CPU from a load run, and a load run takes CPU from the role. worker2 runs a separate application next to its Windmill worker.

### What isn't prepared in the repository

The files in `goodwatch-search/` are written for two roles on vector1. They work on a worker for one role, with these differences. All of this is read from the files, and none of it has run on a worker.

- **Start one role only.** `./deploy.sh start a` starts the service `search-a`, which becomes the container `goodwatch-search-a` on that host. The name is the same as on vector1, on another host.
- **Don't run `./deploy.sh <commit>` on a worker.** It deploys `search-a` and then `search-b`, so it would start a second role on a 4-core host. To change the commit of the one role, see [Deploy a new commit to the role](#deploy-a-new-commit-to-the-role).
- **The caps are 4 CPUs and 4 GB,** which is the whole worker. To cap the role at 3 CPUs and 3.5 GB, put a `docker-compose.override.yml` next to the compose file on the worker. Compose reads that file by itself (its documented behavior, not tried here):

  ```yaml
  services:
    search-a:
      cpus: 3
      mem_limit: 3500m
  ```

  A role capped at 3 CPUs wasn't measured. The benchmark's roles on the workers had the host's 4 cores.
- **`./deploy.sh status` prints `search-b  no container`** on a worker. That's expected.

## The route to a second host

Today abio's proxy sends the two search paths to one server: vector1's proxy, which balances across the two roles and checks each role's `/health/ready` every 2 seconds. A second host isn't in either file, and the change wasn't written or tested. The header of [`goodwatch-search-instance.yaml`](../goodwatch-proxy/traefik/goodwatch-search-instance.yaml) says what's needed: a role on another host needs its own route from abio's proxy.

This runbook uses the same shape as for vector1, because a host that is registered in Coolify has a proxy:

1. **On the worker's proxy:** a copy of `goodwatch-search-instance.yaml` whose server list has the one role, `http://goodwatch-search-a:3000`. The rule, the header `X-Gw-Role`, the retry, and the health check stay as they are.
2. **On the worker's proxy, in its own configuration:** the line that makes it trust abio's address for forwarded headers, as the header of [`goodwatch-instance.yaml`](../goodwatch-proxy/traefik/goodwatch-instance.yaml) describes for vector1, and a restart of that proxy. Without it, the role sees abio's address as every visitor's address, and the search limits count all visitors as one.
3. **On abio's proxy:** the worker's private address as a second server of the service `gw-search` in `goodwatch-search.yaml`, next to vector1's.

All three are owner steps in the Coolify UI. Three things about this shape are inferred from the two files and need the rehearsal:

- **The share is per host, not per role.** abio's proxy gives each server every second search. So the one role on the worker gets half of the searches, and the two roles on vector1 get a quarter each. The worker's role is then full at about 18 searches sent per second, where three roles with equal shares are full at about 27. The benchmark measured equal shares. To get them, vector1 needs twice the worker's weight. How to write that for Traefik v2.10 on abio wasn't checked.
- **abio's proxy can't see that the worker's role is away.** Its health check asks the worker's proxy for its own ping, and that still answers. While the one role on the worker restarts or is down, the searches that abio sends there get a bare 503 from the worker's proxy, and the browser shows the busy state. On vector1 this happens only when both roles are away. So take the worker out of abio's server list before you stop its role for longer than a restart.
- **A refused connection isn't retried.** abio's route has no retry, because it has one server today. With two servers, the retry of `goodwatch-balance.yaml` would move a refused connection to the other host.

The other shape is the benchmark's: the role publishes its port on the worker's private address, and abio's proxy lists the role itself with a health check on `/health/ready`. Then abio's proxy sees the role's state, and the worker needs no proxy route and no trusted address. It needs a published port, a firewall rule for it, and a service of its own in abio's file, because one service has one health check path and vector1's is the proxy's ping. This shape is measured as a balancer in front of roles, but not with abio's proxy and not next to vector1's proxy.

Whichever shape is used: change the copy in `goodwatch-proxy/traefik/`, extend `test-search-local.sh` for a second host, and run it before the owner installs anything. The test needs Docker, which agents don't have on the development machine.

## Add the role

Each step says who does it. Agents change nothing in Coolify, in a proxy, or in a firewall, and start nothing on a host without the owner's go-ahead. The steps on the worker run as root. `<worker>` is the worker's host name.

### 1. Decide that a role is needed (owner)

- **Do:** read the busy share and the answered searches per role, as in [When to add one](#when-to-add-one).
- **Verify:** `./bench.sh smoke` passes with both roles on vector1, so the two roles are healthy and the reading isn't that of one role alone.
- **Undo:** nothing to undo.

### 2. Check the worker's headroom (agent)

- **Do:** on the worker, read the cores, the available memory, and the load: `nproc`, `free -g`, and `uptime`.
- **Verify:** at least 3 cores are idle most of the time and at least 3.5 GB are available. No load run is planned that uses this worker as a generator.
- **Undo:** nothing to undo.

### 3. Register the worker in Coolify (owner)

- **Do:** in the Coolify UI, add the worker as a server and start its proxy.
- **Verify (agent):** on the worker, `docker network inspect coolify` succeeds and a Coolify proxy container runs. `docker manifest inspect <image>:<commit>` succeeds for the commit that the roles on vector1 run: the worker can pull the image. If it fails, the worker needs a login to the registry, which is the owner's.
- **Undo:** remove the server in Coolify.

What Coolify does to a registered host besides the network and the proxy (the nightly cleanup, the **Resources** page) is described for vector1 in [What Coolify can do to these containers](search-role-deploy.md#what-coolify-can-do-to-these-containers). The cleanup's settings on a new server weren't read.

### 4. Place the files and the settings (agent, after the owner's go-ahead)

- **Do:** on the worker, get `goodwatch-search/` from `main`. If the worker has a checkout of the repository, check the one directory out as on vector1:

  ```sh
  git fetch origin main
  git checkout FETCH_HEAD -- goodwatch-search
  ```

  Then copy `goodwatch-search/.env` from vector1 to the same place on the worker, with mode 600, over the private network. Don't print it and don't put it anywhere else: it holds the keys. Add the `docker-compose.override.yml` with the caps.
- **Verify:**
  - `docker compose config -q` prints nothing.
  - `docker compose config | grep -E 'cpus|mem_limit'` shows the caps of the override for `search-a`.
  - `./deploy.sh status` prints `no container` for both roles.
- **Undo:** delete `.env` and the override file. Nothing runs yet.

### 5. Start the role (agent, after the owner's go-ahead)

- **Do:** `./deploy.sh start a`. It waits until the role is ready. On vector1 that took 15 to 22 seconds, and the script waits up to 300.
- **Verify:**
  - On the development machine, `./bench.sh smoke --host <worker> --container-prefix goodwatch-search-a --role search` passes. See [Check a role](#check-a-role) for what it checks and for what it needs to reach the worker.
  - On the worker, `docker inspect goodwatch-search-a` shows the alias `goodwatch-search-a` on the network `coolify`, the caps, no published port, and no `traefik` label.
  - The role's log has no error about Crate, Qdrant, or the cache. This is the first evidence that the role reaches all three from this host.
  - `./deploy.sh status` shows the same commit as on vector1.
- **Undo:** `./deploy.sh stop a`, then `docker compose rm -f search-a`. No request reaches the role before step 8.

### 6. Scrape the role's metrics (agent, after the owner's go-ahead)

Do this before the role gets traffic, so that its busy counter is visible from the first search.

- **Do:** this step isn't prepared. `goodwatch-metrics/search-role.alloy` has two fixed targets, and `goodwatch-search-b:9464` doesn't exist on the worker. Write a variant of the file with the one target `goodwatch-search-a:9464` for a host with one role, commit it, and load it on the worker as in [step 5 of the deploy checklist](search-role-deploy.md#5-scrape-the-roles-metrics-agent-after-the-owners-go-ahead). Alloy must be attached to the `coolify` network, which `docker-compose.webapp.yml` does on vector1. How Alloy runs on the worker today wasn't read.
- **Verify:** in Grafana Cloud, `up{job="goodwatch_search"}` returns one more series with the value 1, and its `instance` names the worker.
- **Undo:** take the file out of Alloy's configuration on the worker, and recreate the Alloy container.

### 7. Install the route on the worker's proxy (owner, in Coolify)

- **Do:** **Servers** > the worker > **Proxy** > **Dynamic configurations** > add the worker's copy of `goodwatch-search-instance.yaml`, with abio's private address in place of the placeholder. In the proxy's own configuration, add the line that trusts abio's address for forwarded headers, then **Restart Proxy**. If the worker's firewall blocks abio's private address on port 80, add the rule, with a comment that names the owner and the purpose.
- **Verify (agent):**
  - The worker's proxy logs no error for the file.
  - From abio, one request with the header reaches the role: `curl -s -H 'Host: goodwatch.app' -H 'X-Gw-Role: search' 'http://<the worker's private address>/api/command-palette?q=mat'` returns titles, and the role logs the request.
  - The same request without the header doesn't reach the role.
  - Nothing changed for visitors: `./bench.sh smoke` passes.
- **Undo:** delete the file in the same place. Do it only while abio's server list doesn't name the worker.

### 8. Add the worker to abio's server list (owner, in Coolify)

This is the step that moves traffic.

- **Do:** **Servers** > abio > **Proxy** > **Dynamic configurations** > `goodwatch-search.yaml`: add the worker as a second server of `gw-search`, with the worker's private address in place of a placeholder. No restart.
- **Verify (agent):**
  - `./bench.sh smoke` passes.
  - Twelve palette lookups over the public address: the worker's role logs some of them, both roles on vector1 log some, and no page instance logs one. All answer 200.
  - `sum by (instance) (rate(goodwatch_http_responses_total{job="goodwatch_search"}[5m]))` rises for all three roles.
- **Verify (owner):** in a browser, one search signed out and one signed in return ranked results with the reading line, and the header search returns titles.
- **Undo:** remove the worker's server line in the same file. The two paths go to vector1's roles alone again, at once.

### 9. Stop the role once and watch the route (agent, after the owner's go-ahead)

- **Do:** send one palette lookup per second at abio's proxy for two minutes and record every status. After 30 seconds, on the worker: `./deploy.sh stop a`. After another 30 seconds: `./deploy.sh start a`.
- **Verify:** write down what the lookups got while the role was away. With the route of this runbook, the expected result is that about half of them answer 503 in that time, as [The route to a second host](#the-route-to-a-second-host) explains. If that's what happens, the route needs the other shape, or the worker must leave abio's list before every restart of its role.
- **Undo:** `./deploy.sh start a`.

### 10. Afterward (agent)

- **Do:** add the role to `SMOKE_SEARCH_ROLES` in `goodwatch-benchmark/config.env` on the development machine, as `<worker>:goodwatch-search-a`. Update [serving-architecture.md](serving-architecture.md) and [search-role.md](search-role.md), which say that two roles run, and write down in this page what differed from it.
- **Verify:** `./bench.sh smoke` prints three `search-role:` lines and passes.
- **Undo:** remove the entry.

### Deploy a new commit to the role

The smoke check warns when a role is behind the page instances in a file that it runs (`WARN  deploy:search-code`). On vector1, `./deploy.sh <commit>` answers that. On a worker with one role, do its steps by hand, because the script would start `search-b` too:

```sh
docker pull -q "$(sed -n 's/^SEARCH_IMAGE=//p' .env):<full commit>"
sed -i 's/^SEARCH_COMMIT=.*/SEARCH_COMMIT=<full commit>/' .env
./deploy.sh start a
```

`start` recreates the container when the image changed, waits until the role is ready, and fails when the container doesn't run the commit in `.env`. This is read from the script and wasn't run. While the role restarts, see step 9 for what the route does.

A one-role mode for `deploy.sh` would make this one command. It doesn't exist.

## Check a role

| Check | Command | What it shows |
| --- | --- | --- |
| The role by itself | `./bench.sh smoke --host <host> --container-prefix goodwatch-search-a --role search`, on the development machine | The container's `WEBAPP_ROLE` is `search`. `/health/ready` answers. A palette lookup returns titles. The search route rejects one character with 400. The log says `Process role: search`, the query models are ready with 2 encoder threads, and the search index and the people index loaded |
| Every listed role, and the public route | `./bench.sh smoke` with the role in `SMOKE_SEARCH_ROLES` | One `search-role:` line per role, and the palette lookup and the rejected search over the public route |
| Is the role behind? | The same run | `deploy:search-code` compares each role's commit with the page instances'. A warning names the files and doesn't fail the check |
| On the host | `./deploy.sh status` | The commit, the health, the uptime, and the memory of each role |
| Does it get traffic? | `sum by (instance) (rate(goodwatch_http_responses_total{job="goodwatch_search"}[5m]))` | Each role's responses per second |
| Is it full? | `sum by (instance) (rate(goodwatch_search_busy_total{job="goodwatch_search"}[5m]))` | Each role's busy answers per second |
| Which commit? | `goodwatch_build_info{job="goodwatch_search"}` | Each role's commit |

- **The smoke check sends no search that runs.** A search that runs writes a history row to production, and a text without a stored reading can start a paid call. So no check here shows a ranked search on the new role. The owner's search in a browser does, but it doesn't say which role answered.
- **`--host` takes a name from `goodwatch-hq/ansible/hosts.ini` or a private address,** and the check opens an SSH tunnel to the container. worker1 to worker3 are in that list. The check has only run against vector1 and abio.
- **A search role says `query encoder not ready`** until its query models have loaded. The check waits for a newer line and fails only after `--log-wait` seconds.

## Remove a role

Order matters: first the traffic, then the role.

1. **Owner:** remove the worker's server line from `goodwatch-search.yaml` on abio's proxy. Searches go to vector1's two roles at once.
2. **Agent:** check that the worker's role gets no request: its line in `sum by (instance) (rate(goodwatch_http_responses_total{job="goodwatch_search"}[5m]))` falls to zero, and `./bench.sh smoke` passes.
3. **Agent, after the owner's go-ahead:** on the worker, `./deploy.sh stop a`, then `docker compose rm -f search-a`. Use `docker compose down` only on a host where every role goes.
4. **Owner:** delete the route file on the worker's proxy. If a firewall rule was added for it, remove that rule.
5. **Agent:** take the role out of the Alloy file on the worker and out of `SMOKE_SEARCH_ROLES`, and delete `.env` on the worker. It holds the keys.
6. **Owner, if the host isn't needed in Coolify anymore:** remove the server there.

To remove one of the two roles on vector1 instead: `./deploy.sh stop b` there. vector1's proxy takes the role out by itself, and nothing in a proxy needs to change. The role's line in the proxy file and in the Alloy file can stay while the role is only stopped.

### What the route does while a role is missing

| Case | What a search gets | Kind |
| --- | --- | --- |
| One of the two roles on vector1 is stopped or restarts | The other role answers. vector1's proxy drops the stopped role within 2 seconds, and a role that got SIGTERM serves for 8 more. In production, 110 of 110 palette lookups answered 200 while role B was stopped for 30 seconds. Capacity is that of one role, about 9 ranked per second | Measured |
| One of them is killed | A few failed requests within one second: 9 of 601 searches in the benchmark, as 502 answers and connection errors. In the local proxy test, none in three runs, because the retry moved the refused connections | Measured |
| Both roles on vector1 are away | 503 with the body `no available server`, in the first second sometimes 502. The browser shows the busy state with Retry. The header search has no titles. Pages are unaffected | Measured in the local proxy test |
| vector1's proxy is away | 503 from abio's proxy, after up to 2 seconds of 502 | Measured in the local proxy test |
| The one role on a worker is away, with the route of this runbook | The searches that abio's proxy sends to the worker get a bare 503 from the worker's proxy: about half of all searches. The rest reach vector1 | Inferred, not tested |
| The worker or its proxy is away | abio's proxy drops the worker within 2 seconds, and vector1's roles answer everything. Until then, a search sent there fails or waits for the connection | Inferred, not tested |
| vector1 is away, and a worker's role runs | The route to the worker still works, but Qdrant is on vector1, so no ranked search can finish. What a search gets then wasn't tested | Inferred |

- **A page instance doesn't take over.** The page instances run as `WEBAPP_ROLE=page`: one that gets a search answers busy, and it answers a palette lookup from the TMDB title search. To send searches back to the page instances, set them back to `both` first, then delete abio's route file: see [the undo order](search-role-deploy.md#10-switch-the-page-instances-to-the-page-role-owner-in-coolify).
- **The browser treats a bare 502, 503, or 504 on the two search paths as the busy answer,** so none of these cases shows an error page.

## Limits that more roles don't lift

- **Qdrant is one node on vector1, and every ranked search calls it.** A role on a worker doesn't make search independent of vector1. With three roles at 40 searches sent per second, Qdrant's slowest probe answer was 0.75 seconds, once, and otherwise under 0.2 seconds (measured, with the limit at 8). Its limit wasn't reached at about 29 ranked searches per second, and nothing is measured above that.
- **vector1 holds Qdrant, two search roles, and a page instance.** The loss of that host wasn't tested.
- **Crate and the cache nodes are shared with the page instances.** Each ranked search reads Crate and writes a history row. The benchmark's roles wrote no rows and had a throwaway cache, so the cost of both at 20 searches per second on production isn't measured.
- **The reading call is paid and external.** A text without a stored reading starts one. The benchmark served recorded readings, so the call's time and its limits under load aren't measured, and more roles don't change them.
- **Every search enters through abio's proxy.** A further role adds no second entry.
- **One process ranks about 9 searches per second with the limit at 4.** A bigger host doesn't change that much: no role needed more than 3 cores, and more than 4 CPUs per role wasn't measured. More capacity means more processes.
- **The deadline stays 1,500 ms.** More roles raise how many searches end ranked. They don't make a single search faster, apart from the 200 to 300 ms that a role that isn't full saves.
- **Four roles and more aren't measured.** The gain per role was 8 to 9 searches per second up to three.

## Not rehearsed

The rehearsal on worker1 that the ticket asks for didn't happen. Unverified, by step:

- **Step 2:** how much memory a worker has, and how much is free next to its Windmill worker. Only the cores are in the docs.
- **Step 3:** what registering a host in Coolify gives it: the `coolify` network, the proxy, its Traefik version, and whether the host can pull the image afterward. All inferred from vector1, which was registered before these documents.
- **Step 4:** that the worker has a checkout of the repository, and the `docker-compose.override.yml` for the caps. A role capped at 3 CPUs or at 3.5 GB wasn't measured.
- **Step 5:** `./deploy.sh start a` on a host without `search-b`, and the smoke check with a worker as `--host`. Also that a role on a worker's `coolify` network reaches Crate, Qdrant, and the cache. The benchmark shows Crate and Qdrant from another Docker network on worker1 and worker2, and nothing for the cache.
- **Step 6:** everything. No Alloy file for a host with one role exists, and how Alloy runs on a worker wasn't read.
- **Step 7:** the route file on a worker's proxy, the trusted address, whether the worker's firewall lets abio's proxy reach port 80, and whether the role sees the visitor's address. The last one isn't verified for vector1's roles either.
- **Step 8:** a second server in `goodwatch-search.yaml`. Neither proxy file was changed or tested for it. Also that the worker's proxy answers abio's health check, the share per host, and a weight that evens it out.
- **Step 9:** what the route does while the worker's one role is away. The table above says what the files imply.
- **Deploying a new commit to one role by hand,** and removing a role.
- **The capacity of the resulting layout:** three roles with a share per host, or four roles. The benchmark's three roles were one per host behind a balancer that listed each of them.
- **The readings in [When to add one](#when-to-add-one):** the queries, the `route` and `instance` label values, and the thresholds. The roles' series in Grafana Cloud weren't read, and no production value of the busy share or the p95 is recorded.

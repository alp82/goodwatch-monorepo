# Serving architecture

How production answers a request for `goodwatch.app`, what each part holds, what happens when a part fails, which settings matter, and which checks guard it. This page describes the state on October 9, 2026. It links the pages that hold the details and doesn't repeat them. It belongs to the map [Serve a viral traffic spike](https://github.com/alp82/goodwatch-monorepo/issues/237), whose destination is 500 page views per second for one hour with no errors.

Read [Not verified and open](#not-verified-and-open) before you rely on a number: the destination isn't proven yet.

## The parts

| Part | Where it runs | What it does |
| --- | --- | --- |
| Proxy | abio (8 cores), Traefik, managed by Coolify | Ends TLS for the site, balances across the page instances, and sends the two search paths to the search roles |
| Page instance 1 | abio, a Coolify application | The webapp image: documents, loader data, the API, OG images, and files |
| Page instance 2 | vector1 (16 cores), the same Coolify application on an additional server, reached through vector1's proxy over the private network | The same |
| Search roles A and B | vector1, from [`goodwatch-search/docker-compose.yml`](../goodwatch-search/docker-compose.yml), not Coolify applications | The same image started with `WEBAPP_ROLE=search`: ranked search and the command palette lookup |
| Static hostname | A `static` subdomain, proxied by Cloudflare's free plan. Its origin is the webapp behind abio's proxy | Build files and `public/` files, from Cloudflare's cache |
| Cache cluster | cache1, cache2, cache3: three Valkey 8 masters, no replicas | The data cache, OG images, build files of running builds, the title snapshot, and rate counters |
| Data stores | Crate (three nodes), Qdrant (one node, on vector1), Supabase for sessions | Titles and member data, related titles and search vectors, sign-in |
| Metrics | Alloy on each host, Grafana Cloud | Scrapes each process's private metrics port |

```text
visitor ── documents, API, OG images ──> proxy on abio ──> page instance on abio
   │                                        │         └──> vector1's proxy ──> page instance on vector1
   │                                        └── two search paths ──> vector1's proxy ──> search role A or B
   └── build files, public/ files ──> Cloudflare ── on a cache miss ──> proxy on abio ──> a page instance
```

- **The site's own DNS record is "DNS only".** Documents, member requests, and API requests never pass through Cloudflare. Only the `static` record is proxied. The zone itself is on Cloudflare's nameservers.
- **Every push to `main` deploys both page instances**, also for files outside the webapp. It doesn't deploy the search roles.
- **Pictures of titles and people** come from TMDB's image host, straight to the browser. They never reach the site.

## What answers each kind of request

Inside a page instance, a request passes these handlers in order. Each of the first four answers before Express:

```text
request -> browser gate -> static files -> page cache -> health endpoints -> Express -> Remix
```

### Documents

- **Route:** the proxy on abio sends requests without the auth cookie to the two page instances in turn. A request with the auth cookie gets a sticky cookie and stays on one instance. The file is [`goodwatch-proxy/traefik/goodwatch-balance.yaml`](../goodwatch-proxy/traefik/goodwatch-balance.yaml), and the reasons are in [webapp-deploys.md](webapp-deploys.md#the-sticky-cookie-is-for-members-only).
- **Anonymous pages that repeat** are answered from the in-process page cache: a complete compressed document from the memory of the Node process, at 0.5 to 0.8 ms of main-thread time instead of 14 to 63 ms for a render. A URL is stored on its second request within 60 seconds, lives 30 minutes fresh and 2 more hours stale, and tracking parameters aren't part of its key. Each process has its own store. See [page-cache.md](page-cache.md) and [ADR 0007](adr/0007-in-process-page-cache.md).
- **Who may get a stored page** is one rule, the cache identity: anonymous or member, country, language. A request with the auth cookie never reads or fills the store. See [cache-identity.md](cache-identity.md) and [ADR 0005](adr/0005-cache-identity-for-anonymous-html.md).
- **Share list and profile pages** are stored for anonymous visitors for 10 seconds fresh plus 10 stale, so that an edit is gone within the owner's limit of 60 seconds. See [Share list pages](page-cache.md#share-list-pages).
- **Everything else is rendered:** member pages, a URL's first request, pages that are never stored (the list is in [page-cache.md](page-cache.md#pages-that-are-never-stored)), and incomplete pages. A render reads the data cache in Valkey (`cached()`), which shares one run per key and serves expired catalog values while one refresh runs, and behind it Crate and Qdrant.
- **At most four renders of one URL run at once.** A fifth identical request gets the busy answer: 503 with `Retry-After: 2` and a small page that reloads itself. See [Four renders per key](page-cache.md#four-renders-per-key).
- **No cache stores HTML in front of the app.** That was decided in [Choose the page cache layer](https://github.com/alp82/goodwatch-monorepo/issues/253). Without a cache that sends `GW-Cache-Identity`, anonymous HTML leaves the app as `private, max-age=0`.

### Build files and `public/` files

- **Pages name the static hostname** for scripts and imported images under `/assets/`, `public/` images and flags, and the web manifest. Cloudflare answers them from its cache. On a miss it asks the webapp, which answers a request with the static hostname's `Host` from its file list and with 404 for everything else. See [static-assets.md](static-assets.md) and [ADR 0010](adr/0010-static-hostname-with-server-side-fallback.md).
- **Each instance falls back by itself.** It requests one file of its own build through the static hostname every 10 seconds. Three failures in a row switch that instance's new pages to the site's own host, and two minutes of successes switch them back. The origin stays a complete copy: every file also answers on the site's host.
- **What keeps the site's host by design:** the favicon and the touch icon, `robots.txt`, the sitemaps, OG images, and the share list fonts under `/fonts/share-card`.
- **On the origin,** a handler in front of Express answers files from a manifest of precompressed files, at 0.3 to 0.5 ms of main-thread time each. Hashed files are `immutable` for a year, `public/` images live a day, and text files such as the web manifest live an hour. See [viral-spike-static-assets.md](benchmarks/viral-spike-static-assets.md).
- **Two builds at once:** each process writes its build's hashed files to Valkey for a day, so that either instance, and through it Cloudflare, can answer a file of the other build. See [The shared store for build files](webapp-deploys.md#the-shared-store-for-build-files).
- **Today, requests for the static hostname reach abio's instance only.** That was observed in the load runs and its cause wasn't checked.

### OG images

- **Address:** `/og/<path>.jpg` on the site's own host, through the same route as documents. An OG image is the link preview image of a page. The code and older pages call it a card.
- **They stay on the site's host on purpose.** A `meta` function doesn't run inside the render, so an OG image's address can't follow one instance's fallback. See [the reasons with their numbers](benchmarks/viral-spike-static-hostname.md#og-images).
- **A hot image** is answered before Express from a 10-second store, at about the cost of a stored page. Behind it sit 32 MB per process and then Valkey, where both instances share the image.
- **A missing image** renders in a pool of child processes (two by default), off the main thread. A request waits at most 4 seconds and then gets a generic image with status 200 that caches for a minute. It never gets a 500.
- **Lifetime in Valkey:** 30 minutes for an image that was rendered for its first request, and 7 days once it's requested again, so that crawlers that fetch each image once don't fill the cache.
- **Share list images** carry a content hash in their URL and are `immutable`. They're drawn when a list is saved, shared, or viewed without one.
- The details are in [viral-spike-og-images.md](benchmarks/viral-spike-og-images.md).

### The API

- **Route:** every path under `/api/` except the two search paths goes to the page instances, like a document. The page cache never looks at `/api/`.
- **An anonymous page view sends few of them:** the error tracking POST (`/api/e`), on title pages the poster impressions POST, and on the home page its pool request. A related titles panel asks `/api/related` only when a visitor selects it.
- **Catalog endpoints** that are the same for everyone answer with a public lifetime and no `Vary`, and read the data cache in Valkey. Member endpoints read member caches that are reset on every write. See [Data endpoints](cache-identity.md#data-endpoints) and [member-data-cache.md](member-data-cache.md).
- **Every backend call has a time limit** and releases its request when it runs out. A Redis command gives up after 1 second and the request reads the database instead.

### Search

- **Route:** the proxy on abio sends `POST /api/combined-search` and `GET /api/command-palette` to vector1's proxy, which balances them across the two search roles and asks each role's `/health/ready` every 2 seconds. The files are [`goodwatch-search.yaml`](../goodwatch-proxy/traefik/goodwatch-search.yaml) and [`goodwatch-search-instance.yaml`](../goodwatch-proxy/traefik/goodwatch-search-instance.yaml).
- **State on October 9, 2026, from the ticket [Deploy two search roles on vector1 and route the search paths to them](https://github.com/alp82/goodwatch-monorepo/issues/400):** both roles run, both proxy files are installed, and the two paths reach the roles and no page instance. One step is left: the page instances still run with the default role, `both`, so each still loads the query models and the indexes (about 1.76 GB) without getting a search. The owner's switch to `WEBAPP_ROLE=page` ends that.
- **A search role** holds one query encoder with 2 threads and runs at most 4 searches at once. One more gets the busy answer, 503 with `Retry-After`. See [search-role.md](search-role.md) and [ADR 0011](adr/0011-search-runs-as-a-role-of-the-webapp-image.md).
- **The browser treats a bare 502, 503, or 504 on the two paths as the busy answer,** so a search that no role can take shows "busy" and not an error.
- **The search roles are deployed by a command, not by a push:** `./deploy.sh <commit>` on vector1, one role at a time. They can run an older commit than the page instances. See [search-role-deploy.md](search-role-deploy.md).

## Capacity and what limits it

"Measured" means a load run with the report linked. "Estimated" means arithmetic from measured costs. Page view runs use the public path with a new TLS connection per visitor, unless the line says otherwise.

| Part | Figure | Kind | Limit | Source |
| --- | --- | --- | --- | --- |
| Movie documents alone, both instances | 500 per second, no failed request, p95 27 to 44 ms at the last step, abio at 47% of its CPU | Measured | None reached | [Documents alone](benchmarks/viral-spike-static-hostname.md#documents-alone) |
| Whole movie page views, files from the static hostname | 80 per second with valid latencies. No failed request up to 120 | Measured | The two load generators, not the origin | [Movie page with the static hostname](benchmarks/viral-spike-static-hostname.md#movie-page-with-the-static-hostname) |
| Primary mix of pages, files from the static hostname | 80 visitors per second with valid latencies. No site error up to 100 | Measured | The load generators | [Primary scenario](benchmarks/viral-spike-static-hostname.md#primary-scenario-hot-mix-with-the-static-hostname) |
| Whole page views at 500 per second | Two instances are enough while the static hostname is up | Estimated: measured for the documents, extrapolated from 80 for the rest | First a Node main thread, most likely vector1's | [What limits it now](benchmarks/viral-spike-static-hostname.md#what-limits-it-now) |
| Whole movie page views during a fallback, files from the origin | 120 per second hold, 140 fail | Measured | The Node main threads (83% and 84% at 120) | [Movie page with the files from the origin](benchmarks/viral-spike-static-hostname.md#movie-page-with-the-files-from-the-origin) |
| 500 page views per second during a fallback | About 9 instances, 12 proxy cores, and 2.5 Gbit/s from one host. Not reachable behind today's proxy | Estimated | The proxy host | [Instances for 500 page views per second](benchmarks/viral-spike-static-hostname.md#instances-for-500-page-views-per-second) |
| What a movie page view costs the origin | 3 requests and 54 KB with the static hostname, against 37 requests and 619 KB without. 8 ms of proxy CPU on abio against 25 ms | Measured, read as plus or minus 30% | | [Cost per page view at the origin](benchmarks/viral-spike-static-hostname.md#cost-per-page-view-at-the-origin) |
| One process, one hot URL from the page cache | More than 1,300 requests per second, against 20 without the cache | Measured on a local build, no proxy | The main thread | [viral-spike-page-cache.md](benchmarks/viral-spike-page-cache.md) |
| One process, files next to pages | About 3,000 file requests per second | Measured on a local build | The main thread | [viral-spike-static-assets.md](benchmarks/viral-spike-static-assets.md) |
| OG images that are stored, both instances | 1,250 requests per second with no error, main threads at 50% to 65%. Private path, reused connections | Measured on October 5, 2026 | Not reached. The run ended because abio was sending 1.4 to 1.7 Gbit/s | [OG images again](benchmarks/viral-spike-page-views.md#og-images-again) |
| OG images at 500 visitors per second | About 30 requests per second and 35 Mbit/s | Estimated from the mix's share | | [OG images](benchmarks/viral-spike-static-hostname.md#og-images) |
| OG images that must be rendered | About 3 per second on a 4-core host. The rest get the generic image after 4 seconds | Measured on a measurement host, not on production | The child process pool | [viral-spike-og-images.md](benchmarks/viral-spike-og-images.md) |
| Home page views, before the static hostname | 60 per second | Measured on October 5, 2026 | The home page's pool request, then the proxy's CPU | [After the home pool fix](benchmarks/viral-spike-page-views.md#after-the-home-pool-fix) |
| One search role | About 9 ranked searches per second | Measured with a benchmark build on vector1, not on production's roles | The role's main thread and its encoder | [The search role benchmark](https://github.com/alp82/goodwatch-monorepo/blob/bench/search-role/docs/benchmarks/search-role.md) on branch `bench/search-role` |
| Two search roles | About 16 ranked searches per second at about 0.8 seconds p95. More searches get the busy answer, up to 80 sent per second | Measured, the same way | The same | The same |
| A new TLS connection | About 3.5 ms of proxy CPU with the ECDSA certificate (14 to 16 ms with RSA 4096) | Measured | | [Switch the proxy's certificate from RSA 4096 to ECDSA](https://github.com/alp82/goodwatch-monorepo/issues/339), [proxy-certificates.md](proxy-certificates.md) |
| Cache nodes | 7 GB limit per node. 2.7 GB in use per node on October 9, 2026 | Measured | Memory. At the limit, the least used entries with an expiry are evicted | [private-redis.md](private-redis.md), [ADR 0003](adr/0003-redis-cluster-of-masters-with-volatile-lfu.md) |
| Cloudflare | No 403, 429, or challenge in about 920,000 requests from two addresses at up to 4,100 per second. 73 of 74 files were cache hits | Measured | Not found. Above that rate it's unknown | [Summary](benchmarks/viral-spike-static-hostname.md#summary) |

What the figures say together:

- **The destination depends on the static hostname.** With it, the origin's share of 500 page views per second is measured for documents and estimated for the rest. Without it, the site holds 120 page views per second.
- **No load run sends the two POSTs of a real page view** (error tracking and poster impressions), so their cost at 500 per second is in no figure.
- **The older reports describe earlier states** and are the history of these numbers: [the baseline](benchmarks/viral-spike-baseline.md), [the checkpoint](benchmarks/viral-spike-checkpoint.md), [the render profile](benchmarks/viral-spike-render-profile.md), and [full page views before the static hostname](benchmarks/viral-spike-page-views.md).

## When a part fails

### The static hostname

- **What happens:** each instance's probe fails three times and that instance's new pages name the site's own host. Each switch writes one log line, and `goodwatch_static_assets_in_use{mode="auto"}` reads 0 on that instance.
- **What visitors see:** at worst about 36 seconds of pages without scripts and styles before the switch. An open tab keeps its address and recovers on its next reload.
- **Capacity:** 120 page views per second until the instance switches back, two minutes after the hostname answers again.
- **What nobody notices by itself:** no alert exists. The smoke check after a deploy prints the mode. Between deploys, an instance on the origin is seen only by someone who reads the gauge.
- **An outage in a region far from the hosts isn't detected.** The probe runs where the instance runs.
- **To force the origin:** the owner sets `STATIC_ASSETS=origin` and redeploys. See [static-assets.md](static-assets.md#owner-steps).

### One page instance

- **What happens:** the proxy asks each instance's `/health/ready` every 5 seconds and stops sending requests to one that doesn't answer. A retry moves a request to the other instance when the chosen one refuses the connection. A crash on vector1 answers 502 until the next health check, because vector1's proxy still answers.
- **What is lost:** that process's page cache and whatever it remembered for members. The other instance renders each hot URL once.
- **Capacity on one instance:** not measured on production. One process answers a hot URL more than 1,300 times per second on a local build.
- **abio is more than an instance.** It also holds the proxy, the site's TLS, and the address that Cloudflare pulls from. If abio fails, the site is down, whatever vector1 does. This follows from the layout and wasn't tested.
- **vector1 is more than an instance too.** It holds both search roles and Qdrant. Not tested as a whole.

### One cache node

- **What happens:** the other two nodes keep answering for their slots. Lookups for the failed node's slots fail for the first second and after that in under 1 ms, because the client marks the node as down. The webapp reads the databases instead. See [When a node fails](private-redis.md#when-a-node-fails).
- **What is lost until the node returns:** its third of the data cache, of the stored OG images, and of the build files in the shared store. The node loads its data again from its append-only file when it restarts.
- **The title snapshot:** a running process keeps the snapshot that it has in memory. A process that starts during the outage has none until the node is back, and serves Discover without titles in the document.
- **Measured:** a 59-second restart of one node cost 221 lookup errors and no failed request, and each node's switch to Valkey cost about a minute of lookup errors and no failed request. Both were at normal traffic. See [Set memory limits, eviction, and partial coverage on the Redis cluster](https://github.com/alp82/goodwatch-monorepo/issues/287).
- **To add or recreate a node:** [redis-add-node.md](redis-add-node.md) and [Recreate a node](private-redis.md#recreate-a-node).

### A search role

- **One role down:** vector1's proxy takes it out within 2 seconds, and a retry moves a refused connection to the other role. The other role carries the searches at about 9 per second, and the overflow gets the busy answer. In production, one role was stopped for 30 seconds and 110 of 110 command palette lookups answered. In the benchmark, a killed role cost 9 failed searches of 601 within one second.
- **Both roles down, or vector1's proxy down:** the two paths answer a bare 503, in the first seconds a 502, and the browser shows the busy state. Pages aren't affected.
- **To send searches back to the page instances:** the owner deletes `goodwatch-search.yaml` on abio's proxy. That works only while the page instances run as `both`. After the switch to `WEBAPP_ROLE=page`, set them back to `both` first. The order is in [search-role-deploy.md](search-role-deploy.md#10-switch-the-page-instances-to-the-page-role-owner-in-coolify).

### A deploy

- **What happens:** Coolify builds the image on abio and replaces the page instances one after the other, about 2 minutes each. On each host, the new container gets requests once `/health/ready` answers. The old one keeps serving for 8 seconds after SIGTERM, then drains and exits. See [webapp-deploys.md](webapp-deploys.md).
- **Failed requests:** 1 in a watched deploy at 2 requests per second, down from 30. With a proxy that checks readiness, a local copy of the setup lost none. A watched production deploy with the readiness check in the balancing route isn't in the docs.
- **The page cache starts empty** in each new process, so each instance renders a hot URL once. A draining process still answers its stored pages.
- **For 2 to 4 minutes the instances run different builds.** Each serves the other build's files from the shared store, and Cloudflare keeps what it has pulled.
- **Every changed file name is new to Cloudflare** after a deploy, so the first request for each one reaches the origin. A new process probes the static hostname only after it has published its files.
- **A failed image build leaves production on the old commit** with no signal. The smoke check with `--commit` waits for the new commit until its timeout.
- **A deploy during a load run makes the run invalid.** Don't push to `main` while one runs against production.
- **The search roles** restart one at a time, only when someone runs `deploy.sh`. A role is back about 20 seconds after its start (measured once), and the other one answers meanwhile.

## Settings that matter

Agents don't change Coolify settings, DNS, the proxy's configuration, or firewall rules. Those are the owner's, and each row says where the steps are. Agents change files in the repository, read production, and run the checks.

### Owner: Coolify, environment of the webapp application

| Setting | Value in production | Effect | Details |
| --- | --- | --- | --- |
| `STATIC_ASSETS` | `auto` | Pages name the static hostname, and the probe decides about the fallback. `origin` forces the site's host | [static-assets.md](static-assets.md#settings) |
| `STATIC_ASSETS_HOST` | The static hostname | Also turns on the file-only rule for requests with that `Host` | The same |
| `WEBAPP_ROLE` | Not set, which means `both` | `page` takes the search models out of the page instances | [search-role.md](search-role.md#settings) |
| `PAGE_CACHE` | Not set, which means on | `off` and a restart turn the page cache off | [page-cache.md](page-cache.md#how-to-turn-it-off) |
| `PAGE_CACHE_MAX_BYTES`, `PAGE_CACHE_MAX_ENTRIES`, `PAGE_CACHE_MAX_FRESH_SECONDS` | Defaults: 128 MB, 2,000 pages, no cap | The store's bounds | [page-cache.md](page-cache.md#bounds) |
| `CARD_RENDERERS`, `OG_CARD_FIRST_SECONDS`, `OG_CARD_KEPT_SECONDS` | Defaults: 2 children, 30 minutes, 7 days | The OG image renderer and its lifetimes | [viral-spike-og-images.md](benchmarks/viral-spike-og-images.md#storage) |
| `SHUTDOWN_DELAY_MS`, `SHUTDOWN_DRAIN_MS`, `SHUTDOWN_HARD_MS`, `READY_MAX_WAIT_MS` | Defaults: 8, 5, 25, and 30 seconds | The shutdown sequence and the longest wait for readiness. The proxy's health check interval must stay below the delay | [webapp-deploys.md](webapp-deploys.md#shutdown-on-sigterm) |
| Health check path, stop grace period, "Include Source Commit in Build" | See the table in the linked page | Readiness before requests, and a build cache that survives commits | [Coolify settings](webapp-deploys.md#coolify-settings) |

`SOURCE_COMMIT` isn't a setting: Coolify sets it when it starts a container, and the page cache's key, the build metric, and the smoke check read it.

### Owner: the proxies, in Coolify's dynamic configurations

| File | Proxy | Effect |
| --- | --- | --- |
| `goodwatch-balance.yaml` | abio | Balances the site across both page instances, with the readiness check, the retry, and the sticky cookie for members. Deleting it leaves abio's instance alone |
| `goodwatch-instance.yaml` | vector1 | Lets abio's proxy reach the page instance on vector1 |
| `goodwatch-search.yaml` | abio | Sends the two search paths to vector1. Deleting it sends them back to the page instances |
| `goodwatch-search-instance.yaml` | vector1 | Balances across the two search roles. Install it before the file on abio, and delete it after that one |

- The sources are in [`goodwatch-proxy/traefik/`](../goodwatch-proxy/traefik/), with placeholders where a private address belongs. `test-local.sh` and `test-search-local.sh` there test them against throwaway containers.
- The key type of the proxy's certificates is an argument of the proxy itself. See [proxy-certificates.md](proxy-certificates.md).
- vector1's proxy must trust abio's address for forwarded headers. Without that, every visitor behind vector1 shares one address in the rate limits.

### Owner: DNS and Cloudflare

- The zone is on Cloudflare's nameservers. `static` is the only proxied record, and the site's record stays "DNS only". Turning the proxy on for the site's record would put documents and members behind Cloudflare, which nothing here is built for.
- No cache rule for the web manifest exists, and none is recorded for anything else. Cloudflare caches by its defaults and the app's `Cache-Control`.
- The steps and what was checked: [Move the DNS zone to Cloudflare and proxy the static subdomain](https://github.com/alp82/goodwatch-monorepo/issues/395).

### Owner present: the cache nodes

- `goodwatch-cache/valkey.conf` holds the settings of all three nodes: `maxmemory 7gb`, `volatile-lfu`, `cluster-require-full-coverage no`, and the client output buffer limit. A node reads the file when its container starts. See [private-redis.md](private-redis.md#memory-limit-eviction-and-partial-coverage) and [ADR 0004](adr/0004-valkey-8-from-the-official-image.md).
- Every new write to Valkey must set an expiry. A key without one is never evicted.
- Firewall rules are the owner's, and each one carries a comment. See [worker-firewall.md](worker-firewall.md).

### Agents, after the owner's go-ahead: the search roles

- `goodwatch-search/docker-compose.yml` sets `WEBAPP_ROLE=search`, `SEARCH_MAX_IN_FLIGHT=4`, and 4 CPUs and 4 GB per role. `SEARCH_ENCODER_THREADS` stays unset, which gives a search role 2 threads.
- `./deploy.sh <commit>` in `goodwatch-search/` on vector1 deploys them. Don't run `docker compose up -d` by hand: it restarts both roles at once. See [goodwatch-search/README.md](../goodwatch-search/README.md).

## Checks that guard it

All commands run in `goodwatch-benchmark/`. The [benchmark README](../goodwatch-benchmark/README.md) has every option.

### Smoke check, after every deploy

```sh
./bench.sh smoke --commit "$(git rev-parse origin/main)"
./bench.sh smoke --host abio --commit "$(git rev-parse origin/main)"
./bench.sh smoke --host vector1 --commit "$(git rev-parse origin/main)"
```

- It finds the new container, requests about 30 pages with edge cases, checks the static hostname (the mode, a build file, and 404 for its root), scans the startup log, and fails when a 5xx counter rose. See [Smoke check after a deploy](../goodwatch-benchmark/README.md#smoke-check-after-a-deploy).
- With `SMOKE_SEARCH_ROLES` set in the ignored `config.env`, the default run also checks both search roles and warns when a role is behind the page instances in a file that it runs.
- It never sends a search that runs, and it doesn't run page scripts.

### Render path budget

```sh
./bench.sh budget
```

- Lighthouse on the generator host checks each landing surface against limits for requests, scripts, bytes, LCP, TBT, CLS, and the score. See [viral-spike-render-path-budget.md](benchmarks/viral-spike-render-path-budget.md).
- The LCP, score, and script byte limits were set again for pages on the static hostname. See [Limits with the static hostname](benchmarks/viral-spike-render-path-budget.md#limits-with-the-static-hostname).
- It's lab data from a server. It says nothing certain about a real phone.

### Load scenarios

- **Whole page views:** `./bench.sh load --scenario page-view`, on the public path with a new connection per visitor. `--files origin` sends the files to the site, which is the fallback case. `urls/movie-document.json` and `urls/hot-documents.json` send the documents alone. See [Page views](../goodwatch-benchmark/README.md#page-views).
- **The commands of the last runs** are under [Repeat the runs](benchmarks/viral-spike-static-hostname.md#repeat-the-runs).
- **Rules for a run:** one load or Lighthouse run at a time on a generator, no deploy during a run, the smoke check before it, and not during the Crate backup at minute 5 of every hour or the TMDB copy from 08:00 and 20:00 UTC. A step counts only while its generators stay under about 80% of their cores.
- **Stop rules** end a run by themselves on failed requests or slow answers. See [Automatic stop rules](../goodwatch-benchmark/README.md#automatic-stop-rules).
- **Watching a deploy:** `./bench.sh deploy-watch` sends 2 requests per second while a deploy runs and lists every failed one.

### Metrics

Each process serves its counters on a private port, and Alloy sends them to Grafana Cloud. The names and the queries are in [viral-spike-metrics.md](benchmarks/viral-spike-metrics.md).

| Question | Metric |
| --- | --- |
| Do pages name the static hostname? | `goodwatch_static_assets_in_use{mode="auto"}`: 1 is yes, 0 is a fallback |
| Does the page cache answer? | `goodwatch_page_cache_requests_total` by `result` |
| Did visitors get the busy answer? | `goodwatch_page_cache_busy_total` for pages, `goodwatch_search_busy_total` for search |
| Are responses failing or slow? | `goodwatch_http_responses_total` by `status_class`, `goodwatch_http_request_duration_seconds` |
| Is a main thread stalled? | `goodwatch_process_event_loop_delay_seconds` |
| Is a cache node down for a process? | `goodwatch_redis_breaker_open_nodes`, `goodwatch_redis_client_ready` |
| Which build runs where? | `goodwatch_build_info`, with `job="goodwatch_webapp"` for the page instances and `job="goodwatch_search"` for the search roles |

- Field Web Vitals are in PostHog, by route pattern. See [Field Web Vitals in PostHog](benchmarks/viral-spike-metrics.md#field-web-vitals-in-posthog).
- The proxy writes no access log. Request counts come from the processes, which don't see a request that the proxy refused.
- The only alert that these pages mention as existing is the hourly check of the Crate backup's age. No alert watches the serving path.

## Not verified and open

### The destination

- **The one-hour proof isn't run.** How it's run is open: [Decide how the one-hour load test proves the destination](https://github.com/alp82/goodwatch-monorepo/issues/404). The longest hold so far is 10 minutes at 80 visitors per second, from before the static hostname.
- **Whole page views above 120 per second aren't measured.** At 500 per second the generators need about 50 cores (estimate), and the files are about 18,000 requests per second to Cloudflare from a few addresses, which may be limited.
- **The error tracking POST and the poster impressions POST aren't in any load run.** At 500 page views per second they're 500 forwarded requests and up to 500 writes per second.
- **A visitor's own time isn't measured.** The page view durations in the reports are a generator's, 1 ms from the origin.

### The static hostname

- **No Grafana alert** for an instance that stays on the origin. The owner skipped it on October 9, 2026.
- **No fallback test on production.** Every transition was tested locally, and one production instance started on the origin and switched to the static hostname by itself. A running production instance that falls back wasn't observed, and neither was a fallback under load.
- **The web manifest isn't cached by Cloudflare.** It reaches the origin with every page view, on abio's instance alone. A cache rule on the static hostname would end that. It's an owner step.
- **The cost of the static hostname on a slow connection isn't measured.** The stylesheet's host makes no difference: with applied throttling, the first paint was the same with the stylesheet on the site's own host (3.25 to 3.59 s) as on the static hostname (3.35 to 3.64 s), and the change was reverted ([The stylesheet's host makes no difference](benchmarks/viral-spike-render-path-budget.md#the-stylesheets-host-makes-no-difference)). A comparison with every file on the site's own host needs production in `origin` mode for about 20 minutes.
- **Four 5xx answers from the static hostname** in 311,596 requests of the primary mix weren't identified.
- **Why requests for the static hostname reach abio's instance only** wasn't checked.
- **Cloudflare on a cold cache, in other regions, and right after a deploy** wasn't measured, and neither was its limit for one address above 4,100 requests per second. Whether a hostname with only static files falls under Cloudflare's rule about a disproportionate share of pictures is open.
- **The certificate renewal for the static hostname** at the proxy isn't proven until the first renewal, about 60 days after October 9, 2026.

### Instances, cache nodes, and search

- **One page instance alone on production** wasn't measured, and neither was the loss of abio or of vector1 as a host.
- **A cache node failure under load** wasn't run: [Run a one-node Redis failure drill](https://github.com/alp82/goodwatch-monorepo/issues/290). Adding a node was rehearsed on a throwaway cluster and not on production.
- **The search roles' capacity on production** wasn't measured. The load run at 20 searches per second was removed from the checklist, because it would write history rows to production and could start paid calls. The figures come from a benchmark build.
- **The page instances as `WEBAPP_ROLE=page`** aren't switched yet, as far as the ticket says. This page doesn't describe a later state.
- **Whether a search role sees the visitor's address** in production isn't verified. The local proxy test shows it.
- **The search roles' series in Grafana Cloud** weren't read after Alloy started to scrape them.
- **Adding a search role on a worker host** has no runbook yet: [Write the runbook for adding a search role on a worker host](https://github.com/alp82/goodwatch-monorepo/issues/401).

### Deploys and data

- **Which path Coolify's health check asks** wasn't read for this page. One page says that it asks `/` every 5 seconds, and another that it asks `/health/ready`. The balancing route asks `/health/ready` in both cases.
- **A deploy under load** wasn't measured: the failed requests per deploy are from 2 requests per second.
- **A dead link that goes viral** renders its 404 page once per request, because no cache stores a 404. Its cost isn't measured.
- **A restore of the Crate backup** was never tried.
- **Members under load** aren't measured. The benchmark has no signed-in session.
- **Good mobile Core Web Vitals,** the third part of the destination, aren't shown. Lab LCP is 4.0 to 6.4 seconds with the static hostname, and no field reading is recorded in the docs.

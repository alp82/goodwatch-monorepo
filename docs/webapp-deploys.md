# Webapp deploys: readiness and shutdown

How a deploy of the webapp switches containers, what the webapp does at its start and its end, how two instances on different builds serve each other's files, and which Coolify settings belong to it. Measured on October 4, 2026 for [Stop deploys from answering 502](https://github.com/alp82/goodwatch-monorepo/issues/298).

## What a deploy does

Coolify builds the image on the serving host and then runs a rolling update:

1. It starts the new container. Docker runs the health check every 5 seconds, after a start period of 5 seconds.
2. When Docker reports the new container healthy, Traefik adds it: Traefik's Docker provider leaves out containers whose health is `starting` or `unhealthy`. From here on, Traefik sends requests to both containers in turn.
3. 2 to 5 seconds later, Coolify runs `docker stop --time=30` on the old container: SIGTERM, and SIGKILL after 30 seconds.
4. When the old container's process ends, Docker reports `die`, and Traefik drops the container.

## Why deploys answered 502

`remix-serve` answers SIGTERM with `server.close()`: it stops listening and never exits. The old container stayed in step 3 for the full 30 seconds, still running and still `healthy` to Docker (one failed health check needs 10 retries), so Traefik kept sending it every second request and got "connection refused". Traefik answers that with 502.

One watched deploy, at 2 requests per second from outside:

| | Before |
| --- | --- |
| Requests sent during the watch | 374 |
| Failed | 30: 28 answered 502, and 2 got no answer within 20 seconds |
| Window | 30.6 seconds, from 0.7 seconds after SIGTERM to 0.8 seconds after the container ended |
| Share of the requests in the window | 30 of 62 |
| Requests the old container logged after SIGTERM | 0 |
| Exit of the old container | SIGKILL after 30 seconds, code 137 |

The two requests without an answer were sent while the container was being removed: Traefik still had its address, and nothing answers there any more.

A deploy could also pass without a 502: one of the three deploys watched before the change did. The likely reason: connections that carry a request at the moment of SIGTERM stay open, and Traefik keeps reusing them.

## What the webapp does now

`goodwatch-webapp/app/server/lifecycle.server.ts` holds both halves.

### Readiness

- `GET /health/ready` answers 200 when the process should get requests, and 503 with the reason otherwise.
- It waits for the title snapshot's first check (Discover needs the snapshot) and for the search index's first load (the command palette and search need their index when the proxy sends the first requests).
- It doesn't wait for the query encoder: it loads in a worker thread, and searches get basic results until then.
- After 30 seconds (`READY_MAX_WAIT_MS`) it answers 200 without them. A process that can't reach Redis or Crate still serves most pages, and a container that never turns healthy would be taken out of the proxy.
- It answers 503 from the moment a shutdown begins.
- `GET /health/live` answers 200 whenever the event loop turns.
- Both are answered before Express. They aren't logged and aren't counted in the request metrics.
- The title snapshot starts loading when the server build loads. Before, it started with the first page request.

### Shutdown on SIGTERM

| Step | What happens | Bound |
| --- | --- | --- |
| 1 | Readiness answers 503. Every response says `Connection: close`, so the proxy keeps no idle connection. The process keeps serving. Stored pages, hot share cards, and static files are answered before Express as before the signal. The page cache stores nothing new (see "During a shutdown" in [page-cache.md](page-cache.md)). | `SHUTDOWN_DELAY_MS`, 8 seconds |
| 2 | It waits for a moment without a recent request in flight, then stops listening. Idle connections close. | 2 seconds |
| 3 | Recent requests still in flight finish. A request that has been in flight for longer than the bound isn't waited for: its connection is cut, and the log names its method and the start of its path. | `SHUTDOWN_DRAIN_MS`, 5 seconds |
| 4 | The registered stops run: timers, the metrics listener, the Redis client, the query encoder, the share card renderers. | 1 second |
| 5 | Exit with code 0. | |

A timer set at the signal exits with code 1 after 25 seconds (`SHUTDOWN_HARD_MS`), whatever the state. Coolify's stop time is 30 seconds, so Docker's SIGKILL never comes first. SIGINT skips step 1. A second signal exits at once.

The listener closes as late as possible, because a container that runs without listening is exactly what Traefik answers with 502. The first version of the sequence stopped listening after step 1 and then waited 10 seconds for three requests that had been in flight for longer than the whole shutdown: that deploy answered 502 for 9.5 seconds (12 of 335 requests). Production has such requests: the in-flight gauge of a process that has run for some minutes rarely reads 0.

A module that starts a timer, a listener, a child process, or a client registers its stop with `onShutdown(name, stop)`.

The delay in step 1 exists for a proxy that checks readiness: it stops sending requests within that time. Without such a check, the delay costs 8 seconds per deploy and loses nothing, because the old process serves as before.

A local server now exits on `kill` after 8 seconds. Use `kill -INT` to skip the delay.

### Title snapshot retry

Before the first load, a failed check was retried every 2 seconds. Each load asks Redis for every chunk at once, and when the link is slow the node keeps sending replies that the webapp has already given up on. The wait now doubles with every failure in a row, from 2 seconds to 1 minute, and varies by up to a quarter.

## What remains without a proxy setting

The webapp can't tell Traefik to stop sending requests. Between the process's exit and Traefik's reaction to Docker's `die` event, Traefik still sends every second request to the old container's address.

On a local copy of the setup (Traefik 2.11, two containers, the same labels and health check, 20 requests per second):

| Setup | Failed requests per deploy | Window |
| --- | --- | --- |
| Before | 229 of 1,197 | 30.1 seconds |
| New shutdown, no proxy setting | 2 or 3 of about 750 in each of five runs (1 or 2 answered 502, 1 got no answer) | 0.1 to 0.2 seconds |
| New shutdown, and Traefik checks `/health/ready` | 0 of about 750 in each of five runs | None |

Three of these ten runs also had three long-lived requests in flight, which the shutdown cut. They aren't counted in the table.

In production, at 2 requests per second from outside:

| | Before | After |
| --- | --- | --- |
| Requests sent during the watch | 374 | 435 |
| Failed | 30 | 1, answered 502 |
| Window | 30.6 seconds | One request, 0.06 seconds after the old process exited |
| Exit of the old container | SIGKILL after 30 seconds, code 137 | Code 0 after 8.1 seconds |

Docker reported the old container's end 0.5 seconds after the process had exited. That half second, plus Traefik's reaction, is the window that remains: every second request in it fails. At 50 requests per second, that's about 15 failed requests per deploy.

## Two instances on different builds

The webapp runs as two instances behind a balancing route (`goodwatch-proxy/traefik/goodwatch-balance.yaml`). Coolify deploys them one after the other, about 2 minutes each, so for 2 to 4 minutes one instance runs the new build and the other one the old build. On each host, the old and the new container also run side by side for some seconds.

A page names the script and style files of the build that rendered it. Those files carry a content hash in their name, and only that build has them. A member's browser sends the sticky cookie `gw_instance` and reaches the instance that rendered the page (see [The sticky cookie is for members only](#the-sticky-cookie-is-for-members-only)). Every other client alternates between the instances, and got a 404 for every second file before the shared store. Confirmed on October 4, 2026, for [Serve a build's script files from every instance during a deploy](https://github.com/alp82/goodwatch-monorepo/issues/312).

### The shared store for build files

`goodwatch-webapp/app/server/build-file-store.server.ts` holds the store, and `static-files.server.ts` uses it.

- **Publish:** a process writes the hashed files of its build to Valkey when it starts: every file under `/assets/` except source maps, in its Brotli form when the build has one. The readiness check `build files` waits for the first attempt, so a new instance gets no page requests before the other instance can serve its files. The process writes them again every 8 hours, and after 1 minute when a write failed.
- **Lookup:** on a request under `/assets/` for a file that the build doesn't have, the process reads the file from Valkey once, keeps it in memory (32 MB at most), and answers it like a file of its own build: the same `ETag`, `immutable` for a year, Brotli for clients that accept it. The first read of a file logs `Build file from the shared store: <path>`.
- **Miss:** a file that Valkey doesn't have answers 404 with `no-store`, as before. The process remembers the miss for 5 seconds.

| Item | Value |
| --- | --- |
| Key | `build-file:v1:<path>`, for example `build-file:v1:/assets/root-AbCd1234.js` |
| Expiry | 24 hours, renewed every 8 hours while a process of that build runs |
| Files per build | 220 in production on October 4, 2026: scripts, style sheets, and the images and fonts that scripts import |
| Size per build | About 3 MB. A file that two builds share is one key, so a deploy adds only the files that changed |
| Largest stored file | 2 MB. A larger file isn't stored |
| Read time limit | 1 second |
| Reads in flight | 32 different files at most. Requests for the same file share one read |

Why Valkey, and not a request to the other instance or the previous build's files in the image:

- Both instances already share Valkey. Neither needs the other's address, and no route between them: the instance on vector1 can't reach the instance on abio today (abio's proxy has no route to its local instance alone, and the container's port isn't published).
- No request is passed on, so nothing can loop and nothing is proxied. A request path is only used as part of a key, and only when it has the shape of a hashed build file name.
- It works in both directions. The old instance serves the new build's files, which an image with the previous build's files can't do.
- It works for more than two instances, and for the two containers of one host during the switch.
- If static files move to a file server or a CDN later ([Decide where static assets are served from](https://github.com/alp82/goodwatch-monorepo/issues/310)), the store does no harm: a CDN that fetches from the instances without a cookie needs exactly this, and with a shared directory the lookups just stop happening.
- The static hostname relies on it ([static-assets.md](static-assets.md)): the CDN asks either instance for a build file, and in automatic mode a new process probes the static hostname for a file of its own build only after it has published.

What it doesn't cover:

- A route that only the new build has, such as a new URL pattern. The old instance answers what it answers for an unknown path.
- Source maps and files larger than 2 MB.
- A tab that was opened more than a day before, when no process of its build has run since. Its script requests get the 404, and the page reloads (`goodwatch-webapp/app/utils/stale-chunk.ts`).
- Valkey being down during a deploy. The lookups then fail fast and answer 404, as before the store.

### Check it locally

Run two production builds with different hashes as two processes against a throwaway Valkey (a single-node cluster in a container), never against the production cluster. Request a file of each build from the other process and compare the bytes and the headers. On October 4, 2026: all 223 files of one local build, requested from the other build's process, answered 200 with the same bytes, and with Valkey stopped an unknown file answered 404 in under 1 ms.

## The sticky cookie is for members only

Decided on October 5, 2026, for "Stop the balancing route from setting its cookie on shared-cacheable responses".

Before, the balancing route's one service had a sticky cookie, so the proxy added `Set-Cookie: gw_instance=...` to the first response of every client, and to every response of a client that keeps no cookies. A cache in front must not store a response with `Set-Cookie` ([cache-identity.md](cache-identity.md)), so it would have stored nothing.

### What needs one instance per visitor

| State | Where it lives | Needs stickiness? |
| --- | --- | --- |
| Member sessions | A signed Supabase cookie that each instance verifies per request | No |
| Anonymous pages in the page cache | Per process. Both instances store the same page for the same key and build | No |
| Page cache resets | Per process. Members are never served from it, and the 10 + 10 second lifetime bounds a share list page in the other process ([page-cache.md](page-cache.md)) | No. A cookie can't help: other visitors reach the other instance anyway |
| Data cache and its reset markers | Valkey | No |
| Search and poster impression limits | Valkey, by client address | No |
| Script and style files of two builds during a deploy | The shared store for build files, in both directions | No |
| What a process keeps for a member for a short time: the taste portrait, Explorer layouts, the Watch next pool | Per process | Useful: without it, a member's requests compute these once per instance |
| The guard against a second undo of the same IMDb import | Per process | Useful: two clicks that reach two instances would both start |
| Loader data during a deploy | A page from the new build can ask the old build's instance for loader data, for the 2 to 4 minutes in which the builds differ | Helps a little. Stickiness only halves it: the instance a browser sticks to is replaced during the same deploy |

Nothing breaks without stickiness. Members get some use out of it, and their responses are `private, no-store` anyway.

### The design

Two routers for `goodwatch.app` on the HTTPS entry point, in `goodwatch-proxy/traefik/goodwatch-balance.yaml`:

- **`gw-webapp-member-https`, priority 1001:** matches a request whose `Cookie` header has the auth cookie, by the same name pattern as `app/utils/auth-cookie.ts`. Its service `gw-webapp-member` has the sticky cookie.
- **`gw-webapp-https`, priority 1000:** every other request. Its service `gw-webapp` has the same servers and health check, and no cookie.

Traefik sets the sticky cookie only on a response to a request that came without a valid one, so a member gets it once per browser session.

Options that lost:

- **No stickiness at all:** one router fewer, but members lose the reuse above and gain nothing.
- **A middleware that removes `Set-Cookie` from `public` responses:** Traefik v2.10's `headers` middleware can remove a response header, but not on a condition, and it would remove the app's own cookies too.
- **A cookie that the app sets:** needs a new route between the app and the proxy's choice of server. The auth cookie already says who is a member.

What changes for visitors:

- An anonymous browser now alternates between the instances, like crawlers and the benchmark always did. During a deploy it relies on the shared store for build files, and a client-side navigation can get loader data from the other build. Not measured.
- A browser that already has `gw_instance` keeps sending it until it closes. The cookie-free service ignores it.
- The proxy checks each instance's readiness twice per interval, once per service.

### Test it

`goodwatch-proxy/traefik/test-local.sh` builds both proxies and two stub instances from throwaway containers. Section 2b checks that anonymous responses carry no cookie (also with analytics cookies, with a leftover `gw_instance`, and with a cookie whose name only ends like the auth cookie), and that a request with the auth cookie gets the sticky cookie once and stays on one instance.

### Owner steps

Agents don't change the proxy. Traefik loads a dynamic configuration without a restart, and no connection is dropped.

1. In Coolify, open **Servers**, then **abio**, then **Proxy**, then **Dynamic Configurations**.
2. Open `goodwatch-balance.yaml` and copy its current content to a local file, for the rollback.
3. Replace the content with `goodwatch-proxy/traefik/goodwatch-balance.yaml` from the repository, and save. Coolify removes the comments.
4. On abio, check that the member rule arrived unchanged:

   ```sh
   grep HeadersRegexp /data/coolify/proxy/dynamic/goodwatch-balance.yaml
   ```

   It must show `` HeadersRegexp(`Cookie`, `(^|;) *sb-[^=; ]+-auth-token([.][0-9]+)?=`) ``.
5. From any machine, check both cases. The first command must print nothing. The second must print one `set-cookie: gw_instance=...` line.

   ```sh
   curl -sI https://goodwatch.app/ | grep -i '^set-cookie: gw_instance'
   curl -sI -H 'Cookie: sb-check-auth-token=x' https://goodwatch.app/ | grep -i '^set-cookie: gw_instance'
   ```

6. Run `./bench.sh smoke` in `goodwatch-benchmark`.

**Roll back:** put the saved content back into `goodwatch-balance.yaml` in the same place and save. If the site answers 404 or 503 after step 3 and the old content isn't at hand, delete the file there: Coolify's own routers then serve the site from abio's instance alone.

## The build's commit

The process reads the commit of its build from the environment variable `SOURCE_COMMIT`.

- **Where it comes from:** Coolify sets it in the container's environment when it starts the container. The image
  doesn't hold it: the Dockerfile has no `ARG` or `ENV` for it. Checked on October 5, 2026, on both instances: the
  variable in the container's configuration and in the Node process is the full commit, the same as the image's tag.
- **Who reads it:** the page cache's key (`page-cache.server.ts`), the metric `goodwatch_build_info`
  (`metrics/process.server.ts`), and the smoke check's `--commit` option, which reads the variable in the container
  with `docker exec`. Without the variable, the first two say `unknown`.
- **No shared store has it in a key.** The page cache lives in the process. The shared store for build files uses
  the file's path, which carries a content hash. A store that two builds share and that keys on the commit would get
  the right value in production as things are.
- **A container that Coolify didn't start** (a local run of the image, a measurement host) has no commit unless you
  pass one: `docker run -e SOURCE_COMMIT=<commit> ...`.
- **Why the image doesn't hold it:** nothing reads it at build time. A build argument that changes with every commit
  ends the layer cache at the first instruction that uses it, and Coolify's setting for it is off for that reason
  (see the table below).

## Coolify settings

Agents don't change Coolify settings. These are for the owner, in the application's **Configuration** pages.

| Page and field | Value | What it buys |
| --- | --- | --- |
| **Healthcheck**, section **HTTP request**, field **Path** | `/health/ready` | A new container gets requests only after the title snapshot and the search index have loaded. The check no longer renders the home page every 5 seconds. |
| **Healthcheck**, section **Timing and retries** | Keep interval 5, timeout 5, retries 10, start period 5 | Readiness took 9 seconds in the watched deploy, so the second or third check passes. 10 retries leave room up to 50 seconds. |
| **General**, section **Container labels**, field **Label management** | **Managed manually (edit labels yourself)**, then add the three labels below | Traefik asks `/health/ready` itself and stops sending requests to a container that is shutting down, before it exits. This closes the remaining window. |
| **Advanced**, field **Stop grace period (seconds)** | Keep empty (30) | The shutdown needs at most 25 seconds. |
| **Advanced**, checkbox **Include Source Commit in Build** | Keep off | Coolify then passes the commit only to the running container, which is all the webapp needs, and the image layers stay cached between commits. |

The labels, for the service of the main domain:

```
traefik.http.services.https-0-gk4owk8.loadbalancer.healthcheck.path=/health/ready
traefik.http.services.https-0-gk4owk8.loadbalancer.healthcheck.interval=5s
traefik.http.services.https-0-gk4owk8.loadbalancer.healthcheck.timeout=4s
```

Things to know before changing the label management:

- Coolify no longer regenerates the labels when a domain or a proxy option changes. The page has a reset to Coolify's defaults.
- With one container, a Traefik health check turns an event loop stall that is longer than the timeout into 503 responses until the next check passes. That's why the timeout is 4 seconds and not 1.
- The interval must stay below `SHUTDOWN_DELAY_MS` (8 seconds), or the old container exits before Traefik has noticed.

## Watch a deploy

```sh
cd goodwatch-benchmark
./bench.sh deploy-watch          # waits for the next push to main
./bench.sh deploy-watch --now    # a deploy is already running
```

It sends 2 requests per second over the public address, and reads Docker's events, the containers' state and health, and their logs on the serving host. It changes nothing there. The report lists the events, the `Shutdown:` log lines of the old container, and every failed request.

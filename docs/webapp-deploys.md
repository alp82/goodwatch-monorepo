# Webapp deploys: readiness and shutdown

How a deploy of the webapp switches containers, what the webapp does at its start and its end, and which Coolify settings belong to it. Measured on October 4, 2026 for [Stop deploys from answering 502](https://github.com/alp82/goodwatch-monorepo/issues/298).

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
- It waits for the title snapshot's first check (Discover needs the snapshot) and for the search index's first load (it blocks the event loop for about 2 seconds, which a new process should have behind it).
- It doesn't wait for the query encoder: it loads in a worker thread, and searches get basic results until then.
- After 30 seconds (`READY_MAX_WAIT_MS`) it answers 200 without them. A process that can't reach Redis or Crate still serves most pages, and a container that never turns healthy would be taken out of the proxy.
- It answers 503 from the moment a shutdown begins.
- `GET /health/live` answers 200 whenever the event loop turns.
- Both are answered before Express. They aren't logged and aren't counted in the request metrics.
- The title snapshot starts loading when the server build loads. Before, it started with the first page request.

### Shutdown on SIGTERM

| Step | What happens | Bound |
| --- | --- | --- |
| 1 | Readiness answers 503. Every response says `Connection: close`, so the proxy keeps no idle connection. The process keeps serving. | `SHUTDOWN_DELAY_MS`, 8 seconds |
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

## Coolify settings

Agents don't change Coolify settings. These are for the owner, in the application's **Configuration** pages.

| Page and field | Value | What it buys |
| --- | --- | --- |
| **Healthcheck**, section **HTTP request**, field **Path** | `/health/ready` | A new container gets requests only after the title snapshot and the search index have loaded. The check no longer renders the home page every 5 seconds. |
| **Healthcheck**, section **Timing and retries** | Keep interval 5, timeout 5, retries 10, start period 5 | Readiness took 9 seconds in the watched deploy, so the second or third check passes. 10 retries leave room up to 50 seconds. |
| **General**, section **Container labels**, field **Label management** | **Managed manually (edit labels yourself)**, then add the three labels below | Traefik asks `/health/ready` itself and stops sending requests to a container that is shutting down, before it exits. This closes the remaining window. |
| **Advanced**, field **Stop grace period (seconds)** | Keep empty (30) | The shutdown needs at most 25 seconds. |

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

# YepWatch: a front that stays up through deploys

Design note for an owner decision, November 13, 2026. Production was only read: `docker ps`, `docker inspect`, Docker networks, the abio proxy's access log, Coolify's deployment queue (read-only SQL), DNS and HTTP headers. Nothing on a host, in Coolify or in DNS was changed.

Question: can the Caddy in `goodwatch-proxy/` be the always-on front that holds requests while YepWatch's containers (and GoodWatch's) swap during a deploy?

**Short answer.** For yepwatch.com: yes, after two fixes. Its Caddy has to move from 2.8.4 to 2.11.7, because 2.8.4 answers 502 to a held POST. And the YepWatch front needs a fixed address on abio, a published port on the private network. For goodwatch.app: no, not now. goodwatch.app already has an always-on front with health checks, abio's Traefik with `goodwatch-balance.yaml`. Its 503s on November 12 between 19:11 and 19:15 UTC didn't come from a container swap. Both instances were overloaded after the deploy. A front that holds requests would only make those queues longer.

## Traffic today

### yepwatch.com

```
client ──DNS (Namecheap, A 159.69.247.66, TTL 1800)──▶ abio coolify-proxy (Traefik 2.10.7, TLS, Let's Encrypt)
        ──router from the front container's labels──▶ front:8080 (Caddy 2.11.7, static app)
                                                        ├─▶ api:3000      (lb_try_duration 30s, lb_try_interval 100ms)
                                                        └─▶ gateway:4311  (WebSocket, same hold)
```

- Coolify compose app `csq2euofkojrcfzyxwrjxwym`. All three containers sit on the Docker network of the same name, and `coolify-proxy` is attached to it. Each container's name carries the deploy time (`front-csq2…-20261112T211728`). Its aliases on the network are that name and the service name (`front`, `api`, `gateway`).
- Traefik's routers for yepwatch.com (`https-0-csq2euofkojrcfzyxwrjxwym-front-e6ec@docker`) exist only while a front container runs, because they come from that container's labels.
- `www.yepwatch.com` has no DNS record (NXDOMAIN). Coolify has a router for it, but no client can get there.

### goodwatch.app

```
client ──DNS (Cloudflare, DNS only, A 159.69.247.66, TTL 300)──▶ abio coolify-proxy (Traefik 2.10.7, TLS)
        ──goodwatch-balance.yaml (priority 1000/1001, health check /health/ready every 5 s, retry 2)──┬─▶ abio: goodwatch-webapp:3000 (alias on the coolify network)
                                                                                                  └─▶ vector1 Traefik :80 (ClientIP 10.0.0.21) ─▶ goodwatch-webapp:3000
        ──goodwatch-search.yaml (priority 1100: /api/combined-search, /api/command-palette, /mcp)──▶ vector1 search roles
```

`static.goodwatch.app` is proxied by Cloudflare and reaches abio's Traefik as well.

### goodwatch-proxy

- It runs on **pgnode01 (Crate-01), 10.0.0.11, public 128.140.87.34**, not on abio. The host also runs `crate-01`, a Windmill worker and the private admin Caddy (`goodwatch-private-proxy`, `10.0.0.11:443`). Load average was about 7.5 on 16 cores, and 22.7 of 31 GB of memory was in use.
- Image `caddy:latest`, running v2.8.4. Started by hand from `/root/goodwatch/goodwatch-monorepo/goodwatch-proxy` (a checkout at c8cef2b2, October 16). Nothing deploys it automatically.
- **The live files differ from the repository.** The live `docker-compose.yml` binds 80/443 to the public IPv4 and IPv6 addresses only. In the repository it binds every address, which would collide with the private proxy on `10.0.0.11:443`. The live `Caddyfile` has the public Kuma allowlist for `status.goodwatch.app`, and the repository doesn't. Both changes were made during the private administration rollout (`docs/private-administration.md`) and were never committed.
- What it serves: `a.goodwatch.app` (PostHog relay), `status.goodwatch.app` (public Kuma page), `windmill.goodwatch.app`, the Convex APIs for aistack and manaschmiede, and `a.seen.is`. None of goodwatch.app or yepwatch.com goes through it.
- From 10.0.0.11, abio is 0.4 to 4 ms away (average 1.2 ms), and so is vector1. `curl -H 'Host: goodwatch.app' http://10.0.0.21/` from there reaches abio's Traefik, which answers 301, its HTTP-to-HTTPS redirect.
- `traefik/` holds the dynamic configurations for the Coolify proxies on abio and vector1, not files for this Caddy. `seo/` is the Googlebot log export, and `acceptance/` holds the Traefik access-log evidence for search.

## Why yepwatch.com goes down during a deploy

Coolify doesn't do rolling updates for compose apps. It removes every old container, front included, before it starts the new ones. While no front container runs, abio's Traefik has no router for yepwatch.com and answers 404. The api already starts without a shutdown delay (the comment in `yepwatch-app/compose.yaml`), so the gap is now about 7 seconds. The front's own hold (`lb_try_duration 30s`) covers api and gateway restarts only while the front itself runs.

So the fix needs a proxy that isn't part of the compose app and that refuses to give up while the front is missing. Traefik can't do this: it answers at once when a route or server is missing, and its retry middleware isn't a hold.

## Why not goodwatch.app (for now)

Deploys of `gk4owk8` on November 12 at 19:10 UTC: abio ran from 19:10:05 to 19:12:05 and vector1 from 19:11:37 to 19:12:43. abio's access log, `gw-webapp-*` routers, requests per minute:

| Minute (UTC) | 200 | 499 | 502 | 503 |
| --- | --- | --- | --- | --- |
| 19:09 | 1,640 | 9 | 0 | 0 |
| 19:11 | 2,079 | 215 | 0 | 23 |
| 19:12 | 1,309 | 1,901 | 197 | 1,566 |
| 19:13 | 369 | 2,193 | 32 | 3,276 |
| 19:14 | 71 | 1,296 | 0 | 2,407 |
| 19:15 | 790 | 332 | 0 | 636 |
| 19:16 | 1,401 | 37 | 0 | 0 |

The 503s continued for 3 minutes after both deploys had finished, and thousands of clients gave up waiting (499). Neither instance was answering its health check in time, so Traefik had no server and answered 503. That is overload or a blocked event loop after start, not a gap between containers. It happened again this morning: from 08:05 to at least 08:12 UTC, the new abio instance (1ba46d8e) failed Docker's health check ("exceeded timeout (5s)"), and `/health/live` and `/` inside the container didn't answer within 8 seconds, at 170 to 250 % CPU. Meanwhile goodwatch.app was served by vector1 alone. In the 10 minutes before 08:13, the proxy logged 23,448 responses with 200, 8,002 with 403 (browser gate), 2,404 with 429 and 1,791 with 499: heavy automated traffic. By 08:13 the container was healthy again, with a failing streak of 1.

A front that holds requests in front of two saturated instances makes the queue longer and turns 503s into timeouts. Fix that first, separately: warm-up after start, CPU budget, the bot load. After that fix, Caddy could take over from `goodwatch-balance.yaml` for goodwatch.app with the same mechanism as below. That move would mean porting the member sticky cookie, the search routing and the www redirect, and changing trusted IPs on both Traefiks. It's a project of its own.

## Proposed change for yepwatch.com (B: TLS stays on abio)

```
client ─▶ abio Traefik (TLS as today; file router yepwatch-front.yaml, priority 1000)
            └─ failover service
                 main:     goodwatch-proxy Caddy  10.0.0.11:8480 ──hold up to 30 s──▶ 10.0.0.21:18480 ─▶ front:8080
                 fallback: 10.0.0.21:18480 directly (only when the Caddy on .11 fails its health check)
```

Why this shape:

- **Reuses goodwatch-proxy, with no DNS or TLS change.** abio's Traefik keeps the certificate. A router in a dynamic configuration file keeps the certificate renewing and doesn't disappear with the container. Rollback means deleting the file, and it takes effect at once, the same as `goodwatch-balance.yaml`.
- **The front gets an address that survives the swap.** The front publishes 8080 on abio's private address at a fixed port. While no front container runs, a connection to that port is refused. Caddy treats that as a dial error and retries every 100 ms for any method, because the request never reached an upstream. Docker DNS aliases can't do the same job across hosts. Within abio, Traefik answers a missing alias with 502, and Caddy doesn't retry on a status code.
- **pgnode01 doesn't become a single point of failure.** Traefik's `failover` service (file provider only, present in 2.10.7) health-checks the Caddy on .11. When that Caddy or its host is down, Traefik sends traffic straight to the front port. Deploys then behave as they do today, and nothing worse happens.

### 1. Repository: `yepwatch-app/compose.yaml` (push from a thread)

```yaml
  front:
    # …
    expose: ["8080"]
    # A fixed address for the always-on hold in goodwatch-proxy (docs/yepwatch-zero-downtime-front.md). Only the
    # private network reaches it. Old containers are gone before new ones start, so the port is free at every deploy.
    # Local use: YEPWATCH_FRONT_ADDRESS=127.0.0.1.
    ports: ["${YEPWATCH_FRONT_ADDRESS:-10.0.0.21}:18480:8080"]
```

`yepwatch-realtime/release/test-repository-compose.py` line 37 currently asserts that no service publishes a port. Change it so that only `front` may publish, and only on a non-wildcard address, port 18480. 18480 is free on abio (checked with `ss -ltn`). Docker-published ports go around UFW, and abio's `DOCKER-USER` chain is only `RETURN`. Binding to `10.0.0.21` keeps the port private, at the same exposure as the Crate and Redis ports. A narrower `DOCKER-USER` rule (from 10.0.0.11 and the coolify-proxy network only) is optional. If one is added, it needs the owner/purpose comment from AGENTS.md.

Optional in the same change: in `yepwatch-realtime/release/Caddyfile`, global `servers { trusted_proxies static private_ranges }`, so that the front keeps the visitor's address in `X-Forwarded-For` instead of replacing it. Today nothing in YepWatch reads it (see Risks), so this only matters for logs.

### 2. goodwatch-proxy on .11 (repository change, then the owner or an approved session applies it)

First commit the live drift (public-IP port bindings, Kuma allowlist) to the repository, so the repository matches what runs. Then:

```yaml
# goodwatch-proxy/docker-compose.yml
    image: caddy:2.11.7@sha256:3095ad245c353e3bdb27a38f22a095c1cfa9e295ab21c0214c3e72b0e2960525   # same pin as the YepWatch front
    ports:
      # … the existing public bindings …
      # yepwatch.com hold, plain HTTP from abio's proxy over the private network.
      - "10.0.0.11:8480:8480/tcp"
```

```caddyfile
# goodwatch-proxy/Caddyfile, at the top (global options)
{
	servers :8480 {
		# abio's proxy sets X-Forwarded-For / X-Real-Ip; keep them.
		trusted_proxies static 10.0.0.21/32
	}
}

# … existing sites …

# Always-on hold for yepwatch.com (docs/yepwatch-zero-downtime-front.md). abio's proxy ends TLS and sends the
# requests here. While a deploy replaces the YepWatch containers, the front's port refuses connections; Caddy
# holds each request and tries every 100 ms for up to 30 s. A refused connection never reached the app, so
# retrying it is safe for every method; a request that did reach it is retried only when it is a GET.
:8480 {
	@yepwatch host yepwatch.com
	handle @yepwatch {
		reverse_proxy 10.0.0.21:18480 {
			lb_try_duration 30s
			lb_try_interval 100ms
			# A reload of this Caddyfile (for any site) must not cut every open room's WebSocket at once.
			stream_close_delay 30m
		}
	}
	# abio's failover health check (any Host other than yepwatch.com).
	handle /edge-health {
		respond "ok" 200
	}
	handle {
		respond "Not found" 404
	}
}
```

No `encode`: the front compresses its own responses. No active health check on the front: with one upstream, the request goes through within 100 ms of the port opening, not at the next check (measured below).

Applying it recreates the `caddy` container (new port, new image), which restarts every public site on .11 for about a second. The certificates in the `caddy_data` volume stay. Use `docker compose up -d --pull never caddy` after pulling the pinned image, because `caddy:latest` must not move on its own.

**The version matters.** Caddy 2.8.4, the version running now, answered **502** for a POST held over a 3 s gap ("http: invalid Read on closed Body"). 2.11.7 delivered the body after the gap. Tested locally, see Measured below.

### 3. abio Traefik: `yepwatch-front.yaml` (owner, Coolify UI)

Servers > abio > Proxy > Dynamic Configurations > + Add, file name `yepwatch-front.yaml`. It belongs next to the other files in `goodwatch-proxy/traefik/`, with a test like `test-local.sh`.

```yaml
http:
  routers:
    yw-front-https:
      entryPoints: [https]
      rule: Host(`yepwatch.com`)
      priority: 1000
      service: yw-front
      tls:
        certResolver: letsencrypt
    yw-front-http:
      entryPoints: [http]
      rule: Host(`yepwatch.com`)
      priority: 1000
      middlewares: [yw-front-redirect-to-https]
      service: yw-front
  middlewares:
    yw-front-redirect-to-https:
      redirectScheme: {scheme: https, permanent: true}
  services:
    yw-front:
      failover:
        service: yw-front-hold
        fallback: yw-front-direct
    yw-front-hold:
      loadBalancer:
        passHostHeader: true
        healthCheck:
          path: /edge-health
          interval: 2s
          timeout: 1s
        servers:
          - url: http://10.0.0.11:8480
    yw-front-direct:
      loadBalancer:
        passHostHeader: true
        servers:
          - url: http://10.0.0.21:18480
```

Priority 1000 beats Coolify's label routers (rule length, about 45), and ACME HTTP challenges still go to Traefik's own challenge router. Coolify's `gzip-sse` middleware is left out on purpose. Delete the file and Coolify's routers take over again.

### Who does what

| Step | Who |
| --- | --- |
| Compose port, compose test, optional `trusted_proxies` in the front Caddyfile | Repository, push (YepWatch auto-deploys) |
| Commit the live goodwatch-proxy drift, then the new site, port and image pin | Repository, push |
| Apply on .11: `git` update of the checkout (it has local changes), pull `caddy:2.11.7`, recreate `caddy` | Owner, or a session the owner approves (server change) |
| Add `yepwatch-front.yaml` on abio | Owner, Coolify UI |
| Smoke loop through one deploy (below) | Thread, read-only |

Order: compose first (the published port changes nothing until something uses it), then .11, then the Traefik file.

## Alternatives

**A. Move TLS to goodwatch-proxy (DNS change).** Point yepwatch.com at 128.140.87.34 and let Caddy end TLS. This removes the Traefik hop and adds HTTP/3. Costs: pgnode01 becomes a single point of failure in series with abio, with no failover. Rollback goes through DNS (TTL 1800 today). And the certificate needs a plan. abio's Traefik answers every `/.well-known/acme-challenge/` itself, so Caddy can't get an HTTP-01 certificate before the switch. Either move yepwatch.com's nameservers to Cloudflare and use DNS-01 (the private proxy already builds Caddy with the Cloudflare module), or accept a few seconds of TLS errors right after the switch. Also, the live Caddy image has no DNS module. B gets the same hold without any of this.

**C. A small always-on Caddy on abio itself**, as its own compose project outside the YepWatch app, with the same Traefik file. It avoids the cross-host hop and the dependency on .11, but it doesn't reuse goodwatch-proxy and adds a component to maintain.

**Not chosen:** splitting the front into its own Coolify Dockerfile app with rolling updates. The front reaches `api` and `gateway` by service name, so that needs cross-app networking in Coolify. And the api and gateway restarts still need the hold.

## Expected outage per deploy after the change

- **No failed requests.** A request that arrives while the containers swap waits instead of getting Traefik's 404. The wait is at most the gap, about 7 s today, plus up to 100 ms. Once the new front runs, the front's own hold takes over for the api and the gateway, as it does today.
- **WebSockets** still drop once per deploy, because the gateway process restarts. The client's reconnect is held until the new gateway answers, so the client sees a reconnect without an error. Native clients already resend saved idempotent requests (`yepwatch-app/src/core/continuous/resend.ts`).
- The wait itself can only go away with two stacks side by side (blue/green), which Coolify's compose deploys don't offer.
- If a deploy breaks the front for good, requests wait 30 s and then get 503 ("no upstreams available"), instead of a quick 404.

## Verification

1. **Before:** a smoke loop through one deploy, to record the baseline (expect about 7 s of 404s from Traefik).
2. **After**, the same loop: from a machine outside the network, every 200 ms, log the time, status and duration of
   - `GET https://yepwatch.com/`
   - `GET https://yepwatch.com/api/yepwatch/v1/proposal/health/ready` (GET only, the route has no HEAD)
   - `POST https://yepwatch.com/api/yepwatch/v1/proposal/invites/preview` with an invalid code: expect a stable 4xx and never a 5xx
   - one WebSocket client on `/api/yepwatch/v1/proposal/realtime` that reconnects and logs each gap.

   Start a deploy (a push to a watch path, or Redeploy in Coolify). Pass: no connection errors, no 404/502/503, the longest duration at most the gap plus 1 s, and every WebSocket reconnect succeeding on its first try. The deploy's timing comes from Coolify's queue (`application_deployment_queues`, read-only).
3. **Failover:** after .11 is in place, stop nothing in production. Test failover with the local rehearsal below. Watch the health-check lines of `yw-front-hold` in abio's Traefik log once.
4. Add a Kuma monitor for `http://10.0.0.11:8480/edge-health`, so that running on the fallback doesn't go unnoticed.

## Risks

| Risk | Assessment |
| --- | --- |
| Single point of failure | B adds .11 to the path, but the failover sends traffic around it when its Caddy fails a 2 s health check, at a cost of a few seconds of 502 for requests already in flight on .11. abio stays a single point of failure, as today. Recreating the .11 Caddy for other sites restarts the hold for about a second; failover covers that. |
| TLS issuance | Unchanged in B: Traefik keeps the certificate it has, and the file router renews it. A would need DNS-01 or a short gap. |
| WebSocket | Caddy and Traefik pass upgrades through. `stream_close_delay 30m` on .11 keeps open rooms alive across Caddy reloads. Existing timeouts don't change (Traefik 2.10 has no read timeout by default). Include the WebSocket client in the smoke loop. |
| Replaying request bodies | Only connections that were refused are retried for POST, and those requests never reached the app. Once a connection is made, only GET is retried (`lb_retry_match`'s default). One small window remains: an idle pooled connection that the old front closes while a POST is being sent on it gets a 502. YepWatch's writes carry idempotency keys and native clients resend them. Requires Caddy ≥ 2.11 on .11 (2.8.4 fails held POSTs). |
| Server-Timing and headers | Both proxies pass response headers through unchanged. Caddy adds `Via: 1.1 Caddy` to the upstream request. Nothing is compressed twice (no `encode` on .11, `gzip-sse` left out). |
| Client IP | Traefik sets `X-Forwarded-For`/`X-Real-Ip`. .11 trusts 10.0.0.21 and appends its own hop. The front trusts private ranges once the optional line is in. Today no YepWatch code reads these headers. The gateway's per-IP WebSocket cap (`maxPerIp`, 128 in the container) counts the socket address, which has always been the front's own address. So that cap acts as a global cap, before and after this change. |
| Rate limits | YepWatch's limits are global or per actor (`ADMISSIONS_PER_MINUTE`, commands per actor), not per IP, so they don't change. Held requests arrive together when the front comes back: a burst of the length of the gap. That's small at YepWatch's traffic, but it's the one load spike this change adds. |
| Drift on .11 | The checkout there has uncommitted changes. Applying from the repository without committing them first would undo the Kuma allowlist and the public-only bindings, and the latter would break the private admin proxy. |

## Rollback

Delete `yepwatch-front.yaml` in Coolify, and Coolify's label routers take over at once. The published port and the .11 site can stay; nothing uses them without the file.

## Measured locally (November 13, 2026)

All on this machine, host network, with a Python upstream that is down for 3 s and then comes back:

| Setup | Held GET | Held POST |
| --- | --- | --- |
| Caddy 2.11.7, `lb_try_duration 20s`, active health check every 1 s | 200 after 3.5 s | 200 after 3.5 s, body delivered |
| Caddy 2.8.4 (live version), no health check, interval 100 ms | 200 after 3.1 s | **502** after 3.1 s ("invalid Read on closed Body") |
| Caddy 2.11.7, no health check, interval 100 ms | 200 after 3.1 s | 200 after 3.1 s, body delivered |
| Traefik 2.10.7 `failover` → Caddy 2.11.7 → upstream | | 200 after 3.1 s, body delivered |
| The same, with Caddy stopped | 200 from the fallback after Traefik's health check dropped Caddy | |
| Upstream down longer than `lb_try_duration` (20 s) | 503 after 20.06 s | |

With an active health check, a held request waits for the next passing check, not for the port. That's why the .11 site has none. The proposed Caddyfile (live sites plus the new block) passes `caddy validate` on both 2.8.4 and 2.11.7.

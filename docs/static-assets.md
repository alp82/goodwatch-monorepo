# The static hostname and the fallback to the origin

The webapp can write the addresses of a page's files on a second hostname, the static hostname, which a CDN serves.
Each instance checks that hostname and goes back to the site's own host when it fails. This page says how the address
is chosen, what moves, what the settings are, and what the owner has to set. The decision is
[ADR 0010](adr/0010-static-hostname-with-server-side-fallback.md). The code is
`goodwatch-webapp/app/server/asset-address.server.ts` and `goodwatch-webapp/app/utils/asset-url.ts`.

With the default settings nothing changes: every page names the site's own host, as before.

## Settings

Both are environment variables of the webapp, read when the process starts.

| Setting | Values | Default |
| --- | --- | --- |
| `STATIC_ASSETS` | `auto`: the probe decides. `static`: always the static hostname. `origin`: always the site's own host. | `origin` |
| `STATIC_ASSETS_HOST` | The static hostname, for example `static.example.com`. Pages then name `https://static.example.com`. | Not set |

- Without `STATIC_ASSETS_HOST`, the mode is `origin` whatever `STATIC_ASSETS` says, and the log says so once.
- An unknown value of `STATIC_ASSETS` counts as `origin`, with one warning in the log.
- Outside a production build (the Vite dev server) the address is always the site's own host.
- For a local run, `STATIC_ASSETS_HOST` also takes a complete origin with a scheme and a port, such as
  `http://127.0.0.1:3112`.
- `origin` is how the benchmark keeps measuring the origin alone.

## How one build names either host

Remix writes paths such as `/assets/root-AbCd1234.js` into the build. A path is relative to whatever names it, which
gives the rule for each kind of file:

| File | How it gets its address |
| --- | --- |
| Entry scripts, route scripts, their preloads, route style sheets | Remix reads them from the build's file list. The server entry gives each render a copy of the list with every address on the chosen host (`manifestForBase`). |
| Route scripts and preloads of a later navigation in the browser | The browser entry rewrites the file list that the page loaded, with the host that its own scripts came from. |
| Lazy chunks and their preloads | A chunk imports another one with a relative path, so the import follows the script. `experimental.renderBuiltUrl` in `vite.config.js` makes Vite's preload helper resolve against the script too, and not against the page. |
| Fonts and images named in a style sheet | The style sheet names them with a path, so they follow the style sheet. |
| The style sheet, the font preload, the web manifest, imported images, `public/` images and flags | `assetUrl(path)` puts the chosen host in front. |

`assetUrl` and `assetBase` (`app/utils/asset-url.ts`) work on both sides:

- **On the server,** the server entry picks the address once per response and renders inside
  `renderWithAssetBase`. `assetUrl` reads the address of the render that calls it, so a render that started before a
  switch finishes with the address it started with.
- **In a browser,** the address is the host that the page's scripts came from, or empty when that's the page's own
  host. So a hydrated page names the same addresses as the server did, and a page keeps its address for as long as
  the tab stays open.

Rules for code:

- Call `assetUrl` while rendering: in a component, a hook, a `links` function, or a function that they call. Never
  at module load: on the server the result differs per response.
- Don't call it in a loader, an action, or a `meta` function. Those don't run inside the render, and what they return
  (an OG image address, for example) keeps the site's host.
- An address without `assetUrl` stays on the site's host. That always works, and it costs the origin one request.

## What moves

| Moves to the static hostname | Keeps the site's host |
| --- | --- |
| Hashed build files under `/assets/`: scripts, style sheets, fonts, imported images | Documents, loader data, `/api/` |
| `public/` images (`/images/`) and flags (`/flags/`) | `robots.txt`, the sitemaps |
| The web manifest, and with it the icons that it names | The favicon and the touch icon |
| | OG cards under `/og/`, and the share card fonts under `/fonts/share-card` |

## The probe

In `auto` mode each instance requests one file of its own build through the static hostname: Remix's manifest file,
the first file that a page loads.

| Item | Value |
| --- | --- |
| Interval | 10 seconds |
| Time limit, for the whole response | 2 seconds |
| A success | Status 200, an `Access-Control-Allow-Origin` header, and a complete body. A redirect is a failure |
| Switch to the origin | 3 failures in a row |
| Switch back to the static hostname | Successes in a row for 2 minutes |
| At the start | The first result decides: a success starts on the static hostname, a failure on the origin |
| `User-Agent` | `goodwatch-asset-probe` |

- The probe starts after the instance has written its build's files to the shared store (see
  [webapp-deploys.md](webapp-deploys.md)), so that the other instance can answer the CDN for a new build. Readiness
  waits for the first result, at most 2 seconds.
- The header is part of the check because a script from another host doesn't run without it. A CDN that answers 200
  without the header would break every page.
- The next probe starts 10 seconds after the last one ended. Against a hostname that hangs, three failures take
  about 36 seconds, and about 30 seconds against one that refuses the connection.
- Each switch writes one line to the log, and so does a first probe that fails. Other probe results don't.
- The switch is per instance. Two instances can name different hosts for a while.
- The probe runs where the instance runs. An outage limited to a region far from it isn't detected.

## The page cache

The in-process page cache has the address in its key (see [page-cache.md](page-cache.md)). After a switch, a request
finds no stored page and is rendered with the new address. The pages of the other address stay in the store until
they expire or are evicted, and are used again when the instance switches back within their lifetime. A render that
was in flight during a switch isn't stored.

## What the webapp answers for the static hostname

A request whose `Host` is the static hostname gets files only:

- A file of the build or of `public/`, or a file of another build from the shared store: answered as on the site's
  host.
- Everything else: 404 with `Cache-Control: no-store`. That includes pages, `/api/`, the health endpoints, and the
  browser gate's URLs.
- While the file list of a new process is still being read, such a request waits for it, as file requests on the
  site's host do. A process whose file list failed to load answers 503.

The rule holds in every mode, as soon as `STATIC_ASSETS_HOST` is set. A request for a file on the site's own host
is answered as before, so the origin stays a complete copy.

## Headers

- Build files under `/assets/`, font files, and the web manifest answer `Access-Control-Allow-Origin: *`, on the
  site's host too. Module scripts, their preloads, fonts, and the web manifest are fetched with CORS when they come
  from another host.
- While a page names the static hostname, its first link is `<link rel="preconnect" crossorigin>` for it. Scripts
  and fonts use that connection. The stylesheet link carries `crossorigin` too while the page names the static
  hostname: a browser keeps requests with and without credentials on separate connections, and without the attribute
  the render-blocking stylesheet would wait for a second connection that no hint opened. Images from `public/` still
  use that second connection.

## Metrics

`goodwatch_static_assets_in_use` on the metrics port: 1 while new pages of the instance name the static hostname, 0
while they name the site's own host. The label `mode` holds the setting (`auto`, `static`, `origin`). See
[viral-spike-metrics.md](benchmarks/viral-spike-metrics.md).

An alert for "10 minutes on the origin" asks for `goodwatch_static_assets_in_use{mode="auto"} == 0` for 10 minutes.
With the label, an instance that is set to `origin` doesn't fire it.

## Known limits

- During a fallback the origin serves every file again: 120 movie page views per second on the public path with new
  connections, not 500 (measured on October 9, 2026, see
  [the static hostname runs](benchmarks/viral-spike-static-hostname.md)).
- At worst about 36 seconds of pages without scripts and styles before a switch (three probes). A tab that is open
  keeps its address. It recovers on its next reload, or when a lazy chunk fails to load, which reloads the page
  (`app/utils/stale-chunk.ts`).
- An imported image whose address doesn't go through `assetUrl` stays on the origin.
- The web manifest names its icons with paths, so they come from the static hostname. Its `start_url` isn't set, so
  an installed site still starts on the site's own host.

## Check it locally

No CDN is needed. Run a production build without `REDIS_HOST`, so that nothing is written to Valkey, and use a
second loopback port as the static hostname: a small proxy that passes requests to the webapp with their `Host`
unchanged.

```sh
cd goodwatch-webapp
SENTRY_DISABLE_AUTO_UPLOAD=true npx remix vite:build && node scripts/precompress.mjs
NODE_ENV=production PORT=3111 METRICS_PORT=9511 \
  STATIC_ASSETS=auto STATIC_ASSETS_HOST=http://127.0.0.1:3112 \
  npx remix-serve build/server/index.js
```

- With nothing listening on port 3112, the log says that the instance stays on the origin, and the gauge reads 0.
- With the proxy running, the instance switches after 2 minutes of successes, and the gauge reads 1.
- Stop the proxy: after 3 failed probes, about 30 seconds, the instance is back on the origin.
- `curl -H 'Host: 127.0.0.1:3112' http://127.0.0.1:3111/` answers 404, and the path of a build file answers 200.

Measured on October 8, 2026, on a development machine, with a movie page and `/how-it-works`:

| Step | Result |
| --- | --- |
| Start with port 3112 closed | Gauge 0. Pages name the site's host |
| The proxy starts | Gauge 1 after 131 seconds. A movie page names the static hostname for 40 build files, 15 flags, and the web manifest. In headless Chromium, 60 scripts, the style sheet, the font, and the images came from there, the page hydrated, and a navigation loaded its route script from there. Documents and loader data stayed on the site's host |
| The proxy accepts requests and never answers | Gauge 0 after 36 seconds |
| The proxy answers again | Gauge 1 after 131 seconds |
| The proxy stops, so the port is closed | Gauge 0 after 30 seconds |
| A page that the page cache held with the static hostname | Not served after the switch: the next two requests were misses with the site's host, and the third a hit |
| Requests with the static hostname's `Host` | 404 for `/`, a movie page, `/health/ready`, a gated person URL, an unknown build file, and a POST to `/api/`. 200 for `robots.txt` and build files |

## Owner steps

Agents don't change Coolify, DNS, or the proxy. Merging and deploying this change alters nothing for visitors,
because the default is `origin`.

1. The DNS zone and the proxied `static` record are the ticket "Move the DNS zone to Cloudflare and proxy the static
   subdomain". The proxy on the serving host needs a route for the static hostname to the webapp, with the `Host`
   passed on unchanged.
2. In Coolify, open the webapp application, then **Environment Variables**, and set `STATIC_ASSETS_HOST` to the
   static hostname, for both instances. Leave `STATIC_ASSETS` unset. After the deploy, the static hostname answers
   files and 404, and pages still name the site's host.
3. Check the static hostname from any machine: a build file answers 200 with `access-control-allow-origin: *`, and
   `/` answers 404.
4. The switch itself, `STATIC_ASSETS=auto`, is the ticket "Switch production to the static hostname and rerun the
   page view benchmark".

**Roll back:** set `STATIC_ASSETS=origin`, or remove it, and redeploy. Removing `STATIC_ASSETS_HOST` also ends the
file-only rule.

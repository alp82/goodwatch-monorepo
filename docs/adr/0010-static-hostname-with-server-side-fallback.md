---
status: accepted
---

# Serve static files from a static hostname, and fall back to the origin on the server

Static files are served from a `static` subdomain through Cloudflare's free plan. Each webapp instance checks that
hostname itself and, when it fails, writes the files' addresses on the site's own host into its pages. Decided on
October 8, 2026, as part of the map "Serve a viral traffic spike", with the ticket "Decide where static assets are
served from". How it works, with its settings: [static-assets.md](../static-assets.md).

A movie page view is 34 requests, 33 of them static. With the ECDSA certificate, the site holds 140 movie page views
per second. The limits are the two Node main threads, almost all of it static files, and the serving host's outgoing
traffic: 681 Mbit/s at 140 page views per second. The destination is 500. Both limits are static files: their
requests and their bytes.

## Choices

- **A `static` subdomain behind Cloudflare Free.** The DNS zone moves to Cloudflare. The site's own record stays
  "DNS only", so documents, members, and API requests never pass through Cloudflare. Files are the same for every
  visitor, so no cache key, cookie, purge, or staleness question arises.
- **What moves:** the hashed build files, and the images and the web manifest from `public/`, with their lifetimes of
  today and no purge. `robots.txt`, the sitemaps, and the favicon keep the site's host. OG cards stay at the origin
  until the page view benchmark has been rerun.
- **The static hostname answers files only.** The CDN pulls from the webapp, which answers a request with the static
  hostname's `Host` from its file list and with 404 for everything else. No page has a second address.
- **The fallback is on the server, without the owner.** In automatic mode each instance requests one file of its own
  build through the static hostname every 10 seconds, with a 2-second limit. Three failures in a row switch that
  instance's pages to the site's own host. Two minutes of successes in a row switch back. An outage can happen at
  night, so a setting plus a redeploy wasn't enough.
- **The address is chosen per response, in one build.** Remix writes paths into the build. The server entry gives
  each render a copy of the build's file list for the chosen address, and a helper gives the same address to
  everything else that moves. A browser takes the address from the host that its scripts came from, so the files of
  a later navigation follow the page.
- **The in-process page cache keys on the address,** so a stored page doesn't outlive a switch.
- **One setting with three values:** automatic, always the static hostname, always the origin. The default is always
  the origin, which is also how the benchmark keeps measuring the origin alone. The hostname is a setting too.
- **A gauge per instance** tells which address its pages use. The alert for 10 minutes on the origin was planned
  and then skipped by the owner on October 9, 2026: no alert exists.

Rejected:

- **More Node instances, or a file server behind the proxy.** Both lift the Node limit only. The bytes still leave
  through the serving host.
- **Cloudflare Free on a separate domain** that holds only static files: about 10 USD per year for a site address
  that never depends on Cloudflare's DNS. Not taken.
- **bunny.net:** costs money from the first month.
- **A retry in the browser:** fragile with module scripts, and slow when the CDN hangs instead of failing.
- **A switch in DNS:** up to 5 minutes, and it depends on Cloudflare's API during a Cloudflare outage.
- **Two builds, or a rewrite of the finished HTML.** One build can name either host (see above), and a rewrite would
  also touch the loader data inside the page.

## Consequences

- During a fallback the origin serves every file again and holds about 140 movie page views per second, not 500.
  Measured on the public path with new connections on October 9, 2026: 120 hold and 140 fail
  ([viral-spike-static-hostname.md](../benchmarks/viral-spike-static-hostname.md)).
  The destination holds only while the CDN is up.
- The probe runs on the hosts. An outage limited to a region far from them isn't detected.
- At worst about 30 to 36 seconds of pages without scripts and styles before a switch. An open tab recovers on its next
  navigation or reload: a lazy chunk that fails to load reloads the page, and the new page names the origin.
- A changed `public/` image is up to a day old at the CDN, as it already is in browsers.
- Build files and fonts answer `Access-Control-Allow-Origin: *`, because module scripts, fonts, and the web
  manifest are fetched with CORS from another host.
- An image or a font that a module imports moves only when its address goes through `assetUrl`. One that doesn't
  stays on the site's host, which always works.
- The site's DNS depends on Cloudflare's authoritative DNS. None of Cloudflare's reports on its outages of
  November 18, 2025, December 5, 2025, and October 2, 2026 lists authoritative DNS among the affected services.
- Old tabs are covered as before: each instance writes its build's hashed files to Valkey for a day
  ([webapp-deploys.md](../webapp-deploys.md)), and the CDN keeps what it has pulled.
- The whole site behind Cloudflare stays a separate, later question.

Evidence: the resolution of the ticket "Decide where static assets are served from", and
[viral-spike-page-views.md](../benchmarks/viral-spike-page-views.md).

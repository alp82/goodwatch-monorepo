# Review the edge gateway prototype

This is undeployed design code for [the Cloudflare review](../docs/research/edge-cache-cloudflare.md). Do not enable it before completing that document's origin trust, stale-policy, purge and runtime validation gates.

No root tooling covers this folder; run its tests and bundle checks explicitly. Test imports from the application resolve dependencies against `goodwatch-webapp/node_modules`, so installing only this folder's dependencies is insufficient.

The Worker imports the application's identity implementation. It requires both sets of dependencies and Node 24 for the unit tests:

```sh
(cd goodwatch-webapp && SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm ci --include=dev)
(cd goodwatch-edge && npm ci)
node --test goodwatch-edge/worker.test.ts goodwatch-webapp/app/server/cache-identity.test.ts
```

No test starts a server, reads `.env`, uses real credentials or makes network requests. Fixtures port the app's locale/auth test cases and compare edge results with the app. Keep the pinned `isbot` version aligned with the app lockfile so both bypass the same declared crawlers.

`wrangler.jsonc` has no route and disables caching and public preview URLs. The future deployment must use a zone route, `nodejs_compat` and the origin's public `SUPABASE_URL` binding, without other application credentials. The Node compatibility environment supplies that binding to the imported auth-cookie matcher. Do not deploy this as a standalone Custom Domain: its `fetch` subrequest needs the zone's underlying origin.

The Worker bypasses all queries, root documents, members, auth, MCP, APIs, conditional and non-GET requests. It preserves response body streams and adds `GW-Edge: hit|miss|bypass-<reason>` for cache observability. Native HIT/STALE/UPDATING/REVALIDATED statuses map to hit, MISS/EXPIRED to miss, and other or missing statuses to bypass-origin-policy. Request bypass reasons are bounded and contain no cookie values. Reviewed Cloudflare operational cookies remain eligible; unknown cookies and authentication cookies still bypass. This header describes the fetch result, not a guarantee that the response was already warm. Unit tests mock the origin fetch; they do not emulate CDN cache storage. Cloudflare's current `cf.vary` behavior, cookie/private response exclusions and native stale policy require a separate nonproduction Cloudflare integration check.

## Sad shows canary

The separate `wrangler.browse.jsonc` deploys `browse-canary.ts` under the name `goodwatch-browse-cache`. Install this folder's and the webapp's dependencies as above, then run `npm test` here. Deploy the matching webapp to both serving instances first. Confirm that `GET /api/browse-edge-representation` returns the active commit followed by `.static` or `.origin`, and that the production zone-key transform still authenticates Worker fetches at both instances. Then run `wrangler deploy --config wrangler.browse.jsonc` with Worker script and zone route edit permissions. Removing this one Worker route restores the origin path immediately.

Only a query-free anonymous browser GET of `/shows/moods/sad` is eligible. The wildcard route also covers query strings and suffixes so the Worker can explicitly bypass those requests. Saved preferences, member and unknown cookies, authorization, conditional requests and declared crawlers bypass. The origin fill receives only the browser marker cookie when present. Its native fetch URL partitions the cache by build, asset host, country and language. Authenticated ingress normalizes that URL back to the public document before rendering. The origin can approve storage only after React completes a healthy render with a matching representation and an eligible route policy. Browser HTML remains private. The native cache refreshes a stored page after at most 60 seconds fresh and allows up to 120 seconds stale while one refresh runs. Both limits respect shorter route policies.

A Worker isolate reads the current representation on its first eligible visit and at most once per ten seconds during subsequent traffic. Simultaneous arrivals during the check pass through to the regular page. A failed check disables document hits in that isolate until the next check. New deployments and automatic static-host fallback move subsequent requests to a separate cache key as isolates observe the new representation. The origin verifies its own build and asset host again before each fill, including during rolling deployments.

Verify a real miss and subsequent hit for the same anonymous URL and locale, a separate first visit in another locale, bypass reasons for cookies and queries, and stale revalidation after expiry. `GW-Edge` reports document outcomes. A `stale` result may trigger a background origin refresh. `GW-Edge-State: origin` counts an extra metadata request, and `memory` reuses the isolate's answer. Origin logs can distinguish page fills by the internal `__gw_sad` query and metadata reads by their API path. Time application HTML through completion as well as through first byte.

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

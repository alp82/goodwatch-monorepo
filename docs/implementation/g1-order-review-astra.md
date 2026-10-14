**Verdict: request changes before preview.** Three P2 findings; no P0/P1 found.

1. **P2 — Repeated catalogue-wide CPU cost:** [reader.server.ts:202](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/g1-order/goodwatch-webapp/app/server/g1/reader.server.ts:202). Every page rebuilds arrays, sorts twice and creates full-title Maps; the cache saves only validation. A synthetic 60k-title run took **176–544ms/request**, excluding filtering and network. **Fix:** cache ordered results and metadata with bounded storage keyed by member, payload identity/build, snapshot, ordered filtered candidates and mix mode; retain freshness checks.

2. **P2 — Watch next batches log the wrong ordering provenance after refresh:** [watch-next.server.ts:826](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/g1-order/goodwatch-webapp/app/server/watch-next.server.ts:826). Lazy cards preserve the browser’s earlier key order but record the latest plan’s payload, groups and tiers. Publication/deletion between requests produces incorrect exposure records. **Fix:** pass an opaque initial-plan identifier with card batches and retain that plan’s metadata; refresh the complete list if unavailable. Test publication and deletion between requests.

3. **P2 — Required rating-triggered rebuild is missing:** [title_snapshot.py:667](/home/alper/projects/goodwatch-monorepo/.claude/worktrees/g1-order/goodwatch-flows/windmill/f/sync/copy/title_snapshot.py:667). Only snapshot/nightly attempts enqueue G1; the adopted plan also requires debounced rating changes. **Fix:** enqueue through a server-side adapter after committed preview-member rating changes, enforce the preview list, debounce per member and use the serialized G1 queue.

Other conclusions:
- **Off:** ordering and existing cache identities remain unchanged. Responses are not literally identical to `origin/main`: #525 adds `listId` and member exposure writes.
- **Preview:** member/surface/sort gates and fallback look correct. Discover orders before paging; Watch next preserves fit/time/Not tonight grouping.
- **Parity:** TypeScript matches Python. Six fixtures cover suffixes beyond 100, reversed ties, no ratings, empty filters, removed franchise leaders and position 11—including closer-only and no-eligible branches. No substantive uncovered pure-order branch found.
- Payload validation and member-cache isolation look sound. Automatic jobs use configured preview IDs and publish only `g1:v1:*`; manual calls require explicit IDs but do not check the configured allowlist.
- Fresh schema and nullable migration align; migration remains a deployment prerequisite.
- Three Node test files and 18 Python tests passed with fake backends. No production access or file changes.
# Profile Scores pagination verification

The live `/u/alperortac/scores` returned 593 title records for 1,010 ratings because the server cut every tier off
at 120. The new page sends at most 24 records per tier and exposes subsequent batches through
`/api/profile/:handle/scores`, with complete-library counts and filtering before pagination.

Verified on 2026-10-26 against the real account through the local Remix server:

- Counts: All 1,010, Movies 869, Shows 141. Initial records: 171.
- Read every tier to its final batch: 1,010 records, 1,010 unique keys, no missing titles.
- Movie/show filters and alphabetical sorting apply across the full library.
- Invalid tiers/offsets return 400; an obsolete library revision returns 409 with private/no-store headers.
- Chromium at 390px: append 24 → 48, collapse/restore, simulate a failed batch, retain 48 posters, Retry → 72.
- Chromium at 1440px: open/close the sort menu; expand a tier, visit a title, Back restores the 48 loaded posters.
- No browser page errors after fixing the sort control's closed portal hydration mismatch.
- Scores-route loader JSON: 163,664 → 48,794 bytes; gzip: 55,421 → 17,259 bytes (about 69% smaller).

Repeatable regression checks from `goodwatch-webapp`:

```sh
node --test app/domain/profile*.test.ts app/server/profile/compare-model.test.ts app/server/profile/taste-stats-view.test.ts
npm run build
```

All 21 selected tests pass; the production build passes. Full `tsc --noEmit` still reports existing errors:
its output is byte-for-byte identical between unchanged main (`d3e19ea66`) and this change, using the same dependencies.

Before deploying this change, ran the required landing-surface budget command against the existing live site:

```sh
SHARE_LIST_PATH='/u/alperortac/lists/o1H79d4fVu' ./bench.sh budget --runs 1
```

Run `20261026T163300Z-lighthouse-budget` fails existing budgets for home, movie, show, person, Discover, and share list.
Examples include home script bytes 344.1 KiB versus 295 KiB and movie script count 42 versus 32.
This change was not deployed during that run. No budget limits were changed.

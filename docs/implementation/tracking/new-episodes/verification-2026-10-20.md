# Verification: Continue and episode announcements, 2026-10-20

## Behavior

Continue sorts every eligible show by the air date of its Next episode, newest first, then last activity.
There is no Seen-first ordering. The next unwatched episode, rather than the show's latest aired episode,
decides its position. All Continue candidates are resolved before selecting the home page's first rows.
The stale show-level aired count no longer decides grouping. Unknown and future dates do not count as aired.

The real My shows component was exercised in a DOM with Remix navigation and fetcher forms: opening details
and returning preserves news; Dismiss clears the announcement and navigation count; the show remains in Continue;
the dismissal survives navigation. Server tests cover durable snapshots, the first watch, separate member
ownership, later releases, and a stale tab dismissing an earlier release.

## Checks before shipping

- 220 focused tracking, My shows, TV home, streaming arrival, and interaction tests pass.
- Full webapp suite: 3,828 tests, 3,824 pass, two fail, one skipped, one TODO. Both failures reproduce on
  unchanged `origin/main` (`1bb42395`): `tv-title-render.test.ts`'s rating-level expectations and
  `score-control.test.ts`'s library/bulk score picker expectations.
- Production build passes.
- Type check: the same 185 existing diagnostics as unchanged main, with no new diagnostic when compared by
  file, diagnostic code and message (line numbers excluded).
- `git diff --check` passes.

## Landing budget baseline

`./bench.sh budget --runs 1` ran against the already-deployed site, before shipping these changes.
Run: `20261020T031100Z-lighthouse-budget`. The unchanged deployed site fails all six surfaces' budgets.
Failures include existing script counts, requests, images, byte totals, and blocking time. Budget limits were
not changed to conceal those failures. The public share-list URL stays in ignored `config.env` and is not in
this report.

A production-build manifest comparison against unchanged main shows the same number of initial scripts:
home 14, movie/show 24, person 15, Discover 25, share list 10. The summed Brotli bytes for each manifest's
entry, root, and route modules and static imports decrease by 72–100 bytes per surface. This is a build
comparison, not a substitute for Lighthouse or a claim that the existing deployed budgets pass.

# The new TV: SSR, SEO and hydration (slice 12)

Verified on 2026-10-14 on `feat/tv-slice-12-budgets`, on `/home-preview`, against the checklist of
[235-living-room-seo.md](235-living-room-seo.md) as far as an address that is not `/` can show it. A dev server on
real data (production Crate and Valkey, a pure reader: no `APP_ORIGIN`, no sign-in, no writes), every `REC_*` flag
on. `docs/implementation/tv-screen-revamp/budgets/drive.mjs seo`: 18 checks pass, none fail.

- **The same HTML for every guest:** the whole document is byte for byte the same for Googlebot's smartphone agent,
  a desktop Chrome and an iPhone Safari (one SHA-1 for all three); the room and the section below (45,721
  characters) compared by the drive too.
- **One H1 per window:** the HTML has two, one per edition of the screen ("Let's find something good for
  tonight."); exactly one shows at 1920 x 1080, 1440 x 800, 390 x 844, 375 x 667 and 844 x 390, before any script
  and after hydration.
- **The section below the room** follows it in the HTML with its 16 start titles as links and the hubs
  (`/discover`, `/explorer`, `/taste`), nothing hidden. A guest's HTML has no member's tile.
- **`/living-room?tv=moods`** answers 301 to `/?tv=moods`.
- **No Suspense in the room's server markup**, no hydration warning: the paint run's console is quiet at 31 sizes
  on the dev server (React's development build names a mismatch), see
  [tv-screen-revamp-first-paint.md](tv-screen-revamp-first-paint.md).
- **The meta block of `routes/_index.tsx`** is not touched by this slice (`git diff` of the branch against the
  integration branch shows no change to `routes/_index.tsx`). `/home-preview` keeps its own `noindex` meta and the
  canonical of `/`.
- **Lighthouse SEO** on `/home-preview` is 61, only because it is `noindex` and has no description, by design; the
  score of 100 that the #235 check recorded is to be checked on `/` in slice 13.

Cache: `/home-preview` answers `private, no-store`. On `/` a guest's page must take the shared cache policy of
`livingRoomAuth` (see the slice 13 notes in [budgets/README.md](../implementation/tv-screen-revamp/budgets/README.md)).

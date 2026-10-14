# Account pages prototype

Prototype for [#534](https://github.com/alp82/goodwatch-monorepo/issues/534) (map [#529](https://github.com/alp82/goodwatch-monorepo/issues/529), research [#528](https://github.com/alp82/goodwatch-monorepo/issues/528)):
how the account pages look once Better Auth replaces Supabase, and the pages an app such as Claude needs. Throwaway
code; nothing is merged to `main`.

**Review page:** `review.html` in this folder (self-contained, every screenshot inlined, 30 numbered questions). It
is built by `build_review.py` from `shots/`.

## Open it

```
cd goodwatch-webapp
npm ci && npx patch-package
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3121
```

Then open `/prototype/auth`. No `.env` is needed: the route has no loader data and calls nothing. The floating bar
picks the screen, its state, the app (`client`) and the variant; the arrow keys flip A and B.

`/prototype/auth?screen=<screen>&state=<state>&variant=A|B&client=claude|chatgpt|claude-code|unknown&shot=1`

| screen | states | variants |
| --- | --- | --- |
| `sign-in` | `form`, `error`, `unverified`, `throttled`, `connect` (on the way to an app), `cutover` | |
| `sign-up` | `form`, `guest`, `taken`, `connect` | |
| `verify` | `sent`, `confirmed`, `expired` | |
| `forgot` | `form`, `sent` | |
| `reset` | `form`, `done`, `expired` | |
| `emails` | | |
| `notice` (sign in again) | | A banner, then the sign-in page · B dialog with the sign-in inside |
| `consent` | `ask`, `allowed`, `denied` | A card inside the site, full access · B own page, See only or See and change |
| `apps` (Connected apps) | `list`, `confirm`, `empty` | A own tab in Settings · B section in Account |

`shot=1` hides the prototype bar. Every button moves to the next screen as the real one would (sign-up leads to
"check your inbox", "Pretend I clicked the link" to the confirmed page, and so on).

Code: `goodwatch-webapp/app/routes/prototype.auth.tsx` and `goodwatch-webapp/app/ui/prototype-auth/`. Left out of a
production build through `PROTOTYPES` in `goodwatch-webapp/vite.config.js`.

## What it decides and what it leaves open

- Today's look stays: the split layout with the picture, the white Google button, the amber primary. One Google label,
  Continue with Google. The password rule is shown and ticked while typing (10 characters, see the questions).
- The consent page lists what the app can see, what it can change and what it can never do, from the tools proposed in
  #528. Apps with published details (CIMD) show maker and domain; self-registered ones (DCR) get a warning.
- Connected apps shows access, connected and last-used dates, Disconnect with an inline confirmation, and the
  connector address to copy.
- The variants exist only where the layout is open: the cut-over notice, the consent page and where Connected apps
  lives. The questions are in `review.html`.

## Screenshots

`shots.mjs` takes them (Playwright with the system Chromium, 1440 and 390 wide, the site's footer hidden), then each
PNG became WebP (`magick <png> -quality 78 <webp>`). The site's header shows "Sign in" on every screen because the
prototype has no session. The posters behind the cut-over notice come from TMDB's image host.

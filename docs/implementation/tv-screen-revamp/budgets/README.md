# Slice 12: the first paint, access and the budgets

> Since October 14, 2026 the webapp reads no `REC_*` feature flag: what `on` did is what the site does
> (`docs/implementation/tv-screen-revamp/rec-flags/`). The flags here record how this was built and run then. A server
> of a later commit needs none of them.

The new TV at `/home-preview`, made ready to be the start page. Proof for [the plan](../README.md), slice 12 and
section 5. Taken on October 14, 2026, on `feat/tv-slice-12-budgets` with the integration branch at `60c235a8`
merged in. The proofs with their numbers:

- [The first paint, hydration and layout shift](../../../verification/tv-screen-revamp-first-paint.md)
- [SSR, SEO and hydration](../../../verification/tv-screen-revamp-seo.md)
- [Keyboard, screen readers and touch targets](../../../verification/tv-screen-revamp-access.md)
- [Rendering budget and Lighthouse](../../../verification/tv-screen-revamp-budgets.md), with
  [lighthouse-budget.md](lighthouse-budget.md)

[first-paint.jpg](first-paint.jpg): six layouts on real data, before any script and hydrated.

## What changed

- **The first paint** (`tv/TvRoom.tsx`, `tv/PhoneRoom.tsx`, `tv/PhoneRemote.tsx`, `tv/tv.css`, `tv/room-art.ts`):
  the server's HTML holds every layout's parts and `tv.css` places them as the layout functions will. Every box
  agrees with the hydrated room to 0.00 px at 31 sizes; layout shift 0.
- **The phone/desktop split reads the window's width**, and the room is measured to the fraction of a pixel.
- **The desktop's whole TV picture is always `w1280`**; the phone's top bar keys have their measured height before
  hydration (`keyLength`, `tv/kit.tsx`).
- **The menu's items are menu items**; the phone Remote's printed words are hidden from screen readers; with reduced
  motion the Remotes' keys do not move.
- **A focus move no longer draws the Remotes and the section below again** (memoized in `TvRoom.tsx`).

## Run it

```
cd goodwatch-webapp
npx patch-package          # npm ci does not apply patches/
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3191
```

That is a server without services: `/home-preview` without start titles, and the member harness
`/prototype/my-library-real/tv?member=six`. For real data, the same with the main checkout's `.env` loaded,
`APP_ORIGIN` unset and `REDIS_COMMAND_TIMEOUT_MS=60000`: a pure reader. For a production build:
`npm run build`, then `NODE_ENV=production PORT=3196 <the flags> npx remix-serve ./build/server/index.js` with no
`.env` and no Redis or Crate in the environment (with Redis it would publish its build to production Valkey).

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3191 node drive.mjs [paint|access|budget|seo]
```

- `paint`: the room with its scripts stopped against the hydrated room, at 31 sizes. `LABEL=` files the run's
  numbers under its own name in `checks.json`.
- `access`: the keyboard walk as a guest and a member, axe (`AXE=` the path of `axe.min.js`, by default next to
  `playwright-core`), the words' contrast by pixels, touch targets, reduced motion.
- `budget` against a production build: `ROUNDS=`, `PROFILE=0,1,2`, `POINTING=1` for the pointing sweeps only,
  `NOREPLAY=1` (Sentry's recorder off) or `BLOCKED=1` (the Remote and the ring kept out of its recording).
- `seo`: the HTML for three user agents, the H1s, the links, the old address.
- Lighthouse: `lighthouse` 13.5.0 with `goodwatch-benchmark/lighthouse/run.sh`'s flags against the build, three
  runs into `<run>/lighthouse/home/run-N.json`, then `node goodwatch-benchmark/scripts/budget.mjs check <run>
  <a copy of urls/budget.json whose home path is /home-preview>`.

## For slice 13 (the switch)

Nothing here changes `routes/_index.tsx`, `server/living-room.server.ts` or the old TV's files.

**`shouldRevalidate` of `routes/_index.tsx` (`:34-42`) must become `/home-preview`'s:**

```ts
import { isTvOnlyChange } from "~/ui/living-room/tv/tv-machine"

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod &&
	currentUrl.href !== nextUrl.href &&
	isTvOnlyChange(currentUrl, nextUrl)
		? false
		: defaultShouldRevalidate
```

- `isTvOnlyChange` from the new machine, whose keys are the new TV's (`tab`, `theme`, `style`, `island`, `side`,
  `pick`, `title`, `q`, `service`, `focus`) and the old TV's (`mood`, `from`, `refine`, `step`, `goal`, `page`,
  `more`), so an old link still changes nothing but the TV.
- `currentUrl.href !== nextUrl.href`: today's version answers `false` for the same address too, which turns
  `revalidator.revalidate()` into nothing. The new TV needs it: after a member marks an episode watched on the TV,
  `TvLivingRoom.tsx` asks for the loader again (`refresh`, `:254-270`) so Tonight and My shows are new.
- A submission (`formMethod`) still revalidates, as today.

**The rest the switch must know:**

1. **The loader** becomes `tvHomeLoader` (`server/living-room/tv-loader.server.ts`). Its SEAM (`:74-76`): it sets
   `private, no-store` for everyone. On `/` a guest's page must keep the shared cache policy `livingRoomAuth`
   chose, and the incomplete-page policy when the start titles are missing, as `loadLivingRoom` does
   (`server/living-room.server.ts:20-46`, `INCOMPLETE_PAGE_HEADERS`). A member's stays private.
2. **One stylesheet for the route:** fold `tv.css` into `living-room.css` and drop the second link. Lighthouse
   counts 3 render-blocking requests on `/home-preview` (limit 2); folded, it is 2. The first-paint rules are
   scoped to `.tvr[data-room="unmeasured"]` and depend on nothing in `living-room.css` but the room's height rules.
3. **The LCP element line of `urls/budget.json`** names `/assets/room-phone-`. On a phone with the Remote in the
   hand (Lighthouse's 412 x 823) the new room's largest picture is the hand photo (`/assets/hand-`), in 3 of 3
   runs. The owner decides whether the line names the hand, either of the two, or the room photo is made the
   largest again. Change it in the same commit as the switch, with the reason.
4. **The pool request** goes from `routes/_index.tsx`'s `useQuery` (`:110-133`, after every first paint) to the
   new TV's own (`useTvPoolState`: at the first interaction for a guest, when the Discover or a service tile first
   has the focus for a member). The benchmark's captured page view of home still holds the old request.
5. **The meta block** (`:49-102`) stays as it is; `/home-preview`'s `noindex` meta goes with the route.
6. **Remote.tsx is read with the old TV's types** (`TvAction`, `TvScreen` from `tv-flow.ts`, imported as types in
   `TvRoom.tsx`): when `tv-flow.ts` is deleted, those two types move with the Remote, or the Remote takes the
   room's `RoomKey`.
7. **The desktop Remote's logo** (`goodwatch-logo-white.svg`, 2 KB) is in the HTML on every window and asked for on
   phones too, where the desktop Remote is hidden. Small; the image lines pass with room.
8. **Changes on `main` to the files the switch replaces:** none since the integration branch last took `main`.
   `main` is at `8cf806a1` ("leaving through the TV leans in, and a TV button leads back"), already merged into the
   integration branch (`7d870e71`); it changed `tv-transition.ts`, `main.css`, `app.tsx`, `MobileDock.tsx`,
   `SiteHeader.tsx` and added `TvWayBack*`/`tv-way-back*`, and nothing of `routes/_index.tsx`,
   `server/living-room.server.ts` or `living-room.css`.

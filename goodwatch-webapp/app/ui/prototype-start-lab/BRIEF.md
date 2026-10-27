# Start page lab: brief for variant builders (PROTOTYPE, round 1, 2026-10-27)

Throwaway prototype code on branch `prototype/start-lab`. Nothing here ships as written; the owner picks variants and the winners get rewritten into real code later.

## Why we're redesigning the start page

Today `/` is a living room photo with a big TV and a Remote. Guests first watch an intro film on the TV, and the TV screen is a small, worse copy of the real app. Visitor feedback: the TV is "a nice gimmick but actually very annoying", the intro doesn't let you try GoodWatch right away, and people may leave frustrated. For signed-in members the TV has no real purpose.

The owner's decisions:

- **Guests try first.** The main focus is the unique selling point: search by mood or anything ("a cozy mystery for a rainy Sunday"), and the best recommendations. First results appear inline on the start page; **See all** opens `/discover?q=...`.
- **The TV becomes a hint.** A small TV in a room scene, with a play affordance. Pressing it runs a nice motion transition to a full-viewport TV, and the intro film plays full screen. The Remote may go away; try variants.
- **Keep the cozy living room vibe**, with new scenes from new perspectives (generated images; see "Scenes"). Live, clickable posters sit in the scene on shelves and in frames, or the normal poster cards overlay the scene.
- **How GoodWatch works** gets trimmed to the essentials with a link to `/how-it-works`. The browse section is open to redesign.
- **Members** get at least a little of the living room feel and a curated, personal start page: what to watch next (movies and shows), For you recommendations, and maybe popular or hot titles.
- **Round 1 is broad.** Variants must disagree about structure (layout, hierarchy, primary affordance), not only colors. Later rounds go into detail.

## How the lab works

- URL: `/prototype/start-lab?as=guest&layout=a&hero=a&recs=a&scene=sofa-shelves&shelf=a&tv=a&how=a&browse=a` (`as=member&member=a` for members). A missing section takes its first variant. The bar at the bottom picks variants (← → cycle, ↑ ↓ change section, H hides it).
- Code: `app/ui/prototype-start-lab/`.
  - `lab/types.ts`: **read this first.** The variant contracts (`BlockVariant`, `LayoutVariant`, `ShelfVariant`, `TvVariant`) and `useLab()`: `data` (fixtures), `scene`, `shelfTitles`/`setShelfTitles`, `playIntro(from)`, and `Room`.
  - `lab/Room.tsx`: the room any block can place (`<Room className="h-[50vh]" />`, or `zoom`/`focal` for a crop around the TV). It draws the chosen shelf variant into the scene's poster slots and the chosen tv variant's hint on the TV screen, in perspective (`scene/homography.ts`, CSS `matrix3d`).
  - `lab/fixture-search.ts`: `fixtureSearch(data, q)`, `moodAnswer`, `promptAnswer`, `picksFrom(data, tapped)`. The lab runs offline, so searches and picks come from captured fixtures. Use these; never call `/api/combined-search`, `/api/discover/results` or `/api/guest-recommendations` (they fail offline, and in production a search costs money and writes history).
  - `lab/kit.ts`: `titleHref(card)`, `tmdbImage(path, size)`.
  - `sections/<section>/index.ts`: each section's `VARIANTS` list. You own the sections in your assignment and nothing else.
- Data (`LabData`, server `app/server/prototype-start-lab.server.ts`): every title is a `TitleCard`-shaped `LabCard` (`key`, `tmdb_id`, `media_type`, `title`, `poster_path`, `backdrop_path`, `release_year`, `goodwatch_overall_score_normalized_percent`, `match`, ...), so the site's own cards render it unchanged.
  - `data.guest`: `moods` (the 11 Discover moods with titles), `prompts` (6 typed searches with titles and how the query was read), `popular`, `topRated`, `quizPool` (24 famous titles to tap), `similar` (neighbors per quizPool key).
  - `data.member`: the owner's own start page data (`tonight`, `shows` sections such as Continue, `wishlistMovies`, `forYou`, `forYouShows`). The member's display name in copy is "Sam".
  - `data.talked`: the "Talked about now" row (`TalkedRow`).
  - Fixture files live in `~/.cache/start-lab/fixtures` and are still being written when you start. Code against the types; arrays may be empty for a few minutes.
- Intro film: `/api/intro` serves a captured fixture in the lab. The real player mounts standalone: a positioned box with `container-type: size` → `FilmPhone.Provider value={isPhonePicture(w, h)}` → `<Stage k={1}><Player scenes={FILM} data={data} /></Stage>` (see `app/ui/living-room/intro/FilmScreen.tsx`, `player.tsx`, and `app/ui/how-it-works/pictures.tsx`); import `intro.css`.

## Scenes

17 generated images in `public/prototype-start-lab/scenes/` (look at `debug/contact-a.png` and `debug/contact-b.png`, and `debug/<id>.png` for the numbered TV and slots). Landscape ids: `sofa-shelves`, `media-wall-angle`, `shelf-closeup`, `coffee-table` (top-down flat lay), `projector-loft`, `retro-den`, `iso-cutaway` (3D isometric), `pixel-iso` (pixel art), `miniature` (tilt-shift dollhouse), `nook-illustrated` (painted), `papercraft`, `flat-vector`. Five have a `-portrait` phone version that `Room` swaps in on tall boxes. Each scene has one small TV screen (painted black) and 6-12 poster slots (painted dark gray) with measured quads. The TVs are small (1-8% of the image): a hint, as the owner asked. Your variant must work with every scene, since the owner mixes them.

## Rules

1. **Reuse existing components and designs.** The owner rejects invented visual languages for the app's own UI: use the real poster card (`TitlePosterCard` from `app/ui/title-card/TitlePosterCard.tsx`, or `MovieTvCard`; pass `actions={false}` to avoid account writes), `DiscoverHeading`/`ReadAsChips` (`app/ui/discover/`), `ScoreRing` (`app/ui/details/hero/ScoreRing.tsx`), the talked-about `StartRow` (`app/ui/talked-about-now/start-row/`), the site's buttons, gray-900 and amber palette, and its type. Vary arrangement, grouping, order, size, motion, and disclosure. The room scenes and the TV transition are where visuals may reach further; say in the variant name when a variant is "bolder".
2. **Phones matter as much as desktop.** Every variant must work at 375 × 740 and at 1440 × 900 with no horizontal scroll. The owner tests on his phone.
3. **60 fps.** Animate `transform` and `opacity` only. No backdrop blur over moving content. No layout-shifting animations.
4. **Copy:** short and plain, no marketing taglines. Name the feature, not the control. Use American English.
5. **No new third-party packages, no new dependencies in imports that Vite hasn't pre-bundled.** framer-motion is already used in the app and fine.
6. **Shared dev server.** One Vite server runs for everyone on port 3172 (`prototype-start-lab.sh`); don't start, restart, or kill servers or processes. Remix compiles all routes together: create every module before the file that imports it, and register your variants in `index.ts` last. A broken import in your files breaks the page for every builder.
7. **No account or production writes.** Don't wire real mutations. Links to real pages (`/discover`, title pages, `/sign-up`, `/how-it-works`) are fine; they won't have data offline.
8. **Files:** only inside your own `sections/<section>/` folders, unless your assignment says otherwise. Put a one-line `// PROTOTYPE (start page lab): ...` comment at the top of each file saying what the variant is. Keep each variant in its own file.
9. **Check before you finish:** `npx tsc --noEmit -p . 2>&1 | grep prototype-start-lab` shows nothing from your files, and `curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3172/prototype/start-lab?<your section>=<key>"` returns 200 for every key (and the page HTML has no error boundary). No screenshot passes: the owner tests the feel himself. A single screenshot to check geometry is fine if you have a reliable way to take one.
10. **Report:** a short list of your variants (key, name, the idea in one sentence, the question it answers for the owner), anything you couldn't do, and anything another section should know.

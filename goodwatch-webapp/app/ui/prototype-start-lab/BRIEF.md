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

---

# Round 2 (2026-10-27): the owner's verdict on round 1 and what changes

## Picks

- **Guest:** layout c (hero, then a room band), hero b (mood chips), recs b (tap three), scene `nook-illustrated` (painted), shelf e (live changes), tv a (camera push-in), how b (TV on the side), browse a (hub chips).
- **Member:** scene `nook-illustrated`, shelf e, member e (doors) layout; member c (tonight first) was "pretty good".

## The owner's notes, verbatim

Guest:
> * the search does still look cramped, the chips too uninteresting
> * dont like the layout shift when results are shown
> * the scene could be extended to the top and bottom, like in a or b, but integrated with the search and taste quiz features. maybe both can be combined somehow. search something, then tap 3
> * the scene does not need the tv to be in the foreground, because the how it works intro will be below in this section [how b, TV on the side]
> * the browse section needs more love, like actual sections with good teaser content you can scroll through

Member:
> * no tv no intro here, that could be hidden somewhere at the bottom as an easteregg maybe but not necessary
> * the scene we could still extend maybe.
> * a: rows are not bad content-wise but a bit boringly presented (the hot section below is not a good fit)
> * b: not enough content
> * c: pretty good
> * d: bad layout, content makes sense but weirdly balances. search should show results inline
> * e: nice layout, not convinced about the movies shows split. goto section not bad
> * none of these are an interactive way to quickly get to decisions. would be good to go in that direction with the option to deep dive into each section when needed

## How round 2 is wired

- `/prototype/start-lab` is round 2 by default (`?round=1` shows round 1; the bar's R1/R2 button switches). The round 1 picks are round 2's defaults (`lab/choice.ts` DEFAULTS).
- **Guest page = `stage` + `how` + `browse`.** The `stage` section (`sections/stage/`) owns the whole first screen: the scene, the search, tap three. There is no separate layout, hero or recs in round 2. `how` b (TV on the side) follows, then `browse` (`sections/browse2/`).
- **Members:** `sections/member2/`. No TV, no intro: pass `noTv` to every `<Room/>`.
- **New scenes:** `nook-stage` (landscape, no TV, 16 slots), `nook-stage-portrait` (phone, no TV, 16 slots), `nook-stage-tv` (small TV at the side). Look at `public/prototype-start-lab/scenes/debug/contact-c.png` and `debug/nook-stage*.png`. Calm zones (normalized): top x .20-.80, y .02-.24; rug x .34-.68, y .81-.95 (landscape); portrait top x .21-.79, y .02-.26, rug x .36-.77, y .78-.97. Shelves run the full height at both sides. `nook-stage` is the default scene; other scenes must still work (they have a TV; pass `noTv`).
- A `<Room/>` that shows the TV hint on a scene without a TV uses `lab.tvScene` (the same room's TV corner, `nook-illustrated`), so How it works b keeps its TV.
- **Search timing:** `typedSearch(data, q, { signal, onReading })` in `lab/fixture-search.ts` answers a typed query the way the site does: the "Read as" reading after ~380 ms, titles after ~900 ms. Mood chips and example prompts are the free path (their answers could ship with the page): `moodAnswer`/`promptAnswer` answer at once. Design the loading moment for typed text.
- **Picks:** `picksFrom(data, tapped)` now has similar titles for every title in moods, prompts, popular and topRated (238 titles), so "search, then tap three" gives real picks from search results.
- **Browse data:** `data.guest.browse`: `genres.movie` (8 rows), `genres.show` (7 rows), `services` (Netflix, Prime Video, Disney Plus, HBO Max, Hulu, Apple TV, with `logo_path` and titles), `best.movie`/`best.show` (20 each), `newOn` (16 recent releases on those services). Plus `data.guest.moods` (11) and `data.talked`.

## Rules added in round 2

- **No layout shift.** Reserve the space results, loading states and picks will take before they arrive. Swapping content must not change the height of anything above the fold. Animate in place (crossfade, flip, slide within a fixed box).
- **SEO floor:** the guest stage carries the page's one H1 (plain, describes the product, for example "Find something to watch by mood or anything"); every other block uses H2/H3. Real `<a>` links render on the server.
- **Phones first:** 375 × 740 must show the field, the mood choices, and the start of results or the tap-three row on the first screen.
- Keep using the existing components: `TitlePosterCard` (`actions={false}`), `DiscoverHeading`-style field, `ReadAsChips`, `ScoreRing`, `StartRow`, the site's mood visuals (look at the Discover filter sheet in `app/ui/filter-bar/` and the vibe colors, `bg-vibe-*` in `app/tailwind.css`) for richer mood choices.

---

# Round 3 (2026-10-27): refine the round 2 picks

Picks: guest **stage a** (tray on the rug), scene `nook-stage`, shelf e, tv a, how b, **browse a** (rails); member **member2 d** (this or that; c was also liked).

The owner's notes, verbatim:

> guest:
> * browse c has some nice elements too: the genres with their tooltips. the top 10 with the big numbers
> * the search and tap is better in a, but there is still room for improvement. the search needs to be elevated and stand out, but nicely, without the opaque bg of b. we can use further padding and some kind of large shadowy feel. the presets look nice, but overlap too much with the bg, maybe make it bigger and have more room at the top
> * the image should not have any candles in, also less repetitive elements like the plants and baskets
> * the how it works tv scene is nice, but duplicates parts of the image above which feels weird
>
> member:
> * member start: both c and d are nice but i like d more
> * [the "Your lists" doors under d] rename your lists because that conflicts with the actual lists users can create. make the selected state more obvious and select first item by default
> * [the full-width gray "Open My shows" bar under an open door] nicer looking link to navigate

Scenes: `nook-stage` and `nook-stage-portrait` are being repainted (no candles, at most two plants, no baskets, a bigger calm top: the top ~36% across the middle ~64% of the width on landscape, ~34% × 60% on the portrait). A new `nook-tv-corner` (the other side of the room, with a TV) replaces `nook-illustrated` as How it works' TV scene (`lab.tvScene`). The images change under you while you work; reload to see them.

---

# Round 4 (2026-10-27): detail on the picks

Picks: guest **stage e** (shadow pool), **browse d** (rails with top 10 and genre peeks); member **member2 d** ("great").

The owner's notes, verbatim:

> guest:
> * E looks good. the search presets should be a bit more obsious to be clickable. the moods should fit into one row. we will have much more than these so some kind of extra select step apart from the most common ones would be good. the results/quiz should be presented and highlighted in a better way that clearly sets them apart from the rest of the page. the posters themselves should be the loved it toggles, like in the tv quiz
> * browse: d is good. each row needs controls to go left and right
>
> member:
> * d is great. agree that the order should depend on what's available in those. we need good empty state with cta too for members that dont have any show, any wishlist item, not enough ratings. or only 1 to a few

New in the lab: a **Member data** section (`?persona=full|few|no-shows|no-wishlist|new`, `lab/personas.ts`) trims the owner's data to test sparse and empty members; `data.member.ratings` is the member's rating count (905 for the owner, 4 for "few", 0 for "new").

---

# Round 5 (2026-10-28): detail on the picks

Picks: guest **stage h** (popover + framed tray), **browse d** ("okay now"); member **member2 d**.

The owner's notes, verbatim:

> guests:
> h is nicer. we can borrow better filter chip designs from discover.
>
> the results section is still not getting the prominence raise it deservess. also, it should show some pretty empty state before the user didnt choose anything. the 1,2,3 steps are not so nice
>
> the 4 posters in the room overlap with the filters which is distracting
>
> the how it works image should combine the play circle with the watch the intro label. the whole room should be clickable
>
> browse d is okay now
>
> members:
> * hot on socials should also show the top picks inline, like the other 3 tabs
> * for you for few titles layout needs lots of improvements [screenshot: persona "few", the For you door open: a half-width "For you is still forming" box with a progress bar and two buttons, filter chips, six posters, then a lone "More in For you" tile on its own row with lots of empty space]

The wall frames behind the mood row are being removed from `nook-stage` and `nook-stage-portrait` (only the side shelf slots stay). `<Room hideSlot={(rect, i) => ...} />` leaves any slot empty whose on-screen rect your block's controls cover, for the other scenes.

---

# Round 6 (2026-10-28): final guest details

Picks: guest **stage j** ("great"), tv a, how b, browse d; members "good" (member2 d, done).

The owner's notes, verbatim:

> guest:
> * j is great
> * watch the intro button in tv is enough: right hand side should only have read how it works
> * arrows for 10 tiles should jump right to the end of the list, currently i can push it a second time for a tiny last move
> * min gap between filters (mood chips) and results, even if that means scrolling
> * empty state looks meh. surprise me should be dice close to the your picks title. the other two we can remove
> * the dimming after 3 picks should happen already after 1 pick
> * picks and picked sound very similar. lists look very similar too
> * the long shelve with nothing on the wall looks weird. we need 3 more variations of this room that mek natural use of the space
> * intro question: yes [the intro film ends by sending guests to the page's tap three, instead of running its own quiz on the TV]
>
> member: good

Three new stage scenes are being painted: `nook-stage-window`, `nook-stage-armchair`, `nook-stage-records` (each with a `-portrait`), 10-14 shelf slots each, no TV, calm top ~38%.

---

# Round 7 (2026-10-28): the room and the gap

The owner: "nice. i like it". He picked the armchair room (`nook-stage-armchair`, now the default scene). His notes, verbatim:

> the room needs less pillows and blankets on floor and chair. remove the rolled up carpet
> the gap between filtesr and results should be much much more. and the scene should never be pushed so high that the dog disappears behind the filters

The armchair room is being tidied (fewer cushions and throws, no rolled carpet). Every stage scene's JSON gets `focus: [x, y, w, h]`: the box around the dog and its seat (`SceneMeta.focus`).

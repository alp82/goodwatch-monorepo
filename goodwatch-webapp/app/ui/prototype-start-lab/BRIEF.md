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

---

# Round 11 (2026-10-28): UX refinement on the settled design

Scene: **`nook-r9-bay-sofa-a`** (now the default). The owner's notes, verbatim:

> * the empty state looks pathetic [screenshot: the "Tap three you loved" card before any choice: a row of dark empty poster frames, three dashed ones with a heart] should be more elegant and fitting the design style of goodwatch in general
> * the picker/results can be a bit more prominent, bigger
> * the scene should get appropriate filters based on the moods chosen / attributes read
> * the posters in the shelf look a bit artificial in those frames, need to look more natural, also are these photo frames, wouldn't it make more sense to replace most of the books with blu rays and just replace their backs?
>
> 10 more variations

Ten repaints of the room are coming as `nook-r11-a` … `nook-r11-j` (+ `-portrait`): Blu-ray cases spine-out on the shelves, 10-14 face-out cases whose cover area is the magenta slot.

---

# Round 13 (2026-10-28): short presets, gentler bright moods, more effects

The owner's notes on round 12, verbatim:
- "search: D is nice. the preset links should be a bit more compact and less wordy. and the search placeholder shouldnt duplicate a preset"
- "effects: C is good but the bright ones are way too extreme. add more effects (scary and crime are good already)"
- "room: 12-b is good"
- "posters: h but we still have weird pixelized artifacts"
- "scene: reduce the min gap to half of this"

Built (f8e9ebfcd): six short presets and a new placeholder for search bar d; light c with the bright moods at about a
third and dust, sweep, fog, flicker, sepia, and moon effects; the chips-to-card gap halved; nook-r12-b slot edges
inpainted (scripts/prototype-start-lab/scene-slots-r13.py). Round 12 picks: searchbar d, light c, scene nook-r12-b, shelf h.

Round 14 preset fix: a preset fills the field with its short phrase and searches it (`PRESET_SHORT` in lab/fixture-search.ts).

# Round 14 (2026-10-28): mood lighting e

The owner's notes on round 13, verbatim:

> * bright: i think we should have the default brightness a bit less so that the difference for selected bright moods is better visible
> * effects: crime should be not THAT dark
> * scary could add some dark red extras
> * the sweep is bad, looks nothing like an effect or filter that makes sense on a tv
> * add more ideas for effects and filter layers
> * presets: they should fill in the exact short phrases

Built: mood lighting **e** ("Round 14", `?light=e`, now round 2's default; a-d unchanged), on c (`sections/light/tables.ts` GRADES_E, REST_DIM, EFFECTS_E):

- **Dimmer resting room:** with no grade on show the room sits under a dark multiply (.2) and a light desaturation (.14), which any grade fades out, so the bright moods lift it; their grade is about a quarter stronger than c's.
- **Crime and mystery lighter:** multiply .62 → .37, vignette .6 → .36, contrast .4 → .3; still drained and cold.
- **Scary:** less black vignette plus `redrim` (deep red edges and a dim red glow at the lamp, breathing slowly) and rare `lightning` in the window.
- **No sweep** anywhere in e. Funny: `pop` + `xpro`. Action: `teal` + `flare` + contrast.
- **New effects:** halation, chroma, crt, vhs, teal, xpro, bleach, pop, leak, shafts, flare, lightning, rain, scratches, redrim (each described in tables.ts EFFECTS_E). Per mood: feel-good shafts + halation + flicker; romance halation + leak; mystery adds fog + rain; mind crt + chroma; heavy bleach + dust; history sepia + scratches; growing vhs + leak; worlds as c.
- **Effect explorer:** `?fx=rain,leak` forces effects on (at FX_SOLO strength, on top of the mood's); while `fx` is in the URL (even `?fx=`) a small toggle list sits in the top left. The lab bar keeps `fx`.
- The window is a guess (the box just above the scene's focus); the lamp is found per scene as before.

# Round 15 room

New default scene **`nook-r15-a`** (+ `-portrait`): nook-r12-b with the sleeping dog removed (the sofa seat is simply empty; cushions and the rust throw stay) and both bookcases lit by r12-e's hidden under-shelf warm LED strips instead of 12-b's neon edge lines (the left bookcase now glows too). Everything else is 12-b: the same 11 / 12 slots to within about a pixel, same lamp, window and rug. Made with one Codex image_gen edit per orientation (`scripts/prototype-start-lab/scene-slots-r15-prompts.json`), processed with `scene-slots-r15.py` (r13's inpainting, fresh metadata). `focus` is 12-b's box (seat and throw). Lamp detection still lands on the lamp shade.

# Round 15 (2026-10-28): the mood picker from My movies

The owner's notes on round 14, verbatim:

> * the mood selection bar + more button looks amateurish. the chips are okay but also they duplicate some sentiments from the example searches
> * in my movies we have these much nicer representation: [screenshot]
> * the best ones are preset combinations but also the categories make more sense here and the selection is much better designed
> * "Find something to watch by mood" - remove the or anything
> * room: the dog needs to go away for now, not everyone like them and this is not a pet website. also, the lights inside the shelves should use the better designed strips from 12-e
> * effects are not bad. some things are still not fitting, but lets park that for a while

The room is "Round 15 room" above. Built for the picker:

- **Stage l "Mixes on the stage"** (`?stage=l`, round 2's default) and **stage m "Mood button"** (`?stage=m`); the bar's stage section is open again with j, l, m. Both are j (same card, gap, light) with My movies' taste picker (watch-next/MoodPicker + TasteShelf) in place of the chips and More moods: its MoodButton ("Any mood" with the color fan, then "Add"/"Change"), PickChip, ChoiceArt and choiceHues render as they are; the tile, shelf and panel head are copies of TasteShelf's (not exported) with guest lines (`sections/stage/jl-picker.tsx`).
  - **l:** the button and the first six mixes as image tiles in one row under the search bar (sideways on phones; fits from ~1250 px). Fixed sizes, so a pick moves nothing.
  - **m:** only the button, the picks as poster chips, and "N titles" (or "Pick up to three"). The calmest stage.
  - **The panel** (both): "Pick up to three. Mix moods, themes, and styles.", k of 3, Clear, Done; "Start with a mix" (eight mixes, 2 × 4 on desktop), then "Everything else": Moods 11, Themes 13, Styles 10, folded. Solid gray-900 (no blur: the light effects move behind it). Picks keep it open; Done brings the results into view.
- **Mixes** (`jl-mixes.ts`): Warm, easy comedies (Funny · Feel-good); Dark, gritty crime (Crime & mystery · Scary · Graphic); Eerie, mind-bending stories (Mind-bending · Scary); Funny love stories (Romance · Funny); Smart, high-stakes action (Action · Mind-bending · Fast-paced); Warm coming-of-age stories (Coming of age · Feel-good); Moving period dramas (History · Heavy · Slow burn); Dark fantasy epics (Fantasy · Heavy · Spectacle). Up to three picks (mixes and words) combine; a fourth is refused with My movies' hint.
- **Lab stand-ins:** a theme or style answers with its nearest mood's (or prompt's) fixture list; picks merge their lists (titles on more lists first); counts are list sizes ("34 titles"). Tile pictures are the lists' backdrops, none repeated.
- **Presets** show only what moods can't say: "Severance, but funny", "Space adventure", "Adult animation" (`PRESETS` in lab/fixture-search.ts). Cozy mystery, Feel-good binge, Mind-bending sci-fi and Twisty thriller are moods in other words; the lab has no other captured prompts.
- **H1** "Find something to watch by mood"; the input's label "Search by mood, plot, or title".
- **Light:** picks drive the room by their first word (a mix by its first part).

# Round 16 (2026-10-28): mixes are their parts, stage m by default

The owner's notes on round 15, verbatim:

> 1. mood: m!
> 2. these can get a bit hard to read on the image bg
> 3. these should be either or selections
> 4. when selecting a mix it should also auto-select the individual ones like funny and feel good
> 5. the panel's scrollbar is okay, but it should use the available vertical space we have
> 6. we can and should have moods in the example searches, just use different words than we have in the selectors
> 7. heading also drop the "by mood"

Built:

- **Stage m is round 2's default** (`DEFAULTS[2].stage`); j and l stay in the bar.
- **A mix is its parts** (`jl-mixes.ts`: `activeMix`, `displayPicks`, `pickMix`). The picks are words only (moods, themes, styles; up to three). A mix tile is on while all its parts are picked, however they got there (tapping Funny then Feel-good lights "Warm, easy comedies" too); only one mix is on at a time (if two would be, the one picked first). Tapping a mix swaps the mix that's on for it: its parts go in first, other words stay while they fit in three (the latest ones stay), so a 3-part mix replaces everything. Tapping the mix that's on takes its parts off and keeps the other words. Mix tiles are never dimmed or refused; words still are at three. Unticking a part below turns the mix off and keeps the rest. "k of 3" and the group badges count parts.
- **Chips by Add:** the mix by its name while it's whole ("Warm, easy comedies 30 ×"), then any other words ("Animated 17 ×"); once broken, the remaining words one by one. The mix chip's × removes its parts. The results' heading and the light follow the same order (the mix's first part leads the light).
- **Chip legibility:** `GuestChip` (a copy of TasteShelf's PickChip): the same art, shape, count and ×, plus a black scrim (60 % at the left under the name, 25 % at the right), a firmer text shadow and darker count and × backings.
- **Panel height:** the panel runs from where it opens down to 80 px above the viewport bottom (the lab bar plus a margin), so it grows with its open groups instead of stopping at 560 px. If less than 360 px is left there, the page scrolls it up to 72 px from the top first. Measured on open and on resizes (visualViewport too), never per scroll frame; it overlays, so nothing behind it moves.
- **Presets** (`PRESETS`, `PRESET_SHORT`): Cheer me up, Rainy-day whodunit, Severance, but funny, Twist ending, Space adventure, Grown-up cartoons. Six, each one captured prompt, none using a picker label. They fit the bar's row at 1440 and 1920 (about 820 of 832 px) and scroll sideways on phones. The mind-bending sci-fi prompt stays out (a seventh wouldn't fit, and Space adventure plus the mind-bending mix cover it). The lab's stand-in reading knows the new words.
- **H1** "Find something to watch" in j, l and m.

# Round 17 fixes (2026-10-28): whole posters, reset after picks, lazy presets

The owner's notes, verbatim:

> - "in the results: [screenshot: the poster row inside the card is cut at both edges, half posters visible, \"Start over\" top right] either show an arrow or dont show incomplete posters. same for the picks: [screenshot: the 'Also for you' row, Interstellar whole and Bleach cut off at the card's right edge] (ideally we show 6 results that fit into the frame), we can allow this to grow further in width on large screens"
> - "when i selected 3 and go back choosing, the selections should be reset"
> - "the search presets should be all lower case and without \"-\" - like a lazy human would type them"

Built (stages j, l, m: the spotlight card; k is unchanged):

- **Whole posters only** (`sections/stage/jk-pager.tsx`, `JkBody fit`). The results row and both "Also for you" rows are size containers; per breakpoint a poster is at most the width the fixed card height holds, shrunk just enough that a whole number fits the row (CSS container queries, so the first paint is already right; card heights unchanged per breakpoint). The scroller's box ends less than a gap past the last whole poster, so the next never peeks. Rows snap to every poster (a swipe lands on whole posters); arrows page by one whole set.
  - Results: 3 at 375 (97 px) and 414, 4 at 768, 6 at 1024 and at 1440×900 (179 px), 7 at 1280×800 / 1440×800 (151 px, the short-screen size), 8 at 1920 (181 px).
  - Arrows: from 640 px the title page rows' round blue arrows (as browse d) over the first and last poster, fading out at an end; on phones page dots and the small blue arrows sit in the room under the posters (phone posters max 118 px to leave it).
  - Also for you: small arrows in the label's line before "Start over". 6 whole on phones (~41 px), 3 at 768, 5 at 1024, 6 at 1440 (83 px), 7 at 1920 (98 px). From 1024 px the featured title and the row share the width evenly (was 1.3 : 1).
- **Wider card:** `max-w-[clamp(1200px,calc(100vw-320px),1600px)]` (1200 up to ~1520 px viewports, 1600 at 1920); the module column allows 1648 px. The gap/scene placement is untouched.
- **Reset after picks** (`useJkFlow`): once three are loved, Back or choosing anything new (a mood, preset, typed search, picker pick, Clear, the dice) empties the three and the Loved slots; fewer than three still carry across searches. Start over as before (it now also cancels the pending "show the picks" beat).
- **Lazy presets** (`PRESET_SHORT`): cheer me up, rainy day whodunit, severance but funny, twist ending, space adventure, grown up cartoons (and the unshown "messes with my head"). The field fills with exactly that and searches it; the stand-in reading's "grown up" and "<title> but" ("like Severance") rules know the new spelling.

# Round 17 opening flow

The owner's note, verbatim:

> for the lab, a new experiment:
> * lets start the page with the boot animation from the previous tv
> * it transitions into this landing page
> * we can experiment with either what we have now or just the search section first [screenshot: the stage's top only: H1, the search field with "Try" presets, and the "Any mood · Pick up to three" button, over the dark room top]
> * bg can adapt gradually during the flow
> * different ux flows
> * basic idea is: first search then recommend me

Built: a new lab section **"Opening flow"** (`?flow=`, guest, round 2, first in the bar; default `none` = today's page, no boot). Code in `sections/flow/`: `boot-overlay.tsx` (the old TV's `Boot` from `ui/living-room/intro/boot.tsx` + `boot.css`, imported as they are, full screen over the page and the lab bar; its own fade-out is replaced by the hand-off), `shell.tsx` (stage m composed as it is: `JkStage` + `SpotlightCard` + `MoodButtonPicker`; nothing forked), one file per variant. Steps: 0 ask (search or mood), 1 pick (tap three; reached once the guest has asked: Enter, the button, a preset, the picker's Done, or the field losing focus), 2 For you. The background is a night layer over the room (opacity per step) and a scale on the room's box (the camera), plus a warm glow layer for the glow hand-off; the mood lighting runs underneath as before. Opacity and transform only; reduced motion gets a 0.7 s boot and fades.

- **a "Boot, then the page":** fade through black into today's whole stage m; the room goes dark → lit and the camera eases from 1.08 to 1.
- **b "Search first":** the boot's amber glow swells and stays as the room's warm light while the black fades; only the search block over an almost dark room. The first search or mood brings the card and half the light (a mood more, so its lighting shows); For you lights the room.
- **c "Step by step":** glow hand-off; the search block waits alone in the middle of the screen over a near-black room seen close up (1.12). The first search slides it up to its place and the card in; each loved title lights the room more and pulls the camera back; For you is fully lit at the normal framing.
- **d "Ask and answer":** three questions in one place with a step indicator and Back: "What are you in the mood for?" (search block), "Which of these did you love?" (the card fades in where the search block was), "Here's what to watch". Fade hand-off; the room lightens with each answer.
- **e "TV hands off" (bolder):** the boot screen powers down like an old TV onto the search field (the black screen shrinks into the field's box), then the field glows once. Then as b.

Every visit starts fresh (each flow's stage state `start-lab-stage-flow-<key>` is cleared on load); the round button under the header's right end replays the opening; a tap on the boot skips it. The stage stays in the server's HTML under the overlay.

# Round 18 (2026-10-28): the boot in the header's place

The owner's notes on round 17, verbatim:

> i like C's initial experience with the centered search
> instead of having the full screen boot, let's add that at the top of the screen while the rest of the page is also quickly assembling and then replace it with the header in a smooth quick transition. maybe we can reuse the e animation as well
>
> more iterations based on this

Built: four new opening flows, **f, g, h, i**, all c's experience (the search block alone in the middle over a near-black room seen close up; the first search moves it up and brings in the card; each loved title lights the room and pulls the camera back; For you fully lit) through c's own spec (`C_SPEC` in `c.tsx`; f-i spread it via `STRIP_BASE` in `f.tsx`, with the room at 0.9 instead of 0.94 at the first step so its fade up shows). **g is the default flow** (`DEFAULTS[2].flow`); `?flow=none` is today's page, a-e are unchanged.

- **No full-screen boot** (`sections/flow/boot-strip.tsx`): the old TV's `Boot` (boot.tsx + boot.css as they are) plays in a fixed strip exactly over the site header (64 px, 65 at lg, z above the header), sped up (G and arc ~0.9 s, "oodWatch" slides out by ~1.1 s). The real `SiteHeader` (root layout, fixed) is in the HTML underneath the whole time, so its box never moves (measured identical before and after the hand-off at 375, 1440 and 1920).
- **The page assembles at the same time, CSS only from the first paint** (`.fl-early` in `shell.tsx`): the room fades up from black (night layer 1 → 0.9, 1.3 s) while the camera settles (5 % closer → c's 1.12, 1.8 s); the search block is centered by CSS (`translateY(.46 × (100svh − 64px) − 50% − pad/2)`, c's formula, so no jump when scripts start), and its parts come in staggered (H1 0.15 s, field 0.27 s, presets and mood button 0.39 s; 0.55 s each, opacity + translate).
  - The stage measures its gap (the room's placement) and obstacles from on-screen boxes; while the block is lifted, `useUnliftedMeasures` switches the lift off for one synchronous measuring pass (mount, the stage's observer round, its 400 ms timer, resizes), so the room sits where c puts it and nothing paints in between. One more pass after the block has moved up.
- **Hand-offs** (start at 1.15 s after the first paint; the strip is gone by ~1.6-1.75 s):
  - **f "TV off into the header":** e's power-down on the strip: the picture squashes into a bright line (0.18 s), the line shrinks to nothing, and two black halves part from the middle so the header opens out of the line (0.46 s in all).
  - **g "Logo hand-off":** the boot's G and "oodWatch" travel and shrink onto the header's wordmark (FLIP from G to G, 0.48 s) while the black fades and the header's Browse, search and Sign in show; the real wordmark (hidden until then) takes over where they land (0.12 s crossfade).
  - **h "Glow sweep":** an amber glow runs across the strip left to right (0.48 s) and leaves the header behind it: a black cover moves right while its content moves left by the same amount (a wipe from two transforms, no clip-path).
  - **i "Quiet":** a smaller boot (21/26 px), then the strip crossfades away with a 6 px lift while the header's parts rise 8 px into place (0.48 s), and the search field glows once (e's ring).
- **Skip, replay, reduced motion:** a tap or key anywhere skips to the hand-off (the tap still reaches the page, which works under the strip); ↻ and reload play it again; reduced motion: the boot holds 0.6 s and the strip fades in 0.3 s, the page's parts only fade.

# Round 19 (2026-10-28): big boot, calm hand-offs, once a session, search + moods

The owner's notes on round 18, verbatim:

> - "g is okay, but the moving to the left is not the best thing because it grabs attention. needs a smoother transition"
> - "f is looking too flashy"
> - "h as well and bad readability during the transition"
> - "i not bad actually"
> - "i would like to see a variation where the boot animation is a bit bigger and further down and the header just slides in while it transitions out in a smooth fade out"
> - "boot animation should only happen once per session (session storage) and never for members"
> - "it should be possible to combine search with moods, so dont remove the other one when adding one"
> - "the arrows should only go right and left once, dont add more posters than that"

Built (f, g, h, i unchanged):

- **j "Big boot, header slides in"** (`?flow=j`, **the default**, `DEFAULTS[2].flow`; boot-strip mode `big`): c's start (search block centered over the near-black close room, the page assembling as in f-i). The boot plays large (46 px type on phones, up to 62 / 78 px; never more than 30 % of the room it has) centered in the empty band between the header and the H1, placed by CSS from the block's own centering formula (`.46 × (100svh − 64px) − C/2`, C the block's height per breakpoint), so it's right from the first paint and never touches the H1. The header waits above the screen (`translate: 0 −100%`, its place filled with night, not the page's gray). At 1.4 s it hands off: the boot fades out with a slight shrink and lift (opacity 0.6 s, `translateY(−8px) scale(.96)` 0.7 s) while the header slides down into place (0.64 s, soft ease-out, opacity 0.42 s), both at once; the header's backdrop blur is off while it moves. Gone by ~2.1 s.
- **k "Logo hand-off, calm"** (mode `fade`): g's strip with no travel. The boot's wordmark fades (0.3 s) and shrinks to 0.88 in place, the black strip lifts after it (0.46 s from 0.2 s), and the header's own wordmark fades in where it always is (0.42 s from 0.26 s), so the two never sit on top of each other readably. ~0.7 s.
- **l "Quiet, header slides in"** (mode `slide`): i's small boot in the header's place without the black strip; it fades (0.3 s) while the header slides down over its place as in j, then the field glows once as in i.
- **Once a session, never for members** (`shell.tsx` `GATE_SCRIPT`). An inline script first in the flow's HTML: on a session's first load it sets `sessionStorage["gw-boot-seen"]` and the boot plays; on later loads it ticks a hidden checkbox (`#fl-boot-gate`), and CSS on `html:has(#fl-boot-gate:checked)` hides the strip and its night cover, turns off every header-hiding rule and the page's assembly animations, so a returning visitor's server-rendered page shows the assembled landing at once (the c start, header in place, no flash); after hydration the strip is removed. (A checkbox's checked state is a property, so hydration sees nothing new; an `<html data-…>` mark, the production intro's pattern, made React warn in dev.) Applies to the strip flows f-l; a-e keep their full-screen boot. Members never see a boot: the lab's member view (`as=member`) renders the member page, which has no flow; a real page would leave the boot out of a member's HTML. **Lab:** ↻ always replays (the flag stays set, so a reload skips again); `?boot=1` forces the boot on load; switching flows in the bar plays the new one (it's a client-side mount, which the gate doesn't apply to). Reading sessionStorage is in a try/catch (no storage: the boot plays).
- **Search + moods combine** (`ab-shared.tsx`): the search (typed or a preset) and the mood picks are kept apart and combined into the source (`mix` with `q`). Typing or a preset keeps the picks; picking moods keeps the field's text and a running search. The field's Clear (and emptying it) clears only the search; × on a chip clears only that mood; the picker's Clear clears the moods. The "Read as" line shows the reading and then the picks ("Read as Mystery · Funny"); the module's line names both ("rainy day whodunit · Funny"); See all sends both. Light follows the moods if any has a grade, else the search's reading. The reset-after-three rule covers the field's Clear too. **Lab stand-in:** the search's fixture list re-ranked by the picks' merged list: titles on both first, then the search's others and the picks' others taking turns (the captured lists barely overlap, so adding a mood visibly changes the row). The dice / chip mood (stage j) is still a search of its own.
- **Arrows page once** (`jk-pager.tsx` `MAX_PAGES = 2`): the results row and Also for you hold at most two whole views (the row's `--jk-n` × 2, read before paint; results count See all as one of them), so → goes one page and ← back, nothing further; the phone page dots are two.

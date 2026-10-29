# Start page redesign

**Status:** built on `feat/start-page-redesign` (steps 1 to 9, October 29, 2026); not merged to `main` yet. See
[Shipped state](#shipped-state).

This spec ships the start page the owner picked in the start page lab (branch `prototype/start-lab`, rounds 1 to 19,
October 27 and 28, 2026). It replaces the TV living room at `/` with a search-first page over a painted room. Guests
try GoodWatch right away; members get a personal start. Builders get one step at a time from the list in
[Build steps](#build-steps).

The lab is the source of truth for the look and the motion: `goodwatch-webapp/app/ui/prototype-start-lab/` on that
branch, with every round's owner notes in its `BRIEF.md`. The lab ran offline on fixtures; this spec names the real
data source for every stand-in.

## Goal

- A guest lands on a centered search over a dark room, searches by mood or anything, taps three titles they loved,
  and gets real recommendations on the page. The TV intro stays one tap away.
- A member lands on "this or that" from their own lists and doors into Continue watching, Wishlist, For you, and Hot
  on socials. No TV, no boot.
- The page stays fast on phones (mobile LCP under 2 s target, benchmark budget held), crawlable (one H1, real links in
  the server HTML), and free of layout shift.

## Decisions

The owner's final picks (October 28, 2026):

| Part | Pick | What it is |
|---|---|---|
| Opening (guests) | Flow j | The old TV's boot drawn large in the empty band above the centered search. At the hand-off it fades out while the real site header slides down. Once per browser session; never for members. |
| Stage (guests) | Stage m | The search block (H1, search bar, the "Any mood" button) centered over a near-black room that lights up step by step. |
| Search bar | Bar d | Two-row bar: the field and an amber Search button with a ↵ key segment; under a divider, six lowercase presets or, while a search is on, Discover's "Read as" chips. |
| Mood choice | My movies' mood picker | "Any mood" opens the taste picker panel: eight mixes ("Start with a mix"), then Moods, Themes, and Styles. Up to three picks; a mix is its parts; one mix on at a time. |
| Results | Spotlight card | "Tap three you loved": whole posters, paged by arrows at most once (two pages). Loved 0/3 slots. Then "For you": a featured title and "Also for you". |
| Room | Scene `nook-r15-a` | The painted sofa nook, no dog, warm under-shelf LED strips. Phone version `nook-r15-a-portrait`. |
| Posters in the room | Shelf h | Real poster covers in Blu-ray cases on the shelf slots, in perspective. |
| Lighting | Light e, grade only | The dimmed resting room and per-mood color grades. No moving effects. |
| How it works | How b | The room's TV corner as one "Watch the intro" button, beside three essentials and a "Read how it works" link. |
| Browse | Browse d | "Where to start": Top 10 with big numbers, New on, moods, services, and a genre cloud with peeks. Every rail has arrows. |
| Members | Member start d | This or that from the member's own lists, then the "Go deeper" doors, with empty and sparse states. |

Final tweaks from the owner's last round, to build in:

- "j is great. can be a bit further to the top and the scale out should not stop while fading out." The boot sits
  higher in its band, and its shrink keeps moving until it is fully transparent.
- "on mobile, we should fit 4 fotos per screen." The results row shows four whole posters on phones.

The owner's answers to the open questions:

1. **Typed search** searches after a debounce pause. Presets run a regular search with their exact phrase; nothing
   is precomputed. This spec uses **800 ms**, the same as Discover's `COMMIT_MS`
   (`app/ui/discover/DiscoverHeading.tsx`), not the lab's 500 ms: every search is a paid Jev reading and a history
   row, a 500 ms pause fires more readings for half-typed text, and one rule across the site means a query carried to
   **See all** behaves the same. Enter and the Search button search at once.
2. **Mood lighting** ships light e's color grade and its resting dim, plus static layers only. The moving effects wait
   for a separate effects lab (see [Follow-ups](#follow-ups)).
3. **The TV home** leaves `/`. Its code stays (`app/ui/living-room/`, `app/server/living-room/`); a 404 easter egg
   comes later. The intro film stays reachable from How it works' TV corner and ends on a "Your turn" card with
   **Try it**.
4. **The three loved titles** are saved in the guest's stored progress (`app/utils/guest-progress.ts`), so "Keep my
   taste" carries them into the account and Discover's For you counts them.
5. **Mood picker counts** for guests read "N titles", counted across every service in the guest's country, and read
   "on your services" once the guest has saved services.

## Rules for every step

- **No production writes from local runs.** `goodwatch-webapp/.env` points at the production databases. Never start
  a server with it. Verify with `npm run typecheck`, `npm test`, render tests (the `vite-node` pattern in
  `app/ui/living-room/below-room.test.ts`), and an isolated local run: `env -i` with blank endpoints and keys and the
  egress-blocking preload, as `goodwatch-webapp/prototype-start-lab.sh` on the lab branch does. For a production
  build, use a throwaway local Valkey cluster (memory note `local-isolated-valkey`). Search and Discover results
  don't work offline; check them with unit tests against mocked `fetch`, and the owner checks live after deploy.
- **Reuse existing components.** `TitlePosterCard`, `ScoreRing`, `ReadAsChips`, `MoodButton`, `PickChip`,
  `ChoiceArt`, `choiceHues`, the title page rows' arrows, the site's buttons and palette. Where a piece isn't exported
  (`ChoiceTile`, `Heading` in `TasteShelf.tsx`, `PanelHead` in `MoodPicker.tsx`), export it and add a prop for the
  guest's lines rather than copying its markup as the lab did.
- **No prototype names.** No `j`, `m`, `d`, `h`, `e`, `r15`, `jk`, `jl`, `fl-`, "round", "lab", or "stand-in" in
  production files, identifiers, CSS classes, or comments. Name things by what they do.
- **No feature switches.** Ship to everyone. Steps merge into `feat/start-page-redesign`; the branch merges to `main`
  once, in step 9. Until then `/` on `main` keeps the TV.
- **60 fps.** Animate `transform` and `opacity` only. No backdrop blur over moving content (turn the header's blur
  off while it slides). Check with performance traces (work counts), not headless fps.
- **Phones first.** Check 375 × 740, 390 × 844, 768 × 1024, 1280 × 800, 1440 × 900, and 1920 × 1080. No horizontal
  scroll.
- **No layout shift.** Reserve every box before its content arrives. CLS stays at most 0.01.
- **No new dependencies.** framer-motion is already in the app.
- **SEO floor.** One H1 ("Find something to watch"), every other heading H2 or H3. Real `<a>` links in the server
  HTML. The stage is in the server HTML under the boot.
- **Mobile LCP.** The room picture is the LCP element. It paints at full opacity from the server HTML (a night layer
  over it may fade; the image itself never starts at opacity 0). Keep `START_AFTER_PAINT` on the route.
- **Page cache.** Guest HTML depends on the cache key only (`docs/page-cache.md`): URL, auth state, country, and
  language. Decide first visit in the browser, never by cookie or user agent.
- **Search never runs from a loader.** Searches cost money and write history.
- **Copy:** short and plain, American English, no taglines. Google developer documentation style in docs.

## Map from the lab to production

New code lives under `app/ui/start/` and `app/server/start-page/`. Nothing imports `app/ui/prototype-start-lab/`.

| Lab piece (on `prototype/start-lab`) | Production home | Notes |
|---|---|---|
| `routes/prototype.start-lab.tsx`, `lab/LabPage.tsx` | `app/routes/_index.tsx` (rewritten) | Loader `startPageLoader` from `app/server/start-page/loader.server.ts`. Keeps `headers`, `START_AFTER_PAINT`, meta and JSON-LD. Drops `introStartScript` and the TV. |
| `server/prototype-start-lab.server.ts` | `app/server/start-page/loader.server.ts`, `browse.server.ts`, `member.server.ts` | Real reads; see [Data sources](#data-sources). |
| `scene/SceneStage.tsx`, `scene/types.ts`, `lab/Room.tsx` | `app/ui/start/room/StartRoom.tsx`, `room/scene.ts` | `scene.ts` holds the two scenes' metadata (size, slot quads, focus, lamp) as typed constants copied from `public/prototype-start-lab/scenes/nook-r15-a*.json` and `nook-tv-corner.json`. No runtime JSON fetch. |
| `scene/homography.ts` | `app/ui/start/room/homography.ts` | Moves as is, with its unit tests added. |
| `sections/shelf/cover2-case.tsx`, `cover2.tsx`, `cover-poster.tsx`, `lit.tsx` (`LiftCaption`), `store.ts` | `app/ui/start/room/ShelfCovers.tsx` | Cased covers only (one style). |
| `sections/stage/jk-shared.tsx` (`JkStage`, placement), `efg-shared.tsx` | `app/ui/start/stage/StartStage.tsx`, `stage/placement.ts` | Placement becomes CSS (see [The room](#the-room)). |
| `sections/stage/ab-shared.tsx` (`useStageFlow`, `Source`), `jk-shared.tsx` (`useJkFlow`) | `app/ui/start/stage/useStartQuery.ts`, `stage/useLovedThree.ts` | Query state (text plus picks), the view (`empty`, `loading`, `results`, `forYou`), the reset-after-three rule. |
| `sections/searchbar/d.tsx`, `shared.tsx`, `bars.tsx` | `app/ui/start/search/StartSearchBar.tsx`, `search/presets.ts`, `search/useStartSearch.ts` | Bar d only. |
| `lab/fixture-search.ts` (`typedSearch`, `promptAnswer`, `PRESET_SHORT`) | `search/useStartSearch.ts` | Real search; presets are the six phrases only. |
| `sections/stage/jl-picker.tsx` (`MoodButtonPicker`, `GuestTile`, `GuestChip`, panel) | `app/ui/start/moods/StartMoodPicker.tsx` | Built from exported `MoodPicker`/`TasteShelf` parts. |
| `sections/stage/jl-mixes.ts` | `app/ui/start/moods/mixes.ts` (+ `mixes.test.ts`) | `MIXES`, `activeMix`, `displayPicks`, `pickMix`, `togglePick` wrapper. Drop `mergedTitles`, `mixAnswer`, `guestPicker`. |
| `sections/stage/j.tsx` (`SpotlightCard`), `jk-module.tsx`, `jk-pager.tsx`, `hi-shared.tsx` (`ToggleCard`, `SkeletonRow`) | `app/ui/start/spotlight/SpotlightCard.tsx`, `spotlight/PosterPager.tsx`, `spotlight/LovedSlots.tsx`, `spotlight/ForYouPanel.tsx` | `fitCss` moves into a CSS file. |
| `sections/stage/jk-grade.tsx`, `sections/light/tables.ts` (`GRADES_E`, `REST_DIM`, `COLOR_STRONG`) | `app/ui/start/lighting/grades.ts` (+ test), `lighting/RoomGrade.tsx` | Grade layers only. `effects.tsx`, `explorer.tsx`, `EFFECTS_E` stay behind. |
| `sections/flow/shell.tsx` (gate, steps, `C_SPEC`/`STRIP_BASE`), `flow/boot-strip.tsx` (mode `big`) | `app/ui/start/opening/OpeningBoot.tsx`, `opening/boot-gate.ts`, `opening/steps.ts` | Only the large boot and header slide. Other modes stay behind. |
| `sections/how/tv-side.tsx`, `how/visuals.tsx` (`ESSENTIALS`) | `app/ui/start/how/HowItWorksCorner.tsx` | |
| `sections/tv/push.tsx` (`PushTheater`, `YourTurn`), `tv/kit.tsx`, `tv/push.css` | `app/ui/start/how/IntroTheater.tsx`, `app/ui/living-room/intro/scenes/your-turn.tsx` | The end card joins the intro's scenes; `film.ts` exports a film that ends on it. |
| `sections/browse2/d.tsx`, `kit-de.tsx`, `kit-hubs.tsx` | `app/ui/start/browse/StartBrowse.tsx`, `TopTen.tsx`, `Rails.tsx`, `GenreCloud.tsx` | |
| `sections/member2/d.tsx`, `cd-shared.tsx`, `cd-doors.tsx` | `app/ui/start/member/MemberStart.tsx`, `ThisOrThat.tsx`, `deck.ts` (+ test), `Doors.tsx`, `FirstSteps.tsx` | |
| Inline `<style dangerouslySetInnerHTML>` strings | `app/ui/start/start.css`, `app/ui/start/opening/opening.css` | Linked from the route's `links` with `crossorigin`, listed in a `START_SHEETS` array (as `HOME_SHEETS` is) so the 103 hints preload them. |

## The room

**Assets.** Copy from the lab branch's `public/prototype-start-lab/scenes/` into `app/img/start-room/` (Vite hashes
them):

| Source | Production file | Size | Use |
|---|---|---|---|
| `nook-r15-a.avif`, `.webp` | `start-room-1536.avif`, `.webp` | 1536 × 1024, about 157 KB AVIF | Desktop and landscape |
| `nook-r15-a-portrait.avif`, `.webp` | `start-room-phone.avif`, `.webp` | 1024 × 1536, about 161 KB AVIF | Upright phones (LCP) |
| `nook-tv-corner.avif`, `.webp` | `tv-corner.avif`, `.webp` | 1536 × 1024, about 136 KB AVIF | How it works (lazy, below the fold) |

Re-encode the phone file to land under about 120 KB if the image budget needs it. The scenes have no larger source;
on screens wider than 1536 px the picture scales up, as it did in the lab.

**The picture.** Use the TV room's pattern from `app/ui/living-room/tv/room-art.ts`: both pictures in the HTML, a
`<source media>` pointing at `NO_PICTURE` blanks the one the window doesn't draw (the page cache forbids choosing in
HTML by device). The server's choice is the 103 Early Hint: `server/early-hints.ts` picks the phone or desktop AVIF
for `/` from `Sec-CH-UA-Mobile`, as today. The pictures carry `fetchpriority="high"`, `crossorigin`, and
`elementtiming="hero"` (`HERO_TIMING`). The shared media queries (`UPRIGHT_PHONE`, `NOT_UPRIGHT_PHONE`) move or are
reused; the phone version shows on boxes taller than wide (the lab's 0.8 aspect rule) only if that equals the media
query; otherwise the media query wins, since nothing can measure before paint.

**Placement** (streamlined 2026-10-29, prototype `prototype/start-streamline`). Production places the room in CSS from
the first paint (`start.css`, `stage/placement.ts` mirrors the math with tests). The stage is a column: the search
block (fixed heights per breakpoint), then the card, whose bottom edge stands on the floor in front of the sofa.

- **Before the card opens**, the search block waits at the foot of the headroom (`clamp(96px, 15svh, 200px)` on phones,
  `clamp(120px, 17svh, 260px)` from 640 px, `clamp(120px, 20svh - 20px, 260px)` from 1024 px), its bottom over the
  window's middle, and only the card's bottom strip shows: the **ledge** (see "The ledge").
- **The picture** is sized so the headroom, the block, the window-to-floor strip, and the foot (24 px; on phones the
  dock's height plus 10 px) fill the screen under the header, between 70 % and 115 % of the stage's width, centered on
  the sofa. Each scene names its window (`window.top`, `window.middle`) and the floor strip the ledge stands on
  (`floor.top`, `floor.bottom`), as shares of the picture's height (`room/scene.ts`).
- **Opening** lifts the block to the top (`--start-pad`) and grows the card up from the ledge's bottom edge, at most to
  16 px under the block (less a member's list tabs). The night above the room fades out by the window's top.

JavaScript measures only to place the shelf covers and to hide the slots that controls cover.

**The camera and the night.** The room never moves: the camera stays at 1. The night (`room-steps.ts`):

| When | Guest | Member |
|---|---|---|
| Load, before the lamp (700 ms after the page starts) | 0.55 | 0.55 |
| Lamp on, card closed | 0.32 | 0.28 |
| Card open | `max(0.04, (moods ? 0.16 : 0.22) − 0.06 × loved)` | 0 |
| Picks shown | 0 | |

The night's opacity eases over 1.4 s.

**Shelf covers.** The start titles (see data) fill the 11 landscape or 12 portrait slots on load; while results are on
show, the shelf shows them instead, flipping each cover (a `rotateY` transform). Each cover bleeds 3.5 % past its slot,
has a transparent pad for anti-aliased edges and a drawn Blu-ray case (a thin clear rim and the blue header band, 8 %
of the cover, no text). Each is a link to its title page, with the lift caption on hover or focus. Covers render after
hydration (they need the measured box); their images use `loading="lazy"` and `fetchpriority="low"` (TMDB `w185`).

## Opening

Guests only. A member's HTML has no boot, no gate script, and no header-hiding CSS.

**Gate.** An inline script first in the stage's HTML, followed by a hidden checkbox `#start-boot-gate`. On a browser
session's first load it sets `sessionStorage["gw-start-boot-seen"] = "1"` and leaves the box unticked (the boot
plays). On later loads it ticks the box, and CSS on `html:has(#start-boot-gate:checked)` hides the boot and its night
cover and turns off every header-hiding rule and the assembly animations, so a returning visitor sees the assembled
page with no flash. Reading storage is in `try`/`catch`; with no storage the boot plays. The checked state is a
property, so hydration sees no mismatch (an `<html data-…>` attribute made React warn in the lab). Keep the script in
`opening/boot-gate.ts` with a unit test of its decision function.

**Timing is CSS.** Scripts start after paint and can be seconds late on slow phones, so the hand-off can't wait for
JavaScript. Every part is a CSS animation with a delay counted from the first paint:

| What | Timing |
|---|---|
| The page assembles | Night 1 → 0.9 over 1.3 s; camera from 1.05 × 1.12 down to 1.12 over 1.8 s; H1, field, then presets and mood button rise in (opacity plus 14 px), 0.55 s each, at 0.15 s, 0.27 s, 0.39 s |
| The boot plays | `Boot` from `app/ui/living-room/intro/boot.tsx` with `boot.css`, sped up: glow 1 s, arc 0.85 s from 0.05 s, G 0.6 s from 0.08 s, "oodWatch" 0.6 s from 0.48 s; no standby dot, no black backing |
| Size and place | Type `min(46px, 12.5vw, 30 % of the band)` on phones, up to 62 px from 640 px and 78 px from 1024 px. The band runs from the header's bottom to the waiting search block's top (the stage's headroom). Owner tweak: center the lockup at about 40 % of the band's height, not 50 % |
| Hand-off | At 1.4 s: the boot fades (opacity 0.6 s) while it shrinks and lifts. Owner tweak: the transform runs at least as long as the opacity with an easing that doesn't settle early (for example `scale(.9) translateY(-12px)`, 0.7 s, `cubic-bezier(.4,0,.6,1)`), so it is still moving in the last visible frame. The header slides down from `translate: 0 -100%` at the same time (0.64 s `cubic-bezier(.22,.8,.24,1)`, opacity 0.42 s), backdrop blur off while it moves. The header's place shows night (`#070c19`) until then. All gone by about 2.1 s |
| Skip | A tap or key anywhere jumps to the hand-off. The gate script adds the listener, so it works before hydration; the tap still reaches the page |
| Reduced motion | The boot holds 0.6 s and fades in 0.3 s; the header only fades; the page's parts only fade |

The boot's band is the stage's headroom above the waiting search block (`--start-headroom`), so the boot never
overlaps the search. The ledge rises in at 0.55 s, after the block's parts.

## Room lighting

`RoomGrade` stacks full-size color layers inside the camera box, between the room and the night, and crossfades them
(opacity, 0.6 s). Port from the lab's `light/tables.ts`:

- `GRADES_E` per grade key: `feelgood`, `funny`, `romance`, `action`, `scary`, `crime`, `mystery` (= crime), `mind`,
  `heavy`, `worlds`, `history`, `growing`. Each layer is `{ bg, blend, o }` with `mix-blend-mode` `soft-light`,
  `screen`, `multiply`, `saturation`, `color`, or `overlay`. Copy the values exactly, including crime at multiply
  0.37 and the bright moods' lifted values.
- `REST_DIM` (multiply `rgb(24 28 40)` at 0.2, saturation gray at 0.14) shows while no grade is on and fades out under
  any grade.
- A word without a grade tints with its own color at `COLOR_STRONG` (0.72) soft-light.

What lights the room: the first pick's first word when it has a grade (a mix leads with its first part), otherwise
the search's reading (the `want` chips' keys through the lab's `GRADE_OF_KEY` table; the most keys win), otherwise
nothing. A typed search grades when its reading arrives, not per keystroke. Port the lab's `GRADE_OF_VOCAB` keyed by
taste-picker ids (`theme:crime` becomes `t:crime`, `style:slow` becomes `s:slow`; moods are `m:<key>`). Drop
`GRADE_WORDS`: the real reading replaces it.

Static layers only: a static vignette per grade is allowed if it is one CSS gradient layer. Nothing animated (grain,
dust, fog, flicker, leak, shafts, flare, lightning, rain, scratches, VHS, the red rim's pulse) and nothing drawn on a
canvas ships now. Check in a trace that the camera's scale with the grade layers stays on the compositor.

## The ledge

The card's box (`ledge/StartLedge.tsx`, `ledge/ledge-models.ts`) is always laid out at the open card's height. Until
it opens, a clip moved down by the hidden height shows only its bottom strip, with the card moved back up inside it;
opening moves both to 0 over 0.75 s, so the clip's top edge slides up (transforms only). The ledge is the floor
strip, at most three quarters of the card's height. No panel: words and posters stand on a soft pool of shadow.

- **Guests:** "Picks for you · Tap three you loved" beside a fan of start titles, labeled **Surprise me**. The whole
  ledge is one button: a tap rolls a random mood and opens the card on its titles.
- **Members:** one big floating button, **Choose what to watch next** (no subtitle, owner 2026-10-29), with **My
  movies** and **My shows** under it (with the Wishlist's and the shows to continue's counts from 640 px). A member
  with nothing on any list sees **Get your first picks**. The open card has the same two links as tabs on its top
  edge, to the right.
- **Both, while searching:** the search's state: placeholders while searching, then the found titles in a row with
  their count; nothing found or an error in words.

Enter, the Search button, a preset, the picker's Done, leaving the field with a search on, a link with a query, or the
ledge opens the card. **Once open, it stays open** (owner 2026-10-29): there is no way back to the ledge.

## Guest card

The open card for guests (`spotlight/SpotlightCard.tsx`):

- **Before any choice** (after clearing a search): a dimmed fan of start titles behind "Tap three you loved" and
  **Surprise me**.
- **Tap three** (`spotlight/TapThreePanel.tsx`, the prototype's design L): a panel whose posters fill its height in a
  row that snaps to each poster (arrows from 640 px, page dots and small arrows on phones), up to 24 titles and See
  all. The header: the heading with **Surprise me**, what's on show as a chip in the first pick's color with the count,
  three hearts for the loved titles, and **See all**. The first loved dims the rest. Nothing found or an error says so
  in the panel with the way on (drop the moods, Retry, Surprise me). The guest's card wants 330, 380, 410 px (378 px
  on short desktops).
- **For you:** the first recommendation with a backdrop, large on it (title, `ScoreRing`, "Because you loved A, B and
  C", **Keep my taste** to `/sign-up`, Details), then "Also for you" (small posters; a tap features one) and **Start
  over**. "Also for you" keeps whole posters per view by container queries (`poster-fit.ts`): 6 on phones, 3 at 768,
  5 at 1024, 6 at 1440, 7 at 1920.

**Loved titles** (`useLovedThree`): tapping a poster saves it with `updateGuestInteraction(mediaType, tmdbId,
"score", 9)` (owner, 2026-10-29: loved is a 9); undoing removes it. Fewer than three carry across searches. Once three are loved, any new choice (a
pick, a preset, a typed search, Clear, Surprise me, Back) empties the three slots and starts over; the saved scores
stay. If `canGuestRate` refuses (the guest has 20 scores), show the existing guest-limit prompt.

**Picks.** Move `findPick` and `recsFor` out of `app/ui/living-room/intro/quiz/taste-quiz.tsx` into
`app/ui/taste/guest-pick.ts` and use it from both: `/api/guest-recommendations` per media type picked (scored items
at 10; with fewer than 5 the server serves Qdrant's recommend-by-example), merged by match, excluding answered titles,
then `/api/intro?cards=` for cards with score and services in the guest's country. Show the For you state once the
cards arrive (the box shows a skeleton until then). No pick: say so plainly in the same box.

## How it works and the intro

`HowItWorksCorner` (H2 "How GoodWatch works"): a crop of the TV corner scene zoomed so the TV is about a third of its
width, the whole crop one button labeled "Watch the intro" with the play circle on the TV; beside it the three
essentials (the lab's `ESSENTIALS`) and one link, "Read how it works" to `/how-it-works`. The picture is lazy.

`IntroTheater` (the lab's camera push-in): pressing the corner pushes the camera into the room until the TV fills the
window, and the intro film (`FilmScreen` mounted standalone, as the lab's `push.tsx` does) fades in on it. Close pulls
back out. Load the film's code and `intro.css` only on press.

The film's last chapter becomes the **Your turn** end card for the start page: one headline, one line, one amber
**Try it**. Add `scenes/your-turn.tsx` and a film list in `film.ts` that ends on it; the TV keeps its quiz ending.
**Try it** (or a few quiet seconds) closes the theater, scrolls the stage into view, focuses the search field when
nothing is chosen, otherwise centers the card and pulses its ring (opacity and transform, 1.5 s).

## Browse

`StartBrowse` (H2 "Where to start"), all rails with real links in the server HTML and arrows on every rail:

| Rail | Data | Links |
|---|---|---|
| Top 10 (Movies, Shows) with big numbers | `getRankedList("movie" \| "show")` (`app/server/best-lists.server.ts`), first 10 | Title pages, `/movies/best`, `/shows/best` |
| New on | `getCountryArrivals({ country, now })` (`app/server/new-on-services.server.ts`) | `/new` hub |
| Moods | Each mood's top titles via the cached legacy `getDiscoverResults` (`app/server/discover.server.ts`) | Mood pages |
| Services | Top services in the country with their popular titles, logos | Service pages |
| Genre cloud with peeks | Genres (8 movie, 7 show) with a few titles each; the peek follows hover, focus, or a tap | Genre pages |

`browse.server.ts` composes these with an in-process cache (30 minutes) per country. The country comes from the
request (it is part of the page cache key). Keep the hub links `below-room.test.ts` requires, or move that test to the
new section.

## Member start

`MemberStart` over the same room (no TV, no boot, no opening steps), behind the ledge's big button (see "The
ledge"):

- **This or that:** two titles from the member's own lists side by side; tapping one keeps it and deals a challenger
  from another list; three taps give tonight's pick with **Watch** (the Watch next hero's button, to the title page).
  "Neither" deals a new pair; **Start over** reshuffles. Nothing is written. The deck (`deck.ts`, from the lab's
  `buildDeck`, with tests): Tonight's pick first, then Continue, Wishlist movies, and For you taking turns, each title
  once; lists with no titles drop out; while For you is still forming (fewer than 10 ratings) its titles wait until the
  own lists run out.
- **Search** above it, the same bar and requests as the guest's (members `GET` Discover results), results in the same
  fixed box.
- **Go deeper doors:** Continue watching, Wishlist, For you, Hot on socials. Ordered by what the member has (doors with
  titles first); the first is open on load and in the server HTML, filled amber with a notch; each section links to
  its page from its header and a last "See all" tile. Empty and sparse states: one slim strip when there is something
  to say ("Bring your ratings" to imports, "Rate a few titles" to `/taste`), then one grid where posters, "add more"
  ghosts, and the end tile fill whole rows. Hot on socials shows its ranked titles inline with why each is talked
  about (`why` from `app/ui/talked-about-now/parts`).
- **First steps** (`member/FirstSteps.tsx`, the prototype's design Path), with nothing on any list: rating a few
  titles as the main step (the ratings so far toward 10, **Start rating**, a fan of start titles), and two rows beside
  it (under it on phones): **Bring your ratings** with the import sources' marks, and **Find something now** with the
  moods' colors. The card wants 470 px on phones and 380 px from 640 px, at most 1240 px wide.
- **Tags:** each side of "this or that" names its list with the shared `ListTag` (`app/ui/list-tag/ListTag.tsx`), one
  color per list everywhere (Continue amber, Wishlist sky, For you violet, Hot on socials rose; My shows' Start
  emerald).
- **Shelf:** the room's covers are the member's Watch next movies; without any, the shows to continue; without those,
  For you. Free cases take the next lists' titles, then everyone's start titles (`memberShelf` in `member-data.ts`).
- **Card size:** 452 px on phones, 500 px from 640 px, and from 1024 px as tall as its width lets the two backdrops
  grow, each capped by the space under the lifted search block. From 1024 px the stage's foot fades into the page's
  gray-900, so the doors follow.

Data (`member.server.ts`; member pages are never cached, so streaming is fine):

| Piece | Source |
|---|---|
| Tonight's pick, movies | `getTonightParts(ctx, taste)` (`app/server/home-doors.server.ts`), through `loadMemberHome` as the TV loader does |
| Continue watching | `getMyShows(viewer, …).continue` (`app/server/my-shows.server.ts`) |
| Wishlist | `getWatchNext(ctx, options)` (`app/server/watch-next.server.ts`) |
| For you | `getDiscoverResults` (`app/server/discover-results.server.ts`) with `forYou: true`, movies and shows; deferred |
| Hot on socials | `getHotOnSocials()` (`app/server/talked-about-now/start-row.server.ts`) when `talkedAboutNowEnabled("row", userId)`; otherwise no door; deferred |
| Ratings count | The member's taste (`loadMemberTaste`) |

Deferred lists come later in the same response (Remix `defer`, `forYouLater` and `hotLater` at the top of the
loader data, presented in the member's language). The door order and the open door are decided before they arrive:
a door whose list is on its way counts as one with titles, so nothing moves when it arrives. The open door's section
is always in the server HTML: when the open door is For you or Hot on socials (no titles on the member's own lists),
the loader waits for that list and defers only the other one. "This or that" deals from the own lists at once; For
you's titles join the deck when they arrive.

## Data sources

| Piece | Source | Where it runs |
|---|---|---|
| Room pictures | `app/img/start-room/` | Server HTML, 103 hints |
| Shelf covers, empty fan | `loadStartTitlesAndPicture` (`app/server/living-room/start-titles.server.ts`) | Loader (shared, cacheable) |
| Search reading and ranking | `/api/combined-search` via `runDiscoverSearch` | Browser |
| Results, moods, counts | `POST /api/discover/results` with `useGuestBody` | Browser |
| Guest picks | `/api/guest-recommendations`, `/api/intro?cards=` via `guest-pick.ts` | Browser |
| Loved titles | `updateGuestInteraction` (localStorage `onboarding_ratings`) | Browser |
| Intro film | `/api/intro` via `FilmScreen` | Browser, on press |
| Browse rails | `browse.server.ts` | Loader (shared, cacheable per country) |
| Member start | `member.server.ts` | Loader (private) |

No backend change is needed beyond the new loader modules. Guests' searches write history rows with no account, as
Discover's do.

## Build steps

Each step is one builder's work, merges into `feat/start-page-redesign` on its own with typecheck, tests, and an
isolated local run green, and leaves the branch working. Steps 2, 3, 5, 6, and 7 can run in parallel after step 1;
step 4 needs step 2; step 8 needs step 2; step 9 comes last.

### 1. Foundation: route, room, assets, state contracts

- Rewrite `_index.tsx` with `startPageLoader` (guest: start titles; member: the member data shell), guest and member
  branches, `START_AFTER_PAINT`, `START_SHEETS`, meta. Drop `introStartScript` and the TV from `_index.tsx`; keep
  `app/ui/living-room/` and `tvHomeLoader` in place, unused. `/?tv=…` loads the new page and ignores the parameter.
  The branch isn't deployed before step 9, so `/` on `main` keeps the TV until then.
- Assets, `StartRoom` (picture, CSS placement, camera box, night layer), `scene.ts`, `homography.ts`, `ShelfCovers`.
- `StartStage` with the H1 and fixed slots for the search block and the card; `useStartQuery` and the `StartResults`
  type (status, cards, reading, total, query signature) as the contract steps 2 to 4 build on.
- Accept: server HTML has the H1 and the room picture at full opacity; LCP is the room picture at 375 × 740; CLS 0 at
  every listed size; shelf covers land in their slots in perspective at all sizes; tests for `homography.ts` and the
  placement math.

### 2. Guest search

- `StartSearchBar` (bar d), presets, debounce 800 ms, Enter and Search, reading row with `ReadAsChips`,
  `useStartSearch` wired to `/api/combined-search` and `/api/discover/results`, See all URL, error and 503 handling.
- Accept: unit tests with mocked `fetch`: typing searches once after the pause, presets search their exact phrase,
  changing picks re-filters without a new search, stale responses are dropped, See all carries text and picks; the
  bar's box never changes height between presets and reading.

### 3. Mood picker and room lighting

- Export `ChoiceTile`, `Heading`, `PanelHead`; add the scrim prop to `PickChip`; `StartMoodPicker`, `mixes.ts`, counts
  from `optionCounts`, panel height rule.
- `grades.ts` and `RoomGrade`.
- Accept: `mixes.test.ts` covers every rule in [Mood picker](#mood-picker); the grade test maps every word id and
  reading key; the panel never moves the page behind it; trace shows no paint work per frame while the grade
  crossfades and the camera scales.

### 4. Spotlight card and guest picks

- `SpotlightCard`, `PosterPager` (four per view on phones), `LovedSlots`, `ForYouPanel`, `useLovedThree`,
  `guest-pick.ts` (moved from `taste-quiz.tsx`, the TV quiz uses it), the opening steps' night and camera values.
- Accept: whole posters only at every listed size; arrows page once each way; loved titles appear in
  `onboarding_ratings` and leave it on undo; the reset-after-three rule holds; the TV quiz tests still pass.

### 5. Opening boot

- `boot-gate.ts`, `OpeningBoot`, `opening.css`: CSS-timed assembly, the large boot with the owner's two tweaks, the
  header slide (CSS on `[data-site-header]`, blur off while moving), skip, reduced motion.
- Accept: first load in a new tab plays it; a reload in the same tab shows the assembled page with no boot frame (record
  the first frames); a member's HTML has none of it; with scripts delayed 5 s the hand-off still happens at 1.4 s; the
  boot never overlaps the H1 at the listed sizes; the shrink is still moving in the last frame with opacity above 0.

### 6. How it works and the intro theater

- `HowItWorksCorner`, `IntroTheater`, `scenes/your-turn.tsx`, the start page's film list, Try it hand-off.
- Accept: the film's code and `intro.css` load only on press; Close and Try it return to the page at the right place;
  the intro's existing tests pass and a new test covers the film list ending on Your turn.

### 7. Browse

- `browse.server.ts` and `StartBrowse` with the five rails.
- Accept: every rail's links are in the server HTML; loader time on a warm cache is under 50 ms; the hub links test
  passes; arrows work by keyboard.

### 8. Member start

- `member.server.ts`, `MemberStart`, `ThisOrThat`, `deck.ts`, `Doors`, `FirstSteps`, member search.
- Accept: `deck.test.ts` covers full, few, no shows, no wishlist, and new members (the lab's personas); no writes on any
  tap; the open door is in the server HTML; doors never change height.

### 9. Cut-over and checks

- Early hints: replace `ROOM_ART`, `PHONE_ROOM_ART`, `HAND_IMAGE`, `HOME_SHEETS` for `/` in `server/early-hints.ts`
  and `early-hints.server.ts` with the start room and `START_SHEETS`; update `early-hints.test.ts`.
- Benchmark: update `goodwatch-benchmark/urls/budget.json` `surfaces.home.lcp_element` to `/assets/start-room-phone-`
  and recalibrate only what measurements justify, with a note.
- Docs: update `CONTEXT.md` (Living room, Start titles, Intro, TV home now describe the new page and the TV's new
  place), mark `docs/implementation/home-intro.md` as superseded for `/`, and record the shipped state here.
- Checks on a local production build behind TLS and HTTP/2 (memory note `start-page-mobile-speed`): mobile LCP and
  score over 9 runs against the old page, CLS, one H1, links in the HTML, page cache stores the guest page (same HTML
  on two guest requests), no `.env` anywhere near the run. Then merge to `main` (push deploys through Coolify).

## Risks

- **Search plus moods filters strictly.** The lab re-ranked fixture lists that barely overlapped; production filters
  the ranked list by the moods, so a search plus three moods can leave few or no titles. The card needs a good empty
  answer ("Nothing matches all of these" with a one-tap way to drop the moods).
- **Cost.** Every typed search and preset is a paid Jev reading. The 800 ms debounce and the reading cache keep it
  down; watch `chargedNano` after launch.
- **Counts cost.** `optionCounts` runs the full filter pipeline per request with no shared cache. One request per pick
  change is the budget; don't fetch per tile.
- **HTML size.** The browse rails and stage may pass the 52 KiB `html_bytes` cap. Keep CSS in files and trim card
  markup before raising the cap.
- **Late scripts.** Anything the first screen needs must work from CSS alone, since scripts start after paint.
- **Blend layers.** `mix-blend-mode` over a full-screen picture under a scaling camera can cost paint work on weak
  phones; trace it in step 3.
- **Upscaled room.** The scene source is 1536 px wide; on large screens it is softer than the old 1920 px room.
- **Removed stand-ins.** The lab answered themes and styles with the nearest mood's list and showed list sizes as
  counts; real counts and results will differ, and some words may return few titles in small countries.

## Shipped state

What step 9 changed beyond the steps' own work, and what the checks found (local production build behind TLS and
HTTP/2 with 103 hints, fixtures for the shelf, Where to start and the members, search and pick answers mocked):

- **Integration.** Members have the mood picker; its counts read "N on your services" with saved services. The picker
  reads its counts from the query's own results answer (`StartResults.optionCounts`, with the search's `ranked`
  list), so a pick change asks once; only the open picker with nothing asked sends its own request, built from the
  results request's query. One services-scope rule (`resultsScope`) serves both. A whole mix shows by its name in the
  bar's reading row and the card's line. The presets row rises at 0.39 s with the mood button. Try it's ring is
  concentric with the card (`--spotlight-radius`).
- **103 Early Hints for `/`:** `START_SHEETS` (five sheets), the phone or landscape room AVIF by `Sec-CH-UA-Mobile`, and
  the dock's white G. Hinting three sheets instead of five measured no steady LCP gain (both bimodal), so all five
  stay on the first paint; none of them can load later without a flash.
- **First-view weight.** Where to start has `content-visibility: auto` with its height reserved, and its rails read
  their geometry only once near the screen. The TV corner's picture and the card's fan render after hydration. The
  dock's white G asks with low priority (Chrome often fetches it apart from its hint, and it then counted toward LCP).
- **Checks (guest at 375 × 740, 390 × 844, 768 × 1024, 1024 × 768, 1440 × 900, 1920 × 1080; members full, few, new,
  no shows):** one H1; title, hub and How it works links in the server HTML; LCP is the room picture (phone file up to
  640 px wide); CLS 0 through boot, preset search, mix pick, three loved and For you; no horizontal scroll; no
  hydration errors; the boot plays once per tab session and not for members. The page cache stores the guest page
  (two requests, the same HTML).
- **Mobile Lighthouse (9 runs, medians, CPU-capped as the generator):** score 72 (old TV page 74), LCP 1.66 s (old
  1.10 s; both bimodal), CLS 0, HTML 29 KB compressed (budget 52 KiB). Local TBT is far above the generator's for both
  pages (new 1.78 s, old 1.45 s). The budget file's image and byte caps for home are raised to the measured values; its
  LCP, TBT and score caps wait for a generator run after deploy. Desktop (3 runs): score 79 (old 84), LCP 0.53 s
  (old 0.36 s).

- **Streamlined start (2026-10-29, prototype `prototype/start-streamline`, rounds 1 to 6):** the room framed with
  the window in view and never moving, the dim load and the lamp, the search over the window with the boot above it,
  the ledge (guest Surprise me, member big button with My movies and My shows), the card growing up from it and
  staying open, the guest's tap-three panel (design L), and the new member's first steps (design Path).

## Follow-ups

- **Mood effects lab:** the owner wants a lab for the mood-to-effect mapping after this ships (the lab's `EFFECTS_E`,
  `effects.tsx`, and `?fx=` explorer are the starting point).
- **TV easter egg:** the old TV home on 404 pages or elsewhere, from the kept `app/ui/living-room/` code; then remove
  what it doesn't use (the TV way-back bar in `app/app.tsx` and `MobileDock.tsx`, the `?tv=` handling).
- **OG image for `/`:** `/og/index.jpg` still shows the old room.
- **Mobile LCP against the old page:** 1.66 s against 1.10 s locally. The slow runs are the ones where Chrome fetched
  the white G apart from its 103 hint; a smaller phone room picture (114 KB, the old one was 37 KB plus the 36 KB hand)
  made no difference in Lighthouse's simulation but may on real slow phones.
- **Generator budget run** (`./bench.sh budget`) after deploy, to calibrate home's LCP, TBT and score caps.
- **Larger scene source** if the owner finds the room soft on large screens.

## Owner answers

1. **Score for a loved title:** 9 (owner, 2026-10-29). It shows as the guest's rating and counts toward the 20 guest
   ratings.
2. **Mix tile counts:** mix tiles show their parts line, and only single moods, themes, and styles show counts
   (owner, 2026-10-29).

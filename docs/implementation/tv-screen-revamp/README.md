# The new TV on the start page: implementation plan

This plan takes the approved TV prototype to production. It says what happens to today's living room code, how
the new TV's state machine works, where each TV screen gets real data, how the Expand key hands over to a real
page, which budgets apply, and in which slices to build it.

Status: a plan, written on October 13, 2026 against `origin/main` at `a6b28b08` and amended the same day with
the owner's answers. Slices 1 and 2 are being built. Four parts of the design are being prototyped again and
wait for their results: see [What waits for a prototype](#what-waits-for-a-prototype). What is decided and what
is still open is in [Decisions for the owner](#7-decisions-for-the-owner).

Every thread that builds a slice starts here and needs nothing else to begin.

## Sources

- **The approved prototype:** branch `prototype/tv-screen-flow`, commit `fc5cc15b`. It is a local branch (not on
  `origin` on the day of writing) and is never merged. Read it with `git show prototype/tv-screen-flow:<path>`.
  - The design round: `goodwatch-webapp/app/ui/prototype-tv-design/` (`scene.tsx`, `base.tsx`, `cinema.tsx`,
    `pointing.tsx`, `phone-room.tsx`, `phone-remote.tsx`, `art.ts`), route `prototype.tv-screen-design`.
  - The flow round: `app/ui/prototype-tv-flow/` (`engine.tsx`, `data.ts`, `kit.tsx`, `apps.tsx`).
  - The notes with screen maps, sizes and measured numbers: `docs/prototypes/tv-screen-design/README.md` (with
    `sizes.json`, `screens/cinema/`, `viewports/`, `walk.mjs`, `shots.mjs`) and
    `docs/prototypes/tv-screen-flow/README.md`.
- **A production build cannot import prototype files.** `vite.config.js` stops the build when a module of the
  build is a prototype file (`goodwatch-webapp/vite.config.js:96-101`, `:136-139`). Code is carried over by
  rewriting it in real files, never by importing it.
- **The glossary:** [CONTEXT.md](../../../CONTEXT.md). This plan uses its terms: Living room, TV, TV screen,
  Remote, Start titles, Mood, Island, Side of you, Taste, Tonight's pick, My shows, My movies, Want to See, Seen,
  Wishlist, Next episode, New episodes signal.
- **The rules for the webapp:** `goodwatch-webapp/AGENTS.md` (loaders for first paint, TanStack Query for the
  rest without a custom `staleTime`, `./bench.sh budget` after a change to a landing surface, lazy code on first
  use, `assetUrl` while rendering).

Paths below are relative to `goodwatch-webapp/app/` unless they start with `docs/`, `goodwatch-` or `prototype`.
"The prototype" with a path means that file on the prototype branch.

## What is fixed

Approved by the owner; this plan does not reopen any of it. The owner has reopened four parts since; they are in
the next section.

- **The flow "apps":** home with large app tiles and a preview of the focused one; Tonight, Discover, Explorer,
  Taste and, for a member, My shows as mini apps on the TV; a title screen; search; the menu. A guest's steps are
  the prototype's.
- **The look "Cinema".** Marquee and Glow are dropped.
- **Two ways out of the TV, no more:** the Expand key (amber corner brackets with the label "Expand", at the
  picture's bottom right on desktop and phone, with the growing frame), and "Watch on <service>". No "Open full X"
  label anywhere.
- **The top bar on every screen:** Back, Search and Menu where they apply.
- **Desktop:** the Remote under the TV, swinging toward the cursor; the TV as large as measured; the Remote
  beside the TV in small windows (below about 918 px of height or 1110 px of width); no TV type under 18 px in the
  under layout; a ring pointer over the picture, the item under it takes the focus, a click is OK.
- **Phone:** one screen without scrolling; a framed TV on the teal wall with its stand and the sideboard under
  it; the real Remote in the hand, lying on the table in short windows; touch pointing (a tap and a held press
  with the ring, a held press points under the finger, the ring steps out on a drag).
- **The room photo stays**, softened in the image file, not by a live blur. The start page's label is "Home"
  (`ui/navigation/destinations.ts:62-65` says so already).
- **Every `REC_*` flag is on** in production (`server/features.server.ts:13-25`). The plan names the flag-on
  pages only: `/discover?moods=`, `/explorer`, `/taste`, `/my-shows`, `/my-movies`. The flags themselves are
  removed in [slice 15](#slice-15-the-rec_-flags-go).

## What waits for a prototype

On October 13, 2026 the owner sent four parts of the approved design back to prototyping. Other threads build
those prototypes. Until a result is in, the text about these parts further down describes the first prototype
and is provisional; each place says so.

| Part | What is being prototyped | What it changes here | Build now | Wait |
| --- | --- | --- | --- | --- |
| Mini Discover's choice screen | Three tabs, Moods, Themes and Styles, with six options each, in place of one grid of moods | The `discover` screen, its URL keys and items in the machine (slice 1); the data behind a choice ([Mini Discover](#mini-discover)); slice 6 | The list of titles for a choice that is already made, read with `useDiscoverResults`; its Expand address; what it shows for a 503 and for an empty result | The choice screen itself, its items and tabs, and where Themes and Styles get their titles |
| The quiz's answers | A rating strip from low on the left to high on the right, with labels and the ten exact scores, in place of four answers | The `quiz` and `rate` screens' items in the machine (slice 1); the `rate` screen of slice 5; slice 8 | Taste's three states, a side, the quiz's frame (the title, its picture, the progress) and its wiring to `useTasteQuiz`, which takes any score from 1 to 10 already | The answer control, its item ids, its keys, and its wording |
| The Expand transition | Several transitions, compared | [The hand-over](#the-hand-over) in section 4; slice 11 | What travels to each page, Back into the same TV screen with the same focus, the reload case, plain navigation with reduced motion | The frame while the key has the focus, the motif's motion, the brackets, the timing |
| The Remote's Netflix and Prime Video keys | A key opens a "watch on this service" TV screen, in place of narrowing the list on show | The `service-key` action and a new screen in the machine (slice 1); the toast and the `service` key in the URL; the parts of slices 2 to 5 named below | The two keys on both Remotes, sending `service-key` with the service's name as today (`ui/living-room/Remote.tsx:190-221`) | Everything a press does: no toast, no narrowing, no `services=` on an Expand address until the result is in |

**For slice 1, which is running:** keep each of these four behind one function of the machine (the items and
transitions of `discover`, the items of `quiz` and `rate`, the transition of `service-key`), so that a result
changes one place and its tests. The `service-key` transition does nothing for now.

**A gap the Discover prototype must close.** Discover's filters have moods and genres, and no themes or styles
(`domain/filter-state.ts:163-211`). Themes and Styles exist as groupings of the Explorer, with 14 and 10 islands
(`domain/explorer.ts:7-15`, `server/explorer/islands.server.ts:150`, `:254`). Six options per tab can be drawn from them, but
their titles would then come from `/api/explorer/map?grouping=theme` and `style`, and Expand would have to open
the Explorer at that island, or Discover needs two new filters. The prototype's result has to say which.

## 1. What exists today, and what happens to it

Read from the code on `origin/main`. "At the switch" means the pull request that puts the new TV on `/`
([slice 13](#slice-13-the-switch)); "cleanup" is the one after it.

### The TV and the room (`ui/living-room/`)

| File | What it is today | Verdict | Why, and what carries over |
| --- | --- | --- | --- |
| `tv-flow.ts` (854 lines) | The pure TV flow: `transition(state, action, context)` returns the next state, a history instruction and effects (`:173-177`, `:752`). Screens home, about, services, this-or-that, moods, picks, title, search, quiz (`:66-82`). The screen and focus live in the URL (`:185-298`). Focus is one list per screen (`tvItems`, `:318-357`); all four arrows step through it (`:772-780`). The menu, the Remote's keys and a member's doors leave the TV in one press (`:553-556`, `:662-670`) | **Replace** with a new machine; delete at cleanup | The screens, the focus model and the exits all change. What carries over is its shape, see [section 2](#2-the-new-state-machine): the pure function, `readTvState` and `writeTvParams`, `isTvOnlyChange` (`:304-313`), power and boot (`:757-769`), the menu as an overlay outside the URL (`:93-95`), the history depth (`:96-97`), Back's rules (`:490-507`). Two exports are used elsewhere and must move first: `DOOR_HREF` (`:40-44`, imported by `server/tonight.server.ts:16`) and the type `Night` (`:60-64`, imported by `server/living-room/picks.server.ts:12`) |
| `tv-flow.test.ts` (835 lines, 85 tests, `node:test`) | 14 groups, from "TV state in the URL" (`:52`) to "a member's home with doors" (`:780`) | **Replace**; delete at cleanup | The new machine gets its own test file in the same style. The groups whose subject stays are ported: URL round trip, focus, Back, Home and deep links, the menu, the streaming keys, power and boot, loader revalidation |
| `use-tv-flow.ts` (81 lines) | Binds the flow to the router: the screen and focus from the URL, power and the menu from React state, the depth from the history entry's state (`:27-38`); every transition navigates with `preventScrollReset` (`:49-60`); the boot timer (`:66-70`) | **Replace** with a new hook of the same job | Kept: where each part of the state lives. Changed: a focus move no longer navigates, and the hook measures the items for a direction move, see [the focus model](#the-focus-model) |
| `tv-transition.ts` (120 lines) | Leaving through the TV with the View Transitions API (#232): `useLeaveThroughTv` (`:86-102`), `useReturnIntoTv` (`:109-120`), the TV's box as a clip inset (`:29-38`), plain navigation with reduced motion or without the API (`:21-27`). Its CSS is in `main.css:87-128` | **Keep, and extend** | It is the Expand key's hand-over already. [Section 4](#4-the-expand-key-into-a-real-page) adds the frame around the picture and the brackets |
| `TvScreens.tsx` (1293 lines) | The desktop screens on a 960 x 528 canvas, and parts both editions share: `Item` (`:153-183`), `Boot` (`:138-150`), `whereLine` (`:259-266`), the guest home whose headline is the page's H1 (`:185-196`, `:294-320`), the on-screen keyboard (`:1076-1145`), an interim search over the titles already on the TV (`:1147-1159`), the bar and the menu (`:1190-1293`) | **Delete** at cleanup | Every screen is redrawn in Cinema. Carried over as ideas: `Boot` with its CSS (`living-room.css:780-819`), `whereLine` and the watch key's three labels (`:1024-1028`), and the rule that the guest home is the same HTML for every guest with one H1 (`:294-296`) |
| `PhoneTvScreens.tsx` (1004 lines) | The phone edition on a 560 x 308 canvas (`:1-5`), and the copy drawn inside the desktop scene before the window is measured, whose headline is not an H1 (`:54-56`) | **Delete** at cleanup | The new screens draw both editions from one module, as the prototype's `cinema.tsx` does, on a 500 x 417 phone canvas. The two-editions-in-the-HTML technique stays, see [SSR and hydration](#ssr-and-hydration) |
| `TvQuiz.tsx` (580 lines) | The taste quiz on the TV: four levels over a 1 to 10 strip, "Keep these 5?", picks three at a time (`:1-5`) | **Delete** at cleanup | The new quiz is one question with four answers. It keeps using `useTasteQuiz` (`ui/taste-quiz/use-taste-quiz.ts:24`) |
| `Remote.tsx` (441 lines) | The Remote the owner chose in the Remote prototype, already shipped (`:1-4`, commit `b9df2353`): power, Menu, the wheel with OK, Back, Search and Home in an arc, two streaming keys. The prototype's `HugRemote` with `streaming="arc"` is this component. The wheel's four arrows send `step` forwards or backwards (`:401`) | **Change**, small | The wheel's arrows send their direction. The prototype's only change to the file is that (`onDirection` on `Wheel`). Dragging around the wheel and scrolling over it keep stepping (`:331-347`, `:360-379`). `ICON` and `Icon` stay. `APP` (`:26-58`) goes at cleanup: its addresses move into the machine's destinations |
| `LivingRoom.tsx` (665 lines) | The start page's scene: chooses the phone scene (`:109`, `:305-317`), renders the section below the room (`:297-304`), keeps a guest's services and answers in `localStorage` (`:97-124`), runs the quiz hook (`:129-137`), carries out effects (`:158-189`), the keyboard (`:505-607`), measures the window once per resize (`:223-239`), turns the Remote at most 6 degrees with a `framer-motion` spring (`:242-274`), and draws the desktop scene, placed by CSS until measured (`:73-78`, `:330-500`) | **Replace**; delete at cleanup | Patterns that stay: `useIsoLayoutEffect` (`:70-71`), measuring once per resize, the CSS-placed first paint, `inert` while the room is out of the window (`:336`), `useReturnIntoTv` (`:113`), the keyboard handler's guards (`:535-548`). Gone: the stored choices, the spring (the pointing loop replaces it), the quiz effects (`:610-665`) |
| `PhoneLivingRoom.tsx` (386 lines) | The phone scenes: portrait with the room photo, the TV on top and the Remote in the hand; landscape with a Remote that lifts (`:114-131`, `:274-291`). `usePhoneOrientation` and its two media queries (`:50-73`) | **Replace**; delete at cleanup | Portrait becomes the prototype's framed TV in the room. Landscape was not in the prototype ("Not built: swiping, landscape"); the owner has decided it: the TV on the left and the phone's Remote on the right, see [slice 4b](#slice-4b-phone-landscape) |
| `room.ts` (288 lines) | Geometry, pure: the photos and where the TV sits in them (`:16-28`, `:135-142`), the canvases (`:33`, `:145`), the Remote's size and the hand (`:36-46`), `layoutRoom` (`:64-111`), `layoutPhone` (`:211-270`), the two turn functions (`:117-127`, `:276-288`), `PHONE_LIP` (`:151`). It has no tests | **Change** | The photo, hand and Remote constants stay. `layoutRoom` and `layoutPhone` are replaced by the prototype's `layoutRoom` (`scene.tsx:105-147`) and `layoutPhoneRoom` (`phone-room.tsx:41-90`), written as pure functions with tests. The turn functions go (pointing replaces them). Until the switch the new functions live in a new file, because the old scene uses the old ones |
| `living-room.css` (819 lines) | The Remote's materials (`:38-128`), the first paint placed by CSS, mirroring `layoutRoom` and `layoutPhone` (`:147-265`), the room as the first screen of a page with its lock, the lip and the section below (`:267-778`), the boot screen (`:780-819`) | **Change** | Stays: the Remote, the page lock, the lip, the section below, the boot. Rewritten: the first-paint mirror, for the new layouts. Added: Cinema's rules, the pointer, the phone's room. The route must end up with one stylesheet of its own, see [script and byte budgets](#script-and-byte-budgets) |
| `HomeDoors.tsx` (289 lines), `home-doors-code.tsx` (38 lines) | A member's three doors (Continue, Start a show, A movie), which leave for My shows and My movies on the first press, with the New episodes and landed signals (`HomeDoors.tsx:1-16`). A chunk only a member with doors requests, drawn after hydration (`home-doors-code.tsx:1-7`) | **Delete** at cleanup | The new home has app tiles for everyone, and nothing on it leaves the TV. What the doors said moves to the Tonight and My shows tiles, see [decision 6](#7-decisions-for-the-owner). `home-doors-code.tsx` is the template for every lazy chunk of the new TV |
| `BelowRoom.tsx` (179 lines), `use-below-room.ts` (243 lines), `below-room.test.ts`, `below-room-render.test-support.tsx` | The section below the room (#352): the 16 start titles and the hubs as links in the server HTML, the lip as the way down, and the hook that owns how the page moves between the room and the section | **Keep**, untouched | The start page's links for crawlers. The new scene must keep the contract they rely on: the room is a block with `id="room"` that is `inert` while away, and the lip lies over its bottom edge (`living-room.css:368-394`, `:452-478`). The prototype's scene is `fixed` and fixes the body (`scene.tsx:184-195`, `:348`); that part is not carried over |
| `living-room-data.ts` (264 lines) | The page's data types and the pure logic of a night's picks: `LivingRoomTitle`, `StartTitle`, `LivingRoomData` (`:11-45`), `HomeDoors` (`:51-81`), the choices (`:92-114`), the streaming keys (`:117-132`), `titlesFor`, `moodCounts`, `tvContextOf` (`:170-264`) | **Change** | Stays: `LivingRoomTitle`, `StartTitle`, `REMOTE_SERVICES` and `remoteServiceName`. Goes at cleanup: the pairs, the choices, the night logic, `HomeDoors` as a home type. The data type changes with the loader, see [section 3](#3-real-data-per-screen) |

### Routes and server

| File | What it is today | Verdict | Why |
| --- | --- | --- | --- |
| `routes/_index.tsx` (221 lines) | The start page: the loader re-export (`:29`), `shouldRevalidate` so TV steps never rerun the loader (`:34-42`), the stylesheet and a preconnect to `image.tmdb.org` (`:44-47`), the page's meta, alternates and JSON-LD (`:49-102`), the pool request after first paint (`:110-133`), and the effects: leaving, Want to See, Seen, Not for me with its undo (`:167-213`) | **Change** at the switch | The meta block is not touched (`docs/verification/235-living-room-seo.md`). The component, the data hooks and the effects are the new TV's |
| `routes/living-room.tsx` (5 lines) | `/living-room` answers 301 to `/` with its query | **Keep** | Old links keep working. The new `readTvState` also reads the old screen names, see [the URL](#the-url) |
| `routes/api.living-room.ts` (2 lines) | The start page's loader again, at `/api/living-room` | **Delete** at cleanup, after the owner confirms nothing outside the repository calls it | No caller in `goodwatch-webapp/app`, `goodwatch-benchmark` or `docs` (searched) |
| `routes/api.living-room.picks.ts` (12 lines) with `server/living-room/request.server.ts` (112 lines) | `?view=pool` returns the pool (`request.server.ts:97-100`); without it, three picks for a mood, a source and a service. Members GET; guests POST their browser's progress (`:11-27`, `:76-96`) | **Keep the pool view, change its payload** | The pool view is the only form the app calls (`routes/_index.tsx:123`). The benchmark replays that request (`goodwatch-benchmark/README.md:113`, `scripts/test-page-view.sh:38`, `smoke/urls.json:318`). The picks form has no caller in the app and goes at cleanup |
| `routes/api.living-room.services.ts` (45 lines) | The services of a country, for the services screen | **Delete** at cleanup | The services screen is gone and nothing in the app calls the route. `docs/cache-identity.md:79` and `:129` name it and need the same edit |
| `server/living-room.server.ts` (105 lines) | The loader. A guest gets an empty contract and the start titles, so the HTML is the same for every guest (`:20-46`). A member gets every Wishlist card, the saved services and, with `REC_TRACKING`, the doors (`:47-91`) | **Replace** at the switch by a new loader built beside it | The guest part is the same plus the first picture. The member part gets lighter: no Wishlist cards, see [section 3](#3-real-data-per-screen) |
| `server/living-room/data.server.ts` | `livingRoomAuth` (`:17-27`) and `livingRoomServices` (`:29-46`) | **Keep** | The cache policy of the page, and the names behind the streaming keys |
| `server/living-room/pool-keys.server.ts` and its test | The pool's candidates, kept per snapshot version and day (`:36-64`), a viewer's keys (`:71-125`), the start titles' keys (`:141-143`) | **Keep** | The start titles and the pool both read it |
| `server/living-room/pool.server.ts` (121 lines) | The pool: the best six and three per mood as cards, the member's whole Wishlist as cards, the services, the this-or-that pairs (`:30-93`) | **Change** | The pairs (`:20-28`, `:62-83`) and the Wishlist cards (`:96-121`) go. The cards stay as the TV's art and a guest's Tonight |
| `server/living-room/picks.server.ts` (97 lines) | Three picks for a night; it walks the whole snapshot on every request (`:47-83`). `rankOf` (`:21-24`) is used by the pool | **Change**: keep `rankOf` and `LivingRoomUnavailable`, delete the rest at cleanup | Mini Discover reads Discover's own results instead, so the TV and the page show the same titles |
| `server/living-room/start-titles.server.ts` and its test | The 16 start titles from the snapshot and the display fields (`:18-45`) | **Keep**, one field added | The first start title lends the guest home its first picture |
| `server/living-room/wishlist.server.ts` (84 lines) | A member's Wishlist keys and mood counts, kept in Redis for 60 seconds (`:31-84`) | **Delete** at cleanup | Only the loader's Wishlist cards use it (`server/living-room.server.ts:50`) |
| `server/home-doors.server.ts`, `server/tonight.server.ts` | `getTonightParts` (`home-doors.server.ts:41`): a member's My shows and first movies for tonight. `getTonightsPick` (`tonight.server.ts:88`) | **Keep**; `homeDoorsOf` (`home-doors.server.ts:121`) goes at cleanup | They become the read behind a member's Tonight and My shows on the TV |
| `domain/living-room.ts` | The type `LivingRoomPicks` | **Delete** at cleanup, with the picks | |
| `main.css:87-128` | The grow and shrink keyframes of the TV transition | **Keep, extend** | They must stay in `main.css`: the living room's stylesheet is gone by the time the next page animates in (`ui/living-room/tv-transition.ts:6-8`) |
| `ui/DiscoveryContinuity.tsx:53-58` | Leaves the start page's scroll position alone | **Keep** | Unchanged |

## 2. The new state machine

### What the prototype's engine does, and what is taken from it

The prototype's engine (`prototype-tv-flow/engine.tsx`) is a React hook that holds everything: the stack of
screens in React state, mirrored into `?at=home.discover.discover-cozy` with `history.replaceState` (`:120-132`),
the focus of every screen on the stack (`:136-140`), the direction rule read from the DOM (`:244-277`), a store of
made-up person data (`:141`), and the expand run as a frame loop that sets React state on every frame
(`:195-241`). Screens carry their behaviour as closures (`base.tsx:112-246`), and OK is a click on the focused
element (`engine.tsx:324`). None of it is a pure function and none of it has tests.

| Part of the prototype | Taken as it is | Rewritten |
| --- | --- | --- |
| The direction rule (`engine.tsx:244-277`) | The rule itself, line for line | As a pure function over boxes that are passed in, with tests |
| Which screens exist and what each shows (`base.tsx:112-246`, the two READMEs' screen maps) | The screens, their items and their order | As a typed screen union and a pure transition function. Behaviour moves out of closures into actions and effects |
| The stack in `?at=` and `history.replaceState` | Nothing | One TV screen per browser history entry, as today. The prototype's own notes ask for it (`docs/prototypes/tv-screen-flow/README.md`, "Not in this round") |
| The focus per screen, given back on Back (`engine.tsx:136-152`) | The behaviour | Kept per history entry, see [the focus model](#the-focus-model) |
| The focusable item `F` (`kit.tsx:45-97`) | Its markup contract: `data-tv-item`, `aria-current`, a real `<button>` | It dispatches `focus` and `choose`, as today's `Item` does (`ui/living-room/TvScreens.tsx:153-183`) |
| The keyboard (`engine.tsx:371-405`) | The key map | Merged with today's handler and its guards (`ui/living-room/LivingRoom.tsx:535-548`) |
| The expand run's clock (`engine.tsx:195-241`), the stand-in page (`scene.tsx:397-419`) | Nothing | The real hand-over is the View Transition of `tv-transition.ts` |
| The store: Want to See, ratings, the quiz, the service, the draft (`engine.tsx:141`, `:347-368`) | Nothing | Real mutations and hooks, as effects |
| Pointing (`prototype-tv-design/pointing.tsx`) | Almost all of it: one listener, one frame loop that stops at rest, no React state on a move | Its `focus` callback dispatches to the machine; it loads as a lazy chunk; it does nothing while the room is away |
| The Cinema screens (`prototype-tv-design/cinema.tsx`) | The layout numbers, the sizes, the class recipes | Over real data types; no `Skin` object (there is one look); the CSS string (`:12-27`) and the scene's (`scene.tsx:53-64`) move into the stylesheet |
| The room's layout (`scene.tsx:105-147`, `phone-room.tsx:41-90`) | The formulas | As pure functions with the README's tables as test cases; the phone gets the lip's reserve |
| The phone's Remote (`phone-remote.tsx`) | The component | It dispatches TV actions |
| `data.ts`, `art.ts` | Nothing | Sample data |

### The contract

The same as today's (`ui/living-room/tv-flow.ts:1-11`), in a new file:

```ts
transition(state: TvState, action: TvAction, context: TvContext): {
	state: TvState
	history: "push" | "replace" | "back" | "none"
	effects: TvEffect[]
}
```

The machine never fetches, never measures and never touches the browser. `TvContext` is what the page knows:
whether the person is a member, whether they have a taste, and the ids of what is on the screen (titles, moods,
islands, sides), as `pickKeys` is today (`tv-flow.ts:100-123`).

### The screens

| Screen | In the URL | Items, in reading order | Expand |
| --- | --- | --- | --- |
| `home` | no `tv` | `app:tonight`, `app:discover`, `app:explorer`, `app:taste`, and for a member `app:shows` | No |
| `tonight` | `tv=tonight`, `pick=1` | `details`, `another` | Yes |
| `discover` without a mood | `tv=discover` | `mood:<key>` for every mood, `mood:any` last | Yes |
| `discover` with a mood | `tv=discover&mood=<key>`, `service=<name>` | `title:<key>` for up to four titles, `change-mood` | Yes |
| `explorer` without an island | `tv=explorer` | `island:<id>` for six islands | Yes |
| `explorer` with an island | `tv=explorer&island=<id>` | `title:<key>` for up to four, `hop:<id>` for two islands next door | Yes |
| `taste` without a side | `tv=taste` | Without a taste: `start-quiz`. With one: `side:<id>` for each side, `start-quiz` ("Rate more") | Yes |
| `taste` with a side | `tv=taste&side=<id>` | `title:<key>` for up to four | Yes |
| `quiz` | `tv=quiz` | `answer:loved`, `answer:liked`, `answer:disliked`, `answer:skip` | No |
| `shows` (a member's) | `tv=shows` | `title:<key>` for up to three Next episodes and up to three shows to start | Yes |
| `title` | `tv=title&title=<key>` | `watch`, `want-to-see`, `seen` | Yes |
| `rate` | `tv=rate&title=<key>` | `level:9`, `level:7`, `level:5`, `level:3` | No |
| `search` without a query | `tv=search` | `go` once two characters are typed, then `idea:<text>` | No |
| `search` with a query | `tv=search&q=<text>` | `title:<key>` for up to four | Yes |
| `about` | `tv=about` | `got-it`, `rate` | No |

- **On every screen** the items end with `expand` (where the table says yes) and the top bar: `bar:back` (not on
  home), `bar:search` (not on the search screens), `bar:menu`. This is the prototype's table in
  `docs/prototypes/tv-screen-design/README.md`, "The top bar".
- **The menu** is an overlay, not a screen: `menu:home`, `menu:search`, `menu:sign-in` for a guest,
  `menu:about`, `menu:off`. It is React state and not in the URL, as today (`tv-flow.ts:93-95`). The prototype's
  "Account" entry is left out, see [decision 7b](#7-decisions-for-the-owner).
- **Power and boot** stay as they are (`tv-flow.ts:757-769`, `use-tv-flow.ts:19`, `:66-70`). The phone's Remote
  has no power key; "Turn off" is in the menu, and any key turns a dark TV on (`LivingRoom.tsx:544-548`).
- **Item ids** keep today's `kind:argument` form (`tv-flow.ts:657-658`), not the prototype's `kind-argument`.
- **Provisional rows:** `discover` without a mood, `quiz` and `rate`, and the `service` key of the lists. They
  wait for a prototype, see [What waits for a prototype](#what-waits-for-a-prototype).
- **A guest who opens `tv=shows`** gets home, as an unknown screen does today (`tv-flow.ts:213`).

### The URL

- **One address per TV screen**, as today: `/?tv=discover&mood=funny`. `writeTvParams` keeps parameters that are
  not the TV's (`tv-flow.ts:274-298`), and `isTvOnlyChange` keeps the loader from rerunning (`:304-313`,
  `routes/_index.tsx:34-42`).
- **The keys:** `tv`, `mood`, `island`, `side`, `pick`, `title`, `q`, `service`. A title's key is
  `<media_type>-<tmdb_id>`, the form the quiz's picks use today (`ui/living-room/TvQuiz.tsx:531-532`). Today's
  title screen writes the numeric catalog key, which nobody can read in a link; `titleKey` converts
  (`utils/title-key.ts:10`).
- **`focus=` is read on arrival and never written while the focus moves.** It exists for links and for tests.
- **Old addresses.** `readTvState` maps what the old TV wrote: `tv=moods` to `tv=discover`, `tv=picks` with a
  `mood` to `tv=discover&mood=`, `tv=picks` without one and `tv=services` and `tv=this-or-that` to `tv=tonight`,
  `tv=quiz` to `tv=quiz`, a `title` it cannot parse to home. Each mapping is a test.

### History

| Transition | History |
| --- | --- |
| Opening an app, a mood, an island, a side, a title, the quiz, the rating, search | `push` |
| "Another one" on Tonight, "Sail to" an island, What is GoodWatch? from the menu, a new query on the results | `replace` |
| A streaming key | Waiting for the prototype of the service screen; `none` until then |
| Back with history from this visit (`depth > 0`) | `back` |
| Back on a deep link | `replace` with home; on home, nothing (`tv-flow.ts:490-507`) |
| The Home key | `push` home unless home is showing (`tv-flow.ts:516-520`, `:565-567`) |
| Search results from the search screen | `replace`, so Back from the results is one step (`tv-flow.ts:831-838`) |
| A focus move, the menu, power, a toast | `none` |
| Answering the last quiz title, choosing a rating level | `back`, with the effect that stores the answer |

Browser Back and the TV's Back are the same step, as today.

### The focus model

**Four directions.** The rule is the prototype's (`engine.tsx:244-277`):

- Left and Right stay in the row: only items that overlap the focused one vertically count.
- Up and Down take the nearest row in that direction, and in it the item with the least sideways offset.
- Down from an item more than twice as wide as the row's items starts at the row's left end.
- With nothing in that direction, the focus stays.
- The top bar is the top row of every screen, reached with Up; the Expand key is reached with Right along the
  last row or with Down.

**The machine gets the boxes; it does not read them.** A direction is the action
`{ type: "move", dir, boxes }`, where `boxes` are the on-screen rectangles of the items of the topmost layer.
The hook measures them at the moment of the key press, after bringing the focused item into view, as the
prototype does (`engine.tsx:245-250`). The rule itself is a pure function `nextInDirection(boxes, from, dir)` with
its own tests.

Why measured boxes and not a declared grid per screen: Cinema's screens are flex and grid layouts whose rows page
sideways, the phone and the desktop lay the same items out differently, and the Explorer map places its islands
freely. A declared grid would be a second layout to keep in step with the first by hand. The repository has one
such pair already, the CSS mirror of `layoutRoom` (`living-room.css:147-151`: "keep them in step").

**`tvItems(screen, context)` stays pure** and lists every item id in reading order. It is what validates a
focus or a choice (`tv-flow.ts:786-790`, `:809-811`), where the focus starts (`:412-430`), what the wheel's drag
and scroll step through (`:772-780`), and the order a screen reader meets. A test renders each screen and checks
that the ids in the markup are exactly `tvItems`.

**Where the focus starts.** On the screen's first content item, never on the bar or the Expand key
(`engine.tsx:171-178`). Exceptions, from the prototype: on a list with no titles, the first action.

**The pointer.** Over the picture the system cursor is hidden and the TV draws the ring. The item under the ring
takes the focus (`{ type: "focus", item }`), and a click is `{ type: "choose", item }`, as today
(`TvScreens.tsx:176-177`). The pointer and the Remote's swing are not machine state: `pointing.tsx` moves two
elements by `transform` and sets no React state on a move (`pointing.tsx:14-17`).

**Touch.** A press on the picture focuses the item under the finger; letting go is `choose` on the item the ring
is over; after 10 px of movement the ring stands 46 px above the finger and each item it passes takes the focus
(`pointing.tsx:83-89`, `:281-377`). The machine sees only `focus` and `choose`.

**Focus does not navigate.** Today every focus move is a router navigation that replaces the URL
(`tv-flow.ts:779`, `use-tv-flow.ts:49-60`). With a ring that focuses whatever it passes, that is many navigations a
second, each re-rendering everything that reads the location. In the new hook:

- The focus of the screen on show is React state.
- When a transition pushes a screen or the Expand key leaves the page, the hook stores the focus of the screen
  being left under that history entry's `location.key`, in memory and in `sessionStorage`. This is how the
  router's own scroll restoration remembers positions.
- When a location arrives (Back, Forward, a reload), the screen comes from the URL and the focus from that store,
  else from `focus=`, else from where the screen's focus starts.

So Back gives the focus back on every screen, including after a real page.

**The search draft** is React state of the scene, as today (`LivingRoom.tsx:125`, `:194-206`). On the search
screen it is a real `<input>` dressed as the question line: a phone has no keyboard until an input has the
focus, and the prototype's key listener (`engine.tsx:388-390`) cannot open one.

### Effects

What the page carries out. The machine only names them.

| Effect | Carried out by |
| --- | --- |
| `expand` with a destination | `useLeaveThroughTv`, see [section 4](#4-the-expand-key-into-a-real-page) |
| `watch` with a title | Opens the service, see [the title screen](#the-title-screen) |
| `want-to-see` with a title (a toggle) | `useWishlistMutation` (`hooks/useUserDataMutations.ts:206`); it works for a guest |
| `seen` with a title | A member: `useWatchedMutation` (`:258`), then the `rate` screen. A guest: the `rate` screen only, because the server refuses a guest's watch (`server/watchHistory.server.ts:144`) and a guest's score counts as seen (`server/viewer.server.ts:123-125`) |
| `rate` with a title and a score | `useScoreMutation` (`:140`); it works for a guest |
| `quiz-rate` with a score, `quiz-skip` | `useTasteQuiz`'s `rate` and `skip` |
| `sign-in` | `useContinueWithGoogle` with the current TV address as the return (`ui/taste-quiz/continue-with-google.ts:7`, used the same way in `LivingRoom.tsx:632-651`) |
| `toast` with a text | The TV's own toast ("Only Netflix", "On your Wishlist") |

The old TV's "Not for me" with its undo toast (`routes/_index.tsx:196-209`) has no place on the new title screen,
which has three actions. Not interested stays on the title page, one Expand away.

## 3. Real data per screen

Three rules decide every row below.

- **A guest's first HTML is the same for every guest.** The page cache stores it for 30 minutes and serves it
  stale for two more hours (`utils/auth-cookie.ts:3-4`, `docs/page-cache.md:250-261`), and the SEO check compares
  it byte for byte across user agents (`docs/verification/235-living-room-seo.md:22`). Nothing personal may be in
  it. A member's page is private and never stored (`server/living-room/data.server.ts:17-27`).
- **A mini app reads what its page reads**, wherever the page's read is cheap enough, with the page's own client
  query where it has one. The four titles on the TV are then the first four on the page. Not verified per page:
  how much of the page's first render after Expand comes from that query's cache and how much from its loader.
- **Members GET, guests POST their browser's progress** (`snapshotGuestProgress`, `utils/guest-progress.ts:192`),
  and both answers are `private, no-store`. Every endpoint below follows this already.

### Overview

| Screen | At first paint | On demand | Source | Missing |
| --- | --- | --- | --- | --- |
| Home, a guest | The tiles and one picture, the same for everyone | The pool, at the first interaction | The start titles in the loader; `POST /api/living-room/picks?view=pool` | The first start title's `backdrop_path` in the loader data |
| Home, a member | Tonight's three picks and the My shows preview | The pool, when the Discover tile first has the focus | `getTonightParts` in the loader | A small shaping function over `TonightParts` |
| Tonight | The same as home | Nothing | A guest: the pool's best three. A member: the loader | Nothing more |
| Discover, the choice | Nothing | The pool, for the tiles' art | Waiting for the prototype of three tabs. For moods: `domain/moods.ts:224` for the list; the pool for a picture per mood | A source for Themes and Styles, see [What waits for a prototype](#what-waits-for-a-prototype) |
| Discover, the titles | Nothing | On choosing a mood | `/api/discover/results?moods=<key>` through `useDiscoverResults` | Nothing |
| Explorer, the map and an island | Nothing | When the Explorer tile first has the focus | `/api/explorer/map?grouping=mood` through `fetchMap` | A pure function that chooses six islands and their neighbours |
| Taste | Nothing | When the Taste tile first has the focus | `/api/taste/portrait?tab=sides` | A fallback when a taste has no sides yet |
| The quiz | Nothing | On opening the quiz | `useTasteQuiz` | Nothing |
| My shows | In the member's loader | Nothing | `getTonightParts` with three episode lists | The loader exposes more of `MyShows` |
| A title | What the list it came from knows | The full card, on opening | **New:** `/api/title-cards?keys=` | The endpoint; a link for "Watch on <service>" |
| Search | Nothing | On OK | `POST /api/combined-search` through `requestSearch` | Nothing |

### Home

**A guest's first paint.** The four tiles and the first picture come from data that is the same for everyone:

- **The full-picture backdrop and the Tonight tile** show the first start title. For a visitor nobody knows
  anything about, the pool's best title and the first start title are the same title by construction: both are
  the front of the same candidates in popularity order (`server/living-room/pool-keys.server.ts:89-99`,
  `:141-143`). So the picture in the HTML is the real first pick, not a placeholder.
- **Missing:** `StartTitle` has no backdrop (`ui/living-room/living-room-data.ts:25-28`,
  `server/living-room/start-titles.server.ts:30-37`). `TitleDisplay` has `backdrop_path`
  (`server/title-cards.server.ts:40-46`), so the loader passes the first title's on. One field, for one title:
  the HTML has a byte budget.
- **The Discover tile** shows four posters: start titles one to four, already in the loader data.
- **The Explorer and Taste tiles** are drawings (`base.tsx:379-409`), no data.
- **The H1** is in the HTML, see [SEO](#seo).

**After the first interaction** (`utils/first-interaction.ts:21`: a pointer move, a touch, a key, a scroll) the
home asks for the pool and swaps in the person's own picks. Today the pool is asked for right after the first
paint, on every page view (`routes/_index.tsx:110-133`). That request is the start page's measured weak point
under load: "The limit there isn't the proxy. It is the home page's `POST /api/living-room/picks?view=pool`"
(`docs/benchmarks/viral-spike-page-views.md:12`), with a p50 of 667 ms and a p95 of 1,753 ms in that run
(`:208`). A visitor who leaves without touching the page, and every crawler, would no longer cause it.

**The pool's payload changes:** `suggestions` (the best six and three per mood) and `catalog` stay; `wishlist`
and `pairs` go (`server/living-room/pool.server.ts:50-92`).

**A member's first paint.** The loader already reads `getTonightParts` for the doors
(`server/living-room.server.ts:83-91`, `server/home-doors.server.ts:163-169`). The new loader returns, in place
of `doors` and `wishlist`:

- **`tonight`:** up to three cards. The first is Tonight's pick as `getTonightsPick` decides it
  (`server/tonight.server.ts:88-146`); the next ones are the following movies of `TonightParts.movies` (three are
  read, `home-doors.server.ts:24`, `:76-80`) and then the first show to start.
- **`shows`:** the first three rows of `MyShows.continue` (falling back to `pickUp`) and the first three of
  `MyShows.start` (`server/my-shows.server.ts:52-72`).
- **Dropped:** every Wishlist card. Today the loader reads all of them in batches of 60 so the old Moods screen
  can count them (`server/living-room/pool.server.ts:95-121`, `ui/living-room/TvScreens.tsx:518-521`). The new
  TV shows no such count.

A member's home needs the pool only for the Discover tile's posters, so it asks when that tile first has the
focus.

### Tonight

- **A guest:** the pool's first three `suggestions`, under "Best rated right now", the label today's TV uses for
  the same list (`TvScreens.tsx:841`). A guest with ratings gets them in their taste's order
  (`pool.server.ts:44-48`). A guest with a Wishlist in their browser has a Tonight's pick, the last title added
  (`server/tonight.server.ts:99-109`); it leads, read through `useTonightsPick`
  (`ui/navigation/useTonightsPick.ts:40`), which the navigation's hub already mounts (`ui/navigation/Hub.tsx:226`).
- **A member:** the loader's `tonight`. When Tonight's pick is an episode, the screen says so with
  `TonightsPick.episode` (`tonight.server.ts:29-36`).
- **"Another one"** steps through the three and wraps, as in the prototype (`base.tsx:117-131`).
- **Not built:** a longer sequence. `/api/watch-next?notTonight=` exists (`routes/api.watch-next.ts:21-27`) if
  three ever prove too few.

### Mini Discover

- **The choice screen waits for a prototype:** three tabs, Moods, Themes and Styles, with six options each
  ([What waits for a prototype](#what-waits-for-a-prototype)). What follows about the moods describes the first
  prototype.
- **The moods** are the eleven of `domain/moods.ts:12-24` and "Any mood". The first prototype shows five moods
  and Any mood in a 3 by 2 grid; the real list makes twelve tiles. With six options to a tab, the new prototype
  has to say which six.
- **A mood tile's picture** is the backdrop of the pool's first title with that mood, at TMDB's `w300`. Until the
  pool is there, the tile is the mood's own colour (`MOODS[n].hue`).
- **The titles** are the first four cards of `/api/discover/results?moods=<key>&page=1`
  (`routes/api.discover_.results.ts:67-108`, guests through the action at `:161-178`), read with
  `useDiscoverResults` (`:116`). "Any mood" is the same request without `moods`.
  - The request returns 40 cards; there is no smaller page (`server/discover-results.server.ts:27`). It is kept
    that way on purpose: it is the request the Discover page makes for the same filters, so both show the same
    titles in the same order.
  - It answers 503 with `Retry-After` until the title snapshot is loaded (`api.discover_.results.ts:89-93`).
    The list then says "Nothing fits." after its retries, as an empty result does.
- **The streaming keys wait for a prototype** and narrow nothing until its result is in. For the "watch on this
  service" screen they are to open, the read is at hand: Discover's results take `services=<id>`
  (`domain/filter-state.ts:167-175`), and the two ids are in `REMOTE_SERVICES`
  (`ui/living-room/living-room-data.ts:117-120`).
- **Not used:** `getLivingRoomPicks`. It would show other titles than the page behind Expand, and it walks the
  snapshot on every request (`server/living-room/picks.server.ts:47-83`).

### Mini Explorer

- **One request for the whole app:** `/api/explorer/map?grouping=mood` (`routes/api.explorer.map.ts`,
  `getExplorerMap` at `server/explorer/index.server.ts:321`), through `fetchMap` and `explorerKeys`
  (`ui/explorer/api.ts:65-89`), the Explorer page's own query. Every island carries its top titles
  (`domain/explorer.ts:100-117`), so an island's screen needs no second request.
- **The grouping "mood" has twelve islands** (`server/explorer/islands.server.ts:61-142`); they are not the
  eleven moods of Discover.
- **The mini map shows six, as the owner decided:** the six islands with the most titles for the person
  (`ExplorerIsland.count`, `domain/explorer.ts:104-105`), in the prototype's six places
  (`prototype-tv-design/cinema.tsx:220`), given out by the islands' real positions from left to right and top to
  bottom, so that neighbours on the real map stay neighbours here. A pure function with a test.
- **There is no list of neighbours.** Islands have a position (`x`, `y` from -1 to 1, "islands with similar
  titles sit close together", `domain/explorer.ts:110`). "Sail to" offers the two nearest of the six by that
  distance, and the map's dotted bridges join each island to its nearest.
- **An island's titles** are the first four of `island.titles`. They are `ExplorerTitle`, not `TitleCard`; the
  title screen asks for the card.
- **Not verified:** the map's size in bytes (up to 27 titles for each of 12 islands). The slice measures it and,
  if it is too heavy for a tile's first focus, loads it on opening the app instead.
- **A guest** works as on the page: the same endpoint with the guest's progress.

### Mini Taste

- **Does the person have a taste?** Not "five ratings". A taste match needs five titles the person liked, at a
  score of 6 or more (`server/taste/formula.server.ts:28-30`), and sides need about five loved ones
  (`server/taste-portrait/sides.server.ts:51-57`, `:307-309`). The prototype's `rated >= 5`
  (`engine.tsx:300`) is not the test. The screen asks `/api/taste/portrait?tab=sides`
  (`routes/api.taste.portrait.ts:45-77`) and reads `status` and `subject.kind` of the `SidesView`
  (`server/taste-portrait/view.ts:111-123`).
- **Three states:**
  - `subject.kind` is `sample` (a guest under five ratings, `server/taste-portrait/index.server.ts:150-181`), or
    `status` is `empty` and the person has fewer than five scores: "Rate 5 titles you've seen." and Start rating.
  - `status` is `ready`: the sides as tiles. **There are two to four of them, not always three**
    (`sides.server.ts:297-314`); the prototype's fixed "Three sides of you" becomes the count. A side's screen
    shows `side.here`, up to four titles the person rated (`view.ts:103-104`), which can be fewer.
  - `status` is `empty` with five scores or more: the person did the quiz, and there are no sides yet. The screen
    shows the quiz's picks as a list ("Made for you") with "Rate more". `useTasteQuiz` has them (`picks`,
    `ui/taste-quiz/use-taste-quiz.ts:159-182`).
- **A member's view** comes from the page loader on `/taste` (`server/taste-portrait/page.server.ts:26`); the
  page's hook fetches for guests only (`ui/taste/tabs/useTasteView.ts:20`). On the TV both ask the endpoint. Not
  verified: whether a member's request can share the page's cache.
- **The quiz** is `useTasteQuiz({ titles: [], member, enabled })`, as today (`LivingRoom.tsx:129-137`): it
  fetches its titles from `/api/smart-titles` (`routes/api.smart-titles.ts:8`) and stores a guest's ratings in
  the browser (`utils/guest-progress.ts:49-53`; at most 20 scores, `:90-97`). The four answers store scores through its `rate`
  and `skip`. The answer control waits for a prototype (a strip with the ten exact scores,
  [What waits for a prototype](#what-waits-for-a-prototype)); `rate` takes any score from 1 to 10. The quiz ends when `progress` reaches
  `QUIZ_GOAL`, 5 (`ui/taste-quiz/quiz-flow.ts:10`).

### My shows

- **A member's, in the loader.** `getTonightParts` calls `getMyShows` with one episode list
  (`server/home-doors.server.ts:48-57`); the screen shows three Next episodes, so that becomes three. An episode
  list is kept for 10 minutes (`server/tracking.server.ts:547-555`).
- **A Continue row** has the show's title, poster and backdrop and its Next episode with season, number, name
  and runtime (`server/my-shows.server.ts:40-58`); `episodeCode` writes "S2 E4" (`domain/episode-label.ts:2`).
  There is no episode still: the show's backdrop is the picture.
- **A show to start** has title, poster, backdrop, match and service, and no year (`:60-70`).
- **The signals.** The New episodes signal's count comes from `useWhatsNew`
  (`ui/navigation/useWhatsNew.ts:19`), as on the old Continue door (`ui/living-room/HomeDoors.tsx:23`, `:179`).
- **No API route returns `MyShows`**; the only reads are this loader and the page's (`routes/my-shows.tsx:37-87`).
  The TV needs none, because a member's loader runs on every arrival at `/`.

### The title screen

- **The card.** A title can come from six lists with five shapes (`TitleCard`, `ExplorerTitle`, `PortraitTitle`,
  `MyShowsRow`, a search row). The title screen always shows a `TitleCard` (`server/title-cards.server.ts:61`):
  title, year, runtime, the GoodWatch score, the taste match, the services, the tagline, the backdrop and
  poster, and whether it is on the Wishlist or Seen.
- **Missing: an endpoint for a card by key.** Nothing returns a `TitleCard` for an arbitrary title:
  `/api/watch-next/cards` covers Wishlist titles only (`server/watch-next.server.ts:697-707`) and
  `/api/explorer/card` the Explorer's pool in another shape. New: `GET /api/title-cards?keys=` (guests POST),
  over `getTitleCards` (`server/title-cards.server.ts:86`), at most `MAX_KEYS` (`:31`). The display fields are
  kept in memory for 10 minutes and in Redis for 6 hours (`:4-8`).
- **The first paint of the screen** uses what the list knew (title, poster or backdrop), then the card.
- **The one-line description** is the card's `tagline`, which can be null; the line is then left out. The
  prototype's lines are made up (`prototype-tv-flow/data.ts:25-51`).
- **"Watch on <service>".** The label follows today's rule (`ui/living-room/TvScreens.tsx:1024-1028`, built on
  `offersOf` and `watchLine`, `ui/watch-next/services.ts:14`, `:36`): "Watch on Netflix" on one of the person's
  services, "On Netflix" on another, "Not streaming" as a key that does nothing.
  - Today the key opens the title's page (`routes/_index.tsx:185-187`). In the approved design it opens the
    service.
  - A card's service has no link (`CardService`, `server/title-cards.server.ts:55`). The link comes from
    `POST /api/watchability` (`routes/api.watchability.ts:19`), which returns each offer's `stream_url`; without
    one, `tmdbWatchUrl` gives TMDB's page for the title in the person's country (`utils/streaming-links.ts:48`).
  - The title screen asks for it on opening, so the address is there by the time of the press: a new tab opened
    after a wait is blocked as a pop-up.
- **Seen it** for a member's show with a Next episode marks that episode ("Seen S2 E4") in the prototype
  (`kit.tsx:248-260`). Not verified which mutation of `ui/tracking` does this from outside the title page; the My
  shows slice finds it, and without one the key rates the show as for any title.

### Search

- **On OK, the full search:** `POST /api/combined-search` through `requestSearch`
  (`routes/api.combined-search.ts:62-69`, `ui/search/search-request.ts:42`). The TV shows the first four rows.
  It is the search the page behind Expand runs (`searchHref`, `ui/navigation/destinations.ts:45-49`:
  `/discover?q=`), so the TV and the page agree.
- **Never per key press.** The search spends the paid inference budget
  (`docs/implementation/combined-search/README.md:54`) and is admission-limited. One search per OK is what a
  search from the site's header costs.
- **The ideas** are fixed queries; today's are in `TvScreens.tsx:1067-1074`.
- **Not used:** `/api/command-palette` (`routes/api.command-palette.ts:13`). It is cheap and cached for 6 hours,
  but it matches the start of a title only, and the ideas ("cozy mystery") are not titles.
- **A result's title screen** asks `/api/title-cards` for its card.

## 4. The Expand key into a real page

### Where it goes, and what travels

A pure function `destinationHref(screen, context)` in the machine, with a test per row.

| Screen | Expand opens | What travels |
| --- | --- | --- |
| Tonight, a member | The pick's own page: `TonightsPick.href` (`/my-shows`, `/my-shows#start` or `/my-movies`, `ui/living-room/tv-flow.ts:40-44`) | Nothing: the pick is the first thing on that page |
| Tonight, a guest | `/discover` | Nothing. `/watch-next` shows a guest nothing (`routes/watch-next.tsx:58-59`) |
| Discover, the choice | `/discover` | Nothing |
| Discover, the titles | `/discover?moods=<key>` | The mood (`domain/filter-state.ts:163-185`). A theme or a style: waiting for the prototype |
| Explorer, the map | `/explorer?grouping=mood` | The grouping |
| Explorer, an island | `/explorer?grouping=mood&island=<id>` | The island (`ui/explorer/history.ts:14-22`) |
| Taste, and a side | `/taste` | Nothing. Not verified: whether the page can open on one side |
| My shows | `/my-shows` | Nothing |
| A title | `titlePath(media_type, tmdb_id, title)` (`utils/helpers.ts:13`) | The title |
| Search results | `searchHref(q, features)` | The query |

Home, the quiz, the rating, the search screen without a query and What is GoodWatch? have no Expand key.

### The hand-over

**Waiting for a prototype.** Several Expand transitions are being compared. What is certain is the first
paragraph below (what the code does today) and everything in the next subsection (Back, the screen, the focus,
the data). The numbered list describes the first prototype's transition and is provisional.

Today (#232): `useLeaveThroughTv` measures the TV's box, writes it to `--tv-inset` on `<html>`, sets
`data-tv-transition="out"` and navigates with `viewTransition: true` (`ui/living-room/tv-transition.ts:86-102`).
The router waits for the next page's loader, then the browser shows the new page clipped to the TV's box and
grows the clip to the window (`main.css:95-111`). Only `clip-path` on the transition's snapshots animates, once.
That is the growing frame, and it stays.

What the approved design adds:

1. **The frame while the key has the focus.** The picture steps back to 94% and thin amber brackets (3 px) stand
   14 px inside the TV's edge (`prototype-tv-design/scene.tsx:47-51`, `:288-291`). This is CSS on the TV:
   `transform` on the canvas and a brackets element, shown while the machine's focus is `expand`. Nothing loops.
2. **The motif on the key.** In the prototype its brackets move out and back for as long as the key has the focus
   (`scene.tsx:58-59`), by animating `inset`. The rendering budget allows neither an endless loop at rest nor a
   layout property in a loop (see [the rendering budget](#the-rendering-budget)). The real key plays the move
   twice with `transform` and rests open. With reduced motion it rests open at once, as in the prototype
   (`scene.tsx:60-63`).
3. **The brackets grow with the frame.** A fixed element in the document carries the four brackets and has its
   own `view-transition-name`. While a TV transition is marked it stands at the TV's box as long as the room is
   in the document (`html:has(.living-room)`, the selector the stylesheet uses already, `living-room.css:142`) and
   at the window's edge once it is not. The browser moves a named element from its old box to its new one by
   itself, so the brackets travel outward with the clip's edge, and the rules for it sit in `main.css` beside the
   keyframes.
   - **Not proven.** The slice proves it in Chromium, Safari and Firefox. If it does not hold, the fallback is
     today's transition with the brackets fading out as the frame starts to grow.
4. **Timing.** Out in 0.85 s, the prototype's `GROW_MS` (`engine.tsx:37`); back in 0.45 s as today
   (`main.css:99-102`). Today's out is 0.6 s.

**With reduced motion, and in a browser without View Transitions,** both ways are plain navigation, as today
(`tv-transition.ts:21-27`, `:90-95`; `main.css:122-128`).

### Back into the same TV screen, with the same focus

- **The screen.** Expand pushes the page's address on top of the TV screen's history entry. Browser Back pops to
  `/?tv=discover&mood=funny`, and the machine reads the screen from it. This works today.
- **The shrink.** `useReturnIntoTv` runs on mount, sees a `POP` after leaving through the TV, and points the
  replayed transition at the TV's box, measured again if the window changed size
  (`tv-transition.ts:109-120`). Unchanged.
- **The focus.** Before leaving, the hook stores `expand` as the focus of that history entry
  ([the focus model](#the-focus-model)). On Back the screen arrives with the Expand key focused, so the picture
  is framed exactly as it was when it left, and the shrink lands in that frame.
- **The data.** The transition waits for the start page's loader, not for the TV screen's own request. The
  screen's request is still in TanStack Query's cache from before leaving, so the screen draws at once. The
  global cache time decides how long that holds (`goodwatch-webapp/AGENTS.md`: no custom `staleTime`); after it,
  the screen arrives in its loading state and fills in.
- **A member's Back** reruns the start page's loader, as today with the doors. That is `getTonightParts` again:
  the user data is cached for 5 minutes (`server/userData.server.ts:20-26`) and the episode lists for 10.

## 5. Budgets and risks

### The rendering budget

Issue [#190](https://github.com/alp82/goodwatch-monorepo/issues/190), in its resolution comment; the research is
on the branch `origin/research/living-room-rendering-budget` at `docs/research/living-room-rendering-budget.md`.

- **Only `transform` and `opacity` may loop or follow the pointer.** Blur, blend modes, `box-shadow`,
  `clip-path` and SVG geometry may change only in short, one-shot transitions.
- **When nothing happens, nothing animates.** No endless loops at rest.
- **No blend modes and no live blur over the room photo.** Blurs are baked into images.
- **Numbers:** idle CPU at 5% of a core or less with a GPU, 10% or less under software rendering; 10 ms or less of
  main-thread work per frame, no task over 50 ms, INP 200 ms or less; LCP 2.5 s or less at p75; decoded image
  memory of 32 MB or less for the room, the hand and the TV's content.

What the new TV costs against it, read from the prototype's code. None of it was measured
(`docs/prototypes/tv-screen-design/README.md`, "Not in this round").

| Part | In the prototype | Against the budget | The plan |
| --- | --- | --- | --- |
| The backdrop's cross-fade | A full-picture image fades in over the last one on every focus move (`base.tsx:313-338`, `scene.tsx:55-56`), 0.42 s, `opacity` only | Allowed: one-shot, `opacity`. The cost is decoding a new image and compositing two layers of 2.4 times today's area | Decode with `img.decode()` before the swap, as the research asks; keep at most two backdrops alive; `w780` where the picture is under 900 CSS px wide, `w1280` above |
| The focused tile | `filter: brightness(.62)` on every tile that is not focused, with a transition on `filter` and `box-shadow` (`cinema.tsx:14-16`) | One-shot, so allowed, but `filter` on up to twelve images repaints them. Not a loop | Replace `brightness` with an overlay's `opacity`. Keep the shadow as a one-shot |
| The room | `filter: blur(1.8px)` on the photo, 1.2 px on the phone (`scene.tsx:356`, `phone-room.tsx:98`) | **Not allowed** | New image files with the softening in them |
| The expand motif | An endless `inset` animation while focused (`scene.tsx:58-59`) | **Not allowed** twice over | Two plays with `transform`, then rest ([section 4](#the-hand-over)) |
| The pointing loop | One `requestAnimationFrame` loop eases two transforms and stops when both have arrived (`pointing.tsx:201-253`) | Allowed: `transform` only, and nothing runs at rest. At 120 Hz it runs twice as often while it runs | Keep as built. With reduced motion the Remote does not move and the ring has no lag (`pointing.tsx:133`, `:167`, `:177`) |
| The Remote's swing | Up to 42 degrees with `perspective` and three rotations on an element that holds the hand photo (`pointing.tsx:98`, `:186-198`) | `transform` only. The layer is the 1024 x 1536 hand photo | Measure under software rendering |
| The TV's glow | A static `box-shadow` of 120 px around a TV of 1271 x 686 (`scene.tsx:365`), switched with power | Static, so allowed | Keep; check it is not repainted when the canvas inside changes |
| The larger TV | 1271 x 686 on a 1920 x 1080 window against about 770 px of width today | Every repaint inside the TV is 2.4 times the pixels | The idle and focus-move measurements below are the gate |
| The room photo's size | Scaled so its TV matches ours: about 3,480 px wide at 1080p, 1.36 times the largest file (`scene.tsx:138-143`) | The browser takes the 2560 file on every desktop: 14.7 MB decoded, with the hand 6.3 MB and two `w1280` backdrops 7.4 MB, about 28 MB of the 32 | Softened files need fewer pixels: encode the softened desktop room at 1920 wide at most |
| Screen changes | A 0.3 s zoom and fade (`cinema.tsx:23-24`) | One-shot `transform` and `opacity` | Keep; CSS, so `framer-motion`'s `AnimatePresence` is not needed |

**How a slice proves it** (the research's pre-ship list): idle CPU with `chrome --disable-gpu` at 10% or less;
the same with a GPU at 5% or less; a performance trace of ten focus moves and of the Remote following the
cursor with no task over 50 ms; Lighthouse's "Avoid non-composited animations" empty; reduced-motion emulation;
the tab hidden for a minute.

### Script and byte budgets

The limits are in `goodwatch-benchmark/urls/budget.json:13-31`, for a first-time mobile visitor who does not
scroll, the median of three Lighthouse runs. `./bench.sh budget` measures the deployed site, not a branch
(`goodwatch-benchmark/README.md:164-206`).

| Line for home | Limit | Measured today (`docs/benchmarks/viral-spike-render-path-budget.md`) | What the new TV does to it |
| --- | --- | --- | --- |
| `lcp_element` | An `img` whose address contains `/assets/room-phone-` | The room photo | **At risk.** On a phone the TV's picture is about 362 x 302 CSS px and the photo is drawn in two pieces. If the home's backdrop is the largest image, this line fails. The softened phone photo keeps `room-phone-` in its name, and the slice checks which element Lighthouse names |
| `html_bytes` | 20,480 | 16,677 before the section below the room, which added 1,620 | Two editions of the home screen are in the HTML, as today. The new home has five tiles and less text than the old one |
| `script_count` | 16, no margin | 16 | Every new lazy chunk must stay out of the first view. A first-view chunk more fails the line |
| `script_bytes` | 262,144 | 243.8 KB | The old TV leaves the first view at the switch. Only the room, the home screen, the bar, the machine and the Remote may be in it |
| `image_count` | 32 | 29 | The old home shows one backdrop and six posters; the new one shows one backdrop and four |
| `image_bytes` | 378,880 | 347 to 364 KB | **Tight.** A `w1280` backdrop does not fit: the phone's first picture is `w780` |
| `blocking_requests` | 2 | 2 | The route keeps one stylesheet of its own. Not verified which two requests the line counts; a second route stylesheet would very likely be a third |
| `lcp_ms`, `tbt_ms`, `cls`, `score` | 6,050, 150, 0.01, at least 63 | LCP medians of 5,377 and 5,292 ms, score 70 and 71 | CLS depends on the first paint matching the measured layout to the pixel |
| `total_bytes`, `host_requests` | 768,000, 37 | 725 KB in the run that set the limit | The softened photos should be smaller than today's |

- **Chunks.** `vite.config.js` splits by route after its shared groups (`:162-269`, `:339`). A module that the
  home route imports statically is in the home's chunk; an app module of 3,000 bytes or less with two importers
  goes to the shell, on every page (`:194`, `:242-253`). There is no size check in the build: the gate is the
  budget run.
- **What is lazy.** Each mini app's screens, the title screen, search and the pointing loop load on first use,
  as `home-doors-code.tsx` does it: `lazy` with `reloadOnStaleChunk` (`utils/stale-chunk.ts:48`), asked for on
  intent (the app's tile takes the focus) or with `onFirstInteraction` (pointing), and drawn only after hydration
  (`ui/living-room/home-doors-code.tsx:14-37`).
- **`framer-motion`.** The old scene imports it for one spring and for screen changes
  (`ui/living-room/LivingRoom.tsx:9`, `TvScreens.tsx:4`). The new TV needs neither. Whether that takes the
  `motion` chunk out of the home's first view depends on what else imports it; the switch slice compares.
- **How a slice proves it.** Compare the first view's scripts of two production builds, `main` and the branch,
  sized as `scripts/precompress.mjs` writes them, with the same release id in both; quote gzip beside Brotli
  (`docs/implementation/tracking/my-library/README.md:172-178`). After the deploy of the switch,
  `./bench.sh budget`. A limit that must rise is raised in the same commit with the reason
  (`goodwatch-webapp/AGENTS.md`).

### SSR and hydration

The prototype logs a "Suspense boundary switched to client rendering" notice and a server `useLayoutEffect`
warning. Read from its code, not reproduced here:

- **The warning:** the engine calls `useLayoutEffect` directly (`prototype-tv-flow/engine.tsx:172`). The real
  scene uses `useIsoLayoutEffect` (`ui/living-room/LivingRoom.tsx:70-71`).
- **The notice** is React error 421: a Suspense boundary of the server's markup got an update before it had
  hydrated. The prototype draws nothing until the window is measured and then sets state in a layout effect
  (`scene.tsx:166-177`, `:364`), which is such an update. The repository has met this before and has a rule:
  never put a lazy part in the server markup of the TV, draw it after hydration (`home-doors-code.tsx:4-7`).

The rules for the new TV:

- **The server draws the real home screen**, both editions, placed by CSS until the window is measured, as today
  (`LivingRoom.tsx:73-78`, `:435-443`, `living-room.css:147-265`). The mirror of the new layouts is harder than
  today's: two desktop layouts with a threshold, and two phone forms.
- **No Suspense in the server markup of the room.** No route on a landing surface suspends today
  (`docs/benchmarks/viral-spike-render-profile.md:103`).
- **State set before hydration ends is a transition** (`ui/auth/AuthProvider.tsx:56-59`); hydration itself runs
  in `startTransition` (`entry.client.tsx:48-52`).
- **Proof:** at 1440 x 900 and 390 x 844, no console error or warning after hydration in the dev server (React's
  development build names a mismatch), and the first paint and the hydrated layout matching to the pixel in a
  production build, as #233 required. Serve that build with the backing services' keys blanked: a production
  process writes its build's files to the shared store ([webapp-deploys.md](../../webapp-deploys.md)).
- **Not verified:** whether a 421 on the start page reaches Sentry. `hydrateRoot` has no `onRecoverableError`
  (`entry.client.tsx:41-46`).

### SEO

`docs/verification/235-living-room-seo.md` is the checklist; none of it may change.

- **The meta block** of `routes/_index.tsx:49-102`: title, description, one canonical for every TV state, the
  `en` and `x-default` alternates, the JSON-LD graph. Not touched.
- **One H1 per viewport**, both editions in the source (`235-living-room-seo.md:23`). Today it is "Let's find
  something good for tonight." (`ui/living-room/TvScreens.tsx:316-319`). Cinema's home has no sentence in that
  place: its large type is the focused app's name, which changes with the focus. The plan keeps the sentence as
  the home's H1 where the prototype says "Good evening." (`cinema.tsx:83`), for guests and members alike.
- **The same HTML for every guest**, byte for byte across user agents (`:22`). The guest home's server markup
  uses the start titles only.
- **The section below the room** with its 16 title links and 12 hub links stays in the server HTML
  (`ui/living-room/below-room.test.ts`), with nothing hidden.
- **`/living-room?tv=moods` answers 301** (`:25`).
- **Proof:** the document's source compared for three user agents; the H1 count per viewport; Lighthouse's SEO
  score at 100, as the check recorded.

### Reduced motion, keyboard and screen readers

- **Reduced motion:** the Remote does not aim, the ring has no lag and no fade, screens cut, the cross-fade is a
  cut, the brackets stand still, Expand is plain navigation. The prototype does each of these
  (`docs/prototypes/tv-screen-design/README.md`, "Reduced motion"; `scene.tsx:60-63`).
- **The keyboard is the Remote** (#229): arrows, Enter, Escape and Backspace, H, M, and S for search from the
  prototype (`engine.tsx:391-399`). The guards stay: nothing while the room is away, nothing inside an input,
  nothing with a modifier, Enter and Space left to a focused button (`LivingRoom.tsx:535-548`).
- **Everything on the Remote is also on the TV** ([CONTEXT.md](../../../CONTEXT.md), "Remote"): the top bar and
  the menu cover Back, Search, Home and Turn off.
- **Real buttons.** Every item is a `<button>` with `aria-current` when focused, in `tvItems` order; the bar's
  keys have labels; the Expand key's label names where it goes ("Expand: Discover", `base.tsx:359`).
- **Targets:** 44 px or more on touch. The prototype measured every key of the phone's Remote at 44 px or more
  and the smallest TV target at 68 px tall on the desktop (`sizes.json`).
- **The pointer** is `aria-hidden` (`pointing.tsx:64`), and hiding the system cursor applies over the picture
  only.
- **No documented screen-reader requirement exists for the living room** (searched `docs/` and the issues). The
  new one: the screen's name is announced when the screen changes (a polite live region with the bar's title),
  and the Tab key walks the screen's items in reading order.

### Risks, by size

1. **The first paint.** A CSS mirror of two desktop layouts and two phone forms, pixel-exact, is the hardest
   single piece. If it drifts, CLS fails its 0.01 and the page jumps on hydration.
2. **The phone's height.** The prototype measured the phone without the lip. The real room loses 60 px to it
   (`living-room.css:368-373`, `:333-337`) where the prototype reserved 20 (`phone-room.tsx:16-17`), and the
   real dock is 72 px, not 64 (`ui/navigation/MobileDock.tsx:36`). By the prototype's own formulas that is 48 px
   less: the Remote is in the hand from a window height of about 757 px at 390 wide (measured: 709), and at
   375 x 667 the picture is about 258 px tall, not 289. Computed, not measured. See
   [decision 5](#7-decisions-for-the-owner).
3. **LCP on a phone.** The TV's first picture comes from another host and is close to the photo's size.
4. **The image bytes**, with 15 to 30 KB of room left.
5. **Software rendering** with a TV of 2.4 times the area. #233 measured 8.6% idle against a limit of 10%.
6. **The brackets in the view transition** are not proven.
7. **The room photo has no lossless master** in the repository (`viral-spike-render-path-budget.md:476-477`:
   "re-encoding a lossy file again would show"). The softening hides most of that; the slice shows the result
   beside today's.
8. **The Explorer map's weight** is not measured.
9. **The beside layout and the lip.** From 768 px the lip is a tab at the bottom right
   (`living-room.css:452-478`), where the Remote stands when it is beside the TV.
10. **A search costs inference budget** on every OK, as it does from the header.

## 6. Slices

### How it ships

**Recommendation: build on a preview address behind a flag, and put it on `/` by replacement.**

- **The flag** is `HOME_TV`, with the feature key `homeTv`. It has no `REC_` prefix, by the owner's decision,
  and otherwise works as the others do (`server/features.server.ts:13-25`, `utils/features.ts:4-13`): `off`,
  `preview`, `on`.
  - `off`: `/home-preview` answers 404.
  - `preview`: the members in `REC_PREVIEW_USERS`, the one list of preview members there is
    (`server/features.server.ts:46-52`), get the new TV there, with their own data.
  - `on`: anyone with the address does, for guest checks, Lighthouse and the rendering measurements.
  - Always `noindex`, with the canonical of `/`, in no sitemap and linked from nowhere.
- **The switch** is one pull request: `routes/_index.tsx` renders the new TV. The old TV's files stay in the
  repository, unused, until the cleanup, so a revert of that one pull request is the way back.
- **Why not a flag on `/` itself.** A flag is read on the server at run time. To let it choose between two TVs
  on one route, the route has to import both, and every visitor would download both: the old TV's screens and flow
  are about 4,000 lines. The line it would break has no margin (`script_count` 16) and the next one has 5%. The ways
  around that (drawing the new TV only after hydration, or awaiting its chunk before hydration) each give up the
  server-rendered H1 or add a Suspense boundary to the room, which are the two things the start page must not
  do.
- **Why not replace at once, slice by slice.** The new TV is useless until home, a title and at least one app
  work together, and the start page is the page crawlers read most.
- **What the preview address costs:** one small route file and a flag that both go at the cleanup.

### What no slice before the switch touches

`routes/_index.tsx`, every file of the old TV listed in section 1 as "delete at cleanup", `BelowRoom.tsx`,
`use-below-room.ts` and their test, the meta block, `goodwatch-benchmark/urls/budget.json`, and the pages the TV
expands into. New files go to `ui/living-room/tv/`. Where a kept file must change before the switch, the slice
says so.

### What every slice proves

- `npm test` in `goodwatch-webapp` (`node --test 'app/**/*.test.ts'`), with its new tests.
- `npm run build` passes. It fails on a prototype import.
- `npm run typecheck` and `npx biome lint` on the changed files add nothing to the failing baseline of `main`.
  There is no CI for the webapp (`.github/workflows/` has one workflow, for `goodwatch-flows`).
- Screenshots on the preview address at 1920 x 1080 and 390 x 844, as a guest and as a member, with every
  `REC_*` flag on, beside the prototype's shot of the same screen in `docs/prototypes/tv-screen-design/screens/cinema/`.
- A drive script in `docs/implementation/tv-screen-revamp/` that walks the slice's screens with keys and checks
  the state after each step, as the prototype's `walk.mjs` does. No browser driver is among the repository's
  dependencies; the prototype's scripts take `playwright-core` from outside.
- **Care with real data.** A dev server started with the machine's `.env` reads production Crate and Valkey. It
  must stay a reader: no `APP_ORIGIN`, which turns on the writes of search history and poster impressions, and
  no port 3147, which the prototype's server uses. This is the owner's standing instruction, not a document in
  the repository.

### The slices

Order: 1 and 2 first, side by side. 3 needs both. 4 and 5 need 3 and can run side by side. 4b needs 4. 6 to 10
need 5 and can all run side by side. 11 needs 5. 12 needs everything before it. 13, then 14, then 15.

**Waiting for a prototype** ([the table](#what-waits-for-a-prototype)): slices 6, 8 and 11, and in slices 2 to 5
what a press of a streaming key does. Each of these slices says below what can be built before the result and
what cannot.

#### Slice 1: the machine

- **Goal:** the new TV's state as pure, tested code. No UI.
- **Files, new:** `ui/living-room/tv/tv-machine.ts` (the screens, the URL, `tvItems`, `transition`,
  `destinationHref`), `tv-machine.test.ts`, `tv-move.ts` (`nextInDirection`), `tv-move.test.ts`,
  `focus-memory.ts` and its test.
- **Must not touch:** `tv-flow.ts` and its test.
- **Proof:** tests for every row of the screens, history and destinations tables above, the old addresses, the
  menu, power, and the direction rule on boxes taken from the prototype's layouts (home's row, a 3 by 4 grid, the
  map's free positions, a list with a column of actions, a title's row ending on the Expand key, the bar above
  each).

#### Slice 2: the room

- **Goal:** the new room at every measured window size, with an empty TV and the Remotes in place.
- **Files, new:** `ui/living-room/tv/room-layout.ts` and its test (the two desktop layouts and the phone's two
  forms, the phone with the lip's reserve as a parameter, as `layoutPhone` has it today, `room.ts:211-217`);
  `tv/TvRoom.tsx`, `tv/PhoneRoom.tsx`, `tv/PhoneRemote.tsx`; the softened photos in `img/living-room/`;
  `routes/home-preview.tsx`; `ui/living-room/tv/tv.css`.
- **Files, changed:** `utils/features.ts` and `server/features.server.ts` (the flag `HOME_TV`, key `homeTv`); `ui/living-room/Remote.tsx`
  (the wheel's optional direction callback, the prototype's change).
- **Must not touch:** `room.ts` and `living-room.css`. The preview route links `tv.css` beside
  `living-room.css`.
- **Waiting, the streaming keys:** both Remotes get their Netflix and Prime Video keys, and a press sends
  `service-key` with the service's name. That is all: no pressed state on a key and nothing on the TV, until the
  prototype of the service screen is decided.
- **Proof:** the layout tests reproduce the prototype's tables: 1271 x 686 under at 1920 x 1080, 1080 x 583 under
  at 1920 x 940, beside at 1536 x 730, 1440 x 800, 1366 x 650 and 1280 x 720, and the phone rows
  (`docs/prototypes/tv-screen-design/README.md`, "The room" and "The phone"). The tables give window sizes; the
  scene is 64 px shorter on the desktop. The prototype's code comment and its README differ on the width
  threshold (1140 in `scene.tsx:100`, 1110 in the README); the formula decides. The photos' bytes beside
  today's; the section below the room and its lip in place at every size; the room `inert` when away.

#### Slice 3: home, the bar and the menu

- **Goal:** the Cinema home on the preview address, driven by the machine with the keyboard and both Remotes,
  for a guest and a member, from real data.
- **Files, new:** `tv/use-tv.ts`, `tv/TvScreen.tsx` (the canvas, the screen switch, the toast), `tv/kit.tsx` (the
  item, the frame, the bar, the cross-fading picture), `tv/screens/Home.tsx`, `tv/screens/Menu.tsx`,
  `tv/screens/About.tsx`, the boot screen carried over.
  And the preview address's own loader, `server/living-room/tv-loader.server.ts` with a test: the guest
  contract with the first picture's backdrop, and a member's `tonight` and `shows` shaped from `TonightParts`.
- **Files, changed:** `server/living-room/start-titles.server.ts` and its test gain a function for the first
  picture; `server/home-doors.server.ts` reads three episode lists where it reads one.
- **Must not touch:** `server/living-room.server.ts`. The old page keeps its loader and its data until the
  switch.
- **Waiting, the streaming keys:** no "Only Netflix" toast and no service in the scene's state. The toast itself
  is built, for Want to See.
- **Proof:** the guest's HTML of the preview address is the same for three user agents and holds one H1 per
  viewport; the home's markup ids equal `tvItems`; the drive script walks the tiles, the bar and the menu with
  the keys and with the Remote's keys; the HTML's size beside today's start page.

#### Slice 4: pointing

- **Goal:** the ring, the Remote following the cursor (the swing under the TV, the nod beside it), and touch
  pointing on the phone and on any touch screen.
- **Files, new:** `tv/pointing.ts` as a lazy chunk, `tv/TvPointer.tsx`, the pointer's rules in `tv.css`.
- **Must not touch:** the machine. Pointing only dispatches `focus` and `choose`.
- **Waiting, the streaming keys:** nothing in this slice depends on them. A press of any key of the Remote hides
  the ring and leaves the Remote still, whatever the key does later.
- **Proof:** the prototype's checks for the mouse and for a finger, ported
  (`docs/prototypes/tv-screen-design/README.md`, "Proof"); the rendering measurements of section 5 for the
  Remote following the cursor; nothing moves with reduced motion; the chunk is not in the first view.

#### Slice 4b: phone landscape

Decided by the owner: the TV on the left, the phone's Remote on the right, and the Remote tilts properly toward
the spot it points at. The prototype has no landscape, so this slice designs within that decision and shows the
result before it merges.

- **When:** the window is short and wide, today's test (`ui/living-room/PhoneLivingRoom.tsx:50-52`:
  `(orientation: landscape) and (max-height: 540px)`). The room covers the whole window, above the site's header,
  as today (`ui/living-room/living-room.css:724-771`).
- **The TV** stands at the left on the phone's canvas (500 wide, as tall as its height allows up to 417), as tall
  as the window leaves, with its bezel and the wall around it as in portrait. At 844 x 390 that is a picture of
  about 440 x 370, with type from about 17.5 px.
- **The Remote** is the phone's Remote in the hand (`prototype-tv-design/phone-remote.tsx`), upright in the
  column to the right of the TV, rising from the bottom edge. Every key 44 px or more.
- **The tilt.** The Remote is beside the picture here, not under it, so neither of the prototype's two motions
  fits as it is: the desktop's swing would carry the Remote over the picture, and its nod beside the TV is a
  small turn (`prototype-tv-design/pointing.tsx:186-198`, `scene.tsx:297-299`). For landscape the Remote turns
  about the grip under its keys toward the spot, by the angle from the grip to the spot, as far as it can
  without its top corner crossing the picture's edge; it leans back further for a spot higher up and rolls
  toward the TV's side for a spot further left. It eases as the other Remotes do and rests flat, with no
  transform, so its keys are hit where they are drawn (`pointing.tsx:228-229`). A tap, a held press and a drag
  point as in portrait. With reduced motion it does not move.
- **The lip.** In this layout the lip is a tab at the bottom left today (`living-room.css:747-756`), which is
  where the TV now stands. It moves to the bottom right, under the Remote's keys where only the grip is.
- **Files, new:** the landscape branch of `tv/room-layout.ts` with tests, of `tv/PhoneRoom.tsx`, and a rig for
  it in `tv/pointing.ts`. **Changed:** the lip's rule for this media query, in `tv.css` until the switch.
- **Must not touch:** `use-below-room.ts`, which slides the room out of the window in this layout
  (`:16-17` of its header).
- **Proof:** screenshots at 844 x 390, 667 x 375 and 932 x 430; every key hit by a tap; the pointing checks of
  slice 4 in this layout, with the Remote's top never over the picture; going below and back with the lip;
  the first paint placed by CSS in this layout too (slice 12 covers it once this slice has landed).

#### Slice 5: Tonight and the title screen

- **Goal:** the first complete path: home, Tonight, a title, Want to See, Seen it with the rating, Watch on the
  service, and Expand as plain navigation through `useLeaveThroughTv` as it is today.
- **Files, new:** `tv/screens/Tonight.tsx`, `tv/screens/Title.tsx`, `tv/screens/Rate.tsx`,
  `routes/api.title-cards.ts` with its server function and a test, the effects in the preview route.
- **Not yet:** the pool keeps `wishlist` and `pairs` until the switch, because the old TV reads them.
- **Waiting, the streaming keys:** Tonight is not narrowed to a service. "Watch on <service>" on a title is a
  different control and is built here.
- **Waiting, the rating:** the `rate` screen after "Seen it" will take the control the quiz prototype decides.
  Build the screen with the four levels of the first prototype behind one component and one function of the
  machine, so the strip replaces them in one place.
- **Proof:** the drive script, as a guest and as a member, on production data through the dev server; a guest's
  Want to See and rating land in the browser's guest progress; the watch key's address is ready before the
  press.

#### Slices 6 to 10: the apps

Each adds one file under `tv/screens/`, its data hook, and one entry in the screen switch. None touches another
app's files. Each proves its screens against the prototype's shots and walks them in the drive script. None
builds anything for the streaming keys, which wait for their prototype.

- **6, mini Discover. Waiting for the prototype of the choice screen** (three tabs, six options each).
  - Build now: the titles for a mood named in the URL (`tv=discover&mood=<key>`), from `useDiscoverResults`,
    with "Change mood" as Back and Expand to `/discover?moods=<key>`. Proof: the four titles are the first four
    of `/discover?moods=<key>` for the same person.
  - Wait: `Discover.tsx`'s choice screen, its tabs and items, the titles of a theme or a style, and anything a
    streaming key does to the list.
- **7, mini Explorer:** `Explorer.tsx`. The six islands as decided, an island, "Sail to". Proof also: the map's
  payload in bytes, and the four directions on the map.
- **8, mini Taste and the quiz. Waiting for the prototype of the answers** (a strip with labels and the ten
  exact scores).
  - Build now: `Taste.tsx` with the three states of section 3 and a side's titles; `Quiz.tsx`'s frame (the
    title, its picture, the progress, "Haven't seen it") wired to `useTasteQuiz`.
  - Wait: the answer control, its items in the machine, its keys on the keyboard, and its words. Proof once it
    is in: a guest rates five titles and sees what their taste then is.
- **9, My shows:** `Shows.tsx`, with the loader's `shows` and the signal. Proof also: on the tracking harness
  (`/prototype/my-library-real`) with its sample members.
- **10, search:** `Search.tsx`, with a real input. Proof also: on a phone the keyboard opens, and no request
  leaves before OK.

#### Slice 11: the Expand key

**Waiting for the prototype that compares Expand transitions.** The slice has two halves, and the first does
not wait:

- **Build now:** the Expand key in its place on every screen that has one, leaving through `useLeaveThroughTv`
  as it is today; what travels to each page; Back into the same TV screen with the Expand key focused; the same
  after a reload on the page; plain navigation with reduced motion.
- **Wait:** the frame while the key has the focus, the motif's motion, the brackets that grow, the timing, and
  the changes to `main.css`.

- **Goal:** the frame while the key has the focus, the motif, the brackets that grow, the state that travels,
  and Back into the same screen with the same focus.
- **Files, changed:** `ui/living-room/tv-transition.ts`, `main.css` (the rules beside `:87-128`), `tv/kit.tsx`,
  `tv/use-tv.ts`.
- **Must not touch:** the pages it opens. If a page does not take what travels, the slice reports it.
- **Proof:** for every row of the destinations table, the page shows what travelled, and Back returns to the
  same screen with the Expand key focused; the same after a reload on the page; plain navigation with reduced
  motion; a clip of the run beside the prototype's (`docs/prototypes/tv-screen-design/expand/cinema.mp4`);
  Chromium, Safari and Firefox.

#### Slice 12: the first paint, access and the budgets

- **Goal:** the preview address is ready to be the start page.
- **Files, changed:** `tv.css` (the first-paint mirror), the scenes, and whatever the measurements ask for.
- **Proof:** the SSR, SEO, access and rendering proofs of section 5, each written down with its numbers in
  `docs/verification/`; the first view's scripts of this branch beside `main`; a Lighthouse mobile run against
  the preview address on production with the flag `on`, read against the home's limits (a copy of
  `urls/budget.json` whose home path is `/home-preview`).

#### Slice 13: the switch

- **Goal:** `/` is the new TV.
- **Files, changed:** `routes/_index.tsx` (the component, the new loader, and the pool asked for at the first
  interaction); `server/living-room/pool.server.ts` (the Wishlist cards and the pairs go); `living-room.css` takes `tv.css` in, so the route has one stylesheet;
  `ui/living-room/room.ts` if the new layout file replaces it; `CONTEXT.md` (the doors leave the entries New
  episodes signal, Newly available and Recently landed; TV screen names its new examples);
  `goodwatch-benchmark/urls/budget.json` only where a limit must move, with the reason; the benchmark's captured
  page view of home, which holds the pool request (`goodwatch-benchmark/README.md:113`).
- **Must not touch:** the meta block.
- **Proof:** `./bench.sh budget` and `./bench.sh smoke` after the deploy; the SEO check of
  `docs/verification/235-living-room-seo.md` run again; old addresses (`/?tv=picks&mood=funny`,
  `/living-room?tv=moods`) land on the mapped screens.

#### Slice 14: cleanup

- **Goal:** one TV in the repository.
- **Deletes:** every file marked "delete at cleanup" in section 1, the old loader in
  `server/living-room.server.ts`, the flag `HOME_TV`, `routes/home-preview.tsx`, the dead
  rules of `living-room.css`, `routes/api.living-room.services.ts`, `routes/api.living-room.ts` if confirmed,
  the picks form of the picks route.
- **Changes:** `docs/cache-identity.md:79-81` and `:129`; `server/tonight.server.ts:16` takes `DOOR_HREF` from
  where the machine keeps the member pages' addresses.
- **Proof:** build, tests, and the first view's scripts once more.

#### Slice 15: the `REC_*` flags go

Decided by the owner: after the cleanup, every `REC_*` flag is removed, what `on` does becomes what the site
does, and the code, routes, assets and settings that only `off` or `preview` reached are deleted.

- **Goal:** no feature flag in the webapp. One thread, one pull request per flag, each revertable by itself, as
  the recommendation plan asked for its own cleanup
  (`docs/implementation/recommendation-experience/README.md`, "Cleanup of replaced code").
- **How the flags work today.** `server/features.server.ts` reads one variable per feature on every call
  (`:13-25`, `:32-44`); unset or unknown means `off` (`:4-6`). `isEnabled` is true for `on`, and for `preview`
  only for the members in `REC_PREVIEW_USERS` (`:46-62`). The root loader resolves all of them for the viewer
  (`root.tsx:148`) and the browser reads them with `useFeature` and `useFeatures` (`hooks/useFeature.ts:10-19`).
  `REC_RELATED_MAP` is read on its own and is on unless it says `off`
  (`server/related-map.server.ts:54-67`).

**What each flag guards.** Every caller, from a search of `goodwatch-webapp/app` for `isEnabled`,
`getFeatureMode`, `getEnabledFeatures`, `useFeature`, `useFeatures` and the fields of `EnabledFeatures`.

| Flag (key) | Guarded by | Goes with the flag | Stays |
| --- | --- | --- | --- |
| `REC_TASTE_MATCH` (`tasteMatch`; `off`, `shadow`, `on`) | The vector query for recommendations (`server/user-recommendations.server.ts:73`, `server/guest-recommendations.server.ts:208`); the rebuild of a member's vector after a write (`server/taste/member.server.ts:199`); `/api/taste/match` (`routes/api.taste.match.ts:66`, `:79`); the match on cards (`ui/MovieTvCard.tsx:71`, `ui/watch-next/WatchNextPage.tsx:58`); two development routes (`routes/dev.title-cards.tsx:73`, `routes/dev.filter-bar.tsx:62`) | Shadow mode: the comparison log (`user-recommendations.server.ts:208-210`, `server/taste/shadow.server.ts:52`) | **The recommend call.** It is also the path of a person without a taste vector (`user-recommendations.server.ts:71-72`). The recommendation plan lists it for removal; the code needs it |
| `REC_FILTER_BAR` (`filterBar`) | Discover's browse page and the move of `/discover/movies` to `/discover?type=movie` (`routes/discover.($type).tsx:156-181`); `/search` moving to `/discover?q=` (`routes/search.tsx:29-40`); `/api/discover/results` (`routes/api.discover_.results.ts:71`, `:106`, `:162`); the full list in a search (`routes/api.combined-search.ts:101`); a member's taste in a search (`server/combined-search/taste-rows.server.ts:15`); the header's search box and the old filter chips (`ui/search/SearchJourney.tsx:178`, `:1000`); `searchHref` (`ui/navigation/destinations.ts:47`); `routes/dev.filter-bar.tsx:47` | The old Discover page: the rest of the route's loader (from `:183`) and the component under `:385`, with `ui/filter/FilterBar` and what only it imports. The search page behind `/search` (`JourneyResultsPage`, `JourneyFilters`); the route stays as the redirect, 301. The redirect of `/discover/movies` becomes permanent (`:165` says "Temporary, while the flag can roll back") | `ui/filter/FilterCountries.tsx` (settings and onboarding use it, by the recommendation plan); `ui/explore/MovieTvGrid` (`routes/$type.$category.$page.tsx:14`) |
| `REC_WATCH_NEXT` (`watchNext`) | `/watch-next` (`routes/watch-next.tsx:47`); `/my-movies` (`routes/my-movies.tsx:50`); the Wishlist's redirect (`routes/wishlist.tsx:76`); `/api/watch-next` and its siblings (`server/watch-next-request.server.ts:71`, `:97`; `routes/api.watch-next_.watched.ts:36-38`); Tonight's pick in the navigation (`ui/navigation/useTonightsPick.ts:47`); the Watch next destination (`ui/navigation/destinations.ts:75`); the old header's links (`ui/main/Header.tsx:51`, `ui/main/UserMenu.tsx:25`) | The Wishlist page: the route's loader after its redirects and its component (`routes/wishlist.tsx:83` on), `ui/filter/WishlistFilter.tsx` | `/api/wishlist-titles`: the account transfer uses it too (`ui/onboarding/AccountTransfer.tsx:82`) |
| `REC_TASTE_PAGE` (`tastePage`) | The Taste tabs (`routes/taste._index.tsx:65`, `routes/taste.tsx:6`, `server/taste-portrait/page.server.ts:23`); the new quiz (`routes/taste.quiz.tsx:63`); `/api/taste/portrait` (`routes/api.taste.portrait.ts:50`) | The unlock-ladder profile (`routes/taste._index.tsx:50-54`, `:68-82`, `:99-103`, `ui/taste/TasteProfile` and `ui/taste/features/`), the `api.taste-profile.*` routes and `server/taste-profile.server.ts`; the old quiz (`routes/taste.quiz.tsx:88-92`, `:113-131`, `ui/taste/TasteQuiz`), and then `/api/interest-discovery` with its server module and hook if nothing else imports them | Whatever the new quiz and the TV still import |
| `REC_EXPLORER` (`explorer`) | The page (`routes/explorer.tsx:31`); its endpoints (`server/explorer/http.server.ts:40`, `:63`); warming the pool at start (`server/explorer/index.server.ts:88`); the destination (`ui/navigation/destinations.ts:101`) | Only the checks | Everything else |
| `REC_NAVIGATION` (`navigation`) | The header, the dock and the dialogs against the old header and bottom navigation (`app.tsx:66`, `:72-102`); which code hydration waits for (`app.tsx:47-63`, `entry.client.tsx:33`); `/api/command-palette` (`routes/api.command-palette.ts:14-22`); every `useNavigation()` that can be null (`ui/navigation/NavigationContext.tsx:61-63`) and `useHasDock` (`ui/navigation/MobileDock.tsx:141-143`, read by `ui/filter-bar/Slab.tsx:254`, `ui/taste-quiz/TasteQuizPage.tsx:156`, `ui/watch-next/PhoneControls.tsx:440` and the room) | `ui/main/Header.tsx` with `ui/Search.tsx`, `ui/main/UserMenu.tsx` and `LazyUserMenu.tsx`; `ui/nav/BottomNav.tsx`; the branches for a page without the dock, and the room's rules for the old bottom navigation (`ui/living-room/living-room.css:304-331`, `:365-394`) | What `ui/filter-bar/Slab.tsx:18-22` imports from `BottomNav.tsx` moves out first. **The error page uses the old header**, see the checks |
| `REC_AGE_FILTER` (`ageFilter`) | Reading the ratings with the title snapshot (`server/title-snapshot/index.server.ts:141-145`); the viewer's age ladder (`server/title-filter/index.server.ts:291-298`); a part of Discover's cache key (`server/discover-results.server.ts:116`) | Only the parameter | The filter still hides itself when a snapshot has no ratings (`.env.example:58-59`) |
| `REC_TRACKING` (`tracking`) | The watch log's host (`app.tsx:67`, `:92`); the pages and endpoints (`routes/my-shows.tsx:39`, `my-library.tsx:48`, `my-movies.tsx:53`, `api.my-library.ts:18`, `api.tracking.show.ts:33`, `api.watch-log.ts:88`, `:93`, `api.new-episodes.ts:24`, `api.newly-available.ts:21`); a member's redirects (`routes/watch-next.tsx:51`, `routes/wishlist.tsx:72`); `server/watch-next-request.server.ts:101`; first-seen dates in the availability index (`server/availability-index.server.ts:286`); the start page's loader (`server/living-room.server.ts:83`, gone by then); the browser (`ui/navigation/useNewEpisodes.ts:30`, `ui/title-actions/useTitleActions.ts:28`, `ui/watch-next/FinishPrompt.tsx:27`, `ui/tracking/gate.tsx:37`, `ui/navigation/destinations.ts:125`, `:133`, `:141`) | The branches for a member without tracking: a movie's Seen as a plain toggle, the finish prompt without a watch, the show page without the status box and the episode list | Everything a guest gets: a guest has Watch next and no tracking, by who they are, not by a flag |
| `REC_RELATED_MAP` | `relatedMapEnabled` (`server/related-map.server.ts:59-67`), read at `:306` and `:387` and in `routes/api.related-map.ts:15` | The setting, and `"off"` among the lookup's answers (`:295-297`) | The related titles carousel: it also serves a title whose pack was not there in time (`ui/details/DetailsContent.tsx:64-67`) |
| `REC_PREVIEW_USERS` | `server/features.server.ts:46-52` | The list | |

**Goes at the end, with the last flag:** `server/features.server.ts`, `utils/features.ts`, `hooks/useFeature.ts`,
`features` in the root loader's data (`root.tsx:112`, `:148`), the `features` argument of `getDestinations` and
`searchHref` and the `available` field (`ui/navigation/destinations.ts:45-59`), and `HOME_TV` if slice 14 left
anything of it.

**Other places that name a flag:**

- **Settings files:** `goodwatch-webapp/.env.example:44-69`; `goodwatch-search/.env.example:36-46` and
  `goodwatch-search/test-deploy.sh:143-148`, because the search role is a second deployment that reads the same
  flags.
- **Tests that set a flag:** seven test files set `REC_TASTE_MATCH = "off"` when they load, which keeps the
  scheduled vector rebuild out of the test (`server/taste/member.server.ts:199`): `newly-available.test.ts:74`,
  `show-tracking.test.ts:76`, `tracking.test.ts:58`, `watch-state.test.ts:76`, `my-pages.test.ts:66`,
  `userData.test.ts:64`, `watch-log.test.ts:73`, all in `server/`. They need another way to hold it back before
  the flag goes. The tests of the flag itself are deleted (`watch-log.test.ts:182-193`,
  `show-tracking.test.ts:701-710`), and `ui/navigation/destinations.test.ts:6-16` no longer passes
  `NO_FEATURES`.
- **Development and harness routes that read a flag:** `routes/dev.filter-bar.tsx`, `routes/dev.title-cards.tsx`,
  `routes/prototype.watch-log-real.tsx:150`, `routes/prototype.episode-tracking-real.tsx:271`.
- **The benchmark:** the tap test's steps for the carousel (`goodwatch-benchmark/tap/tap.mjs:37`,
  `README.md:257`) and `smoke/search-role-urls.json:17`.
- **Documents:** `docs/serving-architecture.md:170`, `docs/implementation/related-map.md` ("How to turn it
  off"), `docs/search-role-deploy.md`, the rollout sections of
  `docs/implementation/recommendation-experience/README.md` and of `docs/implementation/tracking/`, and the
  drive scripts there that start a server with flags. They get one line saying the flag is gone, not a rewrite.

**Checks before any deletion:**

1. **For the owner: what production is set to.** The values live in Coolify and are not in the repository. For
   the webapp application and for the search role, each of the eight variables must read `on`
   (`REC_TASTE_MATCH` `on`, not `shadow`), and `REC_RELATED_MAP` must be unset or `on`. A flag that is `preview`
   or `off` anywhere means its old code is still what some visitors get; that flag waits.
2. **For the owner: `REC_RELATED_MAP` is a switch for trouble, not a rollout flag.**
   `docs/serving-architecture.md:170` lists it among the owner's settings: `off` and a restart bring the carousel
   back. Removing it removes that switch. Confirm that it should go with the others.
3. **Each flag `on` for seven days without new errors**, the rule of the recommendation plan ("Order").
4. **The error page.** Without the root loader's data every flag reads as off (`hooks/useFeature.ts:8-9`,
   `:18`), so the error page draws the old header and the old bottom navigation (`root.tsx:160-162`, `:239`).
   It needs a header that works without loader data before `REC_NAVIGATION`'s old code is deleted.
5. **The snapshot carries ratings** in production, or the age filter stays hidden whatever the code says.
6. **Old addresses keep answering:** `/search?q=`, `/discover/movies`, `/wishlist`, `/taste` for a guest.

**Order.** The checks first. Then one pull request per flag, the ones that only lose a check first and the one
the error page depends on last:

1. The error page gets its own header (no flag removed yet).
2. `REC_EXPLORER` and `REC_AGE_FILTER`.
3. `REC_RELATED_MAP`, if the owner confirms.
4. `REC_TASTE_MATCH`, with the tests' new way to hold back the rebuild.
5. `REC_FILTER_BAR`.
6. `REC_WATCH_NEXT`.
7. `REC_TASTE_PAGE`.
8. `REC_TRACKING`.
9. `REC_NAVIGATION`.
10. The flag modules, `REC_PREVIEW_USERS`, the settings files and the documents.
11. The owner removes the variables from Coolify, for both deployments, after the last deploy. The other way
    round turns a feature off: unset means `off` as long as the code still reads the variable.

In each pull request, a module goes only when nothing imports it any more. Remove the guard and its off branch,
then follow the imports; the build and `tsc` name what is left without a user.

- **Must not touch:** the behaviour with every flag on. No page, address or answer changes for a visitor.
- **Proof, per pull request:** `npm test` and `npm run build`; `tsc` against the baseline of `main`; a dev
  server started with every `REC_*` variable unset shows what `main` shows with all of them `on`, on the page
  the flag guarded, as a guest and as a member; the old addresses above answer as before; the error page draws
  (ask for an address that names no page); the first view's scripts of the two builds for each landing surface,
  which should not grow; after the deploy `./bench.sh smoke` and `./bench.sh budget`, with a limit that improved
  for good lowered in the same commit (`docs/benchmarks/viral-spike-render-path-budget.md`, "Margins").
- **Proof, at the end:** a search of the repository for `REC_` finds only documents that record the past.

## 7. Decisions for the owner

The numbers are those of the first version of this plan, so earlier messages about "decision 5" still point at
the right one.

### Decided on October 13, 2026

- **1. How it ships.** The flag is `HOME_TV` (feature key `homeTv`), without the `REC_` prefix. The plan stays
  as recommended: the new TV is built at `/home-preview` behind that flag and goes onto `/` by replacement.
- **3. The mini Explorer shows six islands**, as recommended: the six with the most titles for the person, in
  the prototype's six places, each joined to its nearest; "Sail to" offers the two nearest.
- **5, the second half. Phone landscape:** the TV on the left, the phone's Remote on the right, tilting
  properly toward the spot it points at ([slice 4b](#slice-4b-phone-landscape)).
- **New. Every `REC_*` flag is removed** after the cleanup, and what `on` does becomes the default
  ([slice 15](#slice-15-the-rec_-flags-go)). Two checks in that slice are the owner's: what production is set
  to, and whether `REC_RELATED_MAP` goes too.

### Waiting for a prototype

- **2. The moods on Discover's choice screen.** Being prototyped again as three tabs, Moods, Themes and Styles,
  with six options each. The result also has to say where Themes and Styles get their titles
  ([What waits for a prototype](#what-waits-for-a-prototype)).
- **4. The quiz's answers.** Being prototyped again as a strip from low to high with labels and the ten exact
  scores. One point of the old question remains whatever the result: "Not for me" is what today's TV calls
  Not interested (`ui/living-room/tv-flow.ts:133`), a title the person has not seen, so a rating should not be
  labelled with it.
- **The Expand transition** and **the Remote's Netflix and Prime Video keys**, which were not questions in the
  first version.

### Still open

- **5, the first half. The phone's height.** The strip at the bottom of the room that leads to the titles
  below it (the lip) takes 60 px, and the prototype was measured without it. Recommended: keep the lip, because
  it is the only way to the section below and that section holds the page's links for search engines. The cost:
  on a few more phones the Remote lies on the table instead of in the hand, and the shortest phones get a
  slightly shorter TV.
- **6. Where the doors' signals go.** The glossary puts the New episodes signal and titles that landed "on
  home's door". Recommended: the My shows tile carries the count, and the Tonight tile says "New on Netflix"
  when its pick landed in the last 14 days. The glossary changes with the switch.
- **7a. The "Watch on Netflix" button on a title.** Today, pressing it on the TV opens that title's page on
  GoodWatch. Proposed: pressing it opens Netflix itself (or whichever service is named on the button), at that
  title, in a new browser tab, and the TV stays where it was.
- **7b. No "Account" entry in the TV's menu.** The site's header above the room has the account already, and an
  entry on the TV would be a third way to leave it. "Sign in" stays in the menu: it goes to Google and comes
  back to the same TV screen.
- **7c. Two addresses nobody in the repository calls**, `/api/living-room` and `/api/living-room/services`, are
  deleted at the cleanup unless something outside the repository uses them.

Two changes to the first prototype's look that the rendering budget forces, for the owner to know: the Expand
key's brackets move twice and then rest instead of moving for as long as the key has the focus, and the tiles
that are not focused are dimmed by an overlay instead of a brightness filter. Both look the same at rest. The
first of the two is part of what the Expand prototype is now comparing.

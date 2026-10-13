# TV expand transitions prototype

Throwaway. Branch `prototype/tv-expand-transitions` (from `prototype/tv-screen-flow`). The question, in the
owner's words: "Expand animation: quick prototype showing different transitions (today, new, others) and focusing
on seamless transitions and easy navigation back".

Seven transitions from the approved Cinema TV into the **real** page behind its Expand key, on one route, and three
ways back from the real page into the same TV screen with the same focus.

**Recommendation: 3 Frame for the way out, the corner key plus Escape for the way back.** Details under
[Recommendation](#recommendation).

## Open it

`http://100.71.215.115:3157/prototype/tv-expand` (over Tailscale; the server is left running).

The destinations are the real routes with every `REC_*` flag on: `/discover?moods=funny` from the mini Discover
results, `/movie/546554-knives-out` from the title screen. Any other TV screen with an Expand key works too.

| Key | Button | What it does |
| --- | --- | --- |
| `1` to `7` | `1 Today` … `7 Wipe` | The transition (`?t=today\|grow\|frame\|morph\|camera\|live\|wipe`) |
| `B` | `Back: corner key` | The way back the real page shows: corner key, scroll-up bar, Escape only (`&back=key\|bar\|esc`). Works on the real page too |
| `W` | `Slow page` | The page's data takes 1.5 s longer (`&slow=1`) |
| `R` | `Reduced motion` | Reduced motion, whatever the system says (`&calm=1`) |
| `D` | `Results screen` / `Title screen` | The other of the two TV screens |
| Arrows, `Enter`, `Escape` | the Remote | Drive the TV. `Enter` on the Expand key leaves. `Escape` while a page is on its way cancels |
| `Escape` on the real page | the TV key or bar | Back to the TV, from any depth |

No key needs Shift or AltGr. On the phone the controls are behind the small `⋯` key under the TV.

To start it again:

```
cd goodwatch-webapp
npm ci
ln -s /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env .env
REDIS_READ_ONLY=on REDIS_COMMAND_TIMEOUT_MS=60000 \
SEARCH_DATABASE_URL= SEARCH_STORAGE_KEY= OPENROUTER_API_KEY= TYPESAFE_API_KEY= MILVUS_URL= \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3157 --host 0.0.0.0
```

### Where the real pages come from, and what the server may not do

The pages are served by this branch's dev server from production Crate and Valkey, as a reader only:

- `APP_ORIGIN` is not set, so the search history and poster impression endpoints answer 403. Nobody is signed in.
- Valkey is read only. This branch is 253 commits behind `main`, so a value it cached could have an outdated shape.
  `app/utils/cache.ts` on this branch answers every Valkey command that is not a plain read with null and never
  sends it (`REDIS_READ_ONLY=on`); the log shows the first one dropped (`set`). The same file reads the command
  limit from `REDIS_COMMAND_TIMEOUT_MS`, because the title snapshot's chunks take seconds from this machine.
  Without Valkey at all the title page works and Discover answers 503 (it needs the title snapshot).
- **Not changed:** over the Tailscale address the site's own analytics run (PostHog, the Google tag and Sentry are
  off only on `localhost`). Page views of the real pages from this server are sent like from any dev server viewed
  that way. All captures here used `localhost`.

## The transitions

Each row: what it bets on, and what it costs to build for real. Clips are the whole run, out and back; strips are
six frames of the motion itself. Desktop 1440 x 900, phone 390 x 844, both on the results screen.

| | Bets on | Desktop | Phone |
| --- | --- | --- | --- |
| **1 Today** | Nothing new: the real page is revealed from the TV's box by a growing clip, once its data is there | [clip](clips/1-today-desktop.mp4) ![out](strips/1-today-desktop-out.jpg) ![back](strips/1-today-desktop-back.jpg) | [clip](clips/1-today-phone.mp4) ![out](strips/1-today-phone-out.jpg) |
| **2 New** | Instant feedback: the brackets travel to the picture's edge, the picture itself grows to the window, the page fades in | [clip](clips/2-grow-desktop.mp4) ![out](strips/2-grow-desktop-out.jpg) ![back](strips/2-grow-desktop-back.jpg) | [clip](clips/2-grow-phone.mp4) ![out](strips/2-grow-phone-out.jpg) |
| **3 Frame** | The motif carries the whole way: today's clip, with the brackets riding its edge to the window and folding into the Back to TV key | [clip](clips/3-frame-desktop.mp4) ![out](strips/3-frame-desktop-out.jpg) ![back](strips/3-frame-desktop-back.jpg) | [clip](clips/3-frame-phone.mp4) ![out](strips/3-frame-phone-out.jpg) |
| **4 Morph** | The content is the thread: the TV's posters, title and backdrop fly to their places on the page | [clip](clips/4-morph-desktop.mp4) ![out](strips/4-morph-desktop-out.jpg) ![back](strips/4-morph-desktop-back.jpg) | [clip](clips/4-morph-phone.mp4) ![out](strips/4-morph-phone-out.jpg) |
| **5 Camera** | The room stays a place: it zooms into the TV until the screen is the window, the page already on the screen | [clip](clips/5-camera-desktop.mp4) ![out](strips/5-camera-desktop-out.jpg) ![back](strips/5-camera-desktop-back.jpg) | [clip](clips/5-camera-phone.mp4) ![out](strips/5-camera-phone-out.jpg) |
| **6 Live page** | Nothing swaps: the real page is loaded inside the TV at scale and only scales up | [clip](clips/6-live-desktop.mp4) ![out](strips/6-live-desktop-out.jpg) ![back](strips/6-live-desktop-back.jpg) | [clip](clips/6-live-phone.mp4) ![out](strips/6-live-phone-out.jpg) |
| **7 Wipe** | The eye is on the key: the page opens as a circle from the Expand key | [clip](clips/7-wipe-desktop.mp4) ![out](strips/7-wipe-desktop-out.jpg) ![back](strips/7-wipe-desktop-back.jpg) | [clip](clips/7-wipe-phone.mp4) ![out](strips/7-wipe-phone-out.jpg) |

The phone's way back is in `strips/<n>-<name>-phone-back.jpg`. On the title screen:
[Frame](clips/3-frame-desktop-title.mp4), [Morph](clips/4-morph-desktop-title.mp4) (the backdrop and the title
fly: ![morph, title](strips/4-morph-desktop-title-out.jpg)), [Camera](clips/5-camera-desktop-title.mp4).

### What each costs to build for real

Same-document View Transitions exist in Chrome and Edge since 111, Safari since 18, Firefox since 144. Run here:
Chromium 153 (all seven), Firefox 157 (Frame, Camera and Morph, both ways, with the same named elements:
[a Firefox frame](states/firefox-frame.jpg)). **Safari was not run.** With reduced motion every transition is a
plain page change.

| | Browser API | Needs from the destination pages | Without the API | Size |
| --- | --- | --- | --- | --- |
| 1 Today | View Transitions through the router's `viewTransition`; one `clip-path` keyframe | Nothing | Plain navigation | Exists (`tv-transition.ts`, `main.css`) |
| 2 New | None for the growing picture (it is the room's own motion), a 0.26 s root fade through View Transitions at the end | Nothing; the page's data must be asked for at the press and the navigation made when the picture has grown | The page replaces the grown picture in one frame | Medium. The prototype grows the picture by changing its box every frame; for real it has to be a `transform` (rendering budget) |
| 3 Frame | Today's, plus four fixed corner elements with a `view-transition-name` each | Nothing | Plain navigation, the brackets disappear | Small: about 40 lines beside today's code |
| 4 Morph | `view-transition-name` on every shared element, on both sides | Each page type names its counterparts (first cards, `h1`, backdrop), has them in its first frame, and shows the same titles in the same order as the TV. A name used twice skips the whole transition | Plain navigation | Large, and per page type |
| 5 Camera | Two keyframes on the two root pictures (`transform`, `clip-path`, `opacity`) and a `view-transition-name` on the site header so it stands still | Nothing | Plain navigation | Small |
| 6 Live page | An `iframe` of the destination inside the start page | Nothing, but it is a second copy of the whole app while the Expand key has the focus: code, data, memory, a second page view in analytics, and again each time the person comes back | Works without View Transitions | Not a candidate as built. It is here as the reference for "nothing swaps" |
| 7 Wipe | Today's with a `circle()` instead of an `inset()` | Nothing | Plain navigation | Trivial |

### Findings

- **The plan's unproven mechanism holds** (section 4, "the brackets grow with the frame"). Four corner elements,
  each with its own name, travel from the picture's edge to the window's edge exactly with the clip, in Chromium
  and in Firefox. One element for all four brackets would be stretched on the way (the TV and the window have
  different proportions); four elements only move. Two changes to the plan's sketch: the brackets are placed by
  script just before and just after the page is swapped (CSS with `:has(.living-room)` was not needed), and the
  room's own brackets are hidden for that moment so the two sets never show together.
- **Discover's first results are in the page's first frame.** In three fresh browsers the posters stood at the
  very frame the page was swapped in, so no transition lands on an empty grid.
- **Timing, dev build, quiet machine, Frame:** from the press to the first moving frame 0.5 s (data 0.03 to 0.3 s,
  then 0.15 to 0.3 s in which the browser stands still while React builds the page inside the transition), the
  motion 0.85 s. Back: the motion starts 0.12 s after Back and takes 0.45 s. Production was not measured (a
  production server must not run on this machine). The recorded clips are slower than that: recording costs time.
- **The focus on return needed two things** that the plan does not mention: the cursor rests wherever the person
  left it on the real page, often over a tile of the TV, and takes the focus the moment the room is back (fixed
  here: hover counts only after the cursor has really moved); and after the browser's Forward and Back again the
  address no longer carries the focus (fixed here by keeping it with the trip, not only in the address).

## The way back

Half of the task. All three are built; `B` switches between them, on the room and on the real page.

![the ways back, desktop](back/desktop.jpg)
![the ways back, phone](back/phone.jpg)

| Way back | What it is | For | Against |
| --- | --- | --- | --- |
| **Corner key** | A small TV with its brackets pointing inward (the Expand motif reversed) and the word "TV", pinned at the bottom right, 44 px high, above the phone's dock. Hovered or focused it says where it lands ("Discover › Funny") | Always reachable, also for a finger; sits in the corner the Expand key was pressed in; with Frame the brackets fold into it on arrival, which shows where the way back is | One more thing on every page reached from the TV. On the phone's Discover it floats above 170 px of dock and filter bar |
| **Scroll-up bar** | A tab hanging under the header at the top of the page; it hides while the person scrolls down and returns, with the destination's name, when they scroll up | Nothing on the page while reading | It is gone exactly when someone deep in a page looks for it, and it covers the page's top edge |
| **Escape only** | No control. A hint for 4.5 s on arrival ("Esc returns to the TV"; on the phone "The browser's Back returns to the TV") | No clutter at all | Invisible afterwards, and nothing for a finger |

In every variant:

- **The browser's Back** runs the transition in reverse into the same TV screen with the same focus (checked for
  all seven, desktop and phone).
- **Escape** on the real page goes back to the TV, unless the page's own dialog or menu is open or the person is
  typing.
- **Two pages deep** (a title opened from Discover): the control is still there and still says "TV". It goes
  straight to the TV screen the person left (one history move over both pages), with the transition; the browser's
  Back goes one page at a time, as always. After the browser's Forward the control is back.
- **A reload** of the real page keeps the way back (the trip is in `sessionStorage`).
- A page reached from the room by another way than the Expand key (the header, the dock) gets no control. This
  one is by the code only; it was not run.

## The other cases

- **A slow page** (`W`, 1.5 s): ![waiting](states/slow.jpg)
  Today shows nothing until the page comes. The others say at once that something is coming: the frame breathes
  and, after 0.35 s, a line reads "Opening Discover · Esc cancels"; New has already grown the picture; the Camera
  has begun to lean in. **Escape cancels while waiting**: the navigation is dropped and the lead-in runs backwards
  (checked for Today, New and Frame). Backspace and the Remote's Back key are wired to the same; they were not run.
- **Reduced motion** (`R`, or the system's setting): the frame stands at the picture's edge at once, the page
  replaces the room without any animation, and so does the way back (0 running animations measured, both ways,
  for Frame, Camera, New and Live page). The line still says what is coming.
- **The phone**: every transition runs at 390 x 844 (clips above). The TV is almost as wide as the window there,
  so the Camera's zoom is only 1.08x and reads as the page opening downward.
- **Back in the middle of the way out**: [clip](states/back-during-frame.mp4)
  ![every frame](states/back-during-frame.jpg)
  A view transition cannot be turned around. The router skips the running one, the page stands whole for the
  moment the room takes to build, and then the normal way back runs. That is one jump, in every transition built
  on View Transitions (1, 3, 4, 5, 7). I tried starting the way back from where the way out had come to; it added
  a second jump and is removed. Only New can turn around smoothly, and only while the picture is still growing in
  the room.

## What is not seamless, and why

1. **The picture in the TV's box cuts from the mini screen to the page** at the first frame (Today, Frame, Wipe).
   They are two layouts of the same thing. The Camera softens it with a 0.26 s fade, Morph bridges the parts both
   sides have, only Live page avoids it.
2. **The browser stands still while the page is built** inside the transition (0.15 to 0.3 s in the dev build).
   The lead-in in the room cannot run during it.
3. **Back in the middle of the way out jumps** (above).
4. **Morph's posters change in flight**: the TV shows the prototype's sample titles, the real page its real first
   results. For real the TV would have to show the page's own first results.
5. **Live page loads the page twice**, and again after each return.
6. **The Camera's header shimmers**: the site header is 90% opaque, so the zooming room shows through it.
7. **Today with a slow page gives no sign at all** for as long as the data takes. That is today's behaviour,
   reproduced as it is.

## Recommendation

**Out: 3 Frame.** It is the approved motif carried to the end, it is the smallest step from what runs today, it
needs nothing from the destination pages, it behaves the same on the desktop and the phone, and the mechanism the
plan called unproven works in two engines. From New it should take two things: the brackets' short travel when
the key is pressed without having the focus, and the waiting state with its cancel.
Second choice: **5 Camera**, if the room should feel like a place one leans into; it costs the same, but it is
weak on the phone and leaves the brackets behind. Morph is the best of all on the title screen (backdrop to
backdrop, title to title) and could be added there later; as the general way out it asks too much of every page.
Not Live page, not Wipe, and not New as built (the blown-up mini picture and its swap are the least seamless
moment of all seven).

**Back: the corner key, with Escape and the browser's Back doing the same.** It is the only one that is always
reachable and works for a finger. It lands on the TV screen the person left, from any depth.

## Questions for the owner

1. Frame or Camera?
2. How long does the corner key live? Built: for as long as the TV's entry is behind the person in this tab's
   history, at any depth, through reloads. Should it go away after some pages, or stay?
3. From two pages deep the key jumps straight to the TV. Right, or one page at a time like the browser's Back?
4. On the phone the key floats above the dock (and above Discover's filter bar). Keep it there, or give it a
   place in the dock?
5. Escape on a real page reached from the TV goes back to the TV. Is that wanted on the real pages, where Escape
   also closes dialogs and the search?

## Files

- `goodwatch-webapp/app/routes/prototype.tv-expand.tsx`: the route
- `goodwatch-webapp/app/ui/prototype-tv-expand/scene.tsx`: the room, the lead-in, the controls
- `goodwatch-webapp/app/ui/prototype-tv-expand/trip.ts`: the transitions and the way back, as plain DOM code
- `goodwatch-webapp/app/ui/prototype-tv-expand/host.tsx`: the transitions' CSS and the controls on the real page
- `goodwatch-webapp/app/root.tsx`: mounts `host.tsx` in development only (a production build drops it)
- `goodwatch-webapp/app/utils/cache.ts`: `REDIS_READ_ONLY` and `REDIS_COMMAND_TIMEOUT_MS`, for this branch only
- `goodwatch-webapp/vite.config.js`: the route and the folder in `PROTOTYPES`
- `docs/prototypes/tv-expand-transitions/`: this file, `clips.mjs` (records a clip and its strips), `clips/`,
  `strips/`, `back/`, `states/`

Imported and not changed: the Cinema TV, its phone room and Remote, and the pointer from
`ui/prototype-tv-design/`, the engine and sample data from `ui/prototype-tv-flow/`, today's transition from
`ui/living-room/tv-transition.ts`. The desktop room's layout is copied into `scene.tsx`, because
`prototype-tv-design/scene.tsx` does not export it and is being edited elsewhere.

How it works, for whoever builds it: the router starts a view transition once the next page's data is there. The
prototype wraps `document.startViewTransition` to mark `<html>` and place the brackets just before the old picture
is taken and just after the page is swapped, and wraps `fetch` to hold the page's data request until the room's
lead-in is over (and to simulate the slow page). Production needs neither wrapper: the marks can be set at the
press, as `tv-transition.ts` does, and the hold becomes a prefetch at the press with the navigation at the end
of the lead-in.

## Checked

- `npx remix vite:build` passes. The build's scripts contain none of the prototype (in it the root's
  `TvExpandHost` is `null`); the read-only switch in `cache.ts` is server code and is in the server bundle.
- `npx biome lint` on the four new files: clean. `tsc` reports no error in them.
- All seven transitions, out and back, desktop and phone, land on the same TV screen with the focus on the Expand
  key (the 17 runs that made the clips each print it).
- The ways back, two pages deep, Forward and Back again, a reload, the slow page and its cancel, reduced motion:
  by script, with the screenshots above.
- Not checked: Safari, a production build's timing, a real phone (the phone is Chromium at 390 x 844 with touch).

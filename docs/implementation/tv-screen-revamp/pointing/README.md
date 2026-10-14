# Slices 4 and 4b: pointing

The ring pointer over the TV's picture, the Remote that follows the cursor (a swing under the TV, a nod beside
it), a finger that points on the phone and on any touch screen, and the phone's Remote in landscape, which turns
about its grip toward the spot it points at. On `/home-preview`. Proof for [the plan](../README.md), slice 4 and,
as far as pointing goes, slice 4b. Taken on October 13, 2026.

## What is built

- **`tv/pointing.ts`**, a chunk of its own: one `pointermove` listener, one frame loop that eases two transforms
  (the Remote's, the ring's) and stops when both have arrived. It sets no React state on a move; the ring's states
  are attributes written when they change. The machine sees `focus` and `choose` and nothing else: a finger's
  `focus` goes through the room's seam (`RoomTv.point`), and letting go is the item's own click.
- **`tv/pointing-aim.ts`**, pure and tested: where each of the three Remotes should be for a spot, how the ring
  steps out above a dragging finger, and how it is kept on the picture.
- **`tv/TvPointer.tsx`**: the ring's markup and the hook that asks for the chunk at the first interaction.
- **The ring's rules** in `tv.css`. The system cursor is hidden over the picture only, and only while pointing
  runs and the TV is on (`data-pointing="live"` on the room, written by the loop). If the chunk never comes, the
  system cursor stays and a click and a tap work as before.
- **Landscape:** `layoutPhoneLandscape` now says how far the Remote may turn (`turnLimit`): until its top corner is
  3 px from the picture's edge, 22 degrees at most.

## Run it

Two dev servers of `goodwatch-webapp`, both with every `REC_*` flag on, as for [slice 3](../home/README.md): a
guest's on real data, as a pure reader (no `APP_ORIGIN`), and the tracking harness without any service for a
member.

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3184
```

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3185
```

`http://localhost:3184/home-preview` and `http://localhost:3185/prototype/my-library-real/tv?member=six`.

Two dev servers in one checkout share Vite's dependency cache. Start the first, load its page twice, then start
the second and load its page twice: started together, each breaks the other's first load ("more than one copy of
React").

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3184 \
MEMBER=http://localhost:3185 node drive.mjs
```

`drive.mjs` checks the page, measures, and writes `checks.json`, `shots/` and the sheets here. `drive.mjs checks`,
`landscape`, `budget` and `shots` do one part. For the measurements against a production build: `npm run build`,
serve it without any service (`NODE_ENV=production PORT=3186 npx remix-serve ./build/server/index.js`, with the
flags on and no `.env`), and `BUILD=1 GUEST=http://localhost:3186 node drive.mjs budget`. `CONTROL=1` measures
the same without pointing, `NOREPLAY=1` with the error reporting's session recorder off.

## What the checks say

400 checks pass, none fail, and the measurements under [Numbers](#numbers) are 12 more (`checks.json`).

They are the prototype's checks for the mouse and for a finger (its `walk.mjs`), ported to the product's markup,
and new ones for landscape. At each step the script reads the page: the TV's address and focus, the ring's
attributes and place, the Remote's transform, and the boxes of the picture, the TV's body and the Remote.

- **The mouse, the Remote under the TV** (1920 x 1080, a guest and a member):
  - Before the first interaction pointing's code is not asked for, nothing points, and the system cursor shows.
    The first mouse move asks for it.
  - Over the picture the ring appears where the cursor is and the system cursor is hidden there, and only there.
    The item under the ring takes the focus and the ring closes around its dot; a click is OK.
  - The ring hides when a key is used, comes back on movement, and fades after 3.2 s without movement.
  - The Remote swings 42 degrees toward each corner and no further, leans back further for the top corners (22
    degrees against 17), rolls toward the cursor's side, follows the cursor over the site's header, and its
    streaming row stays in the room while it is turned.
  - Over its own keys it settles at rest, with the key under the cursor where it was. A key of the Remote moves
    the focus, hides the ring and leaves the Remote still. It is at rest after the cursor left the window.
  - Following the cursor over the room changes the Remote's `style` and nothing else in the page (a
    `MutationObserver` on the whole document).
  - With the menu open the ring points at the menu's items, and an item under the menu takes no focus.
  - With the TV off: no ring, the system cursor, the Remote at rest. Below the room (the lip): the same, and
    back in the room it points again.
- **Beside the TV** (1440 x 800): the Remote nods 13 degrees at most, left for the left corners and right for the
  right ones, rolls up to 26 degrees instead, and its body stays right of the picture at every corner and for
  every spot on the picture (24 px clear at the least).
- **A finger on the phone** (390 x 844 with the Remote in the hand, for a guest and a member; 375 x 667 with it
  on the table):
  - The very first tap comes before pointing's code and opens what it lands on, as a tap always did.
  - **A tap** shows the ring where the finger landed (the smaller ring), the Remote aims, the tapped app opens,
    then the ring is gone and the Remote has no transform at all.
  - **A press held still for a second** on the menu's Search, which has Home above it: the ring stays under the
    finger, Search has the focus, and letting go opens Search.
  - **A drag:** 6 px is not a drag; after 10 px the ring steps out 46 px above the finger, the item under it has
    the focus, the focus goes where the ring goes, the Remote follows (held, it leans back; lying, it turns and
    does not lean), nothing scrolls, nothing is selected, a held finger opens no menu, and letting go opens the
    app under the ring. Let go over nothing, nothing opens. A finger that left the picture by more than 24 px
    points at nothing.
  - Pointing at the picture's corners and sides, the turned Remote stays under the TV (30 px clear in the hand,
    3 px on the table) and turns 11 degrees at most in the hand, 3.5 on the table.
  - A key of the Remote works as before and neither aims the Remote nor shows the ring. A tap beside the open
    menu closes it. A finger dragging up on the TV or on the Remote scrolls nothing.
- **Landscape** (844 x 390, 932 x 430, 667 x 375): see [below](#landscape).
- **Reduced motion:** with the mouse the ring is drawn at the cursor without lag and without a fade, and the
  Remote does not aim, not for a corner either; the focus and a click work the same. With a finger the ring is
  under it at once, steps out above a drag at once, and the Remote has no transform throughout.
- **The room on a touch screen** (1920 x 1080 with touch): a finger on the picture shows the ring and turns the
  Remote in the hand toward it, and the app opens.
- **Nothing in the console** in any of these runs.

## Numbers

**The first view.** Two production builds, the branch point (`f9df021a`) and this slice:

| | Branch point | Slice 4 | |
| --- | --- | --- | --- |
| Pointing's chunk | | 7,994 bytes, 3,408 gzip, 3,110 Brotli | Not in the route's manifest entry: asked for at the first interaction |
| The route's script (`home-preview`) | 43,905 bytes, 15,852 gzip, 14,428 Brotli | 45,604 bytes, 16,571 gzip, 15,066 Brotli | 1,699 bytes more, 719 gzip, 638 Brotli: the ring, the hook, the scene and the landscape turn limit |
| `tv.css` | 2,404 bytes, 891 gzip, 741 Brotli | 3,561 bytes, 1,181 gzip, 1,008 Brotli | The ring's rules |
| The shell, on every page | 170,523 bytes | 170,523 bytes | Unchanged |
| Scripts the route's manifest entry names | 10 | 10 | No script more in the first view |

**The rendering budget** (#190), at 1920 x 1080 on the dev server, with a GPU and with `--disable-gpu`. The
script wraps `requestAnimationFrame` to count the frames the page asks for and time each, observes the tasks over
50 ms, and reads the main thread's busy time from the browser.

| | With a GPU | `--disable-gpu` | The budget |
| --- | --- | --- | --- |
| Following the cursor for 6 s: frames asked for | 360 | 361 | |
| Main thread per frame of the loop, mean and longest | 0.12 ms, 0.5 ms | 0.10 ms, 0.7 ms | 10 ms |
| Tasks over 50 ms while following | none | none | none |
| At rest: frames asked for in 5 s | 0 | 0 | nothing animates at rest |
| At rest: the main thread is busy | 0.01% of a core | 0.01% of a core | 5%, and 10% under software rendering |
| Ten focus moves by the ring: tasks over 50 ms | none | none | none |

- **Following the cursor** is the Remote and the ring following it around the four corners and twice across the
  picture over no item: pointing alone, no focus move. Without pointing the page asks for no frame at all there,
  so the 360 frames are the loop's, one per display frame while something moves.
- **At rest** the loop has stopped: no frame in five seconds. The busy share is the page's main thread only, not
  the GPU process or the compositor.
- **A focus move by the ring** is slice 3's cost (the home is drawn again and its picture cross-fades), not
  pointing's.
- **The site's own first-interaction code** comes about four seconds after the first interaction, on every page
  (the telemetry and the navigation's panels), and running it is one task of about 100 ms. The measurement
  starts after it.
- This run passed twice in a row, on a machine other work shares, at a load average of 3 to 5.

**Against a production build the result is not settled.** The build was served without any service
(`BUILD=1`). The loop's own frames cost the same there (0.1 to 0.5 ms on average) and at rest it asks for none.
But in 8 of 12 measured sweeps one to four tasks of 53 to 151 ms ran while the Remote followed the cursor.

- Where the browser names a script of 25 ms or more for such a task (its long-animation-frame attribution), it
  is the error reporting's listener, `document.onmousemove` in the Sentry chunk, seven times.
- The same sweep without pointing (`CONTROL=1`: its chunk replaced by an empty one) had no such task in 6
  sweeps.
- With the error reporting's session recorder off (`NOREPLAY=1`: its two sample rates set to 0 in the chunk as
  served) 4 of 6 sweeps had none; the other two were under software rendering while another thread's job took
  the machine's load average from 4 to 12. In that stretch the browser even named pointing's own `pointermove`
  handler, a dozen assignments, for 51 ms: the browser was not getting the CPU, and no number from then means
  much.
- What this points at, and does not prove: Sentry Replay keeps a buffer of every session
  (`replaysOnErrorSampleRate` is 1, `telemetry/config.ts`) and records every change to the page. While the
  Remote follows the cursor that is two `style` changes a frame, as it was with the old TV's spring.
- **For slice 12, on a quiet machine:** `BUILD=1 node drive.mjs budget`, then the same with `NOREPLAY=1` and
  with `CONTROL=1`. If the recorder is the cost, the Remote and the ring can be kept out of the recording, or
  moved with the Web Animations API, which changes no attribute.
- Also not measured: Lighthouse's "Avoid non-composited animations" (pointing writes `transform` from script;
  there is no CSS animation in it), and the tab hidden for a minute.

## Landscape

The prototype has no landscape. Decided by the owner: the TV on the left, the phone's Remote on the right, and the
Remote tilts properly toward the spot it points at. Slice 2 built the layout; this is the tilt.

- **It turns about the grip under its keys, toward the picture on its left.** How far: the angle from the grip
  to the spot's share of a quarter turn, of the turn it has. A spot straight over it would leave it upright; a
  spot level with the grip, a quarter turn away, turns it as far as it may go.
- **How far it may go** is the layout's: until its top corner on the TV's side is 3 px from the picture's edge,
  and 22 degrees at most. That is 20.7 degrees at 844 x 390 and 20.4 at 932 x 430.
- **It leans back** further for a spot higher up (up to 11 degrees), **rolls toward the TV's side** for a spot
  further left (up to 10), and lifts up to 8 px for a spot high up.
- **It eases** as the other Remotes do and **rests flat**, with no transform, so its keys are hit where they are
  drawn. With reduced motion it does not move.
- **Lying on the table** (a scene too short to hold it, as at 667 x 375, where the site's header and dock leave
  239 px) it only shifts: 3.5 degrees at most, no lean, no roll.

What the checks say, at each of the three sizes:

- Every one of the 11 keys is 44 px or more, inside the window, under nothing, and does what it says on a tap.
- A tap, a held press and a drag point as in portrait: the ring under the finger, 46 px above it once it drags,
  the focus where the ring goes, OK on letting go.
- A held finger at sixteen spots across the picture: for every one the Remote turns to the left, between 9 and
  20 degrees in the hand (2.8 to 3.3 lying), further for a spot further left and for one lower down; it leans
  back further for a spot higher up and rolls further for one further left.
- **The Remote's body never crosses the picture's edge**: 14 px clear at the least at 844 x 390, 16 px at
  932 x 430. And nothing of the Remote or the hand is drawn over the picture: with the Remote turned as far as it
  goes, no pixel of the picture's right 70 px differs from the picture at rest.
- Below the room by the lip and back: pointing waits while the room is away and runs again after.
- A short, wide window with a mouse (900 x 420) has the same room: the ring shows over the picture, the Remote
  turns toward the cursor and rests flat over its own keys.

**For the owner to look at:** [landscape.jpg](landscape.jpg). Two things there are choices of this slice, not
of the plan:

- The turn is a share of the angle, not the angle itself. The plan says "by the angle from the grip to the spot,
  as far as it can". Every spot on the picture is 37 to 87 degrees from the grip and the Remote has about 20, so
  by the angle itself it would stand at its limit for every spot and never move as the finger moves. As built it
  turns 9 degrees for the picture's top right and 20 for its bottom left.
- The apps' row is level with the grip, so along it the turn stays at its limit and only the roll follows the
  finger.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): the prototype's strip of the ring pointer, and
  under it a guest and a member at 1920 x 1080 at six stops (the four corners, over an app, over a key of the
  bar), and the nod at 1440 x 800.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the prototype's strips of a tap and of a press held
  and then dragged at 390 x 844, and under them the same for a guest and a member, and the Remote on the table.
  The grey disc is the finger; the script draws it.
- [landscape.jpg](landscape.jpg): 844 x 390, 932 x 430 and 667 x 375, at rest, with a held finger at five spots,
  and dragged.
- `shots/`: each picture by itself.

The app a tap opens says "This screen is not built yet": Tonight, Discover and the others are the next slices'.
The Expand key is slice 11's, so the ring's amber over it is built (`data-out`) and not shown here.

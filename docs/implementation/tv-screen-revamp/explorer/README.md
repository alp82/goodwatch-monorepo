# Slice 7: the mini Explorer

> Since October 14, 2026 the webapp reads no `REC_*` feature flag: what `on` did is what the site does
> (`docs/implementation/tv-screen-revamp/rec-flags/`). The flags here record how this was built and run then. A server
> of a later commit needs none of them.

The Explorer on the new TV: a small map of six islands of the real mood map, an island with its first four
titles, and "Sail to" its two nearest islands. For a guest and a member, on `/home-preview`. Proof for
[the plan](../README.md), slice 7. Taken on October 13, 2026.

## Run it

Two dev servers of `goodwatch-webapp`, both with every `REC_*` flag on, as for
[slice 5](../tonight-title/README.md).

**A guest, on real data.** The server reads production Crate and Valkey and must stay a reader: no `APP_ORIGIN`.

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3207
```

`http://localhost:3207/home-preview?tv=explorer`. The Explorer answers 503 until the title snapshot and its own
pool are loaded, a minute or two after the server starts; the map then says "The map is on its way."

**A member, on the tracking harness** (`/prototype/my-library-real/tv?member=six`, a server without services):

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3208
```

What the harness cannot show: it has no title snapshot, so its Explorer answers nothing. The drive script plays
back, in the browser, the map the reading server gives a person with eight ratings, Netflix and Prime Video.
That is what a member's map is: a taste, On my services, their own counts. The request the page makes there is
a member's (a GET); nobody is signed in anywhere in this proof.

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3207 \
MEMBER=http://localhost:3208 node drive.mjs
```

`drive.mjs` checks the pages and writes `checks.json`, `shots/` and the sheets here. `drive.mjs checks` and
`drive.mjs shots` do one of the two; a whole run takes half an hour on a busy machine, and
`PARTS=walk,person,links,sizes,html` runs some of the checks. It signs in nowhere and writes to no server.

## What was built

- **The map** (`?tv=explorer`): the six islands of the real mood map with the most titles for the person, as
  flat islands in their own colours with their names inside, joined by dotted bridges, on the picture of the
  island that has the focus. Under the map, what sets the focused island apart and how many titles it holds.
- **An island** (`?tv=explorer&island=<id>`): its first four titles as the TV's list, the focused title's name
  and facts over a row of posters, and "Sail to" with the two nearest of the six. A title opens its title screen,
  named at once from what the map knows.
- **Sail to** puts the island next door in this island's place: no new history entry, so Back from any island is
  the map, with the focus on the island the person stepped onto.
- **One request for the whole app**, `/api/explorer/map?grouping=mood`, asked for when the Explorer's tile first
  has the focus. An island's screen asks for nothing.

The machine had the Explorer's screens, items, addresses and transitions from slice 1; this slice changes nothing
in it.

### Which six, and where

`tv/tv-explorer.ts`, pure, with tests.

- **Which six:** the islands with the most titles for the person (`ExplorerIsland.count`), most first; an island
  without titles is none. The count is the Explorer's own, under its default filters: Not seen yet, and On my
  services for a person with services. So a person's six are their own: a guest nobody knows gets Funny,
  Thrilling, Sad, Dark, Cozy and Scary on the day; a person with Netflix and Prime Video gets Romantic in
  Scary's place.
- **Where:** the six places are the prototype's (three along the top, two under them, one at the far right).
  Both the islands' real positions and the places are spread over the same square, and of the 720 ways to give
  six islands six places, the one that moves them least wins. What is west on the real map is left here, what
  is north is on top: Dark, Sad, Cozy along the top, Scary and Thrilling under them, Funny at the far right.
- **Next door:** the nearest islands on the real map, by the islands' positions. A bridge joins each island to
  its nearest (three bridges on the day: Dark and Scary, Sad and Thrilling, Cozy and Funny). "Sail to" offers
  the two nearest of the six, nearest first.
- **A link can name any island of the map.** One that is not among the six shows its titles and sails to the
  nearest of the six; one the map lacks says so and keeps its bar.

### The look

The owner preferred flat named islands that read as a map (Marquee's map) in Cinema's look. Cinema's own
prototype map has round stills with the names under them, so this is new, and it is in
[desktop-beside-prototype.jpg](desktop-beside-prototype.jpg) beside both.

- An island is a flat shape in the island's own colour from the Explorer, each of the six places with an outline
  of its own, with a thin ring of the same colour around it. Its name is inside, large: 38 canvas px on the
  desktop (40 px on a 1920 x 1080 window), 25 on the phone (18 px at 390 wide). The ink is white or near black,
  whichever stands out more on the colour.
- From Cinema: the picture behind everything is the focused island's (its first title's backdrop) and
  cross-fades as the focus moves; the focused island comes forward with the tile's white edge, the others sit
  back in the dark; the bridges are Cinema's dotted lines; the type is Cinema's.
- **The phone** has the six three by two, in the places' reading order, as the prototype has. Each is a touch
  target. The row under them is the Expand key's; beside the key it says what sets the focused island apart.
- **An island's screen** is the prototype's list. On the desktop a "Sail to" key carries the island's colour as
  a small island. On the phone the two keys stand beside the Expand key's corner without the words "Sail to",
  as in the prototype; a screen reader hears "Sail to Sad".

### The direction keys on the map

Slice 1 pinned the direction rule on the prototype's round islands, where two moves were odd: Down from the far
right island went to the bottom row's island at its left, and Up from that island went back to the far right
one. The rule is unchanged; the places are tuned so that every move is what the map shows
(`MAP_PLACES` in `tv/tv-explorer.ts` says how), and `tv-explorer.test.ts` pins every direction from every
island, the Expand key and the bar, at rest sizes, with the focused tile grown, and with the TV shown smaller
and larger. The rule's own test (`tv-move.test.ts`) has the real places in place of the round islands, with the
two moves that were odd.

| From (the day's island) | Up | Down | Left | Right |
| --- | --- | --- | --- | --- |
| Top left (Dark) | Back | Scary | stays | Sad |
| Top middle (Sad) | Back | Scary | Dark | Cozy |
| Top right (Cozy) | Back | Thrilling | Sad | Funny |
| Bottom left (Scary) | Dark | Expand | stays | Thrilling |
| Bottom middle (Thrilling) | Cozy | Expand | Scary | Funny |
| Far right (Funny) | Menu | Expand | Cozy | stays |
| The Expand key | Funny | stays | stays | stays |
| The bar | stays | Cozy | along the bar | along the bar |

- The far right island reaches up beside the top row and down beside the bottom row. So Right from either row
  lands on it, and Up and Down from it leave the map: the bar's Menu over it, the Expand key under it.
- Down and Up between the rows come back to where they started (Dark and Scary, Cozy and Thrilling, Funny and
  the Expand key).
- On the phone the map is a grid, and the moves are a grid's.
- The Expand key is slice 11's and is not drawn yet. In a browser, Down from the bottom row and from the far
  right island therefore stays where it is today; the pinned moves to and from the key are the tests'.

## What the checks say

601 checks pass, none fail.

- **The map's answer, asked directly.** `private, no-store`. Twelve islands, each with twelve titles for a guest
  nobody knows and 15 to 22 for a person with a taste. A person with ratings and services gets a taste and On my
  services, and their six are not the stranger's.
- **The walk, six times:** a guest at 1920 x 1080 and 390 x 844 on real data, a member at both sizes on the
  harness, and a guest with eight ratings, Netflix and Prime Video in their browser at both sizes. After every
  step the script reads the TV's state from the page, and holds it against the map's answer, worked out again in
  the script.
  - **Nothing in the first view:** the Explorer's code and the map are not asked for on arrival, nor at the
    first key press. Both are asked for when the Explorer's tile has the focus, the map once: a guest with POST
    and their browser's ratings, country and services and nothing else of their progress, a member with GET.
  - **The map:** OK on the tile is one history entry. Six islands in their places, in the machine's order, the
    focus on the first, each with its name inside; "Six islands" in the bar; a bridge from each island to its
    nearest.
  - **Every direction from every island,** 24 presses, on the desktop and on the phone: the table above, with
    the focus staying where the table says Expand. Up from the top row is the bar, Down from the bar the top row.
    No move changes the address or adds a history entry.
  - **The focus:** the map says what sets the focused island apart and how many titles it has, and the picture
    is its first title's backdrop, `w1280` on the desktop and `w780` on the phone.
  - **An island:** OK is one more history entry and asks the server for nothing. Its first four titles and the
    two nearest of the six, in the machine's order; the first title's name and facts (the year, what it is, its
    score, and for a person with a taste and services the match and "On Netflix"); every poster named; each
    "Sail to" key says so to a screen reader.
  - **Along the row:** the name, the facts and the picture follow the focus; Left of the first title stays; Up
    is the bar; Right of the last title is "Sail to" on the desktop, and the two keys are under the posters on
    the phone; Right of the last key and Down from it are the Expand key's corner, and the focus stays.
  - **Sail to** shows the island next door with its own titles and its own two nearest, in place: no history
    entry more, nothing asked of the server.
  - **Back** from an island, however far the person sailed, is the map with the focus on the island they stepped
    onto. Forward returns to the island sailed to.
  - **A title:** OK on a poster opens its title screen, named from the map before its card is there; Back
    returns to the island with the focus on that title.
  - **The pointer and a finger:** pointing at an island or a title gives it the focus; a click or a tap steps
    onto an island, sails, and goes Back.
  - **A reload** gives the island its focus back and asks for the map once; H is home, and Back returns.
  - **Nothing in the console**, at either size, for either person.
- **Links.** A link to an island that is not among the six (Romantic for a stranger) shows its four titles and
  the two nearest of the six, and asks for the map once without waiting for a sign of the person. Back on a link
  shows home in its place. An island the map lacks says "This island isn't on the map." `focus=` puts the focus
  on an island and is not rewritten. While the map does not come the screen says it is on its way, and after
  the query's retries that it isn't here right now, with its bar.
- **Every key on every phone of the room's table,** in landscape, and on three desktop sizes: 360 x 740,
  375 x 667, 390 x 700, 390 x 844, 430 x 932, 844 x 390, 1920 x 1080, 1366 x 650 and 1280 x 720. On the map and
  on the island with the longest name among its titles, for a person with a taste and services:
  - every key, the islands and the posters included, is 44 px or more on the phone's screen;
  - every key is inside the picture, none lies over another or over a line of type, each says its words in
    full, nothing is cut off by its box, and every line of type is inside the picture;
  - every island's name is inside its island, and no type is under 20 canvas px;
  - all four posters stand in the picture at once;
  - the Expand key's corner is free of keys and of type.
- **The server's HTML.** A link straight to the map or to an island: the server draws the bar alone, once per
  edition, and nothing of the map, the same bytes for a browser, Googlebot and an iPhone. A guest's HTML stays
  the same for every guest.

`checks.json` has the measured numbers.

## Numbers

**The map's payload**, `POST /api/explorer/map?grouping=mood` on the dev server, the body as sent and as gzip and
Brotli pack it:

| Who | Bytes | gzip | Brotli | Titles per island |
| --- | --- | --- | --- | --- |
| A guest nobody knows | 50,373 | 11,744 | 10,029 | 12 |
| A person with eight ratings and two services | 71,846 | 17,278 | 14,222 | 15 to 22 |
| For comparison: the Explorer page's own request, `/api/explorer/world`, the same guest | 268,313 | 56,614 | | |

- The plan left the map's weight open and asked whether it is too heavy for a tile's first focus. It is not: 12
  to 17 KB on the wire, a fifth of what the Explorer's page reads. So it is asked for when the tile first has
  the focus, and the map is there when the person presses OK.
- The dev server answers a guest's map in 31 to 122 ms once it is warm and the machine is quiet (74 to 120 ms
  by its own `Server-Timing`), and in 280 to 1,280 ms while the machine was busy with other builds, which is what
  `checks.json` holds. The first map for a person with a taste took 960 ms.

**The first view's scripts**, `npm run build` with `SENTRY_RELEASE=compare`, counted by
`../tonight-title/first-view.mjs`, raw / gzip / Brotli. "Before" is the integration branch at `1eb114fc`.

| Page | Before | After | Of which |
| --- | --- | --- | --- |
| `/home-preview` | 12 files, 657,294 / 219,026 / 189,773 | 12 files, 658,093 / 219,242 / 189,991 (+799 / +216 / +218) | Its own chunk, 47,844 to 48,643: the Explorer's entry in the screen switch, its lazy code's name, and the scene's few lines |
| `/` (the old TV) | 17 files, 860,431 / 280,813 / 244,247 | 17 files, 860,431 / 280,821 / 244,245 | Nothing |
| `/explorer` | 18 files, 885,273 / 300,928 / 262,315 | 18 files, 885,273 / 300,937 / 262,431 | Nothing |

- **`shell`, on every page, is the same 169,954 bytes.** It was not at first: with the map read through
  `ui/explorer/api.ts`, as the plan has it, the build moved that small module into the shell, 1,456 bytes (424
  Brotli) more on every page. The TV's request is written in `use-tv-explorer.ts` instead.
- **Loaded on first use:** the Explorer's chunk, 10,714 bytes (4,358 gzip, 3,971 Brotli): both screens, the
  choice of the six and their places, and the map's data hook. It imports nothing that the start page has not
  loaded already.
- **The guest's HTML of `/home-preview`** is 59,743 bytes on the dev server; the Explorer puts nothing into it.
  A link straight to the map is 50,835 bytes.

**Sizes on the window**, at rest, for a person with a taste and services; the smallest of each:

| Window | Canvas shown at | Smallest key | An island on the map | Its name | A poster | Smallest type |
| --- | --- | --- | --- | --- | --- | --- |
| 360 x 740 | 0.66 | 44.5 px | 98 x 72 | 16.6 px | 69 x 104 | 13.3 px |
| 375 x 667 | 0.69 | 44.4 px | 102 x 63 | 17.3 px | 55 x 83 | 13.9 px |
| 390 x 700 | 0.72 | 44.2 px | 106 x 77 | 18.1 px | 73 x 110 | 14.5 px |
| 390 x 844 | 0.72 | 44.2 px | 106 x 78 | 18.1 px | 75 x 113 | 14.5 px |
| 430 x 932 | 0.80 | 44.2 px | 118 x 87 | 20.1 px | 84 x 125 | 16.1 px |
| 844 x 390 | 0.98 | 52.7 px | 143 x 95 | 24.4 px | 85 x 127 | 19.5 px |
| 1920 x 1080 | 1.06 | 67.8 px | 254 x 140 | 40.3 px | 182 x 273 | 25.4 px |
| 1366 x 650 | 0.83 | 53.2 px | 200 x 110 | 31.6 px | 143 x 215 | 20.0 px |
| 1280 x 720 | 0.79 | 50.6 px | 190 x 104 | 30.1 px | 136 x 204 | 19.0 px |

The smallest key is a key of the bar everywhere; the smallest type is 20 canvas px, as on the screens before.

## Where the plan was wrong

- **"The Explorer page's own query."** The plan reads the map "through `fetchMap` and `explorerKeys`, the
  Explorer page's own query". The Explorer's page does not make that request: it reads every grouping at once
  from `/api/explorer/world` (`ui/explorer/ExplorerMap.tsx`). So there is no answer to share with the page behind
  Expand, and importing the module has a cost on every page (above). The TV asks the same endpoint itself.
- **The island does not travel to the Explorer's page.** `destinationHref` gives an island
  `/explorer?grouping=mood&island=<id>`, and the plan names `ui/explorer/history.ts` for it, a file that does not
  exist. The page reads `grouping=`, which opens it on that grouping's region once, and `mix=mood:<id>`, which
  picks islands for a combination; it does not read `island=`. Expand from an island therefore opens the
  Explorer on the Mood region, not at the island. Not changed here: the machine is slice 1's, the key is slice
  11's, and what the right landing is needs a decision (below).
- **"Given out from left to right and top to bottom."** A plain sort into rows breaks as soon as the six do not
  split three, one and two by height. The islands are given out by least movement instead, which does what the
  sentence wants: neighbours stay neighbours.
- **The prototype's six places** are kept as an arrangement, not as numbers: the islands are flat and wide where
  the prototype's are round, and the far right one is taller and sits between the rows, for the direction keys.

## Left open

- **The bridges.** Built as decided: each island joined to its nearest, which on the day's map is three pairs
  and no way across. Joining each to its two nearest draws the islands "Sail to" offers, seven bridges that
  hold the map together, as the prototype's seven did. [bridges.jpg](bridges.jpg) has both; it is one number in
  `mapBridges`.
- **Where Expand lands from an island** (above): the Explorer's page has no address for "at this island".
  `mix=mood:<id>` exists and picks the island, which lights it and shows what every other island would share
  with it; whether that is the landing wanted, or the page should learn `island=`, is the owner's.
- **The list** (a title's name and facts over a row of posters, with keys beside it) is drawn in
  `tv/screens/Explorer.tsx` for this screen alone. Slice 6 draws the same list for Discover; one of the two can
  go once both are merged.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, the map and an island as a guest,
  each beside the prototype's Cinema shot; the focus on the far right island, the third title and "Sail to"; a
  member's map and island; and the design round's three maps beside this one at 1366 x 650.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844, the shortest phone and
  landscape.
- [bridges.jpg](bridges.jpg): the map as built, each island joined to its nearest, beside the map with each
  joined to its two nearest, for the open question below.
- `shots/`: each screen by itself.

The prototype's shots show the Expand key at the bottom right, which is slice 11's; its corner is kept free.

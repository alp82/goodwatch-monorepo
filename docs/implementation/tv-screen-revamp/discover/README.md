# Slice 6: mini Discover

Discover on the new TV: three tabs, Moods, Themes and Styles, with six options each; one choice leads to the first
four titles of Discover's own results for it; a title leads to its title screen; Change leads back to the tabs.
For a guest and a member, on `/home-preview`. Proof for [the plan](../README.md), slice 6. Taken on October 13,
2026.

## Run it

Two dev servers of `goodwatch-webapp`, both with every `REC_*` flag on, as for
[slice 5](../tonight-title/README.md).

**A guest, on real data.** The server reads production Crate and Valkey and must stay a reader: no `APP_ORIGIN`.

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3261
```

`http://localhost:3261/home-preview?tv=discover`. Discover answers 503 until the title snapshot is loaded, which
takes about two minutes after a start.

**A member, on the tracking harness** (`/prototype/my-library-real/tv?member=six`, a server without services):

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3262
```

What the harness cannot show: it has no title snapshot, so its pool and its Discover both answer 503. A member's
tiles there are their options' colours, which is the TV's own fallback. For a member's list the drive script
hands the page the real-data server's answer for a visitor nobody knows anything about; the page's own request
is kept and checked (a member asks with GET). A member's taste match in a list was not seen in a browser; the
line that says it has a test (`listFacts`, `tv-discover.test.ts`).

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3261 \
MEMBER=http://localhost:3262 node drive.mjs
```

`drive.mjs` checks the pages and writes `checks.json`, `shots/` and the sheets here. `drive.mjs checks` and
`drive.mjs shots` do one of the two; a whole run takes about a quarter of an hour, and
`PARTS=pool,walk,same,sizes,html` runs some of the checks. It signs in nowhere and writes to no server: a guest's
country, services and ratings are put into the browser's own storage.

## How it is built

- **The machine** (`tv/tv-machine.ts`, "Mini Discover"). The screen is `{ name: "discover", tab, choice }`.
  `DISCOVER_TABS` is the one constant that says which six each tab offers. The address is `tv=discover`, with
  `tab=themes` or `tab=styles` while that tab is open, or `mood=<key>`, `theme=<key>` or `style=<key>` for the
  titles of a choice. A key the TV does not offer (Discover has more of each) shows its tab instead.
  - A tab opens in place (`replace`), so Back from the titles finds the tab that was open.
  - Two moves are named before the direction rule (`moveInDiscover`): from outside the tabs, a move that would
    land on any tab lands on the open one; along the tabs, a move that lands on a tab opens it.
  - The pointer over a tab is a `focus` and opens nothing; a click or a tap is a `choose` and opens it.
  - The focus starts on the open tab's first option, never on a tab.
- **The screen** (`tv/screens/Discover.tsx`), a chunk asked for while Discover's tile has the focus. Its words are
  in `tv/tv-discover.ts`.
- **The titles** (`tv/use-tv-discover.ts`): `/api/discover/results?moods=<key>`, `?themes=<key>` or
  `?styles=<key>`, through `useDiscoverResults`, with nothing else in the query. The hook runs in `DiscoverData`,
  which the scene mounts while the address names a choice
  ([How a screen loads its data](../tonight-title/README.md#how-a-screen-loads-its-data)).
- **The tiles' pictures** (`server/living-room/tv-choice-art.server.ts`): the plan's proposal, built. The pool's
  answer has `choiceArt`, a backdrop's path per option. An option's title is the pool's most popular candidate
  that has the mood, theme or style and stands for no option before it, so eighteen options show eighteen
  titles. Nothing of a viewer goes in: the pictures are the same for everyone and are worked out once per
  snapshot version and day, after which a pool request reads them from memory. Until the pool is there, and for
  an option without a title, a tile is its option's colour alone.
- **A title's screen names it at once**: the scene keeps the cards the last list showed (`listed` in
  `TvLivingRoom.tsx`), and slice 5's title screen takes its first paint from them.

## What the checks say

620 checks pass, none fail.

- **The pool, asked directly.** `choiceArt` has a path for each of the eighteen options and for nothing else,
  each another title's. It is the same for a guest in another country with saved services and ratings. It is
  912 bytes of an answer of 48,602. Five pool requests in a row took 512, 144, 92, 79 and 80 ms.
- **The walk, four times:** a guest at 1920 x 1080 and 390 x 844 on real data, a member at both sizes on the
  harness. After every step the script reads the TV's state from the page.
  - **Nothing in the first view:** Discover's code, its data hook and its words are not asked for on arrival,
    and no results are. The code is asked for while Discover's tile has the focus.
  - **The tabs:** OK on the tile is one history entry; Moods is open, with its six options by the app's names,
    and the focus is on Funny. Right along the tabs opens Themes, then Styles, each with its six; Right on the
    last tab stays; Left returns. No change of tab adds a history entry or asks for anything, and the screen
    does not arrive again: its options change in place.
  - **Up and Down:** Up from an option lands on the open tab from every column, not on the nearest tab. Up again
    reaches the top bar. Down from each of the bar's three keys lands on the open tab.
  - **The pointer:** over a tab that is not open, the tab has the focus and the open tab keeps its options; OK
    or a click opens it. On the phone a tap opens it. A press on the open tab changes nothing.
  - **Both Remotes' keys** (Right, Down, Up, OK) do the same.
  - **A tile** shows a `w780` backdrop under its option's own colour, six tiles with six pictures, the pool's.
    The focused option's picture is behind the screen (`w1280` on the desktop, `w780` on the phone) and follows
    the focus. On the harness, without the pool, every tile is its colour alone.
  - **One choice:** OK on Crime is one history entry and one request, `?themes=crime&page=1`. A guest asks with
    POST and their browser's progress, country and services, as the Discover page sends them; a member with
    GET. The four titles are the first four cards of the answer, in its order. The bar says "Discover" and
    "Crime"; the screen names the focused title with its facts; the name and the picture follow the focus.
  - **Change** is reached with Right from the last title on the desktop and with Down on the phone. It goes one
    step back and adds no history entry.
  - **A title** opens its title screen, named at once from what the list knew.
  - **Back, Forward and a reload** give every screen its focus back: the list on the title that was chosen,
    with nothing asked again; the tabs with Themes still open and the focus on Crime.
  - **Links:** `style=slow` shows Slow burn's titles; Change there shows the tabs in its place with Styles open,
    and Back then shows home. `theme=war`, which the TV does not offer, shows the Themes tab. The old TV's
    `tv=moods` shows the Moods tab.
  - **Nothing in the console**, and no request left the machine but the site's own telemetry, which was
    stopped.
- **The same titles as the Discover page, for the same person.** For Funny (a guest nobody knows), Crime (a
  guest with Netflix saved), and Slow burn and Crime (a guest with Netflix saved and three ratings):
  - the TV's four are the first four of `/api/discover/results` asked as the page asks;
  - they are the first four titles on `/discover?moods=`, `?themes=` or `?styles=` opened in the same browser,
    in the same order, and the page shows the filter as chosen (a chip that can be removed);
  - the Expand key's effect opens that address, and Back returns to the list with the same four. The key itself
    is slice 11's and is not drawn; the script reaches it with `focus=expand`.
  - The choice screen's Expand opens `/discover` with nothing in the query.
- **Every key on every phone of the room's table**, landscape and the desktop: 360 x 740, 375 x 667, 390 x 700,
  390 x 844, 430 x 932, 844 x 390 and 1920 x 1080. On each of the three tabs, on a list whose first title has a
  long name ("The Lord of the Rings: The Fellowship of the Ring", set by the script), and on a list with the
  focus on its last title:
  - every key, the tabs and the tiles included, is 44 px or more on the phone's screen: the smallest is 44.2
    to 44.5 px on the five phones (see the table);
  - every key is inside the picture, none lies over another, each says its words in full, nothing is cut off
    by its box, no type is under 20 canvas px, and the focused title's name is under no key;
  - the six tiles are one size and stand three by three; the four posters are inside the picture;
  - the Expand key's corner is there, empty and free.
- **Without pictures and without titles.** With the pool answering 503, every tile is its option's colour and the
  layout holds. A list whose answer is held says "Titles are on their way." with the focus on Change; an empty
  answer and a 503 both end in "Nothing fits.", with Change and the bar.
- **The server's HTML.** A link to Discover, to a tab or to a choice: the server draws the bar alone, once per
  edition, the same 50,783 bytes for a browser, Googlebot and an iPhone, and nothing of the options.

`checks.json` has the measured numbers.

| Window | A tab | A tile | A poster | Change | The smallest key |
| --- | --- | --- | --- | --- | --- |
| 360 x 740 | 98 x 44 | 96 x 50 | 69 x 104 | 80 x 44 | 44.5 |
| 375 x 667 | 103 x 44 | 101 x 44 | 55 x 83 | 83 x 44 | 44.4 |
| 390 x 700 | 107 x 44 | 105 x 54 | 73 x 110 | 87 x 44 | 44.2 |
| 390 x 844 | 107 x 44 | 105 x 59 | 75 x 113 | 87 x 44 | 44.2 |
| 430 x 932 | 119 x 44 | 117 x 71 | 84 x 125 | 96 x 44 | 44.2 |
| 844 x 390 | 144 x 51 | 141 x 67 | 85 x 127 | 117 x 53 | 50.7 |
| 1920 x 1080 | 179 x 68 | 368 x 167 | 182 x 273 | 162 x 72 | 67.8 |

Sizes in px of the window.

## Where it differs from the prototype and the plan

- **The phone's keys are touch targets.** The prototype's tabs are 52 canvas px tall and its last row 54; here
  both take their height from `keySize`, 55 to 67 canvas px. The two rows of tiles share what is left, and on a
  short phone the gaps between them give way first (10, 12 and 10 px down to 5, 8 and 5), so a tile is 44 px
  tall at 375 x 667.
- **Four posters fit the phone's row.** A poster is at most 156 canvas px tall; a taller phone leaves the rest
  under the row.
- **A theme's and a style's name and colour are written out in `tv-discover.ts`**, and a test holds each to
  `domain/themes-styles.ts`. Read from that module, as the plan says, the build makes it a file of its own:
  one more script in the first view of the Discover page (32 files to 33) and of the old start page (17 to 18).
  Measured in a build, then undone.
- **The results hook is `useDiscoverResults`, as the plan says; the Discover page itself uses another,**
  `useDiscoverBrowse`, with its own cache. So the page behind Expand does not draw from the TV's answer; it has
  its loader. Both ask the same endpoint and get the same titles, which the checks compare.
- **A tile's picture is one `w780` file**, and the picture behind the screen the plan's size (`w1280` on the
  desktop). On the desktop a focused option therefore asks for a second file.
- **The wheel's step does not open a tab.** The plan names the direction keys, the pointer and OK. Dragging
  around the desktop Remote's wheel steps through every item in reading order; if it opened each tab it passed,
  the options of the first two tabs could not be reached that way. It gives a tab the focus, and OK opens it.
- **`ctx.moods` is gone from the machine's context.** The six per tab are the machine's own constant.

## Numbers

**The first view's scripts**, `npm run build` with `SENTRY_RELEASE=compare`, counted by
`../tonight-title/first-view.mjs`: raw / gzip / Brotli. "Before" is the integration branch at `1eb114fc`.

| Page | Before | Slice 6 | Of which |
| --- | --- | --- | --- |
| `/home-preview` | 12 files, 657,294 / 219,026 / 189,803 | 12 files, 659,597 / 219,827 / 190,597 (+2,303 / +801 / +794) | Its own chunk, 47,844 to 50,147: the machine's tabs, the screen's entry and the scene's wiring |
| `/` (the old TV) | 17 files, 860,431 raw | 17 files, 860,431 raw | No file changed |
| The Discover page | 32 files, 1,094,642 raw | 32 files, 1,094,642 raw | No file changed |

- **Loaded on first use:** Discover's chunk, 8,493 bytes (3,315 gzip, 2,956 Brotli), with its data hook and its
  words. It brings three chunks that exist already: the moods' list, the title's words (slice 5) and the
  results hook's (1,136 bytes).
- **Stylesheets:** `tv.css` 2,404 to 2,634 bytes (the tabs' three rules). The site's own stylesheet 385,146 to
  385,596 (+450), for the new utility classes.
- **The guest's HTML of `/home-preview`** is 59,743 bytes on the dev server on the day. This slice adds nothing
  to it: home's markup is not changed, and the titles below the room change with the day.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, each beside the prototype's shot of
  the same screen: Themes, Styles, the titles of one theme. Then Moods, the focus on a tab, the pointer over a
  tab that is not open, a list with the focus on its third title and on Change, a mood's and a style's titles,
  the tiles before the pool is there, a list without titles, and a member's Themes and list.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844.
- `shots/`: each screen by itself.

The prototype's shots show the Expand key at the bottom right, which is slice 11's, and sample titles.

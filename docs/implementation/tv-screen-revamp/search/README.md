# Slice 10: search

> Since October 14, 2026 the webapp reads no `REC_*` feature flag: what `on` did is what the site does
> (`docs/implementation/tv-screen-revamp/rec-flags/`). The flags here record how this was built and run then. A server
> of a later commit needs none of them.

Search on the new TV: one line to type into and four ideas; OK on what is typed, or on an idea, runs the full
search and shows the first four titles it found in the list every app uses; a title leads to its title screen.
The top bar's Search key, the menu's Search, the Remote's Search key and S on the keyboard open it. For a guest
and a member, on `/home-preview`. Proof for [the plan](../README.md), slice 10. Taken on October 14, 2026.

## Run it

Two dev servers of `goodwatch-webapp`, one at a time, both with every `REC_*` flag on, as for
[slice 5](../tonight-title/README.md).

**A guest, on real data.** The server reads production Crate and Valkey and must stay a reader: no `APP_ORIGIN`,
and not on port 3003 (see [No search history](#no-search-history-from-a-dev-server)).

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3310
```

`http://localhost:3310/home-preview?tv=search`. On this server a search is refused, and the TV says "Invalid
origin" in the titles' place. That is the server's guard, not the screen's fault.

**A member, on the tracking harness**, a server without services:

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3311
```

`http://localhost:3311/prototype/my-library-real/tv?member=six&session=on&tv=search`. New with this slice: the
harness's page hands the TV the sample member's country and saved services, as the TV's own loader does.

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs SIDE=guest GUEST=http://localhost:3310 node drive.mjs
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs SIDE=member MEMBER=http://localhost:3311 node drive.mjs
```

`drive.mjs` runs in two halves, one dev server at a time. The guest's half keeps what the member's half needs in
a file (`STOCK=`); the member's half writes `checks.json` for both and the two sheets. Each half takes its own
shots. `drive.mjs checks` and `drive.mjs shots` do one of the two, and `PARTS=refused,walk,same,sizes,html` runs
some of the checks. The guest's half takes about five minutes, the member's two.

**The search itself is stood in for.** The script answers `POST /api/combined-search` in the browser with a
ranked list of real titles: the keys of Discover's own first 24 cards for a theme, taken from the reading
server. Everything after that is real: the cards come from `/api/discover/results?ranked=`, the title screens
from `/api/title-cards`. The one part that lets a search through, `refused`, checks that the server refuses it.

## No search history from a dev server

A search writes one row of search history and can spend the paid inference budget. On a dev server without
`APP_ORIGIN` neither happens, because the route refuses the request before any search work:

- `routes/api.combined-search.ts:28-35`: the expected origin is `APP_ORIGIN`, and without it
  `http://localhost:3003` in development. A request whose `Origin` header is another address is answered 403
  `{"error":"Invalid origin"}`. That line is above the role check (`:37`), the admission (`:38`) and the call of
  `combinedSearch` (`:129`).
- The history row is written in one place, inside `combinedSearch`: `queueHistory`
  (`server/combined-search/search.server.ts:765`, called at `:1210` and `:1243`) calls `recordSearchHistory`
  (`server/search-runtime/runtime.server.ts:398`), which runs the one `INSERT INTO doc.search_history`
  (`server/search-runtime/store.server.ts:346`). A refused request never reaches it.
- A browser sends its page's address as `Origin` with every POST, so a search from a dev server on any port but
  3003 is refused.

Measured on the reading server on port 3310: a POST with `Origin: http://localhost:3310` answers 403
`{"error":"Invalid origin"}` with `Cache-Control: private, no-store`; a search typed on the TV there sends one
POST with that origin, gets the same 403, is not tried again, and no cards are asked for.

Two ways the guard does not hold, for whoever runs this next:

- **A request without an `Origin` header is let through** (`:32` checks the header only when it is there). `curl`
  sends none. Never POST to `/api/combined-search` on a reading server without an `Origin` header; the script
  writes the header by hand and stops when the answer is not 403.
- **Port 3003 is the default origin.** A dev server on that port with the machine's `.env` runs searches and
  writes their rows. The script refuses to run against it.

## What was built

- **The question screen** (`tv/screens/Search.tsx`). The word "Search", the line, a hint under it, and four keys:
  the TV's ideas ("cozy mystery", "space adventure", "feel-good comedy", "mind-bending thriller").
  - The line is a real `<input>` dressed as the question, "What are you looking for?". It takes the browser's
    focus when the screen opens. The word, the line and the hint are one label, so a tap on any of them gives
    the line the focus, which is what opens a phone's keyboard; that target is 70 px tall or more on every
    phone.
  - Once something is typed, the first key is `Search “heist”`, in an idea's place, and has the TV's focus.
  - The hint says what to do: "Type on the keyboard, or pick one." (on the phone "Tap the line to type, or pick
    one."), "Two letters or more.", "OK searches for it."
- **The keys while typing** (`tv/use-tv.ts`). While the line has the browser's focus every key types, except the
  arrows, Enter and Escape, which stay the Remote's: the arrows move the TV's focus, Enter is OK, Escape is Back.
  H, M and S are letters there. With the browser's focus anywhere else (a key of the Remote was clicked, Tab
  moved it), a key that types gives the line the focus first and lands in it; Backspace deletes there while
  there is something to delete, and is Back on an empty line.
- **The results** (`tv/screens/Search.tsx`, in `tv/TitleList.tsx`): "Search" and the query in the bar, the
  focused title's name and facts over four posters, its backdrop behind. In the titles' place: "Searching…", the
  search's own words when it failed, "Nothing found."
- **The data** (`tv/use-tv-search.ts`, rules in `tv/tv-search.ts`), in the search screen's chunk
  ([How a screen loads its data](../tonight-title/README.md#how-a-screen-loads-its-data)). Two requests, the two
  the Discover page makes for `/discover?q=`:
  1. `POST /api/combined-search` through `requestSearch`, with the page's body
     (`{ q, filters, allTitles: false, discover: true }`). `filters` narrows the ranking to the person's own
     services in their country when they have some, as the page does with On my services on.
  2. `/api/discover/results?ranked=<the ranked list>` through `useDiscoverResults` (members GET, guests POST
     their browser's progress, country and services). The TV shows its first four cards.
- **One search per OK.** Nothing is asked for while the person types: no search and no suggestion. The search
  is not retried, not repeated when the window gets the focus back, and not repeated when the results are shown
  again while their answer is kept (Back from a title, the Search key and back).
- **The page behind Expand does not search again.** The TV keeps a search's answer under the key the Discover
  page keeps its own under (`["discover-search", "<q>|<filters>|0"]`), in the page's shape. Expand within the
  query cache's minute opens `/discover?q=` drawn from it.
- **The machine** (`tv/tv-machine.ts`): the action `typed`, which puts the focus on the key for what is typed;
  that key (`go`) from the first character on.
- **A member's scope** (`server/living-room/tv-loader.server.ts`, `tv/tv-home.ts`): a member's loader data has
  `scope`, their country and saved services, the two values the Discover page's loader gives its own search.
  Nothing is added for a guest, whose HTML stays the same.
- **Pointing** (`tv/pointing.ts`): see [the mouse press after a touch](#the-mouse-press-after-a-touch).

## What the checks say

611 checks pass, none fail (468 in the guest's half, 143 in the member's).

- **The walk, four times:** a guest at 1920 x 1080 and 390 x 844 on real data, a member at both sizes on the
  harness. After every step the script reads the TV's state from the page.
  - **Nothing in the first view:** search's code, its data hook, its rules and the request's code are not asked
    for on arrival, and nothing of a search is. The code is asked for at the first interaction, with the menu's.
  - **Opening it:** the Remote's Search key is one history entry. The line is an `<input>`, empty, asks its
    question, has the browser's focus, and tells a phone's keyboard to show a search key. A press on the line,
    on the word over it and on the hint under it each give it the focus. The Remote's Search key is lit.
  - **Typing:** one character has its key, with the focus, and OK on it searches for nothing. "heist" is in the
    line and on its key. H, M and S are typed and do not go home, open the menu or leave. Backspace deletes.
    The arrows move the TV's focus along the keys and up to the bar while the line keeps the browser's focus and
    what is typed; typing puts the focus back on the key for what is typed. On the desktop the pointer over an
    idea gives it the focus, and a letter typed with the browser's focus on a key lands in the line.
  - **No request before OK:** through all of that a guest's page asked a server for nothing at all. A member's
    asked for no search, no suggestion and no card (the harness's pool, which answers 503, was asked for again
    by itself).
  - **OK:** the results take the question's place, with no history entry more. Exactly one search is sent, by
    POST, with the Discover page's body; a member's is narrowed to their own services
    (`{ streaming: { country: "US", providerIds: [8, 337] } }` for the harness's member). Its cards are asked
    for once, with `ranked` and `page` and nothing else, by POST with the browser's progress for a guest and by
    GET for a member. The four titles are the first four cards of that answer, in its order.
  - **A title** opens its title screen, named from what the results knew, its card asked for once. Back returns
    to the results with the focus on that title, and nothing is searched or asked for again.
  - **The Search key on the results** opens the question again with an empty line; the key again goes back, and
    the results are there without a search. **Back from the results** is one step, to home.
  - **The top bar's Search key** opens it, and OK on the first idea searches for "cozy mystery". **The menu's
    Search** opens it. On the desktop Escape on the question is Back, and S on the results opens the question.
  - **Nothing found, busy, slow:** a search without results says "Nothing found." and asks for no cards; the
    search role's busy answer is said in its own words and not tried again; a search that takes a while says
    "Searching…" with the way back focused, then shows its titles with the focus on the first.
  - **A reload of the results** searches once more: the address names the query, as on the Discover page.
  - **Nothing was sent to a server's store, nothing in the console**, and no request left the machine but the
    site's own telemetry, which was stopped.
- **The same search as the Discover page, for the same person.** For a guest nobody knows, a guest with Netflix
  saved, and a guest in Germany with two services and two ratings:
  - the TV's search is narrowed to the person's own services in their country and to nothing else;
  - the Discover page loaded by itself at `/discover?q=heist` sends a request body that is the TV's, byte for
    byte, and its first titles are the TV's, in the same order (of the 24 ranked titles Discover keeps 24, 6
    and 11 for the three);
  - the Expand key's effect opens `/discover?q=heist` with the TV's titles and without a second search. The page
    asks for its own cards once. Back returns to the results without a search. The key itself is slice 11's and
    is not drawn; the script reaches it with `focus=expand`.
- **Every key on every phone of the room's table**, landscape and the desktop: 360 x 740, 375 x 667, 390 x 700,
  390 x 844, 430 x 932, 844 x 390 and 1920 x 1080. On the question, on the question with a long query typed, on
  the results whose first title has a name of two lines, and on the results with the focus on the last title:
  - every key, the bar's included, is 44 px or more on the phone's screen (see the table);
  - every key is inside the picture, none lies over another, each says its words in full (the key for a long
    query ends in an ellipsis on purpose), nothing is cut off by its box, no type is under 20 canvas px;
  - the line and its hint are inside the picture and under no key, and their target for a tap is 44 px or more
    tall;
  - the question has no Expand key and no place for one; on the results the Expand key's corner is there,
    empty and free.
- **The server's HTML.** A link to the question or to results: the server draws the bar alone, once per
  edition, with no line to type on and nothing typed, found or offered. The room's HTML is the same for a
  browser, Googlebot and an iPhone (49,886 and 49,938 bytes for the two addresses). The guest's HTML of
  `/home-preview` is 59,736 bytes on the dev server, as before.

`checks.json` has the measured numbers.

| Window | The line's target for a tap | An idea's key | A poster | The smallest key |
| --- | --- | --- | --- | --- |
| 360 x 740 | 305 x 70 | 149 x 44 | 69 x 104 | 44.5 |
| 375 x 667 | 319 x 73 | 156 x 44 | 55 x 83 | 44.4 |
| 390 x 700 | 333 x 76 | 163 x 44 | 74 x 112 | 44.2 |
| 390 x 844 | 333 x 76 | 163 x 44 | 75 x 113 | 44.2 |
| 430 x 932 | 370 x 84 | 181 x 44 | 84 x 126 | 44.2 |
| 844 x 390 | 449 x 102 | 219 x 51 | 85 x 128 | 50.7 |
| 1920 x 1080 | 1153 x 181 | 272 x 123 | 182 x 273 | 67.8 |

Sizes in px of the window.

## What was not run

- **A real search.** No search reached a server from this machine, by design. So these were not seen: how long
  the TV says "Searching…" on a real search, a real ranked list's titles, and the page behind Expand drawing
  from a real answer. The rules that make the TV's request and its reading of the answer the Discover page's
  are tested against the page's own functions (`tv-search.test.ts`).
- **A real phone's keyboard.** In the emulated phone the line has the browser's focus on arrival and after a
  tap, which is what opens a keyboard. Whether a given phone opens it without a tap is its browser's rule: iOS
  opens a keyboard only for a focus inside a tap, so there the tap on the line is needed.
- **A member with a real session.** The harness's member has a session of the harness's making; their search
  body and their GET for the cards were checked, the cards themselves were the reading server's for a guest.
- **The member's scope in the real loader** has no unit test: `loadTvHome` needs a session. The harness's page
  builds it with the same two lines.

## The tests

`npm test`: 2,301 tests, 2,300 pass, 1 skipped, none fail. `tsc` at the baseline of 212. Lint clean on every
file changed. The new ones, in `ui/living-room/tv/`:

- `tv-machine.test.ts` (5 tests more, 168 in all): the key for what is typed from its first character; typing
  puts the focus on it from wherever it was; OK on one character searches for nothing; typing is the question
  screen's alone; no move, focus or typing changes the address.
- `tv-search.test.ts` (19): the words; and each of the TV's rules held to the Discover page's own function: the
  text rule (`searchText`), the limits, the eligibility (`searchEligibility` over the page's default filter
  state), the answer's key (`searchFiltersKey`), the request body and the reading of the answer
  (`runDiscoverSearch` with `fetch` stood in for), the words of a failure.
- `tv-search-render.test.ts` (13): each screen drawn in both editions has exactly the machine's items in its
  order; the line is one input that is no item; the hint and the keys' words; the results' names, facts and
  pictures; the Expand key's corner; type sizes; the keys' heights on the phones of the room's table; the server
  draws the bar alone.
- `tv-render.test.ts`: the test of "a screen no slice has built yet" is gone with the placeholder it tested
  (see below).

## Numbers

**The first view's scripts**, `remix vite:build` with `SENTRY_RELEASE=compare` and `scripts/precompress.mjs`,
counted by `../tonight-title/first-view.mjs`: raw / gzip / Brotli. "Before" is the integration branch at
`6766cd48` (with slice 9), built from a copy of it; "now" is this branch with that merged in.

| Page | Before | Now | Of which |
| --- | --- | --- | --- |
| `/home-preview` | 12 files, 665,297 / 221,283 / 191,929 | 12 files, 666,366 / 221,583 / 192,097 (+1,069 / +300 / +168) | Its own chunk, 56,095 to 57,155 (+1,060): the scene's wiring, the keys while typing, the screen's entry, the machine's `typed`. And the shell's 9 bytes |
| `/` (the old TV) | 17 files, 857,072 / 279,210 / 242,889 | 17 files, 857,081 / 279,221 / 242,862 | The shell's 9 bytes |
| The Discover page | 32 files, 1,079,802 / 358,197 / 312,233 | 32 files, 1,079,811 / 358,216 / 312,218 | The shell's 9 bytes |
| A movie's page | 20 files, 849,363 / 281,005 / 242,034 | 20 files, 849,372 / 281,020 / 241,939 | The shell's 9 bytes |

- **`shell`, on every page, 170,252 to 170,261 bytes** (+9 raw, -4 gzip, -54 Brotli). No module moved into it:
  it has the same functions and one export more, `preloadSearchRequest`, which only the site's own search,
  itself in the shell, used before. The Brotli totals move by about a hundred bytes between two builds of the same code.
- **Loaded on first use:** the search screen with its data hook and its rules, 5,595 bytes (2,786 gzip, 2,480
  Brotli), asked for at the first interaction with the menu's. It brings chunks that exist already: the list
  (3,408), the title's words (1,474), the results hook's. The code for the request (`search-request`, 1,827 / 951
  / 829) is the search page's own chunk and is asked for when the line shows.
- **The pointing chunk** 7,438 to 7,699 bytes, for the mouse press after a touch.
- **Stylesheets:** `tv.css` is unchanged (4,172). The site's own stylesheet 389,421 to 390,149 (+728), for the
  line's utility classes.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, each beside the prototype's shot of
  the same screen: the question, the results. Then one character typed, a query, the focus on an idea; the
  focus on the third title, a found title's screen, while the search runs, nothing found, busy; and a member's.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844.
- `shots/`: each screen by itself.

The prototype's shots show the Expand key at the bottom right, which is slice 11's, sample ideas ("cozy",
"heist") and sample titles. The results here are real cards for a ranked list that stands in for the search, so
"heist" shows crime shows.

## Where this differs from the plan

- **The key for what is typed is there from the first character**, not from the second (the plan's table:
  "`go` once two characters are typed"). With the plan's rule, one character typed left the focus on the first
  idea, and Enter searched for "cozy mystery": a search nobody asked for, which costs what any search costs. The
  key now has the focus from the first character, says `Search “h”`, and does nothing until there are two; the
  hint says "Two letters or more."
- **The TV shows cards, not the search's own rows.** The plan: "The TV shows the first four rows" of
  `/api/combined-search`. The page behind Expand does not show those rows either: it sends the ranked list to
  `/api/discover/results`, which filters it by the person's defaults (On my services, Not seen yet) and answers
  cards. The TV does the same, so its four are the page's first four, and the title screen gets a card it
  knows.
- **The search is narrowed as the page narrows it.** The plan does not say with what the TV searches. The page
  narrows the ranking to a person's own services while On my services is on, so a search from the TV without
  that could show a member fewer than four titles where the page shows a full list. For that a member's loader
  data has `scope`.
- **One case where the TV and the page still differ:** a guest with services saved and no country in their
  browser. The page narrows the ranking by its own guess of the country, which the TV does not have; the TV
  leaves the ranking wide. Its titles are still narrowed to the guest's services by the results endpoint, but
  when few of the ranked hundred stream there, the TV shows fewer than the page.
- **The arrows do not move the caret.** In the line Left and Right move the TV's focus, as on every screen. A
  click places the caret, and Shift with an arrow selects.
- **`discover-search-request.ts` and `domain/discover-search.ts` are not imported.** The plan says "through
  `requestSearch`", which the TV uses. The page's wrappers around it are written out again in `tv-search.ts`:
  a second importer from another chunk would move them out of the Discover page's files, and a small shared
  module goes into the shell of every page. A test holds each to the page's.
- **`refetchOnMount: false` on the search's query.** The webapp's rule is no custom `staleTime`, and this sets
  none. Without it, coming back to the results a minute later (Back from a title) would search again by itself.
- **The placeholder for unbuilt screens is gone.** With slice 9 merged in, every screen the machine knows has
  its code; `NotBuilt` in `TvScreen.tsx` had nothing left to draw.

## The mouse press after a touch

Found by the member's walk on the phone, and fixed in `tv/pointing.ts`. After a tap the browser sends a mouse
press to whatever is under the finger, and a pressed button takes the browser's focus. When the tap has
changed the screen by then, that is another screen's key: after a tap on the top bar's Search key it was the
search screen's Back key, which lies where Search was. It took the browser's focus from the line (a phone's
keyboard would have closed) and the TV's focus with it. It depends on which comes first, the new screen or the
mouse press, so it showed on a fast answer only.

`pointing.ts` already drops the click that follows such a tap. It now also stops the mouse press from moving the
focus when the key the tap chose is gone or is not what the press landed on. A tap on a key that stays (Another
one, a level of the strip) is as before. This is every screen's, not only search's.

## Open

- **When does a search run without OK?** Three cases remain, each because the address names the query: a
  reload of the results, a link to them, and Back or Forward to results whose answer is no longer kept (five
  minutes after they were left, or after a failed search). The Discover page does the same for `/discover?q=`.
- **No way to try again on the results.** After "Search is busy right now. Try again in a moment." the way is
  Back or the Search key and the query once more. The machine's table has no such key.
- **The Search key on the results opens an empty line**, not the last query to edit.

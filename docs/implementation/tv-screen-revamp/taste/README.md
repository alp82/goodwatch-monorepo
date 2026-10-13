# Slice 8: mini Taste, the quiz and the rating strip

Taste on the new TV in its three states, a side's screen, the taste quiz, and the rating strip the quiz and "How
was it?" after Seen it both use. For a guest and a member, on `/home-preview`. Proof for [the plan](../README.md),
slice 8. Taken on October 13, 2026.

## Run it

Two dev servers of `goodwatch-webapp`, both with every `REC_*` flag on, as for [slice 5](../tonight-title/README.md).

**A guest, on real data.** The server reads production Crate and Valkey and must stay a reader: no `APP_ORIGIN`.

```
cd goodwatch-webapp
set -a; . /home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env; set +a; unset APP_ORIGIN
REDIS_COMMAND_TIMEOUT_MS=60000 \
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3281
```

`http://localhost:3281/home-preview?tv=taste`. A guest's scores never leave the browser, so a guest on this server
writes nothing anywhere.

**A member, on the tracking harness**, a server without services:

```
REC_TASTE_MATCH=on REC_FILTER_BAR=on REC_WATCH_NEXT=on REC_TASTE_PAGE=on REC_EXPLORER=on \
REC_NAVIGATION=on REC_AGE_FILTER=on REC_TRACKING=on npx remix vite:dev --port 3282
```

`http://localhost:3282/prototype/my-library-real/tv?member=six&session=on`. New with this slice: `&session=on`
gives the page the sample member's session, as the harness's own pages have it. The browser then knows a member,
their marks are read from the harness, and a score goes through the app's own `updateScores` into the dev
server's memory, where it can be read back. Without `session=on` the page has no session, as slices 3 and 5 used
it.

What the harness cannot answer, because it has no title snapshot: the quiz's titles (`/api/smart-titles`), the
portrait (`/api/taste/portrait`) and the picks. The drive script stands them in for in the browser with real
answers it takes from the guest server first: the quiz's real list, and the real portrait of eighteen sample
scores, relabelled as a member's.

```
PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3281 \
MEMBER=http://localhost:3282 node drive.mjs
```

`drive.mjs` checks the pages and writes `checks.json`, `shots/` and the sheets here. `drive.mjs checks` and
`drive.mjs shots` do one of the two, and `PARTS=walk,sides,rate,member,sizes,html` runs some of the checks. A
whole run takes about twenty minutes on a busy machine.

On a machine with room for one dev server at a time, the script runs in two halves: `SIDE=guest node drive.mjs`
with the reading server alone, then `SIDE=member node drive.mjs` with the harness's alone. The guest's half keeps
the real answers the member's half stands in with, and its count of checks, in a file; the member's half writes
`checks.json` for both. The drive scripts of slices 5, 6 and 7 take `SIDE=` the same way, for their checks.

**No score of a run reaches a real account or database.** A guest's goes to the browser's own storage. The
member is the harness's, who does not exist. Every request to `/api/update-*` is stopped in the browser and
counted, on both servers, and every request to another host is stopped too.

## What was built

- **Taste** (`tv/screens/Taste.tsx`, `tv/tv-taste.ts`), three states:
  - *Under five scores:* "Rate 5 titles you've seen.", how many are rated, and Start rating (Keep rating once
    there is a score). The picture is the first title the quiz will ask about.
  - *Sides:* a tile per side, two to four of them, counted in the bar ("Two sides of you"), each with its name
    and the attributes that set it apart, then Rate more. A side opens the titles of it the person rated, up to
    four, each saying their score.
  - *Five scores and no sides yet:* the quiz's picks as a list, "Made for you", up to four, then Rate more.
- **The quiz** (`tv/screens/Quiz.tsx`): one title at a time over its picture, the strip, and Haven't seen it as
  a key of its own under the strip. The fifth score returns to Taste.
- **The rating strip** (`tv/RatingStrip.tsx`, `tv/tv-strip.ts`): one component for the quiz and for
  `screens/Rate.tsx`, whose four plain answers it replaces.
  - Four levels from low on the left to high on the right, read from `RATING_LEVELS`, with the colours of
    `getVibeColorValue`. On the day: Bad, Mediocre, Good, Excellent.
  - On the desktop each level is as wide as the scores it spans, and the ten exact scores stand under them, each
    in its colour and with the app's name for it. The level the focus is in lights its scores.
  - On the phone the four levels alone, as equal keys in one row.
  - A line says what the focus would give: "Good · OK gives it 7", "8 · Great".
  - Rating a title again, the score it has is marked.
- **The machine** (`tv/tv-machine.ts`, the block "The rating strip"): the items `level:3` to `level:9`,
  `score:1` to `score:10` where the context says the exact scores show, and `skip` in the quiz; the focus starts
  on Good; Down from a level lands on its lowest score and Up from a score on its level, both named before the
  direction rule. The context has `exactScores`, which the scene sets from the edition the room draws.

## What the checks say

499 checks pass, none fail.

- **The walk, as a guest on real data, at 1920 x 1080 and 390 x 844.** After every step the script reads the
  TV's state from the page.
  - **Nothing in the first view:** Taste's, the quiz's and the strip's code are not asked for on arrival, nor
    Taste's data hook with the quiz's hook, and no quiz title, portrait or pick is. Taste's code is asked for
    while its tile has the focus, the quiz's on Taste.
  - **Taste under five scores:** one history entry. No portrait is asked for: a guest under five scores would
    get the sample taste, which is not theirs. The quiz's titles are fetched once, here, so the quiz opens with
    its first title.
  - **The strip:** the levels are the app's, low to high; on the desktop each is as wide as its scores and the
    ten scores stand under them; on the phone there are four equal keys and no exact score. The focus starts
    on Good.
  - **The focus:** Left and Right along the levels, stopping at the ends. Down from each level lands on its
    lowest score (1, 5, 7, 9) and Up returns; Left and Right run along all ten; Down again reaches Haven't seen
    it. On the phone Down from a level reaches Haven't seen it. Up from a level reaches the bar. The line over
    the strip follows the focus. No move adds a history entry or stores anything.
  - **A score:** OK on Bad, Mediocre, Good and Excellent stores 3, 5, 7 and 9 for the title on show, in the
    browser's progress, and the next title follows with the focus where it was. The Remote's OK, a click and a
    tap do the same. After a reload in the middle the quiz resumes with its two scores and its focus.
  - **Haven't seen it:** the next title, a pass in the browser's progress and no score; OK again passes the
    next one; it never ends the quiz.
  - **The pointer** over a level or an exact score gives it the focus and stores nothing; a click gives the
    score.
  - **The fifth score** (the exact 8 on the desktop, a level on the phone) is stored as given and returns to
    Taste by going back. Now the portrait is asked for, once, with POST and the five scores from the browser.
    For those five (3, 5, 7, 9 and 8, or 7) it answers no sides, so Taste shows "Made for you": up to four
    picks, none of them a title the person scored or passed, each with its match, then Rate more.
  - **Rate more** opens the quiz again, which says "5 rated"; a sixth and a seventh score with the same press
    store 7 twice and do not end it; Back returns to Taste.
  - **Back, Forward and a reload** give Taste its focus back.
  - **Nothing was sent to a server's store, and nothing in the console.**
- **The sides, as a guest whose browser holds eighteen scores, on real data.** The portrait is the guest's own
  (`ready`); Taste shows its sides, two on the day ("Intricate stories exploring big questions",
  "Situationally funny stories about sport"), and asks for no quiz title and no pick. The picture follows the
  focus. A side opens its titles under its name, the focused one with the person's score; a title opens its
  screen, named at once from what the list knew, its card asked for once, its Seen it key reading the score.
  Back returns to the side and then to Taste, each with its focus. The Expand key's effect opens `/taste`.
- **The rating after Seen it.** The same strip without Haven't seen it, the focus on Good. On the desktop Down
  lands on 7, Right is 8, and OK stores the exact 8: the title's key reads "8 · Great" and the TV says "Rated
  8 · Great". On the phone OK on Excellent stores 9. Rating again marks the score the title has; another level
  changes the one score; Back changes nothing. Sent to no server.
- **A member, on the harness.** Their portrait is asked for with GET; their sides show; looking at them asks for
  no quiz title.
  - The quiz counts the scores of their account ("27 rated"), and does not end.
  - Each score is sent once, as a quiz's score (`by_hand: false`), stored by the app's own `updateScores`, and
    read back from the account: OK on Good 7, the exact 8, a click on the exact 2; on the phone the Remote's
    OK on Mediocre 5 and a tap on Excellent 9.
  - Haven't seen it is one request to `/api/update-skipped`, which no server here knows: it is stopped in the
    browser and read.
  - The account ends with exactly those scores more. Nothing of a member's is kept as a guest's progress.
  - After the quiz the portrait is asked for again.
  - The rating after Seen it sends its score as one given by hand, and it is read back.
- **Every key on every phone of the room's table**, landscape and the desktop: 360 x 740, 375 x 667, 390 x 700,
  390 x 844, 430 x 932, 844 x 390 and 1920 x 1080. On Taste under five scores, the quiz, the rating of a title
  with a name of two lines, the sides, a side's titles and Made for you:
  - every key, the bar's included, is 44 px or more on the phone's screen: the smallest is 44.2 to 44.5 px on
    the five phones; a level of the strip is 73.9 x 45.3 px on the narrowest and 90.7 x 55.5 px on the widest;
  - the phones have four levels in one row and no exact score;
  - every key is inside the picture, none lies over another, each says its words in full, and nothing is cut
    off by its box;
  - the Expand key's corner is free on Taste, the sides, a side and Made for you.
- **The server's HTML.** A link straight to Taste, a side or the quiz: the server draws the bar alone, once per
  edition, and nothing of the person, so a guest's HTML stays the same for every guest. The guest's HTML of
  `/home-preview` is 59,766 bytes on the dev server, as before.

`checks.json` has the measured numbers.

## The tests

`npm test` has 78 tests more for this slice, in `ui/living-room/tv/`. The whole suite on the day: 2,092 tests,
2,086 pass, 1 skipped, 5 fail. The five are timing checks of server code this slice does not touch
(`server/lifecycle.test.ts`, `server/tmdb-timeout.test.ts`, `server/combined-search/catalog-exact-title.test.ts`);
the machine was busy with other threads, and each passes when its file is run by itself. The new ones:

- `tv-machine.test.ts`: the strip's items by edition, where its focus starts, the two named moves for every
  level and every score, the scores it gives, the quiz's end, Haven't seen it.
- `tv-strip.test.ts`: what the strip reads of the focus, what it says, how the scores are lit.
- `tv-taste.test.ts`: the three states, the sides and lists, the words, the machine's context for each, and the
  quiz's write path: OK on each level stores 3, 5, 7 and 9 through the quiz's own `rate`, an exact score as
  given, Haven't seen it through `skip`, and nothing on another screen's effect.
- `tv-taste-render.test.ts`: each screen drawn in both editions has exactly the machine's items in its order;
  the strip's levels, spans, labels and lights; no exact score on the phone; every key's height on the phones
  of the room's table; the Expand key's corner; the server draws the bar alone.

## Numbers

**The first view's scripts**, `npm run build` with `SENTRY_RELEASE=compare`, counted by
`../tonight-title/first-view.mjs`: the entry, the root and the route with their static imports, raw / gzip /
Brotli. "Before" is the integration branch at `1eb114fc`.

| Page | Before | Now | Of which |
| --- | --- | --- | --- |
| `/home-preview` | 12 files, 657,294 / 219,023 / 189,815 | 12 files, 659,253 / 219,630 / 190,365 (+1,959 / +607 / +550) | Its own chunk alone, 47,844 to 49,803: the strip in the machine, the two screens' entries, the scene's wiring |
| `/` (the old TV) | 17 files, 860,431 / 280,810 / 244,291 | 17 files, 860,431 / 280,813 / 244,266 | Nothing: the same bytes |
| A movie's page | 20 files, 857,987 / 284,539 / 245,096 | 20 files, 857,987 / 284,545 / 245,108 | Nothing: the same bytes |

- **`shell`, on every page, is unchanged**: 169,954 bytes.
- **Loaded on first use:**

  | Chunk | raw / gzip / Brotli | When |
  | --- | --- | --- |
  | Taste, with its data hook | 8,840 / 3,415 / 3,097 | The Taste tile has the focus |
  | The words and rules Taste and the quiz share | 3,314 / 1,494 / 1,336 | With Taste |
  | The quiz's own hook (`use-taste-quiz`, as on `/taste/quiz`) | 7,731 / 3,031 / 2,742 | With Taste |
  | The quiz | 1,901 / 1,002 / 869 | On Taste |
  | The rating strip, shared by the quiz and the rating | 4,238 / 1,790 / 1,632 | With the quiz, or with the rating |
  | The rating | 1,134 / 619 / 542 (was 2,201 / 1,154 / 1,024) | On the title screen |

- **Requests, per person.** A guest under five scores opening Taste: the quiz's titles, once. A guest from five
  scores on, or a member: the portrait, once, and again after they have scored. The picks (two requests) only
  while Taste shows them. A person looking at their sides: the portrait and nothing else.

## Pictures

- [desktop-beside-prototype.jpg](desktop-beside-prototype.jpg): 1920 x 1080, each beside the prototype's shot
  of the same screen: Taste before a taste, the quiz, the quiz on an exact score, the rating, a member's sides
  and a side; then a guest's sides on real data and Made for you; then more of the strip.
- [phone-beside-prototype.jpg](phone-beside-prototype.jpg): the same at 390 x 844.
- `shots/`: each screen by itself.

The prototype's shots show the Expand key at the bottom right, which is slice 11's, and on the phone the ten
exact scores in two rows of five, which the owner took out after the prototype. Its levels are named Dislike
and Okay where the app's list says Bad and Mediocre today.

## After the merge, and the one list of titles

The integration branch (pointing, mini Discover, the mini Explorer, the lean-in transition from `main`) is merged
into this slice's branch. Everything above was taken again after it; the numbers in this section are that run's.

- **One list of titles** (`tv/TitleList.tsx`). Taste, Discover and the Explorer each had their own copy of the
  prototype's one list: the focused title's name and facts over a row of posters, its backdrop behind, and the
  screen's own keys beside the row. They now draw with the same component. What an app says of itself is its
  props:

  | | Discover | Explorer | Taste |
  | --- | --- | --- | --- |
  | Under the screen's name | The option ("Crime") | The island, and on the desktop what sets it apart | The side, or "Made for you" |
  | Its keys | Change | The islands to sail to, under "Sail to", each with its colour on the map and "Sail to <island>" for a screen reader | Rate more on "Made for you"; none on a side |
  | Without a title | "Titles are on their way." or "Nothing fits." | "Nothing on this island right now." | Its own two lines |
  | A picture while no title has one | None | The island's | None |

  What changed in each to make them one: the phone's posters are top-aligned under the name in all three (the
  Explorer's stood in the middle of the row); a long name takes two lines in three sizes on the desktop
  (Discover had two sizes, Taste one line); a poster has a dark plate until its picture is there and the phone
  takes the small file (Taste took the larger one); the words without a title are 24 px on the phone (they were
  26, 22 and 24); Taste's Rate more in a list is 68 px tall like the other lists' keys (it was 70).
- **`screen-code.tsx`** keeps this slice's fix for every screen and data component, `DiscoverData`,
  `ExplorerData` and `TitleData` included: a lazy screen keeps the component it was first drawn with.
- **The machine's header** and the heading "Waiting for a prototype" are brought up to date: the strip is its
  own section, and only the Remote's streaming keys still do what the first prototype did (slice 6b).
- **The first view** against the integration branch at `5331ec25`, raw / gzip / Brotli:

  | Page | Integration branch | With slice 8 and the one list |
  | --- | --- | --- |
  | `/home-preview` | 12 files, 667,222 / 222,390 / 192,857 | 12 files, 669,192 / 222,987 / 193,429 (+1,970 / +597 / +572), its own chunk alone |
  | `/` (the old TV) | 17 files, 865,878 | The same bytes |
  | A movie's page | 20 files, 859,743 | The same bytes |
  | `shell`, on every page | 170,770 | 170,770: `tv-title.ts` is still a chunk of its own (1,971) |

  The list is a chunk of its own, 3,548 / 1,467 / 1,314, and the three screens are smaller by more than that:
  Discover 8,493 to 6,259, the Explorer 10,714 to 8,477, Taste 8,840 to 6,944.
- **Tests:** `npm test` 2,230 tests, 2,229 pass, 1 skipped, none fail. `tsc` at the baseline of 212. Lint clean.
- **The drive scripts**, each in its two halves, one dev server at a time: 

  | Script | Guest's half | Member's half | Failed |
  | --- | --- | --- | --- |
  | `taste/drive.mjs` (this slice) | 449 | 50 | None |
  | `tonight-title/drive.mjs` (slice 5), run for the first time since it follows the strip | 521 | 110 | One: the Watch key's pulse on the desktop was seen for 3,282 ms where the check wants 3,500 to 4,500. It counted exactly three pulses, and the phone's passed |
  | `discover/drive.mjs` (slice 6) | 502 | 118 | None |
  | `explorer/drive.mjs` (slice 7) | 470 | 131 | None |

  `checks.json`, the shots and the sheets here are this run's. Those of slices 5, 6 and 7 are as their slices
  left them: their halves ran the checks alone.

## Where this differs from the plan

- **Which state a person is in.** The plan reads `status` and `subject.kind` and "fewer than five scores". Two
  cases it does not name: the portrait says `unavailable` while the title snapshot loads, and a guest with five
  scores of which the portrait can read fewer gets the sample taste. Both follow the person's own score count:
  under five the way into the quiz, from five on their picks. The sample taste's sides are never shown as the
  person's.
- **A guest under five scores is not asked for a portrait.** The plan has Taste ask the endpoint for
  everybody. The answer for such a guest is always the sample taste, so the request is left out.
- **The quiz runs only while it has something to do.** `useTasteQuiz` fetches the picks for every returning
  guest. It is mounted on the quiz and on Taste before there are sides, not while the sides show.
- **The quiz's items depend on there being a title.** While the quiz's titles are on their way, and when none
  is left, the quiz has its bar alone: the machine lists the strip only while the context holds the title the
  quiz asks about.
- **A member's progress is their account's.** `useTasteQuiz` counts a member's scores of the visit. The TV
  counts the scores on their account, so a member with four scores ends the quiz with their fifth, and the
  quiz says how many they have.
- **The phone has a line for what the focus would give.** In the prototype that line took the kicker's place.
  With the ten scores gone there is room for both, so the progress stays in sight.
- **A side's line.** The prototype's sides have a made-up line ("Tense, grim, clever."). A real side has four
  attributes: the line is the first three.
- **Four sides on the phone** stand two by two; the prototype had three.
- **`screen-code.tsx`: a screen is no longer mounted twice.** A lazy screen that was first drawn before its
  code was there was drawn with `Lazy`, and from the next render on with the loaded component: another
  component to React, so the screen was mounted again. For a data component that is its data asked for twice
  (the quiz's titles, in this slice). A screen now keeps what it was first drawn with.
- **The rating's place in slice 5's proof.** `../tonight-title/drive.mjs` assumed the four plain answers in
  fourteen places; it now follows the strip. It was not run again as a whole for this slice.

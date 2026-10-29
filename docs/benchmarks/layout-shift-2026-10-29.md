# Layout shift on the list editor, rating flow, and phone dock

This work addresses ticket 10 of [#784](https://github.com/alp82/goodwatch-monorepo/issues/784).
The production baseline is commit `438767171`. Changes run only in isolated local production builds.
No production settings or data changed.

## Causes and fixes

| Surface | Baseline shift source | Fix |
| --- | --- | --- |
| `/lists/new` | The flip panel starts at zero width and height. Its nested card initially uses a viewport-sized container-unit fallback, then two resize observers replace that geometry. The card contributes about 0.508 CLS. | Fit the flip panel with CSS container units from the first paint. Keep its already hidden edit side out of layout until the first Edit press and lazy-load its thumbnails. Its server markup and quick-pick data remain present. |
| `/taste/quiz` | `useTitleQueue` starts empty and copies loader titles in an effect. A loading message becomes the full rating grid, contributing 0.351 CLS. | Initialize the queue from loader data on the server and the first client render. Preserve delayed initialization, language changes, browser-only resume, and exclusion of answered titles. |
| Phone filter dock | `DockStrip` renders nothing on the server. After hydration it portals controls into the standalone dock, making the dock taller and shrinking its G key. This contributes about 0.028 CLS, or 0.042 with the additional hidden-count line. | Render the page controls and their complete dock together on the server. A CSS `:has()` selector hides the standalone dock before paint. The settled dimensions and controls remain the same. |

The list card retains a small font adjustment below 0.001 CLS. The fixes do not change its design or the page's settled layout.

## Quiz HTML and LCP

The production baseline reports 102.6 KiB of compressed quiz HTML. One subsequent anonymous GET contained
337,508 raw bytes, or 106,170 bytes with local gzip. Its serialized route data contains 300 titles,
about 273 KB as parsed JSON. Field values alone include 81,536 bytes of synopsis and 71,806 bytes of essence tags.
Each title also carries IDs, names, image paths, year, genres, popularity, and score statistics.
Those 300 records are the initial rating queue, not 300 rendered titles.

One-at-a-time rating now sends 20 titles. The existing queue fetches 20 more when five remain.
Quick list mode retains its 300-title batch. The first rating view stays complete in server HTML;
no title or section visible in that view moves behind an interaction or a client fetch.

The baseline LCP element is the decorative `w1280` TMDB backdrop. In the first raw report, its observed
request starts about 871 ms after the document's first byte. It is absent from the initial document,
so the browser must download and run the rating code, initialize the queue, and render again before
it can request the image. The observed resource transfer takes about 175 ms. The reported simulated
LCP is much later, around 5.4 seconds across the baseline runs. Observed request timing and simulated
LCP use different clocks and must not be added together.

The first backdrop now appears in the document with `fetchpriority="high"`. The poster also has intrinsic
dimensions and responsive TMDB sources for its 96-pixel phone and 192-pixel wider layout. The browser
selects the appropriate source using the existing two-times pixel-ratio policy.

The quiz uses the same scripts-after-paint mechanism as title pages. It waits for the first backdrop
to paint before starting module preloads and hydration, with the existing fallback for background
tabs and unsupported timing APIs. This leaves the image and stylesheet free of module-download
competition. Scores and the two initial marks use the existing early-tap replay mechanism.
The backdrop file and its quality stay unchanged.

## Measurement method

Use the bench Crate and title snapshot through loopback endpoints, a private disposable Valkey per build,
and `env -i` with an explicit allowlist. Pin external keys empty, run the page role, disable the page cache,
and preload the existing TCP egress blocker. Do not load dotenv files. The app servers sit behind a
loopback TLS proxy that negotiates HTTP/2. No external server-side connection is allowed.

The browser uses Lighthouse 13.5.0, mobile simulation with CPU slowdown 2.7, hidden scrollbars,
and the pages runner's GET-only guard with at most two requests in flight. The local certificate is
self-signed, so the browser accepts it explicitly. Analytics blocking stays off. Reports retain the
same unscored `bf-cache` omission as the all-pages baseline.

After exploratory checks, run five baseline measurements per primary page, followed immediately by
five candidate measurements per primary page. Run one browser at a time. Other tickets build on the
same machine, so these are back-to-back shared-machine results, not an idle-machine experiment.
The fixture has fewer titles and less text than production. Do not present its byte counts as a
post-deployment production measurement.

## Results

Five runs per side on the final implementation, including every successful run without excluding
outliers:

| Page | Mobile performance, median | Simulated LCP, median | CLS, median |
| --- | --- | --- | --- |
| `/lists/new` | 69 → 98 | 3,608 → 2,026 ms | 0.50835 → 0.00033 |
| `/taste/quiz` | 64 → 94 | 5,181 → 3,008 ms | 0.35138 → 0 |

Candidate scores range from 98 to 100 for the list editor and 94 to 95 for the quiz.
Every candidate run stays below 0.01 CLS. Quiz LCP remains above the wider map's 2.5-second goal.
The quiz's median Lighthouse document transfer falls from 27,026 to 21,137 bytes in this fixture,
including response overhead. The fixture returns 155 initial titles before the change and 20 after;
production had 300 before. This smaller byte saving must not be projected onto the production catalog.

The median Lighthouse CPU benchmark is 4,098 before and 4,236 after for the list editor, and
4,085 before and 4,112 after for the quiz. The machine was shared with other tickets throughout.
The candidate quiz's five LCP values are 2,975, 3,028, 3,052, 2,988, and 3,008 ms.
Its prior iteration had zero CLS but only 83 to 86 performance; delaying scripts until the backdrop
paints and sizing the poster raises the score without reducing backdrop quality.

A guarded browser check at 412 pixels wide also reports zero CLS on `/discover`,
`/discover?type=movie`, and `/watch-next`. The mobile error state of `/discover?q=heist`
still reports about 0.022, described below. These supporting checks are single browser traces,
not five-run Lighthouse comparisons.

## Validation and HTML review

The queue regression test exercises the actual hook through the repository's existing `vite-node`
render-test pattern. It fails against the original empty server queue and passes with the fix.
The relevant queue, flow, title-write, answered-title, and guest-pick tests pass, together with the existing image-source, paint-scheduling, and replay tests: 89 tests.
Delaying the browser entry in a real Chromium session also verifies early score, unseen, and
not-interested taps. Each replays once; the score persists once and the unseen mark opens its
Want to See question. Resizing a page dock from phone to desktop publishes a zero dock height.

TypeScript reports the same 178 existing errors as `origin/main`, with byte-identical output.

The unmodified HTML equivalence checker compares 116 URLs for Googlebot, Bingbot, and Chrome:
348 documents per capture. Both repeated self-checks pass. The cross-build check correctly fails
on all 348 documents because the root dock's markup changes. A separate review removes only the
new page dock and maps the standalone dock's new marker and removed empty portal target back to
the old structure. All 348 reviewed documents then match exactly, including loader data, metadata,
links, and main content. This review explains the expected differences; it does not turn the original
gate into a pass or change the gate's normalization contract.

Intended HTML differences outside that URL inventory:

- `/lists/new` replaces zero-size inline geometry with a CSS aspect ratio and container sizing.
  Its edit side adds `display:none` until first use; thumbnail images add `loading="lazy"`.
  The controls and title data remain in HTML.
- `/taste/quiz` replaces the loading message with the first rating card, its controls, poster,
  and backdrop. Its module scheduling uses the existing after-paint bootstrap, and the rating controls
  gain early-tap markers and a replay script. The default loader queue shrinks from 300 titles to 20; Quick list keeps 300.
- Every normal page dock gains its standalone marker and loses the unused empty portal target.
  Pages with filter strips additionally contain their controls and dock in server HTML.

## Landing-surface budget

Run `./bench.sh budget --run <captured-run>` against guarded local Lighthouse reports for the
four populated, comparable landing surfaces. The baseline and final candidate fail the same capped
lines. No new budget line fails, script counts stay unchanged, and no cap is raised.

| Surface | Script requests, before → after | Script transfer, before → after | Existing failures |
| --- | --- | --- | --- |
| Home | 31 → 31 | 300,912 → 300,940 bytes | Site requests, script count, render-blocking requests |
| Movie | 27 → 27 | 294,690 → 294,596 bytes | Image bytes, total bytes |
| Show | 27 → 27 | 294,732 → 294,632 bytes | Image bytes |
| Discover | 46 → 46 | 381,557 → 381,440 bytes | Site requests, script count, script bytes, image bytes, total bytes |

These are one-run payload checks per surface and side, not timing comparisons. The person and
share-list budget surfaces have no corresponding populated bench fixture and remain unmeasured.
The full budget command therefore remains red. This ticket does not establish a passing full budget.
The HTML equivalence and budget helper tests also pass: 33 tests.

## Limits and owner decisions

The mobile search error still grows its status row from 20 to 72 pixels when its message and Retry
button arrive. The dock fix removes its larger shift, but this separate status change remains.
Reserving 72 pixels removes that source and adds 52 pixels above successful search results.
That spacing change is an owner decision.

One wider-screen Discover fixture check still reports about 0.041 CLS while its heading and filter
content update. The production desktop baseline is about 0.002. This work does not claim to fix
that separate fixture transition.

The local bench has no people and no representative signed-in profile. Member and public-profile
end-to-end measurements remain unverified. Browser-only saved progress or a restored list draft can
replace the server's default content after hydration; this work does not establish zero CLS for every
returning-visitor state. An unrestricted local Watch next check also shows a guest-data replacement
that the production baseline's GET-only guard blocks. The guarded check is stable after the dock fix.

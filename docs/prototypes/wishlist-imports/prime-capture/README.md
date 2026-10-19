# GoodWatch Prime Video Watchlist capture (experiment)

This is a throwaway prototype for [ticket #707](https://github.com/alp82/goodwatch-monorepo/issues/707). It isn't a GoodWatch feature, it isn't supported, and it isn't in any extension store. Version 0.3.0 has been tested only against invented pages. Live capture on Prime Video is unverified.

The extension reads your Prime Video **Watchlist** while you scroll through it. When you stop, it saves two files:

- `goodwatch-wishlist-prime-video-<date>-<time>.json`: the titles, in the [shared wishlist file format](../../../implementation/shared-wishlist-format.md) that GoodWatch's Imports page reads.
- `goodwatch-prime-capture-report-<date>-<time>.json`: counts, fixed codes and words from a fixed report vocabulary. Every other string, such as a name, ID, class or title, is replaced before the file is written. It shows what the capture saw, so a failed run can often be fixed without another one.

## How it decides what's on your Watchlist

The capture reads two things that are already in the page, during the same scroll:

1. **Page data.** Prime Video puts the Watchlist, or its first part, into the page as inert JSON. The capture accepts a collection only when its own data path names the Watchlist. It leaves out library, purchases, recommendations, navigation, live entries and anything nested in a title.
2. **Title cards.** It keeps every card that appears in one grid while you scroll, including cards the page later removes. The grid is identified by its element, and the one that shares the most titles with the page data is used.

It reads no network responses. A list longer than what the page data holds is therefore saved as `partial`: the rest of the list is never read. This is deliberate. The goal of this experiment is a truthful complete-or-partial verdict for one account, not the most titles.

The file holds **page-data Watchlist entries only**. Cards are a check, not a source: a card never adds a title to the file.

The file says `complete` only when all of the following hold:

- The page data holds one Watchlist page that ends explicitly, with no contradicting continuation on the same object. Evidence from enclosing objects doesn't count.
- Any total that Prime Video reports equals what was read.
- Every page-data entry appeared as a card, every card in the grid is in the page data, and both agree on each title's name and type.
- The page data beside the Watchlist shows the **All** view. A selected type filter anywhere on the page, a filtered URL or a filter change counts against it; an **All** control alone doesn't count for it.
- The profile was confirmed at Start, and no page data or header named another profile during the capture. State scripts are re-read whenever their content changes, and in full at **Stop**.

Otherwise the file says `partial` when there's a known gap, or `unknown` when there's no evidence either way. The popup and the report name the reasons.

The file keeps provider identity and GoodWatch identity apart:

- `sourceId` is Prime Video's own ID. It's the GTI (`amzn1.dv.gti.…`) when the page data has one, otherwise the token from the title's detail link.
- `sourceUrl` is the detail link without tracking parts or query.
- `mediaType` and `year` come only from explicit Prime Video fields, in the page data or on the card. A season counts as a show, and the report counts seasons separately.
- The file never contains a TMDB or IMDb ID. Matching to GoodWatch titles happens later, on the Imports page, and is measured separately.

## Load the extension

1. In Chrome, Edge, Brave or another Chromium browser on a computer, go to `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder, or the copy at `~/goodwatch-private/707/prime-capture-extension-v030/`.
4. Check that the card shows version 0.3.0. Remove any earlier version first.

To remove the extension, click **Remove** on its card.

## Capture the Watchlist

1. Sign in to Prime Video and choose the profile whose Watchlist you want.
2. Open the Watchlist from Prime Video's own menu. Leave the filter on **All**. Refresh the tab, and don't scroll yet.
3. Click the extension button, then choose **Start capture**. The popup closes when you click the page; the capture keeps running.
4. Scroll slowly to the very end, until no more titles load.
5. Open the popup again and choose **Stop and save files**. Both files go to your Downloads folder.
6. Refresh or close the Prime Video tab.

A page refresh or a full page load ends the capture without a file. Start again on the Watchlist.

## What it does and doesn't do

It does:

- Run only in the tab where you open the popup, and only after **Start capture** on a Watchlist address. On any other page, **Start** injects nothing.
- Read the inert JSON in the page and the Watchlist cards, from the extension's isolated world.

It doesn't:

- Read network responses, or wrap or change anything in the page's own JavaScript.
- Scroll, click, open pages or send requests.
- Send anything over the network, to GoodWatch or anywhere else.
- Read cookies, passwords, account details or profile names.
- Change your Watchlist.

It asks for two permissions: `activeTab` (the current tab, after you click the extension) and `scripting` (running the capture there). No host permissions.

Version 0.2.0 also read copies of list responses in the page's own world. The #705 route research names no specific Watchlist endpoint, and a reviewer showed that a broad path rule read unrelated responses. Version 0.3.0 removes that reader.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension settings and permissions |
| `extract.js` | Pure extraction: entity fields, detail links, collections, pagination and filter evidence, report vocabulary |
| `collector.js` | Isolated-world collector: page data and cards, guards, the completeness gate, the file and report |
| `popup.html`, `popup.js`, `popup.css` | The popup |
| `capture.test.mjs`, `hardening.test.mjs`, `review3.test.mjs`, `fixtures/synthetic.mjs` | Fixture tests with invented pages; the second and third reviews' reproductions are in `hardening.test.mjs` and `review3.test.mjs` |
| `scripts/browser-integration.mjs` | Loads the real extension in Chromium against invented pages at Prime Video addresses |
| `scripts/parser-check.mjs` | Runs a file through the shipped GoodWatch wishlist parser, counts only |
| `scripts/compare.mjs` | Compares a file with the owner's private reference (full or sampled), counts only |
| `BENCHMARK.md` | Candidate gates, test matrix and results |

## Run the checks

The fixture tests need Node.js 22 or later and `happy-dom` from `package-lock.json`:

```sh
cd docs/prototypes/wishlist-imports/prime-capture
npm ci
npm test
```

The browser check needs `playwright-core` and a Chromium build with the experimental CDP command `Extensions.triggerAction` (tested: playwright-core 1.64.1, Chromium revision 1248):

```sh
GOODWATCH_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
node scripts/browser-integration.mjs
```

Set `GOODWATCH_CAPTURE_OUT=<dir>` to keep the synthetic output files. The harness serves invented pages at `https://www.primevideo.com` addresses, blocks every other request, and never contacts Amazon. It uses `--enable-unsafe-extension-debugging` only to press the real extension button through CDP. Don't use that flag for ordinary browsing.

The parser check needs Node.js 23.6 or later, which runs the webapp's TypeScript directly:

```sh
node scripts/parser-check.mjs <goodwatch-wishlist-prime-video-*.json>
```

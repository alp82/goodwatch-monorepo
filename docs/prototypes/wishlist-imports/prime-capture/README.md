# GoodWatch Prime Video Watchlist capture (experiment)

This is a throwaway prototype for [ticket #707](https://github.com/alp82/goodwatch-monorepo/issues/707). It isn't a GoodWatch feature, it isn't supported, and it isn't in any extension store. Version 0.1.0 has been tested only against invented pages. Live capture on Prime Video is unverified.

The extension reads your Prime Video **Watchlist** while you scroll through it. When you stop, it saves two files:

- `goodwatch-wishlist-prime-video-<date>-<time>.json`: the titles, in the [shared wishlist file format](../../../implementation/shared-wishlist-format.md) that GoodWatch's Imports page reads.
- `goodwatch-prime-capture-report-<date>-<time>.json`: counts, field names and layout notes, without titles, IDs, cursors or profile values. It shows what the capture saw, so a failed run can be fixed without another one.

## How it decides what's on your Watchlist

The capture reads the Watchlist in two independent ways during the same scroll:

1. **Page data.** Prime Video puts the first part of the list into the page as inert JSON. As you scroll, the page loads more of the list. The capture reads copies of those list responses. It accepts a collection only when its own data path names the Watchlist. It leaves out library, purchases, recommendations, navigation, live entries and anything nested in a title.
2. **Title cards.** It keeps every Watchlist card that appears in the grid while you scroll, including cards the page later removes. It reads only the card group that shares the most titles with the page data, so a recommendation row isn't taken for the list.

The file says `complete` only when all of the following hold:

- The page data names a Watchlist collection.
- The last page of the list says it is the end.
- No cursor repeats.
- Any total that Prime Video reports equals what was read.
- Every card is in the page data, and every page-data title appeared as a card.
- The view is the unfiltered Watchlist, the filter didn't change, and the profile was confirmed.

Otherwise the file says `partial` when there's a known gap, or `unknown` when there's no evidence either way. The popup and the report name the reasons.

The file keeps provider identity and GoodWatch identity apart:

- `sourceId` is Prime Video's own ID. It's the GTI (`amzn1.dv.gti.…`) when the page data has one, otherwise the token from the title's detail link.
- `sourceUrl` is the detail link without tracking parts or query.
- `mediaType` and `year` come only from explicit Prime Video fields. A season counts as a show, and the report counts seasons separately.
- The file never contains a TMDB or IMDb ID. Matching to GoodWatch titles happens later, on the Imports page, and is measured separately.

## Load the extension

1. In Chrome, Edge, Brave or another Chromium browser on a computer, go to `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder, or the copy at `~/goodwatch-private/707/prime-capture-extension-v010/`.
4. Check that the card shows version 0.1.0.

To remove the extension, click **Remove** on its card.

## Capture the Watchlist

1. Sign in to Prime Video and choose the profile whose Watchlist you want.
2. Open the Watchlist from Prime Video's own menu. Leave the filter on **All**. Refresh the tab, and don't scroll yet.
3. Click the extension button, then choose **Start capture**. The popup closes when you click the page; the capture keeps running.
4. Scroll slowly to the very end, until no more titles load.
5. Open the popup again and choose **Stop and save files**. Both files go to your Downloads folder.

A page refresh or a full page load ends the capture without a file. Start again on the Watchlist.

## What it does and doesn't do

It does:

- Run only in the tab where you open the popup, and only after **Start capture**.
- Read the inert JSON in the page and the Watchlist cards.
- Read copies of the page's own same-origin JSON responses whose path looks like a list, while the capture runs.

It doesn't:

- Scroll, click, open pages or send requests. It never replays or builds Prime Video API requests.
- Send anything over the network, to GoodWatch or anywhere else.
- Read cookies, passwords, account details or profile names.
- Change your Watchlist.

It asks for two permissions: `activeTab` (the current tab, after you click the extension) and `scripting` (running the capture there). No host permissions.

### What it trusts

The response reader runs in the page's own JavaScript world, because an extension's isolated world can't see the page's responses. It wraps `fetch` and `XMLHttpRequest` without changing what the page receives. It then posts reduced fields back to the isolated collector with a per-capture code. The page itself could forge those messages. For this read-only experiment, the page is the data source anyway. A shipped version would need a review of that boundary.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension settings and permissions |
| `extract.js` | Pure extraction: entity fields, detail links, collections, pagination evidence, redacted shapes |
| `collector.js` | Isolated-world collector: both channels, guards, the completeness gate, the file and report |
| `observer.js` | Page-world response reader for list responses the page requests after Start |
| `popup.html`, `popup.js`, `popup.css` | The popup |
| `capture.test.mjs`, `fixtures/synthetic.mjs` | Fixture tests with invented pages |
| `scripts/browser-integration.mjs` | Loads the real extension in Chromium against invented pages at Prime Video addresses |
| `scripts/parser-check.mjs` | Runs a file through the shipped GoodWatch wishlist parser, counts only |
| `scripts/compare.mjs` | Compares a file with the owner's private reference, counts only |
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

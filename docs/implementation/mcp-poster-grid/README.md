# MCP poster cards: browser check and screenshots

`drive.mjs` renders the real `ui://goodwatch/posters-v2.html` resource (from `goodwatch-webapp/app/server/mcp/poster-grid.server.ts`) in a minimal MCP Apps host. The host loads the HTML in an iframe sandboxed to scripts and popups, adds the CSP that the resource declares, and speaks the host side of the protocol: `ui/initialize` with a theme and Claude-style style variables, tool input and result notifications, `size-changed` and `ui/open-link`. `fixtures.json` holds tool results shaped like production answers, with posters and backdrops from TMDB.

The script checks:

- The page stays transparent, declares `light dark`, takes the host's color scheme, and uses the host's text color.
- Watch next shows the backdrop, a 150 px poster, the episode name, the tagline, facts, and **Watch on Netflix** with the provider's logo. The button, **Open in GoodWatch** and the logo open through `ui/open-link`.
- On a 390 px phone, Watch next drops the episode name and nothing overflows, in both themes.
- My library shows the best match on its backdrop, then 13 posters and the **See it on GoodWatch** tile in a row. The arrows scroll the row; the banner, a row poster and the logo open their pages.
- On a phone the row scrolls sideways inside the card with the next poster peeking in, a touch swipe moves the row and not the page, the arrows stay hidden, and the page never scrolls sideways.
- A title without a poster, a poster that fails to load, and a title without a backdrop keep a clean card; an error answer shows its message.
- No script errors and no CSP violations occur.

`prototype/poster-card-variants.html` is the design round the owner picked from (Watch next A, grid B), kept as the record. It is self-contained apart from TMDB images.

## Run

Use Node 24 and a scratch folder with `playwright-core` (1.55) installed, which brings its own Chromium:

```bash
npm i --prefix /path/to/scratch playwright-core@1.55.0
cd /path/to/scratch && npx playwright-core install chromium
PLAYWRIGHT_MODULE=/path/to/scratch/node_modules/playwright-core/index.mjs node docs/implementation/mcp-poster-grid/drive.mjs
```

Set `CHROMIUM=/usr/bin/chromium` to use a system browser instead. Screenshots go to `shots/`.

## Recorded result, 2026-10-17 (version 2)

- `drive.mjs`: Passed. Widget 20,184 bytes, 8,548 bytes gzipped (the spike with the ext-apps runtime was 446,723 bytes). The phone swipe moved the row to 504 px (dark) and 742 px (light).
- Official reference host: Passed. The maintainers' [basic-host](https://github.com/modelcontextprotocol/ext-apps/tree/82221c0c8ce7661efa6771c9d461511b1650495f/examples/basic-host), set up as in the spike's README on `research/mcp-images`, rendered both cards from a local fixture server that registers the real resource, under its sandbox CSP and light theme, and opened title links through `ui/open-link` (`shots/reference-host-*.png`).
- Headless Chromium ignores `Input.synthesizeScrollGesture`, so the swipe uses raw `Input.dispatchTouchEvent` events.

| Screenshot | What it shows |
| --- | --- |
| `desktop-dark-watch-next.png`, `desktop-light-watch-next.png` | Watch next at 680 px |
| `phone-dark-watch-next.png`, `phone-light-watch-next.png` | Watch next at 358 px, without the episode name |
| `desktop-dark-library.png`, `desktop-dark-library-scrolled.png` | My library by best match, before and after the arrow |
| `phone-dark-library.png`, `phone-light-library.png` | My library at 358 px, the third poster peeking in |
| `phone-dark-library-swiped.png`, `phone-light-library-swiped.png` | The row after a touch swipe |
| `desktop-light-search.png` | Search results, light host |
| `desktop-dark-error.png` | An error answer |

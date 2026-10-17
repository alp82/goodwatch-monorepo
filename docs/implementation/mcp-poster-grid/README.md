# MCP poster grid: browser check and screenshots

`drive.mjs` renders the real `ui://goodwatch/posters-v1.html` resource (from `goodwatch-webapp/app/server/mcp/poster-grid.server.ts`) in a minimal MCP Apps host. The host loads the HTML in an iframe sandboxed to scripts and popups, adds the CSP that the resource declares, and speaks the host side of the protocol: `ui/initialize`, tool input and result notifications, `size-changed` and `ui/open-link`. `fixtures.json` holds tool results shaped like production answers, with posters from TMDB.

The script checks:

- Six visible posters load, then **Show all** reveals the rest.
- Title cards and **See it on GoodWatch** open through `ui/open-link`.
- A title without a poster, and a poster that fails to load, keep a labeled placeholder.
- The light and dark host themes, Watch next with its episode, and an error answer render.
- On a 390 px phone the grid has three columns and no horizontal scroll.
- No script errors and no CSP violations occur.

## Run

Use Node 24 and a scratch folder with `playwright-core` (1.55) installed, which brings its own Chromium:

```bash
npm i --prefix /path/to/scratch playwright-core@1.55.0
cd /path/to/scratch && npx playwright-core install chromium
PLAYWRIGHT_MODULE=/path/to/scratch/node_modules/playwright-core/index.mjs node docs/implementation/mcp-poster-grid/drive.mjs
```

Set `CHROMIUM=/usr/bin/chromium` to use a system browser instead. Screenshots go to `shots/`.

## Recorded result, 2026-10-17

- `drive.mjs`: Passed. Widget 11,139 bytes, 4,931 bytes gzipped (the spike with the ext-apps runtime was 446,723 bytes).
- Official reference host: Passed. The maintainers' [basic-host](https://github.com/modelcontextprotocol/ext-apps/tree/82221c0c8ce7661efa6771c9d461511b1650495f/examples/basic-host), set up as in the spike's README on `research/mcp-images`, rendered the grid from a local fixture server that registers the real resource. Posters loaded under its sandbox CSP, the host's light theme applied, and title links opened through `ui/open-link` (`shots/reference-host-*.png`).
- Claude.ai and ChatGPT: Not checked here; the owner retests after deployment.

| Screenshot | What it shows |
| --- | --- |
| `desktop-dark-library.png` | My library, dark host, first six of 14 |
| `desktop-dark-library-expanded.png` | All 14, including a title without a poster |
| `desktop-light-search.png` | Search results, light host |
| `desktop-dark-watch-next.png` | Watch next with its next episode, dark host |
| `phone-dark-library.png`, `phone-light-library.png` | My library at 390 px |
| `phone-light-watch-next.png` | Watch next at 390 px, light host |
| `desktop-dark-error.png` | An error answer: its message and the page link |

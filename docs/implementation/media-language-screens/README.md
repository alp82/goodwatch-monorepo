# Media language: drives and screenshots

The scripts here drive a local dev server with Playwright (`PLAYWRIGHT=<folder with node_modules/playwright-core>`,
Chromium at `/usr/bin/chromium`), as a guest only.

| Script | What it checks |
| --- | --- |
| `drive.mjs` | The F header pair on the prototype route: preview, Keep, Undo, the question on desktop and phone. |
| `drive-real.mjs` | The pair against the real save endpoint and the `gw_loc` cookie: Keep, first paint, the toast's Undo, Browser default, a 409 between two tabs. |
| `drive-text-settings.mjs` | The settings pair and media text rendering (`lang`, `dir`, Arabic and CJK). |
| `drive-live.mjs` | Localized titles on production data, read only: the inline preview on The Matrix, then the start page, title pages, Discover, a person page and the command palette in German, Japanese, Arabic and Browser default. |

The screenshots are kept out of this public repository (about 24 MB). They live on the owner's machine in
`/home/alper/projects/goodwatch-media-language-screens/`. The scripts write there by default (a folder beside the
repository's checkout), or to `SCREENS=<folder>`.

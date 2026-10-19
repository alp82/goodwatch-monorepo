# Settings: tiles and pages

Settings (`/settings`) is one page of tiles. Each tile shows what its setting is now and is one link to its own page.
The owner picked tiles with sheets on October 16, 2026 (branch `prototype/settings-redesign`). On October 19, 2026,
the owner replaced the sheets with full pages, so each page can have its own layout (branch
`prototype/settings-subpages`, variant A).

## Tiles and pages

| Tile | Page | What it holds |
| --- | --- | --- |
| Header | None | The handle (or "Choose your handle", a link to Public profile) and the email. |
| Watching from | `/settings/country` | The country, as a grid of flag buttons. |
| Show titles in | `/settings/language` | The language of titles, posters, and descriptions, with a sample title. |
| Your services (full width) | `/settings/services` | The services of the country the member watches from. |
| Imports | `/settings/imports` | The import step of the Taste start, then the member's imports. |
| Connected apps | `/settings/connected-apps` | Only while Better Auth is on, as before. Disconnect asks first, in the row. |
| Discover and privacy (full width) | `/settings/discover-privacy` | The For you switch (`for_you`) and the cookie choice. The tile shows both as chips. |
| Public profile | `/settings/profile` | The handle and the profile address. |
| Account and sign-in | `/settings/account` | Who is signed in, one card per way of signing in, Change password, and Restart setup. |
| My library (link) | `/my-library` | Hidden titles moved to My library (`/my-library/hidden`); Settings doesn't link them. |

Every page uses `ui/settings/SettingsPage.tsx`: a "Settings" back link, the page name in the My library heading font,
and one line on what the setting does.

## Names

- **Watching from** is the country. It sets where to watch on every title, which services a member can pick, what
  Discover counts as streaming, and the age ratings. It changes no language.
- **Show titles in** is the language of title names, posters, descriptions, and taglines. Each language shows with a
  flag (`languageFlag` in `ui/media-preference/languages.ts`): the country most of its titles come from.
- **Your services** has its own page, because the owner wanted it as its own tile (October 19, 2026).

## Behavior

- The country and the language save at once, as before (`ui/media-preference/SettingsPair.tsx`): one save call for the
  pair, a toast with Undo, Retry and Cancel after a failed save. One `MediaPreferenceProvider` in the Settings layout
  holds every page and the tiles.
- The pickers are grids (`ui/media-preference/PickerGrids.tsx`). The language grid shows every choice. The country grid
  shows the current country and the likeliest ones, a search over all countries, and "All countries". The header
  pair's dialog keeps its lists (`TitlesList`).
- A service toggle saves the whole list at once. Saves of the member's settings run one after another
  (`useSetUserSettings` has a mutation scope), so the last toggle wins.
- When the country lacks some of the saved services, Your services and its tile say so. When it lacks all of them,
  they say On my services shows nothing (`ui/settings/services-notice.ts`).
- The language tile and page show a sample title (Spirited Away) only when it is in the chosen language
  (`ui/settings/SampleTitle.tsx`, `ui/settings/sample-title.ts`). Checking this with curl misleads: a bot's user agent
  gets the English title for every language.
- The Settings layout's loader answers `private, no-store`, so pages without a loader of their own aren't stored.
- Old addresses answer 301 and keep the query: `/settings/where-you-watch` to `/settings/country`,
  `/settings/streaming` to `/settings/services`, `/settings/hidden` to `/my-library/hidden`. Where to watch, the filter
  bar, the Explorer, and Watch next link to `/settings/services`. The MCP settings tool returns `country_page_url`,
  `services_page_url`, and `language_page_url`; the library tool sends Not interested to `/my-library/hidden`.

## Verification

`drive.mjs` and `switches.mjs` were written for the sheets (October 16, 2026) and need new selectors before they run
again. `old-links.test.ts` checks the redirects, and `SettingsPair.test.ts` checks the saves through the new grids.

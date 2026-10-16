# Settings: tiles and sheets

Settings (`/settings`) is one page of tiles. Each tile shows what its setting does now and opens the setting in a sheet:
from the right on a wide screen, from the bottom on a phone. Each sheet is a route of its own, so a link, a reload, or
the back button opens it again. The owner picked this layout on October 16, 2026, from four prototypes (branch
`prototype/settings-redesign`).

## Tiles and sheets

| Tile | Sheet | What it holds |
| --- | --- | --- |
| Header | `/settings/profile`, `/settings/account` | The handle (or "Choose your handle"), the email, and links to Public profile and Account and sign-in. |
| Where you watch | `/settings/where-you-watch` | **Watching from** (the country) and **Your services**. |
| Show titles in | `/settings/language` | The language of titles, posters, and descriptions. |
| Your data | `/settings/imports`, `/settings/hidden` | Imports, and Hidden titles with their count. |
| Connected apps | `/settings/connected-apps` | Only while Better Auth is on, as before. |
| Discover and privacy | None | The For you switch (`for_you`) and the cookie choice (`cookie_consent`), on the tile itself. |

## Names

- **Watching from** is the country. It sets where to watch on every title, which services a member can pick, what
  Discover counts as streaming, and the age ratings. It changes no language.
- **Show titles in** is the language of title names, posters, descriptions, and taglines.
- Country and services share **Where you watch**, because the country decides which services there are.

## Behavior

- The country and the language save at once, as before (`ui/media-preference/SettingsPair.tsx`): one save call for the
  pair, a toast with Undo, Retry and Cancel after a failed save. One `MediaPreferenceProvider` in the Settings layout
  holds both sheets and the tiles.
- A saved pair now also refreshes the `user-settings` and `streaming-providers` queries. Before, Your services could
  show the old country's list for up to a minute.
- A service toggle saves the whole list at once. Saves of the member's settings run one after another
  (`useSetUserSettings` has a mutation scope), so the last toggle wins.
- When the country lacks some of the saved services, Where you watch and its tile say so. When it lacks all of them,
  they say On my services shows nothing (`ui/settings/services-notice.ts`).
- The tile shows a sample title (Spirited Away) only when the title is translated into the chosen language. Otherwise
  it shows the language name. On October 16, 2026, production returned English for every language.
- `/settings/country` and `/settings/streaming` answer 301 to `/settings/where-you-watch`, keeping the query. The user
  menu and the Hub link to `/settings`. Where to watch, the filter bar, the Explorer, and Watch next link to
  `/settings/where-you-watch`.
- The sheets move with transform and opacity only, and not at all with reduced motion.

## Verification

`drive.mjs` signs up a new member on the local Better Auth dev server (`goodwatch-webapp/scripts/auth-wiring/dev.sh`),
saves every kind of setting, reloads to check that each one was kept, follows the old links, and takes the screenshots
in `shots/` at 1440 and 390 wide. The local CrateDB needs `country` and `streaming_service` rows, which the dev script
doesn't seed.

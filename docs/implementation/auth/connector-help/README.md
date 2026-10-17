# Connector help page and privacy text

Build for [#571](https://github.com/alp82/goodwatch-monorepo/issues/571) (map [#529](https://github.com/alp82/goodwatch-monorepo/issues/529)).
Built on October 14, 2026 on `auth/connector-help-pages`, branched from `origin/main` at `ad7e6d19`.

> **Update, October 17, 2026:** `/connect` is gone (no redirect). The setup per app lives on `/use-with-ai`, the
> troubleshooting on `/support`, and the can see / can change / can never lists on the consent screen and in the
> privacy policy. `REC_CONNECTOR` now only switches the privacy policy text. The rest of this note is the record of
> the original build.

## What it adds

- **`/connect`**: how to add GoodWatch to Claude (claude.ai and the Claude apps, with the Team/Enterprise path),
  Claude Code and ChatGPT, with the connector address and commands to copy. Then things to ask, what a connected app
  can see, change and never do, how to disconnect, and a short troubleshooting list. ChatGPT's plan rules come
  first in its section: see and change on Business, Enterprise and Edu, see only on Pro, web only ([#532](https://github.com/alp82/goodwatch-monorepo/issues/532)).
- **`/privacy`**: with the flag on, an "In short" box and four plain-language sections before the old policy:
  signing in and your account, emails we send, the move from Supabase, connected apps (`#connected-apps`). The old
  text stays, with one change: the sign-in list names only Google. The draft marked 16 statements for the owner; on
  October 15, 2026 the owner kept all of them as written, with no added disclaimers, and the markers were removed.
- **`app/ui/connector/`** for [#570](https://github.com/alp82/goodwatch-monorepo/issues/570): the address, paths
  and the can see / can change / can never lists in one place (`connector.ts`), and `ConnectorAddressCard`, the
  "Connect a new app" box with the address and the "Step by step for Claude and ChatGPT" link, ready to drop under
  the list in the Connected apps tab. The consent page should read its lists from `connector.ts` too, so all three
  pages say the same.

## The flag

`REC_CONNECTOR=on` (in `app/server/features.server.ts`), the same scheme as the `REC_*` flags removed earlier that
day, without the preview list (`REC_PREVIEW_USERS` went with them). Unset or anything else means off: `/connect`
answers 404 and `/privacy` serves the June 2024 policy unchanged. It is read per request; a change needs a restart,
which also empties the in-process page cache. It goes on at the cut-over and the MCP launch ([#552](https://github.com/alp82/goodwatch-monorepo/issues/552),
[#572](https://github.com/alp82/goodwatch-monorepo/issues/572)), which #536 put on the same day.

## Sources for the steps

Read on October 14, 2026:

- Claude: [Getting started with custom connectors](https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp)
  (Customize → Connectors → + Add → Add custom connector; Free has one custom connector; Organization settings for Team
  and Enterprise; + → Connectors in a chat; Remove).
- Claude Code: [MCP](https://code.claude.com/docs/en/mcp) (`claude mcp add --transport http --scope user`, `/mcp`,
  `claude mcp remove`).
- ChatGPT: [Connect from ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt) (Plugins → + → Add
  custom MCP server, `@` in a chat) and the plan rules in [#532](https://github.com/alp82/goodwatch-monorepo/blob/research/auth-mcp-outside-facts/docs/research/auth-mcp-outside-facts.md).
  OpenAI's help center (403 from here) and third-party guides name the menus differently (Apps, Create app,
  Settings → Security and login), so the page tells members to search the settings for "Developer mode".

## Screenshots

`shots/`, taken by `shots.mjs` (Playwright with the system Chromium, 1440 and 390 wide, footer and phone dock
hidden) against a dev server with `REC_CONNECTOR=on` and no `.env`; PNG to WebP with `magick <png> -quality 78`.
The privacy shots end where the old policy starts.

```
cd goodwatch-webapp && REC_CONNECTOR=on npx remix vite:dev --port 3471
# then, from a scratch folder with playwright-core installed and shots.mjs copied into it:
node shots.mjs <out dir>
```

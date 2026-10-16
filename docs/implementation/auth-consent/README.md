# Consent page, Connected apps and Connect Claude (#570)

Built on #581 (`auth/mcp-authorization`) merged with #583 (`auth/account-pages`), with `app/ui/connector/` taken
unchanged from #578. Follows the #534 prototype and resolution: the consent page is its own page without the site's
navigation (variant B) and always grants what the app asked for; Connected apps is its own Settings tab (variant A).

## How a connection runs

1. The app (Claude, Claude Code, ChatGPT, or one that registered itself) opens `/api/auth/oauth2/authorize`.
2. A signed-out member lands on the site's own `/sign-in` with the provider's signed query (the provider's
   `loginPage`). The page says which app waits, beside the form and in the picture column ("Connect Claude"), and sends
   the signed query back with the sign-in, by email or with Google. A member who is signed in already goes straight on.
3. `/auth/mcp/consent` (`routes/auth.mcp.consent.tsx`): the app, "Details published by …" or the unverified warning
   for an app that registered itself, the member's address with "Not you?", the can see / can change / can never lists
   from `app/ui/connector/connector.ts`, and Deny / Allow. The answer is a plain form post; the provider's redirect to
   the app's callback follows. The page sends `Referrer-Policy: strict-origin`, `X-Frame-Options: DENY` and a
   `form-action` limited to the site and the verified callback.
4. `/settings/connected-apps` (`routes/settings.connected-apps.tsx`): one row per grant (Claude Code once per
   computer), "Can see and change" or "Can see only", Connected and Last used, Disconnect after a confirmation
   (`/api/auth/oauth2/delete-consent`), and the connector address with the step-by-step link. The tab shows only
   with Better Auth on.

Server side: `app/server/auth/mcp-flow.server.ts` (the checks, the consent's data and answer, the app waiting for
sign-in) and `app/server/auth/connected-apps.server.ts`.

## Running it

`bash goodwatch-webapp/scripts/auth-wiring/dev.sh` (dev server on :3550 with `MCP_RESOURCE_URL`, Docker CrateDB,
Valkey, Mailpit). A published app (CIMD) is one whose client id is the address of its metadata document. For local
screenshots two such rows are seeded with the addresses Claude and Claude Code use (`clientDiscoveryId: "cimd"`, seed
script in the ignored `goodwatch-webapp/scripts/auth-wiring/results/`). The CIMD plugin refreshes them from
claude.ai on use: a public GET of a published document, as in production.

`drive.mjs` registers a real app (DCR), runs authorize → sign-in → consent → token → MCP call, Deny, two Claude Code
computers, Not you?, Connected apps with Last used and Disconnect, and the empty state. It takes the consent page's
redirect answer itself and shows a placeholder, so the browser never opens an app's callback (Playwright doesn't route a
redirect's target, and a first version once opened claude.ai's callback with a dead local code).

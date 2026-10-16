# Account pages (#550)

The account pages of the Better Auth move, built from the #534 prototype: sign-in, sign-up, email confirmation,
forgot and reset password, the five account emails and the one-time "please sign in again" banner. The consent page
and Connected apps belong to the MCP build (#570).

## Where things are

- Pages: `goodwatch-webapp/app/routes/{sign-in,sign-up,verify-email,forgot-password,reset-password}.tsx`, their pieces
  in `app/ui/auth/kit.tsx`, the banner in `app/ui/auth/SignInAgainBanner.tsx`.
- `app/utils/auth-client.ts`: what the pages ask of the sign-in service. With `BETTER_AUTH_ENABLED=true` the browser
  calls `/api/auth/*`, then reruns the root loader; with it off, the same calls go to Supabase as before.
- Emails: `app/server/auth/emails.server.ts` (HTML and plain text), sent from `auth.server.ts`.

## Cut-over notice (`AUTH_MAINTENANCE`)

Cut-over step 2.2 (#552, owner Q47) freezes sign-ups and password changes while the final Supabase export runs. Set
`AUTH_MAINTENANCE=on` in Coolify and redeploy. Unset or anything else means off. It works with Better Auth on or off.

- The five pages above show "We're moving sign-in to a new home" in the poster card instead of their forms, and so
  does the password change in Settings. Their loaders carry the flag and answer `private, no-store` while it's on.
- `forgot-password` and `reset-password` actions (the Supabase path) answer 503 with code `AUTH_MAINTENANCE`.
  `/api/auth/*` refuses sign-in, sign-up, callback, password and verification routes the same way (a link opened in the
  browser goes to `/sign-in`). The session, sign-out and the apps' own routes stay open.
- Supabase is called from the browser, which no server can refuse. So `auth-client.ts` refuses before it calls, using
  the root loader's flag, and asks `/api/auth-maintenance` first when a cached page doesn't know.
- Code: `app/server/auth/cutover-notice.server.ts`, tests `cutover-notice.test.ts` next to it and in `app/ui/auth/`.

## Running it

`bash goodwatch-webapp/scripts/auth-wiring/dev.sh` starts the wiring's Docker services on their own loopback ports
(CrateDB 15848–15850, Valkey 15901–15903, Mailpit 15925 with its inbox at http://127.0.0.1:15980) and a dev server on
port 3550 with every production setting blanked. `dev.sh down` removes the containers. Google sign-in goes to Google
with a made-up client, so it stops there.

`drive.mjs` walks every flow on that server (29 checks) and takes the screenshots in `shots/` at 1440 and 390 wide.

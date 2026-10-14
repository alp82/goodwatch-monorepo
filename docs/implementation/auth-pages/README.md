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

## Running it

`bash goodwatch-webapp/scripts/auth-wiring/dev.sh` starts the wiring's Docker services on their own loopback ports
(CrateDB 15848–15850, Valkey 15901–15903, Mailpit 15925 with its inbox at http://127.0.0.1:15980) and a dev server on
port 3550 with every production setting blanked. `dev.sh down` removes the containers. Google sign-in goes to Google
with a made-up client, so it stops there.

`drive.mjs` walks every flow on that server (29 checks) and takes the screenshots in `shots/` at 1440 and 390 wide.

# Account deletion (#553)

Members delete their account themselves, from **Settings › Account › Delete Account**. Built on Better Auth 1.7.7's
`deleteUser`, the CrateDB adapter (#548/#564) and its maintenance (#565/#587). This is the code half of #553; the
production half (deleting a real test account on production and checking that none of its rows remain) is separate.

## How it works

- **With a password** (`POST /api/auth/delete-user {password}`): the account is deleted at once. The before hook in
  `auth.server.ts` checks the password (bcrypt imports too) and turns it into a one-minute deletion token, which
  upstream consumes and checks against the session like an emailed one. Ten tries per member per hour, right or
  wrong, so a stolen session can't be used to guess the password. A member without a password (Google only) gets the
  same "invalid password" answer.
- **By email** (`POST /api/auth/delete-user {}`): the email links to `/delete-account?token=…`, valid for one hour and
  once; at most five emails per member per hour. Opening the link deletes nothing. The page asks to sign in first
  when signed out (and comes back to the link), and its **Delete my account** button posts the token. A used,
  expired or someone else's link says "This link no longer works" and offers a new one. Upstream's
  `GET /delete-user/callback` answers 404, so a mail scanner that opens links deletes nothing.
- **What goes**, in this order:
  1. every app grant (Connected apps / MCP): refresh tokens deleted per client and member, which closes the grant's
     version first (#565), then the consent; the apps the member registered; every session, in CrateDB and Valkey;
  2. every row of the member in the fifteen member tables (`app/server/account-deletion.server.ts`), and their
     caches (member data, settings, taste);
  3. Better Auth's user and accounts. The adapter keeps a tombstone that holds only the row's id and releases the
     email claim by CAS, so the address can sign up again at once; maintenance purges tombstones after 30 days;
  4. a second pass over the member tables, for rows a request that was already running wrote late; then a "Your
     account is deleted" email.
- **Share lists**: lists and the profile are deleted. The handle row stays, so nobody else can take the name or its
  links (decision 16 of #170), but its `user_id` becomes `deleted-account`: it no longer names the member.
- `MEMBER_TABLES` (`app/server/account-deletion-tables.ts`) is checked against every `user_*` table in
  `goodwatch-flows/windmill/f/sync/models/crate_schemas.py`; a new member table fails the test until it is added.
- Account deletion is on only when the server entry registers the member data deletion
  (`registerMemberDataDeletion` in `entry.server.tsx`); without it `/delete-user` answers 404, so the sign-in rows are
  never deleted without the member's data.

## Running it

From `goodwatch-webapp`:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix scripts/auth-cratedb/conformance
npm run test:auth:deletion
```

`scripts/auth-deletion/run.sh` starts a three-node CrateDB 5.10.12 (auth tables plus the member tables from the
repository's schemas), three-master Valkey and Mailpit, all named `del-auth-553-*` on loopback ports 16200–16299, runs
the unit tests and `app/server/account-deletion.integration.ts`, and removes everything. `run.sh up|tests|down` keeps
the stores between runs. On a Docker host whose open-file limit is below CrateDB's production check (a cloud sandbox),
add `AUTH_DELETION_LOOPBACK=1`: the three nodes then share one network namespace on loopback. CI
(`.github/workflows/auth-deletion.yml`) uses the standard topology.

`bash scripts/auth-deletion/dev.sh` (after `run.sh up`) runs a dev server on port 16290 against those stores; Mailpit's
inbox is at http://127.0.0.1:16280. `drive.mjs` walks every flow there in Chromium (26 checks) and takes the
screenshots in `shots/` at 1440 and 390 wide.

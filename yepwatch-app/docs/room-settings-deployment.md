# Shared room settings, Jev and GoodWatch login

This release needs a database migration **before the new API starts**. Do not trigger the normal automatic deployment first. Coolify changes remain owner-operated. Keep the existing room key, database passwords and Redis configuration.

## 1. GoodWatch sign-in (existing issuer)

On the existing GoodWatch auth/page deployment set:

```dotenv
AUTH_YEPWATCH_RESOURCE=https://yepwatch.com/api/yepwatch
AUTH_YEPWATCH_CLIENT_ID=yepwatch-public
AUTH_YEPWATCH_REDIRECT_URIS=https://yepwatch.com/api/yepwatch/v1/proposal/member/callback
```

Keep its existing Better Auth, mail, Google, Crate and Redis settings. Deploy the GoodWatch source containing the existing account resource route and these changes. No new issuer, account table, cross-domain cookie or app client secret is needed. The exact configured YepWatch client continues directly after sign-in; third-party clients keep their consent screen. Keep the registration’s `skipConsent: false`: the first-party continuation uses the normal provider grant path, including its durable revocation record.

Register the public client once with the existing issuer's database environment. From `goodwatch-webapp`, `node scripts/yepwatch-auth/build.mjs` creates `build/yepwatch-auth-client.mjs`. Run this beside the GoodWatch runtime's `node_modules` (for example copy it to `/app/yepwatch-auth-client.mjs` inside that container) using that container's existing environment:

```sh
node /app/yepwatch-auth-client.mjs check
node /app/yepwatch-auth-client.mjs apply
node /app/yepwatch-auth-client.mjs check
```

`apply` creates only the configured public client/resource link if absent; it refuses to rewrite an existing different client. It is restartable after a partial operation. No sign-in sessions, passwords, email or Redis operations are created by the helper. Output contains public registration metadata only. Final `ready` must be true. Run one operator at a time.

In **YepWatch's** Coolify environment set:

```dotenv
YEPWATCH_MEMBER_ENABLED=true
YEPWATCH_GOODWATCH_CLIENT_ID=yepwatch-public
```

The callback/resource/issuer URLs are already in `compose.yaml`. Website and Android both use the HTTPS server callback; the server then returns Android to its registered app scheme. The existing guest identity/host/invite survives connection. No refresh-token implementation is included; expired grants require reconnection. Public email delivery and physical Android return still need the deployment smoke test.

## 2. Jev room prompts

Generate a separate random secret of at least 32 characters. Store the **same** value as `YEPWATCH_SEARCH_SECRET` in:

- the existing **GoodWatch search-role** service;
- the **YepWatch** Compose resource.

Do not use the room key, gateway key or an account token. Deploy the GoodWatch search role containing this change. YepWatch calls `https://goodwatch.app/api/combined-search`, the existing search-routed path, using service authentication. Existing Jev configuration, query models, reading cache, budgets and ranking stay on that role. No extra proxy route is necessary. An unavailable interpreter keeps the old room settings and reports a retryable failure; it never pretends basic search is a Jev reading.

Voice input uses the phone keyboard's dictation. There is no separate in-app recording/upload service.

## 3. Migrate the room database, then deploy YepWatch

1. Build the new YepWatch API/operator image without starting it. Retain the previous image and a full stopped-writer backup.
2. Stop **all YepWatch API writers** and gateways in Coolify. No old or new API may run during migration. Keep Crate/Redis and the room key intact.
3. Run the **new image's** operator with the existing room key/key ID and trusted database operator credentials. Mount a private durable directory at `/backup`; the runtime account does not get schema-changing grants. In the API image the command path is:

   ```sh
   node build/yepwatch-release/operator.mjs prepare-room-settings /backup/room-settings.sealed --writers-stopped
   node build/yepwatch-release/operator.mjs apply-room-settings /backup/room-settings.sealed --writers-stopped --apply
   node build/yepwatch-release/operator.mjs check
   ```

   Preparation writes an exclusive mode-0600 encrypted backup and performs no database changes. It rejects conflicting old screen selections before writing the schema. Application verifies every original room head, including its sequence/term, before conversion. Keep the backup and key private. After an interrupted apply, keep writers stopped and repeat **apply with the same backup**. Do not prepare a new backup from a partially converted store.
4. Deploy YepWatch's new API, gateway and web images together. Health must become ready before opening the app. Old API images refuse format 2; simply rolling back the image after migration is not supported. A rollback requires a planned stopped-writer restore into a compatible empty store using the original full backup and old images.
5. Rebuild Android with this source (same signing identity, a new build number). Existing installed clients keep their singleton context compatibility but do not gain the new settings/Leave UI until updated.

No migration, registration or Coolify configuration is automatically performed by app startup.

## 4. Smoke test with fresh rooms

- Set country and providers; verify logos and that no screen selection or More settings exists.
- Enter a prompt/preset, save, and check interpreted attributes in the lobby and Room drawer. Start and check that suggestions follow it. Retry an interpreter failure without losing the old description.
- Connect GoodWatch from browser and Android; complete consent and return to the same room. Verify that the initial provider selection combines both accounts’ saved services without duplicates. After editing the shared selection, verify another join/sign-in does not overwrite it; “Use everyone’s saved services” applies the current union explicitly.
- Join with two people. Leave from one device: it returns to the start screen, the other sees them marked Dropped, and that person no longer blocks matches/agreement. Reopen the invitation on the same device: the original place and answers return, without a new participant. Test host departure, everyone dropping out, and returning after Done too.
- Existing rooms retain votes/decisions after migration. Test with non-sensitive disposable rooms; do not automate participants' choices in their live rooms.

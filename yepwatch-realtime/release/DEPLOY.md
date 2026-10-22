# Deploy the typed-storage YepWatch release

You control Coolify activation. The GitHub Action builds/publishes images only; it never accesses the host, creates database tables, changes Redis ACLs or registers accounts. This document replaces the historical R4 activation instructions.

## What runs

| Service | Coolify / container configuration | Public address |
| --- | --- | --- |
| Front | `yepwatch-front`, port 8080, 128 MiB; static web + forwarding | `https://yepwatch.com` |
| API | `yepwatch-api`, port 3000, 3 GiB; typed Crate storage, catalog, GoodWatch linking | Through front only |
| Gateway | `yepwatch-gateway`, port 4311, 512 MiB; shared Redis Pub/Sub | Through front only, WSS |
| Existing GoodWatch webapp | Update existing deployment to include `/api/yepwatch/account` and issuer configuration | Existing GoodWatch hostname |

There is **no new Redis/Valkey, Crate, account database or issuer container**. API connects to existing Crate `10.0.0.11–13:4200` and Redis `10.0.0.14–16:6379`; gateway connects to API and Redis. Only front joins the external `coolify` network. Do not publish API/gateway ports directly.

## 1. Obtain exact images

Run **YepWatch images** on the release branch in GitHub Actions. Pushing changes on `feat/yepwatch-shared-services` also runs it. It installs locked dependencies, tests client/gateway and real disposable Crate concurrency/recovery, builds Linux/amd64 images, and publishes:

```
ghcr.io/alp82/yepwatch-api:sha-FULL_COMMIT
ghcr.io/alp82/yepwatch-gateway:sha-FULL_COMMIT
ghcr.io/alp82/yepwatch-front:sha-FULL_COMMIT
```

Download the workflow's `yepwatch-deployment-FULL_COMMIT` artifact. **Use its `published-images.env` digest references**, not `latest` or guessed hashes. Keep all three images at the same successful build. New GHCR packages may initially be private: either make these image packages public in GitHub package settings or configure a read-only registry credential in Coolify. No registry password belongs in Compose or Git.

The workflow uses `GITHUB_TOKEN` with `packages: write`, following [GitHub's publishing documentation](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions). It requires no host/deployment secret. It does not build or sign Android; the separately signed APK is an optional local companion, never silently replaced with an old APK.

For local builds with already installed locked dependencies:

```sh
RELEASE_OUTPUT=/absolute/new/release-directory \
IMAGE_PREFIX=yepwatch bash yepwatch-realtime/release/build-images.sh
```

The script refuses existing output directories and tracked uncommitted changes. API dependencies are bundled from this checkout; images get source/revision labels. Local image archives can be transferred with `docker save` / `docker load` if registry publishing is unavailable.

## 2. Prepare existing shared services once

Use the existing private administration process, with YepWatch writers stopped:

1. Create dedicated `yepwatch_runtime` and read-only `yepwatch_catalog` Crate users with private passwords. Do not reuse account/admin credentials in the runtime.
2. Create a stable random room key (at least 32 characters), a separate gateway service secret and matching private files. Back up the room key and its stable ID. Never regenerate them on redeploy.
3. Run the **new image's** operator as the trusted Crate administrator against an empty YepWatch store. Copy the key ID and all four budget settings from `api.env.example` into a private operator env. Use the existing trusted `crate-01` container's loopback network, not exposed passwordless admin access:

```sh
# Run on crate-01's host; substitute your private paths and exact API digest.
docker run --rm --network container:crate-01 --read-only --cap-drop ALL \
  --security-opt no-new-privileges \
  --env-file /PRIVATE/yepwatch-operator.env \
  --mount type=bind,src=/PRIVATE/room-key,dst=/run/secrets/room_key,readonly \
  --entrypoint node API_IMAGE_AT_SHA256 \
  build/yepwatch-release/operator.mjs provision --apply
```

Operator env: `YEPWATCH_PROPOSAL_CRATEDB_ORIGIN=http://127.0.0.1:4200`, `YEPWATCH_PROPOSAL_CRATEDB_USERNAME=crate`, `YEPWATCH_PROPOSAL_SECRET_FILE=/run/secrets/room_key`, plus the identical key ID and budgets. Production uses two replicas. Do not use `--disposable-single-node`. If an old schema exists, stop: this release intentionally refuses it and has no automatic migration or erase operation.

4. Grant the runtime exact table privileges after provisioning:

```sql
GRANT DQL,DML ON TABLE
 doc.yepwatch_room,doc.yepwatch_participant,doc.yepwatch_vote,
 doc.yepwatch_agreement,doc.yepwatch_proposal,doc.yepwatch_decision,
 doc.yepwatch_screen,doc.yepwatch_candidate,doc.yepwatch_command_receipt,
 doc.yepwatch_ticket,doc.yepwatch_member_grant,doc.yepwatch_member_intent,
 doc.yepwatch_control TO yepwatch_runtime;
GRANT DQL ON TABLE doc.yepwatch_runtime TO yepwatch_runtime;
GRANT DQL ON TABLE
 doc.movie,doc.show,doc.episode,doc.imdb_episode,doc.country,
 doc.streaming_service,doc.streaming_availability,doc.streaming_evidence,
 doc.movie_series,doc.season,doc.person,doc.person_appeared_in,
 doc.person_worked_on,doc.media_image,doc.media_video TO yepwatch_catalog;
```

Full DDL: [schema.sql](../../goodwatch-webapp/app/server/yepwatch/schema.sql). These catalog grants need an ordinary functional check with the actual restricted role before public activation.

5. Provision `yepwatch_messaging` consistently on **every existing Redis cluster node**, with its own password, only the two Pub/Sub channels and connection/discovery commands listed in [SHARED-SERVICES.md](SHARED-SERVICES.md#redis). No key access. Catalog snapshot access remains a separate API-only read credential. No Redis data migration is needed.

## 3. Update GoodWatch for signup

Integrate the release branch's GoodWatch changes into the current GoodWatch deployment source, preserving newer unrelated changes; do not blindly point the existing app at an older branch. Build/deploy the existing webapp through its existing Coolify process. Its new account resource and shared issuer policy must be present before enabling linking.

Register the public S256 client and set the three `AUTH_YEPWATCH_*` values described in [SHARED-SERVICES.md](SHARED-SERVICES.md#signup--sign-in) on **both** the existing GoodWatch service and YepWatch API. Registration uses the existing issuer operator process, not a second issuer or app client secret. Existing signup, email verification, login and consent are reused. If this is not configured yet, set `YEPWATCH_MEMBER_ENABLED=false` and identify the deployment as guest-only; do not claim sign-in is ready.

## 4. Configure Coolify

1. Create a Docker Compose resource on abio using `compose.yaml` plus `compose.coolify.yaml` from this exact release. In a Coolify editor that accepts one file, merge the override's `networks.edge.external: true` and `name: coolify` into the base's edge network.
2. Set the three digest image variables and source commit from `published-images.env`. Copy the remaining nonsecret variables from `release.env.example`.
3. Place the private files on the Docker host at the paths in that example. Secret files mounted into containers must be readable by UID 1000; keep their parent directory private. `api.env` follows `api.env.example`. The room/catalog/messaging passwords stay distinct. No production secrets are build arguments.
4. Pull/start the stack with the public route still absent. Run the image's operator `check` with the **runtime** credential, matching key/budgets. Wait for API and gateway readiness and full catalog load; startup can take tens of seconds. A TCP connection is insufficient.
5. Add the isolated `traefik-yepwatch.yaml` dynamic configuration in Coolify's proxy settings. It targets `yepwatch-front:8080` on the `coolify` network and uses the existing HTTP/HTTPS entrypoints and `letsencrypt` resolver. Do not also add a second generated route for this hostname. Keep other GoodWatch routes unchanged.
6. DNS apex already pointed to abio at the last read-only check; verify it still does. Let Coolify obtain the certificate. No new firewall rule is included.

## 5. Check before inviting testers

- `https://yepwatch.com/api/yepwatch/v1/proposal/health/ready` returns 200 with full catalog/store/bus ready; certificate validates.
- Two separate browsers create/join automatically, start, Yep, see a shared match, propose and agree to Done. Replacing a proposal clears prior agreement; returning to voting preserves the current proposal.
- Confirm live WSS delivery, then API/gateway restart recovery with the same room, keys and stores.
- Sign up with a real email or sign in, consent, and return to the **same** actor/room; verify private prefill/progress. Do not put private state/tokens in screenshots or logs.
- Test the newly signed preview on Android over ordinary Internet access. Existing USB debug installs and old APK3 do not prove this release. Confirm browser return and audible trailer playback on the actual phone.

## Operations / rollback

Defaults are 20 active rooms, 20 admission grants/minute, 600 command grants/minute and 60/actor/minute. They are durable policy settings, not live tuning knobs; changing the fingerprint is refused. These do not limit every HTTP read or connection. Rooms expire after six hours.

Before cleanup/backup, stop API writers and gateway; keep keys/private backups secure. Use the operator's `backup FILE --writers-stopped` and `purge-expired --apply --writers-stopped` as documented in [GUEST-RELEASE.md](../../goodwatch-webapp/app/server/yepwatch/GUEST-RELEASE.md). Cleanup exists but no schedule is installed. Full key rotation and sustained-load validation remain separate work.

To stop exposure, remove only the YepWatch proxy route, then stop these three services. Preserve tables, control state, secret files and keys. **Do not roll back to R4/blob-storage images against these typed tables.** Later rollbacks must use a schema-compatible image set and preserve earlier static assets for already open clients. Until such a version exists, stopping the new service is the safe rollback.

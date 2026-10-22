# YepWatch: repository → Coolify → deploy

This is the normal deployment path. No registry account, image archive, host-side env files or custom Traefik configuration is needed. Coolify builds the three services from Git; GitHub Actions only checks/tests builds.

## In Coolify

1. **New project → Production → New resource → Application from Git.** Select `alp82/goodwatch-monorepo` and branch **`main`**.
2. Select **Docker Compose**, base directory **`/`**, Compose location **`/yepwatch-app/compose.yaml`**. Load/parse the file. It defines `front`, `api`, and `gateway` with repository build targets. Coolify passes the repository root as `--project-directory`, so build contexts use `.` even though the Compose file lives in a subfolder. For local Compose commands use `docker compose --project-directory . -f yepwatch-app/compose.yaml …` from the repository root.
3. Assign **`https://yepwatch.com:8080` to `front` only**. In Coolify the suffix selects the internal container port; visitors use `https://yepwatch.com` without a port. Leave API and gateway domains blank. Use Coolify's generated routing/certificate; do not install the older `traefik-yepwatch.yaml` alongside it.
4. Add the variables below in **Environment Variables**. Keep secrets runtime-only, not build variables. Save them and keep a private backup of both generated keys.
5. Complete the one-time database preparation below, then **Deploy**. Coolify builds all three images. Wait for the full catalog/API/gateway checks to become healthy.
6. Enable **Auto Deploy / the repository webhook** using your usual Coolify setup. Subsequent pushes to this branch build and deploy the stack. GitHub Actions does not call the webhook, and a webhook does not automatically wait for CI; use passing checks before pushing a release or trigger deployment manually.

| Required variable | Value |
| --- | --- |
| `YEPWATCH_ROOM_KEY` | Generate once: `openssl rand -hex 32`; retain forever with this store |
| `YEPWATCH_GATEWAY_SECRET` | Generate separately: `openssl rand -hex 32`; same value reaches API/gateway |
| `YEPWATCH_ROOM_PASSWORD` | Password for `yepwatch_runtime` in existing Crate |
| `YEPWATCH_CATALOG_PASSWORD` | Password for read-only `yepwatch_catalog` in existing Crate |
| `YEPWATCH_REDIS_PASSWORD` | Your existing Redis user's password |

`YEPWATCH_REDIS_USER` defaults to **`default`**. Set it only if the existing credential belongs to a named ACL user. The same user/password is reused by API messaging, gateway messaging and the API snapshot reader. Nothing changes the Redis user's permissions automatically.

Private hosts are already set to Crate `10.0.0.11–13:4200` and Redis `10.0.0.14–16:6379`. Optional overrides for room database username/origin and catalog username are in the Compose file. All containers need host routing to those dependencies; no firewall changes are made by this setup.

## Can we reuse the Redis user?

**Yes.** It must support cluster discovery/connection commands, `PUBLISH`, `SUBSCRIBE`, `UNSUBSCRIBE` on `yepwatch:v3:revision` and `yepwatch:v3:activity`, and `GET` for the existing snapshot keys. Existing broad `default` users may already permit these; this work has not inspected or changed production ACLs. Redis ACLs govern commands, keys and channels separately: [Redis documentation](https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/).

Reusing a broad user means the gateway receives that user's broader Redis access too. The application still writes only Pub/Sub messages, never catalog keys. If you later choose a separate messaging user, set `YEPWATCH_REDIS_USER/PASSWORD` to it and set `YEPWATCH_CATALOG_REDIS_USER/PASSWORD` to the existing snapshot reader. No new Redis instance or application rebuild is required.

## One-time database preparation

The application does **not** create production tables at startup. Before the first deploy, create the two Crate roles, then provision all 14 typed tables with the new image's operator and grant the exact table access. The concrete operator command and grants are in [DEPLOY.md, section 2](DEPLOY.md#2-prepare-existing-shared-services-once). Use the same room key, key ID (`yepwatch-first-release-01`) and budget values (20/20/600/60) as this Compose file. You can use the already built typed-storage API archive for this one-time command, or build target `api` from this repository.

Skip that older guide's separate Redis-user requirement if reusing the existing user, and skip its private-file/Coolify/registry steps: this page replaces those steps. Never point the operator at retained demo tables or erase incompatible data to force startup.

## Enable GoodWatch signup/sign-in

Guests work without member configuration. Member linking defaults off until the existing GoodWatch issuer is ready:

1. Integrate/deploy the new `/api/yepwatch/account` endpoint and issuer policy into the **existing GoodWatch application**, preserving unrelated newer GoodWatch changes. No second account service is needed.
2. Register the public S256 client through the existing GoodWatch operator process, with scope `yepwatch:read`, resource `https://yepwatch.com/api/yepwatch` and callback `https://yepwatch.com/api/yepwatch/v1/proposal/member/callback`.
3. Configure the existing GoodWatch service's three `AUTH_YEPWATCH_*` values as in [SHARED-SERVICES.md](SHARED-SERVICES.md#signup--sign-in).
4. In this Coolify application add `YEPWATCH_GOODWATCH_CLIENT_ID=<that client ID>` and `YEPWATCH_MEMBER_ENABLED=true`, then redeploy. These are runtime settings; no secret client password is embedded in the app.

Until configured, Connect GoodWatch cannot complete; guest use remains available. Real public signup/email/callback and physical Android return still require an end-to-end check after activation.

## Check and future updates

Open `https://yepwatch.com/api/yepwatch/v1/proposal/health/ready`, then test two browsers: create/join → Yep → shared match → propose/agree → Done. Test signup/login separately once enabled. Persistent state stays in existing Crate; Redis only carries notifications.

Do not regenerate keys, reset tables, or change the fixed budget policy on redeploy. Rollback must use this typed schema, not the old R4/blob images. The front build contains the web app, not a signed APK download. Existing Android APK4 is separate. The first build installs dependencies; subsequent builds reuse Docker layers.

As with other static app deployments, open clients may need a reload after a deploy because this repository build does not retain previous web chunks. Coolify/build failure leaves the release unproven until its own health checks and public flow pass; local image builds do not prove host connectivity.

References: [Coolify Compose configuration](https://coolify.io/docs/services/configuration/docker-compose), [Coolify domains](https://coolify.io/docs/core/networking/domains).

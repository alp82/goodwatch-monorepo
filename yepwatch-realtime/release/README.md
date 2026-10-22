> Current deployment: [DEPLOY.md](DEPLOY.md). GitHub builds images; the owner activates Coolify.

> Current source uses shared Redis, stable table names and optional GoodWatch accounts. Follow [SHARED-SERVICES.md](SHARED-SERVICES.md). The R4 image hashes/topology below describe the preserved earlier guest release.

# Guest beta release preparation

Prepared for owner activation; nothing here deploys automatically. Production
Coolify/proxy changes remain with the owner under
[webapp-deploys.md](../../docs/webapp-deploys.md) and
[proxy-certificates.md](../../docs/proxy-certificates.md). Do not run this stack
against retained local demo configuration or room stores.

## Public contract and topology

The intended origin is **https://yepwatch.com** for the web app, invitations and
HTTP API. WebSocket is **wss://yepwatch.com/api/yepwatch/v1/proposal/realtime**.
Only the proposal v3 public paths are routed. Guest-only beta has no account,
issuer, OAuth registration or refresh dependency.

**This is a publicly reachable service proposal, not an invite-only service.**
Room invites authorize joining particular rooms; they do not restrict who can
load the app, download the APK or create a guest room. Sharing the URL only with
friends does not create an access boundary.

```text
Existing abio Coolify Traefik :443 (HTTPS/WSS, existing HTTP01 resolver)
  -> front:8080 (Caddy, static export + explicit public HTTP/WS routes)
       -> api:3000 (standalone guest API; durable rooms in private Crate)
       -> gateway:4311 (one-use tickets, leases, shared snapshots, activity)
API + gateway -> dedicated ephemeral Valkey fanout
API only -> full existing snapshot read source + catalog SQL
```

No service publishes a host port in `compose.yaml`. The front joins Coolify's
existing network via `compose.coolify.yaml`. API/gateway use an internal control
network; fanout has its own internal network. Only API gets a catalog egress
network and database/catalog credentials. Gateway gets the service bearer and
dedicated fanout password, with no account/catalog/database access. Valkey holds
reconstructible hints/activity, never authoritative votes or room state.

Proposed initial limits: front 128 MiB/0.5 CPU, API 3 GiB/2 CPU, gateway 512 MiB/1
CPU, fanout 128 MiB/0.5 CPU (64 MiB cache). These are limits to rehearse and tune,
not measured capacity promises. Gateway allows 128 total sockets/32 active rooms;
the existing participant, frame, heartbeat, authorization and lease bounds still
apply. Proxy peer addresses are pooled, so the container's per-IP ceiling equals
its global ceiling. Forwarded client addresses are not trusted for identity.

## Exact inputs and building

Use a reviewed source snapshot, the backend owner's final standalone bundle and
the app owner's frozen public export. Never use a checkout-wide Docker context.
`prepare-context.mjs` copies an explicit allowlist and records every copied hash.
It excludes source maps, environment files and symlinks. The API bundle must have
`server.mjs`, `operator.mjs`, **adjacent** `title-snapshot.worker.js`, package and
lockfile. Its locked runtime dependencies are installed inside the image.

The earlier backend r1 and formatting-only r2 candidates are superseded: general
catalog helpers could write derived source-cache entries. Keep those images for
the historical record; do not use them for release or further functional proof.
Use only the replacement with a dedicated GET/getBuffer snapshot reader and
general shared-cache configuration disabled before helper imports. Normal webapp
cache behavior is outside this release configuration.

Example local build, replacing uppercase input paths/ID with the reviewed pins:

```sh
node yepwatch-realtime/release/prepare-context.mjs \
  --source REVIEWED_SOURCE \
  --out NEW_CONTEXT_DIRECTORY \
  --api-bundle FINAL_BACKEND_BUNDLE \
  --web-export FROZEN_PUBLIC_WEB_EXPORT \
  --preview-download PREVIEW_DOWNLOAD_COMPANION \
  --preview-apk-filename yepwatch-preview-r3.apk
docker build -f NEW_CONTEXT_DIRECTORY/gateway/yepwatch-realtime/release/Dockerfile.gateway \
  -t yepwatch-gateway:RELEASE_ID NEW_CONTEXT_DIRECTORY/gateway
docker build -f NEW_CONTEXT_DIRECTORY/api/Dockerfile.api \
  -t yepwatch-api:RELEASE_ID NEW_CONTEXT_DIRECTORY/api
docker build -f NEW_CONTEXT_DIRECTORY/front/Dockerfile.front \
  -t yepwatch-front:RELEASE_ID NEW_CONTEXT_DIRECTORY/front
```

For a later web update, add `--previous-web-export PREVIOUS_EXPORT` to retain its
hashed `_expo`/`assets` files. A same-path/different-content conflict fails the
build. This supports already-open tabs; retain the prior complete image for
rollback too. Do not replace the active local phone export to build images.

Historical r3 rehearsal app input: committed `42505717`, frozen `beta-web-r1`, index
SHA256 `ea268f1f06d7655a5af643c5429a1d0deceea307f32cfa86ffd2cf61af9c26a8`.
The companion APK is `com.yepwatch.preview`, a distinct preview package with
bundled JS, not the active Hybrid app or a store signing identity. Its path is
`/downloads/yepwatch-preview-r1.apk`, size 56891143 bytes, SHA256
`e6b059d942f0d10c53daff0afafac1b7f52198a86534897bc340c389e1aa9a53`.
The adjacent `.apk.sha256` is served too. No private signing material belongs in
the context/image. See the app owner's `artifacts/release/download-artifact.json`
and `INSTALL.md` companion for Android installation instructions.

R4 compatible client input is committed `932d14c0`, frozen `beta-web-r3`, index
SHA256 `fdcc379d6891bd5e45de72af9ce53deed295375242440daee5dccc7804d45570`.
Its separate `/downloads/yepwatch-preview-r3.apk` is 56900675 bytes, versionCode3,
SHA256 `eac3f80e64c5afe0eb7edc18af0e4acb4c558126c5b8c69a3a16f42d985f7061`,
with the same preview package/certificate. See app `artifacts/r4-client-r2/`.
Client r4-r1/beta-web-r2/APKcode2 was superseded and is not an accepted input.
These inputs/images do not change frozen earlier exports/downloads or devices.

## Private configuration and provisioning

Copy `release.env.example` outside the checkout and fill immutable image digests,
the reviewed source commit, and private file paths. `api.env` contains endpoints,
usernames and stable key ID, not secret values. Required API settings:

```dotenv
YEPWATCH_PROPOSAL_PUBLIC_ORIGIN=https://yepwatch.com
YEPWATCH_PROPOSAL_CRATEDB_ORIGIN=PRIVATE_ROOM_CRATE_HTTP_ORIGIN
YEPWATCH_PROPOSAL_CRATEDB_USERNAME=ROOM_ONLY_RUNTIME_ROLE
YEPWATCH_PROPOSAL_KEY_ID=STABLE_OWNER_SELECTED_KEY_ID
YEPWATCH_PROPOSAL_MAX_ACTIVE_ROOMS=20
YEPWATCH_PROPOSAL_ADMISSIONS_PER_MINUTE=20
YEPWATCH_PROPOSAL_COMMANDS_PER_MINUTE=600
YEPWATCH_PROPOSAL_ACTOR_COMMANDS_PER_MINUTE=60
CRATE_HOSTS=COMMA_SEPARATED_PRIVATE_CATALOG_HOSTS
CRATE_PORT=4200
CRATE_USER=READ_ONLY_CATALOG_ROLE
REDIS_HOST=PRIVATE_FULL_SNAPSHOT_CLUSTER_SEED
REDIS_PORT=6379
```

The final release uses these Redis settings only for its dedicated read-only
snapshot reader; optional `REDIS_HOST2/3` are discovery seeds. No sample
`TITLE_SNAPSHOT_REDIS_URL`, local fixture/install flags or `.env` from the general
webapp is allowed. Existing cluster discovery requires connectivity to discovered
members as well as the seed. Confirm final backend config/runbook before activation.

Compose mounts room key, room-role password, gateway service bearer, dedicated
fanout URL/password, catalog SQL password and source-snapshot password as files.
Do not provide a value and its `_FILE` together. `revision-url` is a private
`redis://:PASSWORD@fanout:6379` file, matching `fanout-password`. Generate independent
strong random room key/service bearer/fanout password; the fanout password must be
at least 32 base64url characters. Never put these in URLs sent to clients, Docker
build args, shell arguments, repositories or logs.

Local Compose file-backed secrets preserve host permissions: runtime UID1000
must be able to read them. An owner-only parent directory mode0700 with files
owned by UID1000 mode0400 works; do not make secrets world-readable. Keep the
room key and key ID stable across restart/rollback and back them up privately.
Losing/changing them can invalidate encrypted rooms, tickets and capabilities.

The API performs no startup DDL or purge. The backend owner's operator command
must check/provision the dedicated room table and runtime metadata with explicit
owner approval, using a separate provisioning role. R4 also provisions
`doc.yepwatch_room_v3_control`; the runtime needs DQL+DML on this table. Initial
control provisioning requires an **empty room store and quiesced writers**.
Never bootstrap over retained r3/tester history or reset a live quota. Supply
identical control settings to the operator and every API; a fingerprint mismatch
refuses readiness/requests. There is no policy migration command. The harness
always uses a fresh own store, with explicit matching settings for provision/API.
Follow the backend runbook for
role grants, key compatibility, inventory and encrypted backup. Never point
`--disposable-single-node` at a production table; it is reserved for an explicitly
disposable loopback Crate store. Do not use local demo keys or share production
room data with the rehearsal.

## Isolated rehearsal

The local harness uses fresh disposable Crate and password-protected Valkey,
reviewed images, the actual app export, and existing full catalog **read-only**
dependencies. It never accesses retained room tables or resets retained services.
Run after the backend's final no-source-cache-write operational proof is ready:

```sh
cd yepwatch-realtime
node --import tsx release/rehearse.mjs \
  --catalog-env PRIVATE_ALLOWLISTED_CATALOG_CONFIG \
  --source-commit REVIEWED_SOURCE_COMMIT \
  --api-image yepwatch-api:FINAL_RELEASE_ID \
  --front-image yepwatch-front:FINAL_RELEASE_ID \
  --gateway-image yepwatch-gateway:FINAL_RELEASE_ID \
  --result release-rehearsal-r4.json \
  --expected-index-sha256 CHECKED_WEB_INDEX_SHA256 \
  --apk-filename yepwatch-preview-r3.apk \
  --expected-apk-sha256 CHECKED_APK_SHA256
```

It requires Docker/Compose, OpenSSL and the app workspace's installed Playwright
Chromium. Only its unique `yw-release-*` project is created/removed. It refuses an
existing loopback443 listener; never stop another listener to run it. An ephemeral
certificate and browser resolver override exercise the actual intended HTTPS
origin on **127.0.0.1:443**, without changing system DNS/trust or contacting public
YepWatch. Only this local cert/SPKI is accepted by the harness. This does not prove
public ACME issuance, real remote network access or a physical Android flow.

The proof covers static/invite/association/download routing, actual browser
cookie and WSS session, two independent native-protocol guests, three-person
proposal/agreement/fresh Done, shared-only output, gateway SIGTERM1012/fresh ticket
reconnect, and API restart preserving its durable actor/decision. Sanitized result
is `artifacts/<result-name>` from `--result` only after success. A matching
`*-browser-done.png` is recorded too. Existing result/screenshot paths are refused
before creating a project, and writes are exclusive: preserve the committed r3
`release-rehearsal.json` and use new names for follow-up runs. Failure logs/config stay
private under a unique `/tmp/yepwatch-release-rehearsal-*`; do not publish them.
The earlier paused r1 attempt was not a successful release rehearsal.

R3 connected rehearsal **passed 2026-10-22T13:45:42.974Z** using committed backend
`d3702ac1fa10650b968d767096129236815fd4d5`, frozen bundle manifest SHA256
`e51fb4a3f8417355ede1b43816eb5bff9e8722bdb0e1f6de64376151f3654d66`.
It exercised a full-catalog 20-card deck, actual public-origin web export plus two
native-protocol clients, three-person proposal/Done, 12 browser shared frames and
zero JS errors. Gateway1012/fresh ticket and API restart preserving actor/decision
passed (API recovery about31s; one local run, not an SLA). The unique Compose
project was removed; retained phone/demo listeners stayed unchanged. See
`artifacts/release-rehearsal.json` and `artifacts/release-static-proof.json`.
This was not a physical phone test, public TLS activation, capacity test or
acceptance of the r3 operational gaps below.

For a separate real rate/cooldown compatibility phase, use another new result
filename and add `--rate-compatibility 1` to the same command. It provisions a new
store/control row with actor command budget1/minute (other settings unchanged),
then observes an actual browser guest's assignment success and readiness429.
It checks Retry-After, reload persistence, no automatic command replay and manual
same-envelope Retry after the natural SQL minute boundary. This test-specific
policy is not a proposed production limit. It never resets a quota, edits a clock
or fabricates a response. Keep both phases' evidence separate from r3.

R4 default-policy rehearsal **passed 2026-10-22T14:34:30.853Z** with backend
`e96519f59951f268ecc1e6f136839c87b56326ce`, frozen bundle manifest SHA256
`1dc465eed79122d6d78eb4a40a484df13a7ce280dab3196ad6b7b95496aa37a4`,
and checked client `932d14c0`/beta-web-r3/APKcode3. The real full-catalog 20-card
three-person flow, shared-only output, gateway1012/fresh ticket and API actor/
decision recovery all passed (12 browser shared frames, zero JS errors; about34s
API restart recovery in this run). See `artifacts/release-rehearsal-r4.json`.

The separate fresh-store rate phase **passed 2026-10-22T14:37:01.043Z** with the
test-only actor budget1/minute. Actual429 returned retryable/Retry-After59;
reload retained the pending readiness command and cooldown, no automatic command
POST occurred, and manual Retry after the natural window sent the same command
ID/sequence/body and succeeded once. Three browser command POSTs total were
assignment success, denied ready, manual ready success. No automatic agreement,
fixture denial, clock edit or quota reset occurred. See
`artifacts/release-rehearsal-r4-rate.json`. Both projects were removed; prior r3
evidence and all retained listeners were preserved. This adds functional
compatibility evidence, not public TLS/physical-phone/load/independent-review
or activation acceptance.

## Release acceptance and known gaps

Container readiness means dependencies are usable. It does not mean the service
is ready for unrestricted public exposure. Activation remains paused until the
final image including the no-source-cache-write path and checked capacity controls
passes connected checks, and root reconciles the remaining gaps with the owner.
A later independent
implementation review is currently unavailable; no such review is claimed by
these packaging and ordinary functional checks.

| Capability | Current scope and acceptance needed |
| --- | --- |
| Room state and transport | Durable Crate/API state, ticket/lease authorization, bounded sockets and repair are implemented; r3 and checked R4 connected release proofs passed, plus real R4 rate/cooldown/manual-retry compatibility. |
| Admission and commands | Checked R4 `e96519f5` adds SQL-clock durable global active-room reservations and logical admission/command/actor grants. Defaults20 rooms,20 admissions/minute,600 commands/minute,60 actor commands/minute. These are not comprehensive raw HTTP/read/metadata/IP protection; exact retries can bypass new logical-operation charges. No unrestricted public-service abuse/capacity claim follows. |
| Expiry and physical cleanup | Logical room expiry does not physically delete encrypted records. Automated physical cleanup is unfinished; owner needs an explicit retention, storage monitoring and cleanup plan before sustained use. No automatic purge is enabled here. |
| Keys | Stable-key compatibility and restart/rollback are supported. Full key rotation/re-encryption is unfinished. Owner must retain the current key securely and accept that ordinary rollback cannot rotate it; compromise recovery requires a separate plan. |
| Service access | Apex/API/APK are public if this router is activated. A service-wide invite-only access boundary is not implemented. Root must choose whether to add one or explicitly accept a publicly reachable supervised trial. |
| Scale and review | Local functional proof is not a load test or independent release review. R4 APIs sharing the same checked store/control policy coordinate logical grants; this does not establish sustained concurrency capacity. |

A small supervised trial can exercise ordinary guest movie/new-show choosing,
matches/proposals, anonymous agreement, reconnect and durable restart recovery.
It must not be described as unrestricted public readiness or as a private service
without an actual service access boundary. Inventory/container/SQL monitoring
during scheduled testing remains useful observation, never a substitute for
enforced controls or release acceptance. Defaults above are backend-enforced
logical budgets, not a measured load capacity guarantee. Connected rehearsals
establish functional evidence only. Pause public
API/WebSocket access at the front proxy on unexpected growth or errors; removing
only the new YepWatch router is a full-service stop option. Preserve stores/keys
for diagnosis; no ad-hoc DELETE, reset or unreviewed cleanup. Physical retention
and key-compromise recovery still require explicit owner acceptance/planning.

Backend-confirmed implemented bounds: 12 participants/screens per room, 20-card
pages, 120 retained candidates, 2000 seen keys per generation, 512000-byte
plaintext aggregate, 64 receipts and four outstanding tickets per actor,
65536-byte JSON body, fixed six-hour room expiry without sliding extension.
Create retries are bounded at four attempts, join/command at six; these are
**CAS attempt limits, not request rates**. Expired encrypted records still occupy
storage until the unfinished physical cleanup is addressed.

## Owner activation and rollback

Read-only inspection on 2026-10-22 found `yepwatch.com` A159.69.247.66, no AAAA,
matching abio/private10.0.0.21. Its existing Coolify Traefik v2.10 owns80/443,
entrypoints `http`/`https`, HTTP01 resolver `letsencrypt`, external network
`coolify`. The public certificate did not yet cover `yepwatch.com`. No current DNS
change is inherently required for the apex; owner domain/Coolify access and TLS
activation are required. `www` is intentionally not configured. Do not publish
an AAAA record without an actually supported IPv6 route.

Before activation the owner checks image/source manifests, private database role
grants and backups, room/key metadata compatibility, API catalog connectivity,
available capacity, and app associations. Current read-only host inventory showed
about10GiB available memory/86GiB free disk; this is a point-in-time observation.
No new paid host is proposed. Expo login/project and Apple team identity remain
unknown; neither blocks mobile HTTPS web or the separately signed Android preview.

Owner-only commands after the acceptance decision above, final connected proof,
approved provisioning and private config placement:

```sh
docker compose -p yepwatch-beta --env-file /srv/yepwatch/release.env \
  -f compose.yaml -f compose.coolify.yaml config --quiet
docker compose -p yepwatch-beta --env-file /srv/yepwatch/release.env \
  -f compose.yaml -f compose.coolify.yaml up -d
```

Then the owner adds **new isolated** dynamic configuration `yepwatch-beta.yaml`
through Coolify's supported proxy UI using `traefik-yepwatch.yaml`. Do not overwrite
shared GoodWatch routes, edit live proxy files from this workspace, restart the
shared proxy or expose API/gateway/store ports. Verify the existing router priority
does not conflict before activation. Existing HTTP01 issues the apex certificate;
no certificate validation bypass belongs in product/native builds.

Readiness is503 until full snapshot + catalog SQL + room metadata/key + bus checks
are fresh and healthy, and during drain. Front/Traefik use API readiness; gateway
also has its own private healthcheck. Record API sourceCommit and image digests;
inspect aggregate health without room IDs, invitations, cookies, tickets or activity
payloads in logs. Existing proxy redaction should stay in place; front has no
access log. Health proves dependency checks, not sustained traffic capacity.

Gateway restart sends1012 and clients obtain fresh tickets; API drain first turns
readiness red. Compose gives30s grace. This initial single API/front topology has
brief restart outages; client repair and durable Crate preserve rooms. Valkey loss
must show degraded delivery until resnapshot/authority recovery. No sticky-session
correctness dependency or client polling should be introduced. For an update,
retain prior images/static assets and keys, check compatibility, and replace only
this Compose project. Do not restart the shared proxy or retained local stacks.

Rollback sets the three image references to the prior reviewed digests and runs
the same Compose command, preserving private config, room table, runtime metadata
and keys. Never use `down --volumes`, purge tables, rotate keys or restore a backup
over a live store as an ordinary rollback. If a schema is incompatible, stop and
use the backend owner's explicit backup/restore procedure into a separate store.
Do not roll an activated R4 store back to an R3 API without capacity controls;
that would bypass its policy. Rollback must retain compatible control semantics
and the same fingerprint. Format2 backend backups include control state; neither
policy replacement nor migration over prior room history is provided here.
Removing only the new YepWatch router disables public access without touching
GoodWatch routes or deleting durable rooms.

## Firewall proposal

No new public firewall rule is proposed: existing80/443 are reused, and internal
services have no host mappings. The owner verifies abio API-container egress to
the private catalog Crate HTTP nodes and all snapshot Redis cluster members.
Only if current rules deny those exact dependencies, request narrowly scoped
owner changes with comments such as **`yepwatch-api: abio to private Crate HTTP`**
and **`yepwatch-api: abio to full snapshot Redis`**, on every relevant host/rule.
Specify actual source/interface, destination and port after owner inspection;
do not paste broad subnet rules or reuse another service's ownership prefix.
See [worker-firewall.md](../../docs/worker-firewall.md). This preparation changes
no firewall, DNS, proxy, production database, cache privilege or paid resource.

Routing references: [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[Caddy SPA patterns](https://caddyserver.com/docs/caddyfile/patterns),
[Compose networking](https://docs.docker.com/compose/how-tos/networking/),
[Compose file secrets](https://docs.docker.com/reference/compose-file/secrets/).

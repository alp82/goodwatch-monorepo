> Current source uses shared Redis, stable table names and optional GoodWatch accounts. Follow [SHARED-SERVICES.md](SHARED-SERVICES.md). The R4 image hashes/topology below describe the preserved earlier guest release.

# R4 activation handoff — prepared, not executed

Accepted packaging/evidence: `c84e5e31`; API source `e96519f5`, client `932d14c0`.
No image upload/load, service startup, role/table/key provisioning, proxy/DNS/
firewall change or device action has been performed. Completed local rehearsals
were not repeated. This is the concrete plan for the owner's final decision.

## Read-only target result

Abio `10.0.0.21` / public `159.69.247.66`: Linux/amd64, Docker26.1.3,
Compose2.20.3, 8 logical CPUs, load3.05/3.07/3.28, 10463MiB available RAM,
about81GiB free disk, no swap. Existing healthy Traefik2.10 still owns80/443,
entrypoints `http`/`https`, resolver `letsencrypt` with HTTP01, watched
`/traefik/dynamic/`, external bridge `coolify` (`172.23.0.0/16`). Its start time
is unchanged. No YepWatch-named container or YepWatch dynamic Host route file
was found. Apex A still points to159.69.247.66; no DNS change is proposed.

All six expected endpoints accepted TCP connections from both the host and an
existing GoodWatch container on `coolify`: Crate `.11/.12/.13:4200`, full-snapshot
Redis `.14/.15/.16:6379`. Backend confirmed the latter through normal read-only
CLUSTER SLOTS. API does **not** need Redis cluster-bus16379. No credentials,
authentication/data requests, new networks or containers were used for this check.
This does not verify the future API bridge or the new roles' functional grants.
Exact evidence: `artifacts/release-target-preflight-r4.json`.

## Exact images and local transfer artifacts

All custom images are Linux/amd64. Tags identify archive entries; verify the
immutable IDs after load and before starting the isolated project:

| Service/tag | Required image ID |
| --- | --- |
| `yepwatch-api:release-r4-20261022` | `sha256:f1ec65af2e7e81cc9abdaa8bc7fa2e9aca07514fb2976afcc3b960a2aa910f79` |
| `yepwatch-front:release-r4-20261022` | `sha256:69f5eb4bc821e0ffeab0ba27d484d79f973632fe1f706af8ab7910806e1e2074` |
| `yepwatch-gateway:release-r3-20261022` (unchanged) | `sha256:4c15a848f8b7c60e932e50f26d99446f43cec21adf10ac8be85d0806701f1994` |

Prepared locally only in `/tmp/yepwatch-activation-r4-transfer-20261022/`:

| Archive | Bytes | SHA256 |
| --- | ---: | --- |
| `yepwatch-r4-images.tar` (three custom images) | 462910464 | `88686063f1f53232086df55a70c923f2504b46ba1b67d2d0a11bc4aadac23f7f` |
| `yepwatch-r4-operator-api.tar` (API only) | 276602880 | `a2ad23538044327513357f94c293115c134abadacd1346baa575b8c2111968a3` |

After approval, owner transfers the first archive/checksum to abio and the API-only
archive/checksum to crate-01 over existing private SSH. No registry/push/account
creation is needed. Verify the appropriate checksum before `docker image load -i
ARCHIVE`, then `docker image inspect TAG --format '{{.Id}}'` against the table.
Verify crate-01's platform before loading its one-shot operator image. Owner also
pulls the already pinned public fanout image (no secret involved):

```sh
docker image pull valkey/valkey:8.1.10@sha256:640c5e62cea04b6d6f2084232651d0cc70362d31f4f805e7be94dbed6855e8f2
```

Docker archive transport preserves images/tags; see official
[save](https://docs.docker.com/reference/cli/docker/image/save/) and
[load](https://docs.docker.com/reference/cli/docker/image/load/) documentation.
No archive has been uploaded or loaded on either server by this task.

## New project and private configuration

Proposed abio project **`yepwatch-beta`**, files under
`/srv/yepwatch/releases/r4-20261022/`: exact `compose.yaml`,
`compose.coolify.yaml`, `traefik-yepwatch.yaml`, and owner-filled `release.env`
from the adjacent example. Stop on an unexpected existing project/file/store;
do not overwrite another deployment. No service publishes a host port.

Set the three accepted tags above, `YEPWATCH_SOURCE_COMMIT=e96519f59951f268ecc1e6f136839c87b56326ce`,
and the private paths from `release.env.example`. The runtime health label names
the backend source; the composite release/image manifest remains `c84e5e31`.

Proposed private directory `/srv/yepwatch/secrets/` is owner-private0700. Runtime
file mounts must be UID1000-readable0400. Provide only named files: `room-key`,
`room-password`, `catalog-password`, `catalog-cache-password`, `gateway-service`,
`fanout-password`, `revision-url`; never a general webapp env dump. Owner generates
independent gateway/fanout secrets once (32+ base64url characters), with exclusive
file creation and no stdout/argv values. `revision-url` privately contains the
matching `redis://:PASSWORD@fanout:6379`. Room key generation is specified in the
backend companion below; retain its separately recoverable backup.

Nonsecret `api.env` uses the following **proposals**, not existing new identities:

```dotenv
YEPWATCH_PROPOSAL_PUBLIC_ORIGIN=https://yepwatch.com
YEPWATCH_PROPOSAL_CRATEDB_ORIGIN=http://10.0.0.11:4200
YEPWATCH_PROPOSAL_CRATEDB_USERNAME=yepwatch_runtime
YEPWATCH_PROPOSAL_KEY_ID=OWNER_SELECTED_STABLE_KEY_ID
YEPWATCH_PROPOSAL_MAX_ACTIVE_ROOMS=20
YEPWATCH_PROPOSAL_ADMISSIONS_PER_MINUTE=20
YEPWATCH_PROPOSAL_COMMANDS_PER_MINUTE=600
YEPWATCH_PROPOSAL_ACTOR_COMMANDS_PER_MINUTE=60
CRATE_HOSTS=10.0.0.11,10.0.0.12,10.0.0.13
CRATE_PORT=4200
CRATE_USER=yepwatch_catalog
REDIS_HOST=10.0.0.14
REDIS_HOST2=10.0.0.15
REDIS_HOST3=10.0.0.16
REDIS_PORT=6379
REDIS_COMMAND_TIMEOUT_MS=30000
```

Compose supplies secret `_FILE` paths; do not add direct values alongside them.
The existing snapshot credential is supplied through the owner's private secret
mechanism. The release's read-only reader disables general shared-cache writes.
Do not substitute the old broad catalog credential for the proposed new reader.

## Precise owner-only provisioning and activation order

1. Owner accepts the public exposure/remaining gaps below and selects the proposed
   store/roles/key ID. Confirm the intended three-node Crate copies and empty room
   store; this is a new beta store, never retained local/phone history.
2. Follow [activation-backend-r4.md](activation-backend-r4.md), verbatim handoff
   from backend (SHA256 `b579e83cd087f9293807a8eb441460ade088502f9ff030493c7ae1e6b55fc7aa`).
   It contains exact trusted crate-01 container-loopback `CREATE USER` commands
   with bound JSON-stdin passwords/exclusive root0600 files, stable-key generation,
   and the API-image operator command in `--network container:crate-01`:
   `node build/yepwatch-release/operator.mjs provision --apply`.
   Use the exact API ID above for `OWNER_REVIEWED_API_IMAGE_DIGEST`. Keep default
   replicas2/three active copies; **no disposable flag**. Then apply its table-only
   grants for `yepwatch_runtime` and `yepwatch_catalog` individually. Nothing runs
   DDL from API startup. Empty-store/control/key mismatch or partial failure means
   stop, not erase/reset/retry over history.
   SQL references: [Crate5.10 CREATE USER](https://cratedb.com/docs/crate/reference/en/5.10/sql/statements/create-user.html)
   and [HTTP bound parameters](https://cratedb.com/docs/crate/reference/en/5.10/interfaces/http.html#parameter-substitution).
3. Transfer only the named role/key files through the private owner mechanism;
   install runtime-readable copies on abio. Supply identical key/key ID and four
   policy settings to operator/API. Run operator `check` using the new runtime
   room identity, not the administration env. New catalog-role functional reads
   remain a post-provision requirement; earlier proofs used the old source reader.
4. After verified loads/private configuration, owner runs only this new project:

```sh
cd /srv/yepwatch/releases/r4-20261022
yw_compose() { docker compose -p yepwatch-beta --env-file ./release.env -f compose.yaml -f compose.coolify.yaml "$@"; }
yw_compose config --quiet
yw_compose up -d --pull never
yw_compose ps
docker inspect --format '{{.Name}} {{.Image}}' yepwatch-beta-api-1 yepwatch-beta-front-1 yepwatch-beta-gateway-1
```

   Confirm all exact image IDs and healthy dependencies before routing. API
   readiness must stay503 until full snapshot, catalog SQL, room metadata/key,
   control fingerprint and dedicated bus pass; there is no timeout-to-green.
   This first private startup verifies the future bridge and new roles. On failure
   stop this project and inspect coarse health; do not add broad firewall rules.
5. Owner uses **Coolify UI** to add only new dynamic file `yepwatch-beta.yaml`
   containing `traefik-yepwatch.yaml`. Host `yepwatch.com`, existing80->443 redirect,
   HTTPS resolver `letsencrypt`, upstream `http://yepwatch-front:8080`, readiness
   health check every5s/3s timeout. Existing HTTP01 issues the apex certificate;
   no shared proxy restart, DNS or firewall change is proposed.
6. Owner verifies valid public HTTPS/WSS, SPA `/r/*` and `/room/*`, preview
   association/download SHA, and an ordinary authorized guest flow with the new
   roles. Internal hooks remain unpublished. No TLS bypass belongs in the app.

## Stop/rollback and exact remaining decision

Disable/remove only the new YepWatch dynamic file through Coolify, then run
`yw_compose stop --timeout 30`. Gateway drains1012; keep all Crate tables, keys,
metadata/control and private backups. Do not use `down --volumes`, DELETE, purge
or quota/key reset. For this first public release, rollback is disabling the new
route/project, **not** activating R3 without controls. Later image rollback needs
compatible R4 control semantics and the same fingerprint/key; retain prior web
assets/images. Existing GoodWatch and local phone stacks remain separate.

**Execution is currently prevented by the owner's pending deployment decision
and unperformed provisioning/secret placement/Coolify activation above.** The
owner must explicitly accept that apex/API/APK will be public, with no service-wide
tester gate; R4 logical budgets do not cover all raw HTTP/read/metadata/IP traffic.
Physical cleanup and full key rotation/re-encryption remain unfinished. Name the
backup/key custodian and finite-trial retention/stop responsibility before traffic;
no ad-hoc cleanup protocol is supplied. Room coordinator `.11` is one HTTP origin,
not automatic coordinator failover. Local functional proof is not sustained load,
public TLS, physical APK3 or later independent-review evidence.

No new paid resource or firewall rule is proposed. If post-start network checks
show a permission gap, any later owner-approved exact rule needs an owner/purpose
comment, e.g. `yepwatch-api: abio to private Crate HTTP` or
`yepwatch-api: abio to full snapshot Redis`; do not reuse another reconciler's
prefix or open public database/cluster ports. See [README.md](README.md) for the
complete build, privacy, routing and restart contract.

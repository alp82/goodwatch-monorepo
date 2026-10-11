# Production ingress evidence and historical rollout procedure

For [Task 407](https://github.com/alp82/goodwatch-monorepo/issues/407), **installed and activated with owner approval** on October 11, 2026. [Activation evidence](../../docs/implementation/search-ranking/ingress-activation-20261011.json), retained by [PR #433](https://github.com/alp82/goodwatch-monorepo/pull/433), records abio activation at 19:15:50.543 UTC and vector1 at 19:16:58.477 UTC (proxy start 19:17:00.023 UTC). Both proxies were healthy, emitted the tested whitelist and had durable logging-ready collector heartbeats at 19:16:39.792 and 19:17:11.077 UTC respectively. Live and stored Coolify configurations received only the approved logging arguments, preserving unrelated settings independently and their preexisting label drift. The seven-day acceptance window remains outstanding.

The preparation digests and installation/restart commands below document the **historical preactivation procedure**. Do not replay them against the active configuration: the original source digests are obsolete and candidate generation intentionally refuses existing access-log arguments. Before verification, check fresh collector heartbeats, image/logging readiness and uninterrupted coverage. Future approved static changes require one-host-at-a-time restart coordination before a fresh acceptance window; preserve existing routing and private rollback backups.

Historical preactivation inspection on October 11, 2026 confirmed:

| Host | Executable version | Configuration | Search router |
| --- | --- | --- | --- |
| abio | 2.10.7 | `/data/coolify/proxy/docker-compose.yml`, service `traefik` | `gw-search-https@file` |
| vector1 | 3.6.25 | same path and service | `gw-search-from-abio@file` |

Both proxies use command arrays, mount `/data/coolify/proxy` at `/traefik`, and had no access-log arguments before activation. Their search routers have priority 1100 and match both combined search and command palette. Filtering POST on those router names conservatively includes POST to the palette path. Do not add paths, IPs or URLs to distinguish it. Unmatched-router requests cannot be classified as searches with this whitelist; retained evidence covers correctly routed HTTP requests, not DNS, TLS, connection or routing failures before selection.

## Approved active arguments

The approved rollout appended these to the existing `services.traefik.command` list on each host:

```yaml
- --accesslog=true
- --accesslog.format=json
- --accesslog.bufferingsize=0
- --accesslog.fields.defaultmode=drop
- --accesslog.fields.names.StartUTC=keep
- --accesslog.fields.names.RouterName=keep
- --accesslog.fields.names.RequestMethod=keep
- --accesslog.fields.names.DownstreamStatus=keep
- --accesslog.fields.headers.defaultmode=drop
```

On vector1 only, also append:

```yaml
- --accesslog.fields.queryparameters.defaultmode=drop
```

No filters exclude successful statuses, and buffering stays synchronous. Output defaults to stdout, leaving the existing Docker logging configuration intact. A durable sanitizer/collector on **both** hosts must be ready before enabling collection; size-based Docker rotation alone does not guarantee seven-day retention. The companion `ingress-collect.mjs` and `ingress-verify.mjs` collect and verify proxy responses on each host. They supplement the search-role lifecycle/history checks; neither summary alone establishes full acceptance.

The deployed-version local fixture verifies request paths, query parameters, body, credentials and headers are absent from access records, including a proxy-generated 502. Both versions additionally emit logger metadata `level`, `msg` (empty in the fixture) and `time`. Thus the raw JSON has seven keys; the external sanitizer must keep only the four declared request fields. Retain only POST records for the host's fixed router name, validate UTC timestamp and numeric status, then replace the router name with a fixed search-route label. Never persist arbitrary metadata messages or unrelated proxy logs. Count all response statuses; failed collection or malformed records block acceptance.

[Traefik 2.10 documentation](https://doc.traefik.io/traefik/v2.10/observability/access-logs/) documents field/header filtering, JSON output and synchronous defaults. [Traefik 3.6 documentation](https://doc.traefik.io/traefik/v3.6/reference/install-configuration/observability/logs-and-accesslogs/) separately documents query-parameter filtering, whose default is keep. The actual 2.10.7 and 3.6.25 binaries were tested; no v3-only query option is passed to v2.

## Prepare without changing a live proxy

`prepare-access-log.py` requires the already installed Python/PyYAML on both hosts. It reads the original, verifies its expected SHA-256, refuses existing access-log options, and writes a **separate mode-0600 candidate** with exclusive creation. Only command-list additions are allowed; parsed settings must otherwise match exactly. Existing values and formatting remain intact. The source is never written. A changed digest requires renewed read-only inspection.

Historical preactivation source digests (not current configuration digests):

```text
abio:    2e34c0f30ca2eab9b172d76fb1b63345ece5ea8f62c06138daf8c7ba6f3ba08e
vector1: 5831100465ad14e8e8c555b58a8d598c7bfa5172a6824fbc913865248ea8bc0f
```

After the reviewed scripts have been placed on the chosen host, preparation commands are:

```sh
# abio: use version 2.10.7 and its inspected digest above.
# vector1: use version 3.6.25 and its inspected digest above.
python3 /opt/goodwatch-search-acceptance/prepare-access-log.py VERSION \
  /data/coolify/proxy/docker-compose.yml \
  /data/coolify/proxy/search-acceptance.candidate.yml \
  --expected-sha256 INSPECTED_DIGEST

docker compose -f /data/coolify/proxy/search-acceptance.candidate.yml config -q
```

The candidate contains existing private settings: review it only on the host, do not print complete Compose output or publish its diff. The documented argument list is the complete intended delta. Initial inspection ran the generator in memory. The later approved preparation wrote separate private candidates, followed by the actual activation recorded above; unrelated live and stored configuration settings were preserved independently.

## Apply and roll back after approval

This section preserves the historical guarded rollout shape and rollback guidance; activation has already been executed. Recheck current source/candidate/image digests before any future approved change rather than using the historical values. Coolify manages these proxies. Actual activation preserved the logging delta in its stored configuration with a guarded model update, because the normal save action overwrites live configuration and prunes managed backups. Unrelated stored/live label differences were preserved independently; future reconciliation can still apply that preexisting drift. Treat lost readiness or a restart as a coverage gap. Do not change dynamic router files or the unrelated dirty balancing file.

On each host, capture the current proxy image ID and ensure the configured image tag still resolves to that ID. Stop if it differs: `--pull never` must not silently replace the tested proxy version with another cached image. Back up the original and preserve its owner/mode when replacing contents:

```sh
set -e
# Set these two nonsecret digests from the reviewed preparation output.
printf '%s  %s\n' "$expected_source_sha" /data/coolify/proxy/docker-compose.yml | sha256sum --check --status
printf '%s  %s\n' "$expected_candidate_sha" /data/coolify/proxy/search-acceptance.candidate.yml | sha256sum --check --status
proxy_image_tag=$(docker inspect --format '{{.Config.Image}}' coolify-proxy)
proxy_image_id=$(docker inspect --format '{{.Image}}' coolify-proxy)
test "$(docker image inspect --format '{{.Id}}' "$proxy_image_tag")" = "$proxy_image_id"
test ! -e /var/lib/goodwatch-search-acceptance/proxy-backup/docker-compose.before.yml
install -d -m 0700 /var/lib/goodwatch-search-acceptance/proxy-backup
cp -p /data/coolify/proxy/docker-compose.yml \
  /var/lib/goodwatch-search-acceptance/proxy-backup/docker-compose.before.yml
chmod 0600 /var/lib/goodwatch-search-acceptance/proxy-backup/docker-compose.before.yml
cat /data/coolify/proxy/search-acceptance.candidate.yml \
  > /data/coolify/proxy/docker-compose.yml

docker compose -f /data/coolify/proxy/docker-compose.yml config -q
docker compose -f /data/coolify/proxy/docker-compose.yml \
  up -d --no-deps --no-build --pull never --force-recreate traefik
```

Validate the proxy's original health check and current public/page/search-role smoke suite; their short invalid-search check does not call Jev or write history. Verify the exact emitted whitelist with an invalid short POST before the acceptance start (it cannot qualify as seven-day traffic). Confirm router names, versions and uninterrupted durable collection on both hosts. Do not print entire Docker logs. Keep the private configuration backup until the acceptance evidence is reviewed.

Rollback restores the unchanged original contents and recreates only this proxy. Also restore the matching original stored configuration/hash fields under a row lock and current-hash guard, using the private Coolify backup identified in the activation evidence; avoid the normal editor save action's overwrite/pruning side effects:

```sh
set -e
cat /var/lib/goodwatch-search-acceptance/proxy-backup/docker-compose.before.yml \
  > /data/coolify/proxy/docker-compose.yml

docker compose -f /data/coolify/proxy/docker-compose.yml config -q
docker compose -f /data/coolify/proxy/docker-compose.yml \
  up -d --no-deps --no-build --pull never --force-recreate traefik
```

Check health and smoke again. A rollback inside the acceptance window invalidates continuous ingress evidence; record its UTC time and restart the window after remediation.

## Repeat the local validation

Use independently SHA-256-verified official Traefik binaries of the two deployed versions:

```sh
python3 goodwatch-proxy/acceptance/test-access-log.py \
  /path/to/traefik-2.10.7 /path/to/traefik-3.6.25
```

The fixture starts only loopback processes and makes no production requests. `privacy-test.json` records the successful result; secrets in tests are synthetic fixed strings. This fixture verifies privacy and a generated error record, not production restart availability or seven-day retention.

## Installed durable ingress collection and historical installation commands

The companion files are in `goodwatch-search/acceptance/`: `ingress-collect.mjs`, `ingress-events.mjs`, `ingress-config.mjs`, `ingress-verify.mjs`, `ingress.test.mjs` and `goodwatch-search-ingress.service`. They reuse the reviewed `Journal` from `collect.mjs`, timestamp helper from `events.mjs` and seven-day constant from `history.mjs`; keep those dependencies beside the ingress files. Node is already installed on both hosts; abio was verified at `/usr/bin/node`, version 20.5.1. No registry credentials, network calls or package installation are needed.

The collector follows both stdout/stderr for the fixed container `coolify-proxy`, polls for replacements every ten seconds and drains previous followers. It writes only fixed host/container IDs, tested image digests, approved logging fingerprints/readiness, sanitized search-route POST statuses, timestamps and collection fences/problems. Raw logs and logger metadata are never written. The shared journal fsyncs each record, deduplicates replay across restarts and rejects an incomplete final record. Heartbeat gaps over 45 seconds, collector restarts inside the window, unavailable proxy containers, malformed matched access events and log-stream failures block acceptance. Every heartbeat must also retain the exact approved access-log arguments and tested image digest. The Docker inspect template emits only fixed argument indexes or an unknown-override marker; full command/environment values never leave Docker. Missing/duplicate/unknown access-log options, access-log environment overrides or a config-file override mark logging unready and record a coverage problem. A Coolify replacement that drops access logging cannot pass using old responses. A running container is not proof its routes or TLS are correct; validate health/routing before the window and review application metrics separately.

These historical commands describe the approved installation already completed on **both** hosts. Do not reinstall/restart the collectors inside a live acceptance window. Any future authorized reinstall must preserve evidence and shared core-collector files:

```sh
set -e
install -d -m 0755 /opt/goodwatch-search-acceptance
install -d -m 0755 /opt/goodwatch-search-acceptance/docker-config
install -d -m 0700 /var/lib/goodwatch-search-ingress
for acceptance_file in collect.mjs events.mjs history.mjs ingress-collect.mjs ingress-events.mjs ingress-config.mjs ingress-verify.mjs; do
  install -m 0644 "goodwatch-search/acceptance/$acceptance_file" /opt/goodwatch-search-acceptance/
done
install -m 0644 goodwatch-search/acceptance/goodwatch-search-ingress.service /etc/systemd/system/
# Prepare this separate mode-0600 environment file with the correct fixed host
# and an explicit replay boundary before the intended window:
install -m 0600 /path/to/reviewed-ingress-environment /etc/default/goodwatch-search-ingress
systemctl daemon-reload
systemctl enable --now goodwatch-search-ingress
systemctl is-active --quiet goodwatch-search-ingress
```

The environment file contains only three nonsecret settings:

```text
SEARCH_INGRESS_HOST=abio
SEARCH_INGRESS_REPLAY_FROM=YYYY-MM-DDTHH:MM:SS.sssZ
SEARCH_INGRESS_IMAGE_ID=sha256:FULL_64_HEX_TESTED_IMAGE_ID
```

Use `vector1` on the second host. Before installation/start, record `docker exec coolify-proxy traefik version` and `docker inspect --format '{{.Image}}' coolify-proxy`; verify the executable is the tested version, the configured tag resolves to that same local image ID, and set `SEARCH_INGRESS_IMAGE_ID` to that exact digest. Repeat after the reviewed proxy recreation before starting the acceptance window. Stop and repeat the binary privacy fixture if the version or digest changed unexpectedly.

Read-only inspected image IDs (not mutable tags):

```text
abio 2.10.7: sha256:ee69e8120b64a420b5deca1cf46db0e4188ef76c7807a45c0f26d8a5ac2ab2bd
vector1 3.6.25: sha256:ee0b3aaa56c3f593da2c7d67ebbdbc600155bf6be2c3cece8f7870db29714a88
```

The service restricts writes to `/var/lib/goodwatch-search-ingress`, socket families to local Unix sockets, and uses an empty Docker config directory so registry credentials are unnecessary. Inspect sanitized heartbeats in that directory, not complete Docker logs. Start it before the reviewed static proxy rollout, then choose the acceptance start after both proxies emit the validated whitelist and both collectors have healthy heartbeats. Keep collection running through the end and through the application's cohort drain.

Verify each host's closed journal separately after at least seven days:

```sh
node /opt/goodwatch-search-acceptance/ingress-verify.mjs \
  /var/lib/goodwatch-search-ingress/events.ndjson START_UTC END_UTC abio FULL_TESTED_IMAGE_ID \
  > /var/lib/goodwatch-search-ingress/summary.json
```

Use `vector1` and its tested image ID on that host. Exit `1` means response/coverage checks failed, `2` means invalid journal/configuration, and `3` means scoped ingress checks passed but joint history/lifecycle review remains required. It intentionally never exits zero or independently marks seven-day acceptance complete. Require successful scoped summaries from both hosts, then combine them with the application history/lifecycle evidence and deployment/readiness evidence.

Proxy-generated or origin 5xx statuses and missing HTTP statuses fail; 4xx counts are retained for review and do not independently fail the 5xx check. Requests that have not yet produced an access record remain unprovable here: require the application lifecycle drain check, review boundary timing, and do not assume a before/after heartbeat demonstrates every request finished. Unknown routers/methods, DNS/TLS/connectivity failures before selection and silent logging sink loss remain outside this evidence. Losing the router would remove its records, so complete routing availability cannot be inferred merely from a positive response denominator.

Reverse collection without deleting evidence:

```sh
systemctl disable --now goodwatch-search-ingress
rm /etc/systemd/system/goodwatch-search-ingress.service
systemctl daemon-reload
```

Keep both journals and private configuration backups through acceptance review. The shared `/opt/goodwatch-search-acceptance/` directory may also serve the application collector on vector1; do not remove it or disable that separate service. Stop/disable during the window is a coverage gap and requires a new window after restoration.

Run meaningful fixture tests with:

```sh
node --test goodwatch-search/acceptance/ingress.test.mjs
```

Fixtures exercise real child processes with a fake Docker executable, container rotation, replay deduplication, privacy stripping, a proxy-generated 502, malformed status, collection gaps, open windows and late response drain. No test makes a production request.

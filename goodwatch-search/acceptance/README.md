# Seven-day production search acceptance

Read-only verification for [Verify seven days of production search after the latency fixes](https://github.com/alp82/goodwatch-monorepo/issues/407). These scripts do not generate searches, call Jev, alter Crate/Redis or change proxy configuration. Node and Docker CLI are sufficient; there are no package dependencies.

The owner’s criterion is seven days without errors and nearest-rank p95 **first usable results strictly below 1500 ms**. An empty provisional batch does not qualify; a final empty answer does. Report full search computation separately. Timing is server-side enqueue after route enrichment; it does not measure browser receive/paint. Final computation ends before final route enrichment/enqueue.

Production status on October 11, 2026: approved ingress logging is active on both proxies, with durable ingress collectors installed. [Activation evidence](../../docs/implementation/search-ranking/ingress-activation-20261011.json), retained by [PR #433](https://github.com/alp82/goodwatch-monorepo/pull/433), records abio's healthy logging-ready heartbeat at 19:16:39.792 UTC and vector1's at 19:17:11.077 UTC. Do not repeat installation or proxy restart merely to start verification. Recheck fresh heartbeats, source/image compliance and coverage before selecting a new window. The seven-day acceptance window remains outstanding.

## Collect before starting the window

Deploy the final fix on both roles and record their full SHAs/readiness UTC timestamps. Run the collector on their Docker host under a persistent service, using a durable evidence directory outside containers. Docker access is required; it reads only the two fixed search-role names. The directory defaults to mode 0700 and journal to 0600. Do not store credentials in service arguments.

```sh
node /path/to/goodwatch-search/acceptance/collect.mjs /var/lib/goodwatch-search-acceptance DEPLOYMENT_UTC
```

`DEPLOYMENT_UTC` is an explicit ISO timestamp ending `Z`. It is the replay lower bound, not proof collection began then. Choose the actual acceptance start **after deployment and after a successful collector heartbeat showing both roles at the intended SHA**. Record the exact start and seven-day end. Leave collection running through the end and until every request accepted in the window has a finished event. Keep the evidence through review; these scripts never delete it automatically.

The collector follows both stdout/stderr, strips all unknown fields and discards unrelated logs. Only fixed lifecycle, history acknowledgement and rejection schemas persist, with Docker timestamps, role and container IDs. It fsyncs every record and deduplicates replay across restarts. It discovers container replacements every ten seconds and retains the old log follower while it drains. Raw log lines, query text, accounts, headers, arbitrary errors and environment values are never written. Docker inspect requests only container ID, start time, running status and `SOURCE_COMMIT`.

Heartbeats and sanitized collection problems expose outages. Restarting the collector inside the window conservatively fails coverage, even if replay looks complete. Missing fences, gaps over 45 seconds, malformed telemetry, stream restarts and Docker failures also fail. A journal with a partial final record fails rather than silently truncating evidence. Local Docker retention is size-based (250 MB per role); it is not a seven-day guarantee. A container deletion or logging sink loss may be unrecoverable. Heartbeats cannot prove the Docker sink never dropped a line.

## Verify the closed window

Run the history verifier **inside a live search container**, where existing `CRATE_HOSTS`, `CRATE_PORT`, `CRATE_USER`, `CRATE_PASS` and `SEARCH_STORAGE_KEY` are available. Copy only `history.mjs`; it has no local module dependencies.

```sh
node history.mjs START_UTC END_UTC > history-summary.json
node lifecycle.mjs /var/lib/goodwatch-search-acceptance/events.ndjson START_UTC END_UTC FULL_DEPLOYED_SHA > lifecycle-summary.json
```

Both require a closed seven-day window and nonempty production traffic. History authenticates AES-GCM ciphertext, discards plaintext without parsing it, excludes foreign-key rows and never outputs queries/ciphertext/keys/accounts. It requires recorded `firstResults`; historical `elapsed_ms` is never substituted. Explicit count plus pagination catches incomplete extraction. Row windows use history insertion time, not request start time.

Lifecycle verification cohorts requests by accepted timestamp and pairs finished events by UUID, including finishes after `END_UTC`. A missing finish blocks acceptance. First-results percentiles include delivered aborted searches. Failed/aborted completions are excluded from full-computation percentiles. Every completed request must have a finite nonnegative computation time, including legitimate zero: missing, null or invalid timing increments `missing_completed_computation_count` and fails `completed_rows_have_computation`. Missing completed first-results timing, errors, title/description warnings, admission rejections, failed history writes and wrong SHAs also fail. History also fails recorded basic reasons and ranker fallbacks. History acknowledgements have no request UUID. The lifecycle audit checks all acknowledgements and collection coverage from `START_UTC` through `max(END_UTC, latest finished timestamp of the accepted cohort)`, conservatively including unrelated history-write failures during drain. Acknowledgements after that cutoff cannot inflate storage counts. Detached asynchronous writes can finish after the cutoff and require separate review. Counts cannot prove exact correspondence across timestamp boundaries. Same-key deliberate probes cannot be distinguished reliably.

Exit codes: `1` recorded checks fail; `2` execution/configuration/journal failure; `3` internal checks pass but independent ingress coverage remains necessary. Neither script independently returns a complete seven-day acceptance pass. Review both summaries and retained ingress evidence before closing the task/map. Existing search-role HTTP response metrics corroborate application 5xx counts, but miss proxy-generated errors and connections closed before HTTP completion.

## Active ingress evidence

Approved activation completed on October 11, 2026: abio at 19:15:50.543 UTC and vector1 at 19:16:58.477 UTC (its proxy started at 19:17:00.023 UTC). The linked activation evidence confirms healthy proxies, exact whitelist checks and sanitized invalid-short POST records without history writes or Jev calls. No proxy changes are part of these verification scripts. The active setting is JSON access logging with `fields.defaultMode=drop`, keeping only `StartUTC`, `RouterName`, `RequestMethod` and `DownstreamStatus`, and explicitly dropping all headers. Never keep `RequestPath`, query parameters, IPs, cookies, referrers, usernames or URLs. An external sanitizer can retain only POST events on the fixed search router (`gw-search-https@file` on abio, `gw-search-from-abio@file` on vector1), mapping that router to a fixed search-route label. POST on the palette path is conservatively included because these routers match both paths; distinguishing them exactly would need a separate router or additional safe classification.

This is a **static** Traefik setting. Its approved restart and durable collection were completed on both hosts; it cannot be installed through a dynamic routing file. Future changes require reviewed restart coordination and invalidate an in-progress window if coverage breaks. Preserve all existing proxy settings and dirty local files. No status filter is enabled: retaining successful responses supplies a traffic denominator alongside 5xx. The activation evidence validates the emitted field whitelist against both deployed versions. Repeat validation if the executable version, image or logging configuration changes. Public-ingress HTTP coverage still cannot prove that DNS/TLS/connectivity never failed before reaching the proxy.

References: [Traefik 2.10 access logs](https://doc.traefik.io/traefik/v2.10/observability/access-logs/) and [Traefik 3.6 logging](https://doc.traefik.io/traefik/v3.6/reference/install-configuration/observability/logs-and-accesslogs/) document JSON formatting, field/header defaults and filters.

## Tests

```sh
node --test goodwatch-search/acceptance/*.test.mjs
```

Fixtures cover cryptographic production classification, strict percentile/window checks, missing timing, delivered aborts, late failures, gaps, privacy stripping, durable replay and actual child-process log following through container replacement/restart. Fake Docker commands touch temporary test evidence only.

## Reversible host installation

After merge/review, copy `collect.mjs` and `events.mjs` to `/opt/goodwatch-search-acceptance/`; install the included `goodwatch-search-acceptance.service` in `/etc/systemd/system/`. Create an empty `/opt/goodwatch-search-acceptance/docker-config/` directory (the collector does not need registry credentials or `/root/.docker`), `/var/lib/goodwatch-search-acceptance` with mode 0700 and `/etc/default/goodwatch-search-acceptance` with mode 0600 containing one nonsecret setting:

```text
SEARCH_ACCEPTANCE_REPLAY_FROM=YYYY-MM-DDTHH:MM:SS.sssZ
```

Run `systemctl daemon-reload` and `systemctl enable --now goodwatch-search-acceptance`. The unit runs fixed read-only Docker commands as root, uses the host Node binary, restricts network sockets to AF_UNIX and can write only its evidence directory. The explicit local Docker socket and empty config avoid dependence on hidden `/root/.docker` credentials/contexts. It does not change app containers. Host Node v20.20.0 was verified read-only on vector1. Inspect `systemctl status`, the journal’s first source/heartbeat records, matching SHAs and fresh heartbeat progression before defining `START_UTC`. Confirm free space and preserve the journal through acceptance review. A collector restart is recorded and fails uninterrupted coverage inside an existing acceptance window.

Rollback: `systemctl disable --now goodwatch-search-acceptance`. Keep existing evidence. After review, remove only this unit, its two installed scripts and its dedicated environment file, then reload systemd. Do not delete the evidence directory as part of rollback.


### Passive Qdrant HTTP evidence

`search.qdrant-http.v1` records one anonymous event per completed or failed ranking batch, including batches that finish after the ranking deadline. Its UUID identifies the batch, not an account or search-history row. The collector retains these events through a numeric/fixed-value allowlist; they do not count as searches, errors in the acceptance cohort, or history acknowledgements.

`socketMs`, `dnsMs`, `connectMs`, `secureConnectMs`, `headersMs` and `responseEndMs` are offsets from the batch start. `socketMs` includes agent queueing. DNS/connection offsets are null when no corresponding event occurs, including a reused socket or an IP address without a lookup. `parseMs` is response parsing duration, `serverMs` is Qdrant's reported processing duration, and `totalMs` includes serialization, transport and parsing. `reusedSocket` is Node's request flag. Counts include query count and received response bytes. Fixed failure reasons distinguish timeout, transport, HTTP status and invalid response; no error text, endpoint, collection, payload, vector or account data is emitted.

The diagnostics do not cancel background work or modify timeout, socket pool, admission or ranking settings. A late event helps attribute a timeout but cannot alone establish cold-cache state or acceptance p95.

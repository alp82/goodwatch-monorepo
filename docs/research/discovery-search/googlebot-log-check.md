# What Googlebot received: server-log check

Checked **2026-10-27**, read-only. All times below are UTC. The requested interval is October 10 through the inspection time on October 27; earlier retained evidence was checked too.

## Verdict

**Undetermined: the available logs cannot establish whether reliability explains Google's indexing exclusions.** They lack the client identity needed to attribute responses to verified Googlebot.
**Neither “Googlebot received many errors” nor “Googlebot received healthy responses” is supported.** The known title-page 503 mechanism remains a plausible contributor, not a measured explanation of bot visits.

Read first: cause 3 and Measurement and follow-up in [the indexing diagnosis](tweet-indexing-diagnosis.md), from `origin/main` at `d5fa01bd75eb29971a1ce32fcc0e1a8e429dffb1`. That report's 1.2% historical server errors, host problems, approximately 1.4 document requests/day and 15.8-second daily average are Search Console evidence, not new server-log measurements from this check.

## What is retained, and what is missing

| Source | Retention observed | What it can establish |
| --- | --- | --- |
| Running `coolify-proxy`, Traefik v2.10, Docker JSON log | Fixed scan snapshot: **2026-10-11 19:16:02–2026-10-27 15:32:13.864**; approximately **29.5 GB** in one file | Request start, router, method and downstream status. **No request host/path, client address, user agent or duration.** |
| Proxy configuration backup dated October 7 | Configuration only | No access-log arguments in that backup. It is not evidence of historical request outcomes. |
| Current webapp container, Docker's local cache of Fluentd output | **2026-10-27 13:54:55.260–15:35:58.497** in the full retained-log read | Morgan `tiny` request lines include method, URL, status, response size and milliseconds. **No request client address or user agent.** |
| External application log drain | Configured for Axiom; retention not established | A read-only aggregate query could not authenticate: HTTP 401 at the legacy query endpoint; the edge query path returned 404. No archived events were retrieved. |
| Coolify deployment queue, selected application and host | **2026-09-03 18:56:21–2026-10-27 13:52:06**; 1,007 queue rows | Deployment timing/status, not bot traffic or a complete container restart history. |

The full proxy scan examined **29,533,808,010 bytes and 106,732,969 complete Docker log lines**. There were **106,653,014 occurrences of `DownstreamStatus`**, and **zero occurrences** of `RequestPath`, `RequestHost`, `ClientHost`, `ClientAddr`, `Duration`, `OriginDuration`, the checked `User-Agent` spellings, `Googlebot` or `bingbot`. Sampled JSON records at the beginning, middle and end had exactly these keys:

```text
DownstreamStatus, RequestMethod, RouterName, StartUTC, level, msg, time
```

Its running access-log configuration explicitly drops fields by default and retains only `StartUTC`, `RouterName`, `RequestMethod` and `DownstreamStatus`; headers are dropped by default. There is no separate access-log file configured. The inspected proxy directory, its backup directory, the bounded log-directory search and the retained Docker container list yielded no older proxy access-log archive or second retained proxy container. This does not establish that no off-host backup exists.

For the application, the running image's Remix server directly calls `morgan("tiny")`. The full retained application read contained **715,227 lines**, including **314,980 parsed access records**. No line contained a Googlebot/Bingbot token, user-agent label, `ClientHost`, `ClientAddr` or `remoteAddress` (case-insensitive checks). Some aggregate crawler messages can name a busiest user agent, but those counters are not per-request identities and do not supply verifiable addresses. [The page-cache decision](../../adr/0007-in-process-page-cache.md) also records that cache hits bypass Express request logging. Application logs therefore cannot substitute for complete ingress access logs, even if older copies are recovered from Axiom.

The historical gap before October 11 at 19:16 cannot be backfilled from the inspected proxy file. The audit covers the specified ingress host and its current application instance, not every possible ingress or backend instance. The routing configuration includes multiple backend targets. No secret values, raw visitor logs or private infrastructure identifiers are included here.

### Useful application evidence, explicitly not Googlebot evidence

Across the **314,980** access lines, **55,218 returned 503 (17.53%)** and **3 returned 429**. Of the 503s, **55,198 were `/person/…` requests** and **20 were `/api/…` requests**. The movie/show prefix groups had **no logged 503** in this short interval. This is a real all-traffic observation; it does not identify people, bots, controlled probes or the cause of each refusal. Query variants are included under their path prefix.

Selected shape statistics for those same application access lines, **October 27 13:55:02.113–15:35:58.497**, approximately 101 minutes:

| Shape | Access lines | Status counts | p50 ms | p95 ms | Max ms |
| --- | ---: | --- | ---: | ---: | ---: |
| Start | 10 | 200: 10 | 141.464 | 9,120.511 | 9,120.511 |
| `/movie/…` | 8,134 | 200: 8,062; 301: 54; 404: 18 | 240.621 | 806.149 | 2,929.514 |
| `/show/…` | 1,570 | 200: 1,561; 301: 8; 404: 1 | 263.408 | 919.402 | 1,936.320 |
| `/person/…` | 296,696 | 200: 241,371; 204: 1; 301: 124; 302: 2; 503: 55,198 | 32.591 | 144.701 | 3,067.739 |
| `/api/…` | 5,629 | 200: 1,682; 204: 3,841; 302: 2; 400: 2; 404: 79; 429: 3; 503: 20 | 191.532 | 1,444.788 | 10,337.417 |

Percentiles use nearest rank across all parsed statuses in each group. These are Morgan response times, not Traefik end-to-end durations or full-body download times; cache hits and pre-Express answers are absent. A second read with the same explicit end timestamp reproduced all **314,980** access lines. Neither these short-window title successes nor the person/API errors establish what Googlebot received over October 10–27.

## Verified Googlebot measurements

**No request could be verified. This is missing evidence, not a measured count of zero Googlebot visits.** A user-agent string alone would not suffice either. Google requires matching the source address to its published crawler ranges or reverse DNS followed by a forward lookup back to the original address. The supplied [Googlebot range URL](https://developers.google.com/static/search/apis/ipranges/googlebot.json) currently redirects to common-crawler ranges, with `creationTime` **2026-10-26T15:46:02**. There are no logged candidate addresses to test. [Google verification guidance](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests).

The following applies to **every UTC day October 10–27**, including the partial first retained day and partial inspection day:

| URL shape | Daily verified requests | Status mix | Response time p50 / p95 / max |
| --- | --- | --- | --- |
| Start `/` | Unavailable | Unavailable | Unavailable |
| `/movie/…` | Unavailable | Unavailable | Unavailable |
| `/show/…` | Unavailable | Unavailable | Unavailable |
| Hubs and categories | Unavailable | Unavailable | Unavailable |
| `/person/…` | Unavailable | Unavailable | Unavailable |
| Sitemaps | Unavailable | Unavailable | Unavailable |
| `/robots.txt` | Unavailable | Unavailable | Unavailable |
| `/api/…` | Unavailable | Unavailable | Unavailable |
| Static assets | Unavailable | Unavailable | Unavailable |
| Other | Unavailable | Unavailable | Unavailable |

Specifically, none of the requested **200, 301/308, 404, 429, 503 or total 5xx** counts can be attributed to Googlebot. All-traffic status counts must not be presented as bot rates. Proxy status lines cannot be safely joined to application URL lines by time alone; they lack a shared request identifier, and the application log omits some responses entirely.

### Non-2xx/3xx requests and deploy correlation

| Verified Googlebot failure time | Path | Status | Within 10 minutes of deploy/restart |
| --- | --- | --- | --- |
| Unavailable | Unavailable | Unavailable | Not assessable |

This is **not an empty failure list**. There is no attributable request population from which to enumerate failures or compute proximity.

Read-only SQL against `application_deployment_queues`, filtered to the webapp and inspected host, returned **665 queue rows** created October 10–27: **663 finished, 2 failed**, and none marked `restart_only`. These are queue records, not a count of distinct code releases or proof of successful public requests. The failures were on October 23 and 26. Grouping uses the queue creation date, so completion can fall on the next day.

| UTC day | Queue records | Finished | Failed |
| --- | ---: | ---: | ---: |
| October 10 | 14 | 14 | 0 |
| October 11 | 51 | 51 | 0 |
| October 12 | 69 | 69 | 0 |
| October 13 | 11 | 11 | 0 |
| October 14 | 20 | 20 | 0 |
| October 15 | 52 | 52 | 0 |
| October 16 | 40 | 40 | 0 |
| October 17 | 73 | 73 | 0 |
| October 18 | 42 | 42 | 0 |
| October 19 | 14 | 14 | 0 |
| October 20 | 19 | 19 | 0 |
| October 21 | 10 | 10 | 0 |
| October 22 | 8 | 8 | 0 |
| October 23 | 73 | 72 | 1 |
| October 24 | 36 | 36 | 0 |
| October 25 | 51 | 51 | 0 |
| October 26 | 74 | 73 | 1 |
| October 27, partial | 8 | 8 | 0 |

The current application container started **October 27 at 13:54:49.969**, with Docker `RestartCount=0`; its deployment queue window was **13:52:06–13:55:12**. The proxy started **October 11 at 19:16:02.062**, also with `RestartCount=0`. These counters describe those particular containers, not removed predecessors. No complete historical container restart timeline was recovered. The database timezone was verified as UTC; queries ran inside `BEGIN READ ONLY` transactions.

For a future attributable request, report the distance to an actual container start and to the deployment window separately, with a ±10-minute flag. Queue creation is not the instant traffic switched. With this many deployments, temporal proximity alone would not establish causality.

### Sitemaps, inner URLs and the fixed sample

**Server-side evidence cannot identify any sitemap or inner URL fetched by verified Googlebot.** This does not mean Google fetched none. The earlier diagnosis's Search Console Sitemaps API records independently report downloads of the master on October 10; static, categories, movie-detail and show-detail children on October 18; people on October 23; and new-arrivals on October 25. Those records are not an access-log census and contain no per-request HTTP status or timing here.

Compared with [the unchanged 50-URL sample](index-sample.csv):

| Sample group | URLs | Server-log crawl outcome |
| --- | ---: | --- |
| Start | 1 | Unknown for all |
| Hubs | 6 | Unknown for all |
| Categories | 8 | Unknown for all |
| Movie titles | 17 | Unknown for all |
| Show titles | 8 | Unknown for all |
| People | 5 | Unknown for all |
| Old shapes, including HTTP and www controls | 5 | Unknown for all |
| **Total** | **50** | **50 unassessable; no defensible fetched/not-fetched split** |

The earlier inspection does independently show Reacher, which is in this fixed sample, successfully crawled on October 20 and excluded. It does not establish that all its other visits were successful. Preserve the fixed sample and its weekly record; do not overwrite unknown server-log outcomes with inspection results from a different measurement.

## Bingbot side table

| Measure, October 10–27 | Result |
| --- | --- |
| Verified requests/day, all requested shapes | Unavailable |
| Status mix and p50/p95/max | Unavailable |
| Sitemap and inner-URL fetches; fixed-sample overlap | Unavailable |
| Failed-request/deploy correlation | Unavailable |

No Bingbot source address was available for verification. Future candidates need reverse DNS ending in `.search.msn.com` and a forward lookup returning the original address, or Microsoft's current published ranges. [Bing verification guidance](https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26).

## Smallest owner change in Coolify

**Proposed only; nothing was applied.** In **Servers → the public webapp ingress server → Proxy → Configuration**, preserve the existing Traefik version, routing and access-log options. Add these six entries to the existing `command` list:

```yaml
- '--accesslog.fields.names.RequestHost=keep'
- '--accesslog.fields.names.RequestScheme=keep'
- '--accesslog.fields.names.RequestPath=keep'
- '--accesslog.fields.names.ClientHost=keep'
- '--accesslog.fields.names.Duration=keep'
- '--accesslog.fields.headers.names.User-Agent=keep'
```

Keep the existing `StartUTC`, `RouterName`, `RequestMethod`, `DownstreamStatus`, JSON format and default-drop settings. This adds the missing URL, source, agent and elapsed-time evidence without logging every header. Do not filter out successful requests: an errors-only log would lose the denominator. `Duration` is nanoseconds; divide by 1,000,000 for milliseconds. [Traefik v2.10 access-log fields and options](https://doc.traefik.io/traefik/v2.10/observability/access-logs/).

The owner must save this in the Coolify UI and schedule the necessary proxy restart; static configuration changes do require a restart. This can briefly interrupt public routes. Do not reset the whole proxy configuration or merely edit a host file that Coolify can overwrite. [Coolify proxy configuration guidance](https://coolify.io/docs/core/networking/proxy/traefik/overview).

After the owner applies it:

1. Inspect one ordinary request's JSON record to confirm all fields arrive and `ClientHost` is the actual external peer. If another ingress sits ahead of Traefik, establish its trusted forwarding chain before verifying bots; do not accept arbitrary client-supplied forwarding headers as identity.
2. Retain at least 21 days across proxy/container replacement. The current single log is already approximately 29.5 GB with fewer fields; arrange bounded storage and durable export instead of assuming Docker retention survives recreation. Keep raw addresses and query-bearing URLs private, and redact query secrets before any public export.
3. Separate claimed bots, verified bots, failed verification and unresolved verification. A fake Googlebot curl is useful only for testing log fields. Distinguish automatic Googlebot from user-triggered inspection fetchers. Archive the dated verification ranges/results alongside private evidence.
4. Produce daily shape/status tables, latency percentiles, the full failure list and deployment/restart flags; join exact URLs to the fixed sample, retaining HTTP/www/query variants. Capture at least a week and a deployment cycle before revisiting the reliability verdict. Even complete HTTP logs cannot observe DNS/TLS failures that never reach HTTP handling; retain Search Console host-status evidence too.

An owner-provided read-capable Axiom export could extend application-log retention, but cannot restore fields that were never emitted. No new application code is required for the proposed ingress logging change.

## Checks and limits

Inspected running container metadata, proxy access-log arguments, configuration backups, the entire fixed-size proxy log snapshot, retained application logs, the running request logger, deployment queue metadata and the fixed sample. Remote reads were spaced out; the large proxy scan used low CPU/I/O priority and streamed counts without copying raw logs into the repository. No live crawl, deployment, restart, configuration edit, database/API write, push or publication was performed. The Axiom calls used only query endpoints and emitted no credentials.

The proposed settings were checked against the installed Traefik version's documentation, **not applied or tested in production**. This report establishes an observability gap; it does not resolve the indexing cause or establish a clean bill of health.

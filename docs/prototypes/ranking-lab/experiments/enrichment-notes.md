# Catalog enrichment for ranking experiments

Captured all **22,089 unique identities** in the original 14-query vector/text pools using read-only SELECT requests to the existing GoodWatch Crate catalog. Zero requested identities were missing. The original `capture.json` was not altered. No paid model call, search-runtime lookup, Redis operation or external mutation was performed.

The preserved artifact is [catalog.json.gz](catalog.json.gz); raw `catalog.json` is a local convenience copy. Decompression produces an object with `records[key]` (for example `records["movie:1398"]`), snapshot metadata and read-query metadata. Each title has its source table, TMDB ID, selected field names and read time. Creator credits separately cite the `person_worked_on`/`person` join and read time. Query ordering and ranking scores are not included in these records, allowing reviewers to receive title context without rank positions.

## Snapshot and coverage

| Item | Value |
| --- | --- |
| Start | 2026-09-22T23:06:48.550Z |
| Catalog text completed | 2026-09-22T23:07:38.153Z |
| Creator credits completed | 2026-09-22T23:09:14.034Z |
| Movie/show records | 16,116 / 5,973 |
| Nonempty synopsis | 22,083 |
| Nonempty essence text | 21,200 |
| Titles with Director/Creator credits | 20,852 |
| Director/Creator credit records | 42,024 |
| Raw / gzip bytes | 67,351,847 / 13,309,561 |

Times come from the environment clock and are retained verbatim, even though the conversation date is September 23. Reads occurred sequentially over a short interval, not inside an atomic database snapshot.

- Original capture SHA-256: `cce0b283b9246c4f67d9c49ed6e08b4968694003e60a2ad2db36c274adf422d2`.
- Catalog records SHA-256: `3a3ce1cd290b9d294e15292cb8eef045cf3e12dc752a471bc7df1e4089a45abc`. Scope: UTF-8 bytes of `JSON.stringify(artifact.records)` in stored insertion order.
- Gzip file SHA-256: `87b91519e33d5dc44aec258c56e678ee99276d89ec3f6e00cdca81b7c0c7aab2`.

Fields include title/year, synopsis, essence text/tags, keywords, genres, adult classification, IMDb identity, vote count and current stored fingerprints. They are **catalog evidence**, not guaranteed facts: essence text and fingerprints are generated descriptions, synopsis can be incomplete, and absent creator credits do not prove absence of a creator. Director and Creator are retained as distinct jobs. Duplicate credit records may exist and should be deduplicated by person/job when displaying or scoring.

The fingerprint values in this enrichment are a later catalog snapshot. Keep the original query capture's used-dimension values when replaying its ranking. Do not silently replace them with refreshed values. The 889 absent essence-text values are also visible as missing evidence, not fabricated content.

## Reproduce

Use the original webapp directory's installed packages and `.env`; the script reads configuration in memory and never prints credentials. The script guards SQL to SELECT and suppresses error response bodies.

```sh
node docs/prototypes/ranking-lab/experiments/catalog-capture.mjs /absolute/path/to/original/goodwatch-webapp
node docs/prototypes/ranking-lab/experiments/catalog-capture.mjs /absolute/path/to/original/goodwatch-webapp --credits
```

The first command refreshes text metadata and fingerprints. The second enriches Director/Creator credits. Both write local raw/gzip files; gzip uses deterministic header timing. Reproduction against the live catalog can return newer source data and therefore different digests.

Source conventions: [searchStatement](../../../../goodwatch-webapp/app/server/combined-search/catalog.server.ts), [existing director join](../../../../goodwatch-webapp/app/server/taste-profile.server.ts), [capture script](catalog-capture.mjs).

## Accepted 30-query baseline: free recapture feasibility

At `2026-09-22T23:08:48.454Z`, a direct `SELECT status FROM doc.search_interpretations WHERE cache_key = ?` check found **0/30 ready entries** for the accepted fixtures under the local storage key and current request builders. Checked model `jev-1.13.0`, question version `accepted-d4-corrected-v1`, current native/English language version `five-language-conservative-markers-v1`, and alternate `exact-native-title-v1` for English title handling. This establishes absence of ready entries for those exact configurations, not absence of every historical interpretation or translated cache entry.

Keys were calculated by importing the request builders without invoking retrieval or inference, using the runtime's canonical serialization and HMAC algorithm. No cache ciphertext was read/decrypted. No original search text beyond the already-public fixtures was queried or emitted. Script mode:

```sh
node docs/prototypes/ranking-lab/experiments/catalog-capture.mjs /absolute/path/to/original/goodwatch-webapp --cache-status
```

A fresh accepted-baseline candidate capture therefore cannot currently be assumed free. The original capture helper invokes `runJevStage`, which can issue paid calls on misses; even ordinary `SearchStore.lookup` writes a Redis cache on a durable hit. A guaranteed read-only replay must directly read exact cached entries and stop on a miss instead of going through those APIs. No recapture was attempted.

Sources: [runtime cache-key construction](../../../../goodwatch-webapp/app/server/search-runtime/runtime.server.ts), [store lookup/cache behavior](../../../../goodwatch-webapp/app/server/search-runtime/store.server.ts), [language routing](../../../../goodwatch-webapp/app/server/combined-search/language.server.ts), [accepted fixtures](../../search-evaluation/fixtures.json).

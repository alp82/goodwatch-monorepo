# One hour at the destination's rate

The proof for the destination of [Serve a viral traffic spike](https://github.com/alp82/goodwatch-monorepo/issues/237),
as decided in [Decide how the one-hour load test proves the destination](https://github.com/alp82/goodwatch-monorepo/issues/404).
Run on October 10, 2026, 10:43 to 11:57 UTC, on commit `1e2ef141`.

## Result

- **The origin's share of 500 page views per second holds for one hour with no failed request.** 1,799,807 documents
  and OG images in 3,600 seconds, every one answered with its expected status.
- **Nothing drifts over the hour.** Main thread use, loop delay, and memory are level from the first ten minutes to
  the last.
- **Whole page views hold at 80 visitors per second for ten minutes with no failed request,** 1,563,207 requests,
  of which 1,465,694 went to the static hostname. The CDN limited none of them.
- **Not proven:** whole page views at 500 per second. The two generators can't send them, and the owner decided
  against renting hosts for it. See [What this doesn't prove](#what-this-doesnt-prove).

## Setup

As in [the static hostname runs](viral-spike-static-hostname.md#setup): two page instances (abio and vector1), the
static hostname in front of the files, two generators (worker3 and worker1, 4 cores each) with half of the rate each,
the public route, a new connection with a full TLS handshake per visitor. Production's own traffic ran alongside,
about 20 requests per second. The Crate backup of 11:03 UTC fell into the hour. No deploy happened during the runs:
the smoke check passed on the same commit before, between, and after them.

## The hour of documents

`urls/hot-documents.json`: the hot mix with each page as its document alone, 60% of it one movie page, plus OG images.

| | Generator on worker3 | Generator on worker1 |
| --- | --- | --- |
| Requests | 899,994 | 899,813 |
| Rate | 250.0 per second | 249.9 per second |
| Failed requests | 0 | 0 |
| Dropped iterations | 0 | 154 |
| p50 / p95 / p99 | 6 / 28 / 55 ms | 10 / 71 / 141 ms |
| Generator CPU, average / highest | 79% / 91% | 88% / 100% |

- **The generators were at their limit.** Both were above the 80% of their cores where a generator delays its own
  requests, so the latencies describe the generators as much as the site. worker1's higher values and its 154
  iterations that didn't start are its own. The count of failed requests isn't affected.

| | abio | vector1 |
| --- | --- | --- |
| Requests per second, benchmark and background | 259.5 | 259.7 |
| 5xx per second | 0 | 0 |
| Main thread, average / highest sample | 38% / 91% | 42% / 92% |
| Main thread per ten minutes | 37, 38, 38, 38, 39, 38% | 40, 44, 41, 43, 42, 42% |
| Highest loop delay per ten minutes | 153, 74, 162, 107, 149, 180 ms | 102, 145, 215, 254, 161, 178 ms |
| Requests in flight, highest | 12 | 9 |
| Process memory, before / after | 819 / 914 MB | 800 / 821 MB |
| Heap in use, before / after | 218 / 193 MB | 191 / 194 MB |
| In-process page cache, before / after | 61 / 67 MB | 61 / 67 MB |

- **abio as a host:** 42% of its 8 cores on average and 60% at most, with the proxy included. It sent 214 Mbit/s.
- **No effect of the Crate backup is visible.** The highest loop delays are at 11:15 UTC on vector1 and at the
  run's end on abio, not in the backup's minutes (11:03 to 11:08).
- **abio's process memory grew by 95 MB** with the heap unchanged. One hour doesn't say whether that goes on.

## Ten minutes of whole page views

`--files page`: each visitor loads the document, its files from the static hostname, and the API requests of a real
page load. 40 visitors per second per generator.

| | Generator on worker3 | Generator on worker1 |
| --- | --- | --- |
| Visitors | 23,996 | 23,995 |
| Requests | 780,582 | 782,625 |
| Failed requests, failed page views | 0, 0 | 0, 0 |
| Page view p50 / p95 | 112 / 156 ms | 117 / 166 ms |
| Document p50 / p95 | 5 / 19 ms | 6 / 22 ms |
| Generator CPU, average / highest | 65% / 74% | 70% / 83% |

- **Per visit the origin got 2.0 requests and the static hostname 30.6.** The static hostname answered 731,839
  requests from worker3 with no error and a p95 of 58 ms.
- **abio:** 22% of its 8 cores on average. The main threads were at 30% and 29%.
- **Complete page views are fewer than visitors** (21,552 of 23,996 on worker3) because the mix contains clients that
  request an OG image and no page.

## What this doesn't prove

- **Whole page views at 500 per second.** That is about 15,000 requests per second to the static hostname. Whether
  Cloudflare Free serves that for an hour from a real crowd isn't tested, and a test from a few addresses wouldn't
  answer it either.
- **A fallback during a spike.** With the files from the origin, 120 page views per second hold and 140 fail
  ([the static hostname runs](viral-spike-static-hostname.md)). The destination holds only while the CDN is up.
- **Search, members, and the long tail under load.** The mix is the hot landing pages for anonymous visitors.
- **Cloudflare's own view.** Nobody looked at its dashboard during the run. What the generators saw is in the tables.
- **Latency at this rate.** Both generators were near or above their limit during the hour.

## Reproduce

```bash
cd goodwatch-benchmark
A="--scenario page-view --mode ramp --rates 250 --step-duration 3600 --urls urls/hot-documents.json --path public --yes-ramp-production"
BENCH_GENERATOR=10.0.0.30 BENCH_METRIC_HOSTS= BENCH_WEBAPP_PROBE=0 ./bench.sh load $A --label hour-documents-b &
BENCH_WEBAPP_PROBE=1 BENCH_WEBAPP_PROBE_EXTRA=10.0.0.20 ./bench.sh load $A --label hour-documents-a
```

The two commands need different labels: with the same label they write into the same run directory. The page view
run is the same pair with `--rates 40 --step-duration 600 --urls hot --files page --page-assets <capture>
--allow-above-500`. Runs: `20261010T104319Z-load-hour-documents-a` and `-b`, `20261010T114638Z-load-hour-page-views-a`
and `-b`, rehearsal `20261010T101124Z-load-hour-rehearsal`.

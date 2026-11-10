The homepage interaction check runs the real client in the pinned Chromium/Lighthouse image. The [frozen fixture workflow](fixture-README.md) covers safe capture, builds, preview servers, resource checks, and the landing budget. Start the isolated fixture server first; this command never starts the webapp or reads its production `.env`.

```bash
# First check the harness against one scenario.
./bench.sh cwv --base-url https://127.0.0.1:3344 --runs 1 \
  --scenarios mobile-fresh-early --variant candidate --out results/cwv-candidate-quick

# The complete matrix, sequentially: three repetitions of six scenarios.
./bench.sh cwv --base-url https://127.0.0.1:3344 --variant candidate

# Run the identical matrix against a separately served baseline build.
./bench.sh cwv --base-url https://127.0.0.1:3343 --variant baseline --trace

node --test cwv/run.test.mjs
```

An explicit HTTP(S) origin is required. The existing Docker image must be `gw-bench-lighthouse:13.5.0-6dd25f05`; it contains Chromium and Puppeteer. The container uses host networking so it reaches the fixture's loopback listener. Its request interceptor aborts every method except GET and HEAD, including on localhost, and blocks known telemetry ingestion and mutating read endpoints. There are no response patches or POST exceptions. Search interpretation and anonymous mood-count POSTs are deliberately unavailable; this check exercises the local controls and committed search URL without running retrieval or writing search history.

The four mobile scenarios use 390×844, DPR 1, native trusted touch input, and 6× CPU emulation by default (`--mobile-cpu` accepts a number from 1 through 20, including fractional rates). Each has a new isolated context and disabled HTTP cache. Fresh and returning refer to the boot session mark: returning still has a cold cache. Early begins when the actual search input has React's attached instance/props marker; settled waits another three seconds. Each asserts search focus, typing and the 800ms committed URL, clear, mood open, Escape plus returned focus, reopen, and Done plus an opened card. Trusted input evidence is recorded independently of the DOM assertions.

CPU throttling is relative to the generator's hardware and current load. It does not name a particular phone. To reproduce a similar effective CPU model on a different idle host, first compare Lighthouse CPU benchmark indices and record the chosen rate. For example, a reference index around 3890 at 6× and a generator index around 1170 at 1.8× have similar index/rate ratios (about 648 and 650). This is an approximate calibration, not proof of equivalent device behavior. Run both baseline and candidate on that same generator with the same explicit `--mobile-cpu 1.8`; retain the 200 ms interaction cap. Do not compare one host's baseline with another host's candidate or calibrate while either host is busy. The option records the actual mobile rate in configuration, raw measurements and the summary; desktop remains 1×. It does not change the separate landing budget's calibrated CPU setting.

The two desktop scenarios use 1365×900, DPR 1, CPU 1× and this explicit custom network: 150ms configured latency, 209715.2 bytes/second down, and 96000 bytes/second up. This is the historical `1.6 * 1024 * 1024 / 8` download profile, not a named DevTools network preset. They make no interactions, so LCP is not prematurely finalized by a click. The final LCP must identify the actual room image and be at most 2500 ms.

For mobile, each action's maximum observed Event Timing duration must be at most 200 ms. This is a lab interaction proxy, **not field INP, Google's percentile, or a guarantee about all interactions**. Event Timing suppresses entries below its 16 ms floor; an empty event list is not itself evidence that an action executed. Trusted input and the corresponding DOM assertion must both succeed. Individual presentation-delay estimates inherit Event Timing's 8 ms duration rounding.

The output directory contains `config.json`, `summary.json`, one raw JSON and screenshot per scenario/run, and optional Chrome traces. Summary schema 1 has `pass`, browser/image/configuration, thresholds, and `measurements`; each measurement has its scenario/run, actual `cpuSlowdown`, `pass`, `maxEventDurationMs`, `lcpMs`, errors/failures, and per-action success/trusted-input/timing results. Raw JSON retains every observed timing, resource sizes, and permitted/blocked requests with URL query strings removed. Exit 0 means all thresholds and assertions passed; exit 1 includes expected baseline regressions; exit 2 indicates launcher/configuration failure. Compare baseline and candidate on the same machine without overlapping builds, browser runs, or other heavy checks. Inspect later field data separately.

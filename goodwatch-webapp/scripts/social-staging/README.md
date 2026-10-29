# Verify staged social reads

Run the SQL equivalence checks and benchmark against a disposable local Crate instance. The script refuses
remote endpoints. It drops and recreates only tables in the `social_followup` schema. Never point it at a
production database.

From `goodwatch-webapp`, start the local database and run the script:

```sh
docker run -d --rm --name gw-social-staging-crate \
  -p 127.0.0.1:19640:4200 -e CRATE_HEAP_SIZE=1g crate:5.10.12 \
  -Cdiscovery.type=single-node -Cnetwork.host=0.0.0.0
mkdir -p "$HOME/.cache/gw-perf/scratch-social"
env -i PATH="$PATH" HOME="$HOME" \
  TMPDIR="$HOME/.cache/gw-perf/scratch-social" \
  SOCIAL_BENCH_URL=http://127.0.0.1:19640 \
  SOCIAL_BENCH_OUTPUT="$HOME/.cache/gw-perf/scratch-social/sql-bench.json" \
  node scripts/social-staging/run.ts
docker stop gw-social-staging-crate
```

Wait for Crate to accept connections before running the script. It compares the staged title and ranking reads
with the frozen reference SQL against fixtures that exercise visibility, hash equality including nulls, verdict
versions and statuses, reports, disabled lanes, images, duplicate-group precedence, score and date ties, limits,
multiple titles, and the 500-ID batch boundary. It repeats those checks after inserting 190,000 unrelated posts,
images, and quality verdicts, with 1,847 links and 1,859 relevance verdicts in total.

The benchmark records three sequential before/after samples for an empty title, a populated title, an eight-title
start row, and a twenty-title Hot ranking. It captures `EXPLAIN ANALYZE` for the original reads and every staged
lookup. Timing uses an injected local HTTP selector so that both versions can finish independently of the
application response budgets. This measures SQL and merge cost, not browser response time or production latency.

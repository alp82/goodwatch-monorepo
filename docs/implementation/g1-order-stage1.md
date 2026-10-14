# G1 offline job, stage 1

`goodwatch-flows/windmill/f/sync/copy/g1_order.py` builds ordering components for an explicit,
nonempty list of preview member ids. Initially the caller passes only the owner's id. Its Windmill
entrypoint defaults to `dry_run=True`. No job was run against production during this implementation.

The frozen research source is `taste-loop/docs/research/taste-loop/lab/candidates/009/g1_mix.py`,
SHA-256 `e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1`.
The complete B3/B5 sections are copied verbatim. The ordinary unit test checks their frozen
section digest; the pack test checks the full research file's digest and exact copied text.
F3 and the mix are a pure `request_order` adapter, checked against the original functions.

## Inputs and arrays

The job issues SELECTs only: all rows of `user_score`, `user_wishlist`, `user_skipped`, and
`user_not_interested`, then reference-pool and touched titles from `movie` and `show`.
The reference pool is exactly the pull's rule: poster IS NOT NULL, GoodWatch score IS NOT NULL,
and at least 1,000 votes. A candidate must also have a fingerprint and be unrated by this
member. Want to See, Skip and Not interested stay candidates, as in the harness. Every own
rating, including ratings outside the pool, contributes to the own show and animation shares.
Animation means production method `Animation`.

`build_titles` uses sorted point ids, uint8 fingerprints (255 missing, integer truncation as in
the pull), float64 public score columns (NaN missing), int64 year/votes/series (-1 missing), bool
genre columns and sorted vocabularies with int16 codes (-1 missing). `build_view` maps title keys
to int32 row numbers, ratings to int8, and other-member group numbers to int32. Deleted touched
titles get placeholders. Rows naming no movie or show are discarded from side tables; invalid
ratings fail the build. Only columns actually read by G1 are built.

Declared differences from the harness:

- Production uses all members' four tables; parity uses tier A only. The pack has 5,521 other
  tier A ratings and 1,004 owner ratings. Tier B ratings were never opened.
- Production groups raw member ids by sorted id into transient integers. Research groups keyed
  hashed ids into pack member numbers. The ids are not model features or payload fields, but
  reordered group summation can change floating point roundoff in production.
- Production is a live read; the pack is frozen at its pull time. Crate reads are not a transaction
  across tables. A changed title snapshot before publication aborts the current member's publish.
- Product candidates start in sorted point-id order. Research T2a shuffles the candidate view.
  B3 and B5 values are invariant to that order; F3 ties follow the input list's stable order.
  Parity checks both the harness's shuffled list and the product's sorted list.
- Only the predictor's required arrays are built; provenance, times, and unrelated title columns
  are omitted after using times to preserve the harness's entry order. Production's touched union
  is the four required member tables; the pack also holds other kinds of touched titles. Those
  additional rows do not enter G1's fitted universe unless one of its four tables names them.

## Payload and request contract

The only write is one JSON SET, with expiry, to `g1:v1:<member>`. Default TTL is 172,800 seconds.
No lock, shared title key, manifest, or other write is made. The current title snapshot must
exist and name the same fingerprint key order; its version is checked again before each write.

The payload has `format: 1`, sorted `pointIds`, and aligned arrays `b3Rank` (float32 values
represented losslessly as JSON numbers), `b5TopHalf` (booleans), `movieSeriesId` (-1 unknown),
`show`, and `animation`. `ownShares` is `[showShare, animationShare]`, or null when there are
no own ratings. Metadata is `modelHash`, `snapshotVersion`, `builtAt` (UTC milliseconds),
`othersCount` (distinct others across the four usable tables), and `othersRatingsCount`.
The B5 bit is rank >= the median over all candidates, equivalent to the source's tie-aware
percentile >= 0.5; the parity test checks that equivalence. B3's source returns float64
percentiles; float32 storage is also checked against its float32 conversion.

Stage 2 looks up components by point id and supplies them in the filtered list's tie order.
`request_order` recomputes franchise picks over that list, retaining the global B5 bits.
It returns indices into the list, groups aligned to the input, and `mixCount` (the prefix length
placed by the mix, at most 100; zero when there is no own mix). Groups are 2 for top-half first
franchise titles, 1 for other top-half titles, and 0 for the bottom half. Nonpositive series ids
are distinct singletons. The suffix keeps F3 order, including displaced front titles.

`goodwatch-flows/tests/fixtures/g1_order.json` contains six small cases with title keys and
component values, own aggregate shares, and expected groups/order/mix prefix length. There
are no member ids, hashed ids, own rating rows, or other members' rows. Expected results come
from the harness's F3/mix with the global bits frozen, including removed franchise leaders,
reversed tie order, no own ratings, an empty filter, and position 11.

## Verification and measurements

Offline unit tests:

```bash
PYTHONDONTWRITEBYTECODE=1 OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 \
  python3 -m unittest discover -s goodwatch-flows/tests -p test_g1_order.py -v
```

Pack parity (the research worktree is read-only; no pull, gate, or connector is imported):

```bash
PYTHONDONTWRITEBYTECODE=1 OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 \
  MKL_NUM_THREADS=2 NUMEXPR_NUM_THREADS=2 \
  python3 goodwatch-flows/tests/g1_pack_parity.py \
  --research /home/alper/projects/goodwatch-monorepo/.claude/worktrees/taste-loop/docs/research/taste-loop/lab \
  --pack /home/alper/goodwatch-research/taste/packs/2026-10-13 \
  --scratch /home/alper/goodwatch-research/taste/work/g1-job
```

Add `--write-fixtures` to regenerate the public component fixture, or `--benchmark-only`
to measure only one member's job path. All intermediate reports go under the scratch directory.
The harness builds the owner view via `_tables`, `_t2a_member`, `_t2a_arrays` with no hidden
ratings, `_others_arrays`, and `view_of`; it never writes a view file.

On the 2026-10-13 pack: 72,101 titles, 59,767 owner candidates. Arrays including dtypes, source
B3 and B5 ranks, float32 B3 ranks, B5 top-half membership, F3 groups/order, the first 100 after
the mix, and all remaining 59,667 positions match exactly. JSON encoding/decoding and the sorted
product input order also pass. The made-up-input tests cover missing values, the pool boundary,
four-table reads/paging, deleted titles, own shares outside the pool, empty history, stable ties,
filtered franchise promotion, TTL-only publication, dry runs, and changed-snapshot rejection.

NumPy 2.5.2 is already installed locally; SciPy is not used. No packages were installed. With
two BLAS threads, measured job array construction plus per-member prediction/JSON encoding was
4.59 seconds in the parity run and 6.94 seconds in the separate benchmark on the shared host.
The benchmark breakdown was arrays 6.19 s, B3 0.21 s, B5 0.53 s, combined prediction/encoding
0.75 s. Cold pack loading took 0.12 s, outside job compute. Peak RSS was 375 MiB in the
standalone benchmark and 443 MiB for the whole parity process; payload size is 3,225,677 bytes.
Memory availability was checked before these runs, comfortably above the measured peak.

For a production pool of this size, budget roughly 5–10 seconds of compute for the owner,
plus Crate read time and one roughly 3.1 MiB Valkey write. Around 37 pool-title pages plus
touched-title batches and four-table member pages are needed. Their network latency and the
all-member B5 fit were not measured: a production wall-clock promise requires a separately
authorized run. A conservative initial memory budget is 1 GiB for a pack-sized pool. Arrays are
shared across an explicitly supplied preview list; B3/B5 are recomputed sequentially per member.
The module caps BLAS threads before importing NumPy. Larger catalogues/member tables scale
memory and build time; the measurement is for this pack, not a universal capacity guarantee.

The Windmill lock reuses the snapshot publisher's already pinned dependencies plus the flows'
existing `numpy==2.5.3` pin. The Windmill CLI is absent locally; no remote resolver, installation,
deployment or scheduling was performed. Local parity evidence is on NumPy 2.5.2.

## Stage 2 decisions and wiring

- Wire the job after title snapshot publication, nightly, and after debounced preview-member
  rating changes. Keep preview ids explicit and jobs for the same member serialized.
- Decide the usable payload age independently of the 48-hour eviction TTL; log every fallback
  and enforce snapshot/model matching. Preserve today's relative order for unkeyed titles.
- Port the pure function against these fixtures. In Watch next, compose F3 and refill inside
  the fitting group after Watch next's grouping; Discover composes over its filtered Best match list.
- Preserve input order for ties and float32 B3 values. The entire pack has exact F3 parity after
  float32 conversion; a future pool large enough to collapse distinct percentiles needs revalidation.
- Add the binding exposure-log fields, 10-minute per-member cache keyed by build time, and
  the preview/shadow flag. Cards keep today's taste match, as the owner must be told in advance.
- Validate the locked worker's NumPy 2.5.3 against the pack before enabling preview; all-member
  production input differences remain declared rather than claiming tier A parity for them.

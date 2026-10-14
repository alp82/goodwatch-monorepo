# Review of the G1 port plan by Fable (read-only), October 14, 2026

Saved by the orchestrator (summary of the reviewer's final message; full file:line evidence was given in the
session).

**Verdict:** the split is workable for an owner-only trial, but as written the product would not show the tested G1
on either surface, and the payload design makes the fallback to today's order the common case.

1. **High.** F3 composed offline over the catalogue: the franchise rule picks the first title of each series in the
   view, so with filters a global key misplaces titles. Publish per-title components (B3 rank, B5 above-median bit,
   movie series id, show and animation bits) and compose F3 at request time over the filtered list. The B5 median
   over the catalogue is fine (T2a's candidates were every unrated title).
2. **High.** Watch next regroups by fit after sorting, which scatters a refill done before it. Refill within
   `fitting` after grouping, or apply only F3 there and say so.
3. **High.** A row-aligned payload goes stale on every snapshot publish (several a day); key it by point id, chain the
   G1 job from the snapshot publisher, log every fallback with its reason.
4. **Medium.** Card match (today's formula) will contradict G1's order; the taste-match filter still cuts by it. Tell
   the owner in advance; the log carries the displayed match per position.
5. **Medium.** Research "others" are tier A only and B5 also reads others' Want to See, Skip and Not interested; the
   job reads the four tables and the parity run uses the harness's others set; any difference is declared.
6. **Medium.** Scope: For you under other sorts and ranked search / Explorer pools stay on today's order; G1 applies
   to the catalogue's Best match and Watch next only.
7. **Low.** Members never hit the filter cache: cache the per-member row-aligned key for 10 minutes, keyed by the
   payload's build time.
8. Otherwise the simplest design: Windmill Python, flagged members only; the job builds only the arrays `g1_mix`
   reads; shadow mode needs no job.

**Parity test:** owner view built by the harness with all ratings visible and every unrated pool title a candidate:
B3 ranks equal, the B5 top-half set equal, F3 groups equal, the first 100 after the mix and the rest identical; then
the webapp's composition over a fixture list equals `predict()` on that list.

**Exposure log must record:** surface, ordering, flag mode, fallback reason, payload build time, model hash,
snapshot version, filters, sort, For you, page, keys in order with displayed match, G1 group and whether the mix
placed it; Watch next tier and hero; under G1 also today's first 100 for the same list (and under shadow G1's).
Outcomes join by member, title and time.

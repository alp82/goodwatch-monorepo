# Item 013: G1 in the product, behind a flag, owner first

Orchestrator's plan, October 14, 2026, after the owner chose this route (STATE.md, DECISIONS.md D1). Built through
normal development on its own branch; nothing reaches another member before the owner's checkpoint.

## What G1 does, in four steps (reference: `lab/candidates/009/g1_mix.py`, hash `e864bd47…`)

1. **B3 rank** of every candidate: today's taste formula on fingerprints standardized against the reference pool.
2. **B5 score:** the pooled predictor (consensus fit across all members' ratings, then the member's own
   posterior and personal weights). Only whether a title is in the member's top half matters.
3. **F3 key:** top-half titles first, and among them the first title of each movie series (by B3) ahead of the rest;
   then the bottom half; each group in B3 order. Key = 2·group + B3 rank.
4. **Mix at the front:** the first 100 positions refilled greedily toward the member's own share of shows and of
   animation (production method "Animation"); everything after keeps step 3's order.

## Split between an offline job and the request

Steps 1–3 need all members' ratings and title columns the snapshot lacks; step 4 is cheap and depends on what the
list holds. So:

- **Offline job** (Python, in `goodwatch-flows/windmill`, next to the title snapshot publisher): reuses the
  research code for B3, B5 and F3 unchanged (copied with its hash recorded, and a parity test that the job's output
  for the owner equals the research harness's ranks on the same inputs). For each member the flag enables (at
  first only the owner), it computes the F3 key over the whole catalogue, exactly as T2a's views do (all unrated
  titles as candidates, median over them), plus the member's own show and animation shares, and publishes them to
  Valkey (`g1:v1:<member>`: a key array aligned to the title snapshot's order, the shares, the snapshot version,
  the model version, the time). Runs nightly and after the member's ratings change (debounced), reads production
  read-only and writes only its own Valkey keys.
- **Request** (webapp): when the flag is on for the member and a fresh `g1:v1` entry matches the current snapshot,
  the Best match branch of Discover (`filterTitles`) and Watch next (`planWatchNext`) order the filtered list by
  the F3 key, then refill the first 100 toward the stored shares, then page as today. Otherwise today's order.
  Card "taste match" is unchanged. Title columns for step 4 (production method) travel in the same payload or a
  shared `g1:titles:v1` key, so the snapshot format does not change.
- **Flag:** `REC_G1_ORDER`, modes off / shadow / preview / on; preview = `REC_PREVIEW_USERS` (the owner). Shadow
  logs the overlap of G1's and today's first 30, like `taste/shadow.server.ts`.
- **Exposure log (#525, built first):** every record carries `ordering` ("taste-v2" or "g1") and the flag state.

## Known differences from the research version, to decide in review

- Research ranks against all unrated titles; the product shows filtered lists (services, moods, type). The F3 key
  is global, so the B5 median and the franchise picks are computed over the catalogue, not the filtered list; the
  mix refill runs over the filtered list.
- Freshness: a rating changes B3 and B5; until the job reruns, the member sees the previous order.
- Titles new to the snapshot since the job ran have no key: placed after keyed titles in today's order.

## Checks before the owner sees it

Parity test (job against harness, owner, tier A view); the webapp's ordering against a fixture; a timing check of the
job for one member; the shadow log for the owner for a day; then preview for the owner. The owner's verdict is the
checkpoint; turning it on for everyone needs a second owner decision.

## Changes after Fable's review (`REVIEW-fable.md`), adopted

- **Payload:** per-title components keyed by point id (B3 rank, B5 top-half bit, movie series id, show and animation
  bits), plus the member's own shares; F3 is composed at request time over the filtered list, then the mix refill.
- **Watch next:** F3 order, and the refill runs within the fitting group after Watch next's own grouping.
- **Job triggers:** chained after each title snapshot publish, nightly, and after the member's ratings change
  (debounced). Every fallback to today's order is logged with its reason.
- **Others:** the job reads ratings, Want to See, Skip and Not interested of all members; the parity run uses the
  harness's tier A others. Production using all members is a declared difference.
- **Scope:** Discover's catalogue Best match and Watch next only. For you under other sorts, ranked search and
  Explorer stay on today's order. The trial judges Best match.
- **Owner told in advance:** the taste match on cards stays today's and will sometimes disagree with the order.
- **Exposure log:** the G1 build adds to #525's record: ordering, flag mode, fallback reason, payload build time,
  model hash, G1 group and mix placement per title, Watch next tier, and under G1 today's first 100 for the same
  list (under shadow, G1's).
- **Cache:** per member, keyed by the payload's build time, 10 minutes.

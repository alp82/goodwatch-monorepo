# Item 001 report (builder: Opus 5.5, high effort), saved by the orchestrator

Pack and census built. T0 = 2026-10-13T08:50:00Z. One acceptance point cannot hold as worded: a second run
reproduces the member files exactly, but the title files differed in 2 of 72,101 titles because production rewrites
title rows continuously.

## Pulled

| Table | Rows | Members |
|---|---:|---:|
| user_score | 9,017 | 231 |
| user_wishlist | 2,072 | 150 |
| user_skipped | 13,812 | 170 |
| user_not_interested | 2 | 1 |
| user_favorite | 72 | 25 |
| user_watch_state | 8,159 | 255 |
| user_watch_log | 254,966 | 255 |
| user_import | 4 | 2 |
| user_import_item | 3,534 | 2 |
| user_setting (country, services) | 702 | 358 |

- Members: 405 with a row in any table; tier A 264, tier B 141. Ratings: 6,525 in the pack (1,004 the owner's),
  2,492 in the gate.
- Provenance: typed 8,117, bulk 431, import 469 (one member, tier A, not the owner). Edited: 300 ratings.
- Sittings: 200 members rated in one sitting, 31 in two or more, 7 in five or more.
- Titles: 72,101 in the pack; 4,666 touched; reference pool 71,839. Embeddings for 4,516 touched titles.

## Where production differs from the specification

- Title rows drift between runs minutes apart; `python3 pack.py diff A B` lists what differs.
- The pack is several files: `pack.pkl` (members), `titles.pkl`, `titles_detail.pkl`, two `emb_*.npy`.
- The brief's reference pool rule gives 71,839 titles, 60,759 with a fingerprint; the product's pool was 58,628.
  Intersect `in_pool` with `has_fingerprint` for the product's pool.
- No prior/applied import pairs exist (`prior_score` is empty); only 2 import items have a source rating beside a
  GoodWatch rating. One applied import in total (IMDb, 469 ratings).
- Show crew has no department in production; rows without a department are kept.
- 92 touched titles are gone from `movie`/`show`; they stay flagged `in_catalog = False` (76 ratings).
- Not interested: 2 rows from 1 member. Show statuses: nearly all Seen; 1 member has Watching, On hold or Dropped.
- Watch log: 248,551 rows are undated `seen` episode rows.
- Fingerprints are stored for the pack's titles only.

## Choices the next items should know

- Bulk rule: 5 ratings spanning 2 seconds or less (marks 900 ratings by the member-wide count; the chained reading
  marks 1,208).
- Tier B traces: watch state and watch log still show which titles a tier B member rated, not the score;
  `n_ratings` is kept for all members. Noted in the manifest.
- Tiers persist in `~/goodwatch-research/taste/tiers.json`; the owner id in `~/goodwatch-research/taste/owner`.
- `sitting` and `position` count from 0; times are epoch milliseconds; a missing time is int64 min; a missing
  fingerprint score is 255.

## Builder's own checks

Counts against `count(*)`; rerun at T0 identical for `pack.pkl`, `gate.pkl`, embeddings and `CENSUS.md`; searches
for UUIDs, raw ids, the key and member hashes in repository files all zero; `crate.sql` refuses anything but reads.

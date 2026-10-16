# T5 on the live Sides of you (#674): registration

Registered October 16, 2026, before any reader call on these cases. The adapter is pinned to production commit
`3cba031f`: the final short taste group names (Q65, Q66, and Q70, names up to 29 characters) and the Q71 heading
"Fits your taste". Live reads refuse to start unless this committed file names the frozen source and cases digests
under "Frozen run."

This replaces the registration on `0da351cd` (commit `b206163e`). That run was held when Q70 changed the names, and
is abandoned unscored and unread (`HOLD.md`). Nothing from it informs this registration.

Everything not stated here is as registered for item 015 (`../015-t5-whose-taste/PREREG.md`): pack, split, removal,
prompt, readers and their confinement, controls, void rule, bootstrap (10,000 member draws, seed 20261013), replay.

## What is tested

- **Description:** the live Sides of you text a member sees on the Taste page, serialized by `lab/t5/live/adapter.ts`
  from the pinned production code (`lab/t5/live/prod-manifest.json`). The template and its source lines in the page
  are in `REPORT-port.md`. Run with `--sides live`.
- **The readers are offline stand-ins.** They test whether the words carry something personal. The product never
  calls an LLM.

## Changes from item 015, decided before any reader call

- **Namesake removal** (live only): a later-list movie whose normalized title equals a named title is removed, closing
  the residual link #656's review found. Same-character films across franchise ids cannot be removed: the pack has no
  character identities.
- **Balanced ranks from the first match:** exactly three triples per member, one with the member's list at each
  displayed-mean rank (lowest, middle, highest). Under item 015's matching the live build had middle-mean 42.3% and
  closest-printed-mean 40.4%, over the 40% stop line, and the frozen rematch kept 0 members.
- **Franchise prefix removal** (live only, Fable check): a later-list movie whose production `franchiseOf` prefix
  equals that of a named title is removed. Python copy, parity-tested against the pinned TypeScript.
- **Outlier-list baseline** (live only, Fable check): the list furthest from the median mean; a stopping baseline on
  the same 40% line.
- **Anime flag and real genres:** live group names pick their noun from TMDB genres, media type and the anime flag; the
  loader passes the pack's genres and `is_anime` (live only, so item 015's input digest is unchanged).
- **Noun-only control** (owner's suggestion, descriptive): each group's noun alone ("comedies", "war stories"), one line
  per group, nouns read from the pinned `group-names.server.ts`. Reported as S minus nouns only; it does not decide.
  Adds 36 calls per reader.
- **Heading "Fits your taste"** (Q71): the adapter writes the pinned page's panel heading before each group name. A
  test fails if any fixed line the adapter writes is missing from the pinned page.
- **Early-mean caliper 1.0** (was 0.5). With balanced ranks the mean shortcuts sit at chance by construction; at 0.5
  only 6 members qualified, at 1.0 11 (1.5 adds none). The matching cost still prefers the closest early means.

## Pass rule (owner, October 16, 2026)

The words gate opens only if GPT-6 Astra meets both conditions, and the validity guard holds:

1. **Clearly beats chance (Q62):** the lower bound of the 95% member-bootstrap interval for its share correct
   (description shown) is above 33.3%.
2. **Clearly beats numbers only (Q67):** the lower bound of the 95% member-bootstrap interval for S minus numbers only
   (average ratings, movie and show mix, no names) is above zero. Same bootstrap draws and members as condition 1.

Further:

- **Validity guard:** if any Astra control (numbers only, no description, permuted answer key) has its share interval
  above 33.3%, a shortcut exists and the run is invalid, not a pass. Voids above 10% make the run incomplete.
- Haiku 5.5 runs as a secondary, descriptive reader and does not decide.
- S minus nouns only is reported for both readers and does not decide. Haiku's S minus numbers only is descriptive.
- This rule applies to #674 only, never to #656 after the fact.

## Build on the final pin (`3cba031f`)

Server code is identical to `f1a1a5b0`; the page differs only in the heading. Q70 changes 6 of 31 descriptions against
the `0da351cd` build. The members, lists, and answer key are unchanged; case ids hash the descriptions, so they and
the baseline tie-breaks change.

| Item | Value |
|---|---|
| Coverage | 18 structural members, 0 empty, 12 primary members, 36 triples; excluded: 4 no pair, 2 unbalanced ranks, 2 short list |
| Baselines (member-weighted) | middle mean 36.1%, outlier 36.1%, closest printed mean 36.1%, positions 33.3% each. Media type 41.7% is tie-breaking only: every list is movies only, so all three lists tie and a hash of the case id picks one. It is reported, never a stop (#656 amendment A1) |
| Names | 62 groups; 19 use the generic noun "stories" |
| Power (one trial per member) | n = 12; null SDE 38.1 points; 9.1% at the +10-point floor. A null says nothing about absence |
| Calls | 36 triples × 4 inputs (S, nouns only, numbers only, none) × 2 readers = 288, plus at most one retry each |
| Numbers-only note | Live numbers only keeps digits inside titles (3 tokens across the descriptions); stated, not changed |

## Frozen run

| Item | Value |
|---|---|
| Production commit | `3cba031ffaa33af80abc18701cf363f011185ff0` |
| Run folder | `~/goodwatch-research/taste/work/t5/run-016-3cba031f` (private) |
| Descriptions digest | `1527068ec28bf8541301ff5b2157525225f7fa83f583cc43e815227403523487` |
| Prompt digest | `8fb4b8a4977357e3618b53b7d320f92eecb3c12aa1c90c455fea39680eaf87ca` |

- `source_digest`: `340fc0b5c98e8ef3a072d73a043a0d7714f0786e5cf634e0217034258688e728`
- `cases_digest`: `33ef6f7cc7e780bd880be24905c6be9199532542a7240e338bc9c3c35f4c7501`

## Run order

1. `read --reader haiku`, then `read --reader astra`, each as its own process with stdin closed.
2. `score`, then `verify` (fresh-process rebuild must match the cases digest and baselines).
3. No rerun, rematch, or prompt change after any reader call. A void rate above 10% makes the run incomplete, not
   repeatable.

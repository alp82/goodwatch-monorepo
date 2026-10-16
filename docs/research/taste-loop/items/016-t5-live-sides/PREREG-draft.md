# T5 on the live Sides of you (#674): registration draft

Draft, October 16, 2026. Not a registration. It becomes `PREREG.md` once the shorter taste group names are on main,
the adapter is re-pinned to that commit, the cases are rebuilt, and the frozen digests below are filled in. Live reads
refuse to start until a committed `PREREG.md` in this folder names the frozen source and cases digests.

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
- **Early-mean caliper 1.0** (was 0.5). With balanced ranks the mean shortcuts sit at chance by construction; at 0.5
  only 6 members qualified, at 1.0 11 (1.5 adds none). The matching cost still prefers the closest early means.

## Pass rule (owner, October 16, 2026)

- **The words gate opens if GPT-6 Astra clearly beats chance:** the lower bound of the 95% member-bootstrap interval
  for its share correct (description shown) is above 33.3%.
- **Validity guard:** if any Astra control (numbers only, no description, permuted answer key) has its share interval
  above 33.3%, a shortcut exists and the run is invalid, not a pass. Voids above 10% make the run incomplete.
- Haiku 5.5 runs as a secondary, descriptive reader and does not decide.
- S minus numbers only and S minus nouns only are reported for both readers and do not decide (open question to
  the owner: should S also have to beat numbers only?).
- This rule applies to #674 only, never to #656 after the fact.

## Build on the short-names pin (`344e7ba3`), not yet final

The owner may still change one word in the names. Rebuild after the final pin; the digests below then change.

| Item | Value |
|---|---|
| Coverage | 18 structural members, 0 empty, 12 primary members, 36 triples; excluded: 4 no pair, 2 unbalanced ranks, 2 short list |
| Baselines (member-weighted) | middle mean 36.1%, outlier 38.9%, closest printed mean 38.9%, media type 33.3%, positions 33.3% each |
| Names | 62 groups; 15 use the generic noun "stories" |
| Power (one trial per member) | n = 12; null SDE 38.1 points; 9.1% at the +10-point floor. A null says nothing about absence |
| Calls | 36 triples × 4 inputs (S, nouns only, numbers only, none) × 2 readers = 288, plus at most one retry each |
| Numbers-only note | Live numbers only keeps digits inside titles (3 tokens across the descriptions); stated, not changed |

## Frozen run (to fill in after the final pin)

| Item | Value |
|---|---|
| Production commit | |
| Run folder | |
| `source_digest` | |
| `cases_digest` | |

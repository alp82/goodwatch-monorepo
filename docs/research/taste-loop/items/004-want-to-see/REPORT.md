# Item 004 report: ranking later Want to See adds (T2b), and the popularity check for T2a

Builder: Opus 5.5, high effort (the item 003 builder, resumed). Saved by the orchestrator from the builder's final
message, shortened; the full tables are `ladder-T2b.md`, `ladder-T2a.md` and `ladder-T1.md` in this folder.

Every rung ran on T2b with both split rules and on T2a with the new columns; the four fixes from Sol 6.1's review
of item 003 (`items/003-hidden-title/REVIEW-sol.md`) are in. T1 came out identical on all 21 runs; T2a moved only as
fix 1 predicts. 81 tests pass; the main T2b B5 run reproduced under `run.sh --verify` (697 values).

## Members each T2b rule keeps (recorded in PROTOCOL 4b before any rung ran)

- Sitting split (primary): 4 members, owner plus 3 others; 124 targets, 80 of them the owner's.
- Entry-order split: 10 members, owner plus 9 others; 155 targets, 87 of them the owner's.
- Why so few: a sitting of 10 or more adds counts as a transfer, which covers 992 of the 1,573 tier A adds (only
  161 of those are bulk writes); only 11 tier A members added in two or more sittings. If only bulk writes counted
  as transfers, the order split would keep 28 members (not built).

## T2b, sitting split, others before the cutoff

Mean percentile of the later adds (0.5 random); difference to B2.

| Rung | Others (3) | vs B2 (others) | Owner (80 targets) | vs B2 (owner, franchise range) |
|---|---|---|---|---|
| B1 | .751 (.648–.840) | +.242 (+.148,+.396) | .767 | +.165 (+.109,+.223) |
| B2 | .509 (.444–.583) | ref | .602 | ref |
| B3 | .672 (.500–.761) | +.163 (+.000,+.317) | .798 | +.196 (+.148,+.243) |
| B4 | .664 (.627–.693) | +.155 (+.110,+.183) | .655 | +.053 (−.011,+.116) |
| B5 | .693 (.656–.740) | +.184 (+.073,+.240) | .653 | +.051 (−.005,+.107) |
| BP | .737 (.562–.908) | +.228 (+.062,+.464) | .876 | +.274 (+.211,+.337) |

Order split, others (9 members), vs B2: B1 +.135, B3 +.105, B4 −.005, B5 +.014, BP +.284; the owner's figures are
like the sitting split's. No title the member had touched before the cutoff appears in any list.

## T2a "among equally popular" (votes within a factor of 1.5), others

Separation vs B2, then the rated-8+ percentile vs B2:
- B1: −.035 (−.116,+.044); +.014
- B3: +.040 (+.003,+.076); +.035 (+.022,+.047)
- B4: +.024 (−.067,+.107); −.022
- B5: +.126 (+.089,+.166); +.004
- BP: −.087 (−.148,−.023); +.103

Both conditions at once (score within 3 points and votes within a factor of 2), separation vs B2: B3 +.023
(−.022,+.061), B5 +.097 (+.049,+.149), B1 −.095. About 31% of others' hidden titles and 24% of the owner's have fewer
than 50 such candidates and are left out of that figure.

## The four fixes

1. **Side-list leak (blocking).** In T2a, unrated titles on a member's Want to See, Skip or Not interested list stay
   in the view but are left out of the comparison set and the first-50 guards (replaces item 003's decision 4). The
   canary now tries pushing listed titles down: after the fix every hidden title sits at exactly 0.5; under the old
   rule the shortcut would have lifted hidden titles to 0.501 (others) and 0.503 (owner). Separations moved by
   0.001 or less. First-50 guards moved more: B3's median votes 142,136 → 120,513; BP's first-50 shares 0.388 → 0.444
   (8+) and 0.264 → 0.314 (≤5).
2. **Shuffled rule.** Three shuffles per rung; pass only if every 95% interval lies within ±0.015, otherwise
   "inconclusive". T2a: inconclusive (only BP passes; widest B2 owner separation −.021, −.057 to +.015). T2b sitting:
   inconclusive (widest B4 others +.067, −.027 to +.219). T2b order: inconclusive (widest B4 others −.074, −.167 to
   +.004). No figure lies wholly outside the band.
3. **Owner band minimum** applied everywhere; no owner figure changed (at least 94 titles in every band).
4. **Fold check.** Others with under 60 ratings (40 members, 10 with both bands), at most 5 hidden per view;
   separation vs B2 with small folds against main folds on the same 10: B1 −.038 vs −.042; B3 +.019 vs −.001; B5
   +.093 vs +.112. Protocol wording corrected (21 titles give a five-title fold, 23.8%).

## Other changes and decisions

- Runs are resumable (a stopped run keeps finished views; the ledger line records how many were taken over), because
  swap was full during long T2a runs and two attempts each at B4 and B5 were cut off.
- Ladder runs used `ladder` mode (the table reads only ladder lines). Bulk writes are never targets. Transfers count
  as sittings; 40% rounded to the nearest whole sitting, at least one; the sitting rule needs two or more add
  sittings. A target touched before the cutoff is dropped and counted; a member needs 3 targets after drops. Each
  target is compared only with non-targets. Own mix = rated and added before the cutoff; later-skip figure and the
  stand-in need 3 or more later skips. Owner figures with too few titles for a standard error are shown, not judged.
- Run times: T2b 1–16 s per run; T2a B1 68 s, BP 52 s, B2 151 s, B3 228 s, B4 467 s, B5 382 s.

## Not done

T1 controls not rerun under the new harness; no T2a run verified by the builder (the orchestrator verified one, see
`DECISIONS.md`); the ledger holds lines from two superseded harness versions (197 new lines in all; tables read only
the final version).

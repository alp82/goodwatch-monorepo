# Phase 1 gate review by Fable (read-only), October 14, 2026

Saved by the orchestrator from the reviewer's final message. The reviewer did not open the gate.

**Verdict: phase 1 exit met with fixes.** The two registered results are sound; the write-up needs four repairs
before the owner checkpoint.

1. **High.** PLAN.md's five orchestrator checks were not done for G1, the only claimed win: no owner first-20 list
   for item 009, no shuffled-label run of `g1_mix.py`, no "this would be wrong if" sentence, no stratum split. The
   exit rule makes these exit conditions. They need no gate look.
2. **High.** DECISIONS "Where D1 stands" overstates what the gate showed. Tier B checked separation and guard 1
   only; the own-mix, franchise and first-50 figures are tier A and should say so; "members the loop never looked
   at" belongs to separation alone.
3. **Medium.** A1/A2 timing is clean, but the amendment was not blind to G1's profile. Order: item 009's explore
   run started 11:31Z, A1 committed 13:33 local, A2 13:36, the run finished about 13:44, RESULTS.md committed 13:46,
   read after item 010 (16:20). A2 was frozen before G1's numbers existed. But G1 is F3 plus a refill of the first
   100, F3's figures were known, and G1's match them to 0.005. Under the old guard G1 fails (+0.029, +0.009 to
   +0.055); under A1 it passes. Tier A passage of A2 was near-certain when A2 was written (Astra's finding 4 stands).
   What the gate adds is real but narrow: the separation gain of a 12th candidate (B1, B3, B4, B5, BP, C1–C3,
   F1–F3, G1) holds on held-out members, in one look. The gate does not test the guard choice; the removed guard
   moves to confirmation, as A1 says. Add one sentence to DECISIONS stating that A1 was decisive for registration.
4. **Medium.** The shows-guard reading is sound; its specification was post hoc. Write the absolute-distance form
   into PROTOCOL.md 4a as amendment A3 so no future candidate gets to pick the reading.
5. **Low.** Cells without intervals in DECISIONS (T1 column; T2b others cells). Copy them in or cite table and row.
6. **Low.** D2's guards are unreported: the registered run's guards pass (pair accuracy +0.028, −0.010 to +0.062;
   low-rating AUC +0.044, +0.005 to +0.087). Add a row; say Brier is not measurable (no `p_low`).
7. **Nit.** STATE.md still says phase 0. Item 009's PREREG was committed four seconds before the registered run:
   in order, but leaves no room for a reviewer; commit PREREGs a clear interval before the run.

**Item 008 (D2):** sound. **What "G1 replicated" licenses:** naming G1 the challenger and starting the confirmation
step, which PLAN.md open question 6 ties to exactly this condition, so T3 recruitment may begin. It does not
license a flag rollout (T2a and T2b must agree; T2b others is 3 and 9 members and later Skip is worse), any claim
about unrated titles above a favourite, any claim about the owner (no gate), or any change to what members see.

**Recommended phase 2 order**

1. Amendment A3, reviewed by two families: (a) the top-list harm criterion for T3, frozen before the page exists:
   per member, "Not for me" plus "Seen it and rated 5 or less" in each scorer's first 10, G1 paired against B2 and
   against BR; G1 blocked if the upper bound against B2 reaches +1 per ten, or if G1's rate is above BR's point
   estimate; primary stays "unseen Want to See in the first 10", with "new to me" reported beside it, since a
   popular top will lose hits to "Seen it"; (b) T3 pool composition: B2, G1, B1, BR, 12 each plus 8 random; (c) the
   shows/animation distance form of finding 4.
2. Hash G1's and B2's full rankings per member into the ledger, then ship the T3 page and recruit toward 20
   members; keep issues #525 and #526 moving. Register the first tier C window now.
3. In parallel, needing no members: the five checks of finding 1; the DECISIONS fixes; the statement-list fixes and
   T5 for D3, the one decision with no result at all.
4. D2 waits for the tier C window. Do not spend more gate looks on D1 variants; the next D1 evidence should be
   judged pools, not another T2a candidate.

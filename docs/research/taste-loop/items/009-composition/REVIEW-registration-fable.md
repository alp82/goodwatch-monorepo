# Review of G1's registration by Fable (read-only), October 14, 2026

Saved by the orchestrator from the reviewer's final message. The reviewer did not open the gate.

**Verdict: register, with conditions written into the PREREG.** Every A2 condition is met on the record; the one
interpretive point (shows) resolves in G1's favour under the reading the record held before the results were seen.

1. The freeze holds: A2 is byte-identical to commit 42e2dc03; `g1_mix.py` has one commit (0f9b3c2d) and its hash
   matches RESULTS.md; the results were read after item 010 (443db2ab).
2. Separation against B2 +0.085663 (+0.048717 to +0.120928), 26 members, 21 improved: passes.
3. Guard 1 −0.059033 (−0.091945 to −0.024717); guard 2 +0.093693 (+0.055506 to +0.132109); franchise −0.474510
   (−0.660755 to −0.307895); animation signed −0.014557 (−0.055571 to +0.025919), passes under any reading.
4. Shows: the signed figure +0.175071 (+0.129614 to +0.221564) says G1 has more shows than B2, because B2 sits 17
   points under the members' own mix. Reading "worse" as "further from the member's own mix" is the record's reading
   from before item 009, not a rescue: PROTOCOL.md 4a anchors the guard on the member's own share; DECISIONS.md D1
   failed B5 for too few shows and B3 for too much animation; item 007's RESULTS.md calls a larger departure from
   the member's own mix the concern; PLAN.md names the re-ranker "toward the member's own mix"; item 009's brief
   frames the problem the same way. No document ever read "more shows than B2" as worse; that would have credited
   B5 for its 8% shows.
5. The post-hoc element is narrower: the exact statistic was specified after RESULTS.md was read. RESULTS.md alone
   already shows G1 closer, and the conclusion is insensitive to the form. Recomputed independently from the
   hash-checked cache: shows −0.157257 (−0.199733 to −0.117625), animation −0.075434 (−0.109887 to −0.043376),
   identical to DISTANCE.md; the member-level form gives −0.159879 and −0.072709. `distance.py` is correct.
6. Nothing else blocks registration. The disliked first-50/200 shares and median votes are descriptive under A1;
   the top-list harm criterion applies at confirmation, not at registration or the gate. T2b order's later-Skip
   worsening (6 members) is a caveat: T2b has no gate and A2 names T2a only.
7. To handle: the harness changed after the exploratory run (item 010), so the registered run reruns under the new
   hash and A2 is judged on its figures. The tier B rule checks separation and guard 1 only.

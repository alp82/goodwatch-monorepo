# Frozen-catalog hygiene review

Do not reuse the old broad hygiene matcher unchanged. Scanning all 50,000 frozen rows flags 15: 11 are ordinary narrative films/specials, 1 is ambiguous, and 3 have direct nonstandard-artifact evidence. A broader source audit finds an additional clear attraction the rule misses. No model or database calls were used.

Most false positives match “based on theme park ride,” including Pirates films, Jungle Cruise and Haunted Mansion adaptations. Dark Ride and Ghoulies II merely set their story at a ride. The Problem Solverz mentions a rejected precursor pilot but explicitly describes the released series.

Conservative filtering needs evidence about what the current record **is**, not any mention: explicit attraction identity with simulator/audience/installation corroboration, or a standalone pilot version with explicit nonrelease and no contradictory release evidence. Fast & Furious: Supercharged, Back to the Future: The Ride and T2 3D have attraction identity evidence; the 1999 Mulholland pilot has direct nonrelease evidence. These labels do not mean the works are intrinsically irrelevant when attraction content is requested.

Keep Captain EO ambiguous: its synopsis calls it a3D science-fiction film shown at Disney parks; venue alone does not establish an unavailable ride-only experience. Keep ordinary adaptations, location mentions, metaphors and released series with rejected-pilot history. Do not implement ID exceptions or import paid planner decisions. Full record-level evidence and conditions are in [the JSON review](cheap-loop-hygiene-review.json).

Standalone `cheap_hygiene.py` now implements conservative current-record identity patterns. A full50,000-row rescan flags exactly four records, all reviewed above. All 18 reviewed cases match the intended conservative decisions, including keeping Captain EO and every ordinary-work counterexample. This is a coverage/false-positive audit, not proof of perfect recall. Ranking remains unchanged.

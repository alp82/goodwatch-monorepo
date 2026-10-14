# Review of amendment A3 by Astra (read-only), October 14, 2026

Saved by the orchestrator from the reviewer's final message.

**Verdict: accept with changes.** Paths below are relative to `docs/research/taste-loop/`.

1. **High — the harm interval can certify safety too readily.** `PROTOCOL.md:597–599` uses a percentile bootstrap without a small-sample safeguard. Counterexample: paired harm is 0 for 90% of members and +10 for 10%, so true extra harm equals the blocking margin. At n=60, observing ≤2 harmed members has probability **5.30%**; with two, the bootstrap upper endpoint is only **+0.833**. This exceeds the intended 2.5% false-safety tail.
   **Change:** use a preregistered, coverage-valid upper confidence bound for the bounded paired harm mean; retain bootstrap descriptively. Validate rare concentrated harm and constant samples before accepting the analyst.

2. **High — novelty is silently downgraded, allowing a popularity-driven “win.”** `PLAN.md:143–145,224–226` makes new-to-me hits a guard; `PROTOCOL.md:561,580–595` makes them descriptive. G1 can gain familiar Want to See hits while significantly reducing discovery.
   **Change:** restore the paired new-to-me non-worsening guard, or explicitly register its removal as an A3 departure and narrow D1’s conclusion to expressed unseen interest. Neither result establishes personalization or enjoyment after watching.

3. **High — withdrawals escape the missing-harm protection.** `PROTOCOL.md:539–543,642–643,657–665` permits 60 exposures followed by a pass on only 20 retained members. Selective withdrawal can remove precisely the members harmed; title-level unknown bounds do not cover them.
   **Change:** require a preregistered withdrawal sensitivity analysis using lawful aggregate counts and worst-case paired outcomes. Confirmation must survive it; otherwise report inconclusive. Do not retain deleted answers.

4. **High — recruitment feasibility and a finite checkpoint are unresolved.** `CENSUS.md:31–35` gives **96 non-owner members with ≥20 ratings**, before further exclusions; `CENSUS.md:57–62` gives only **30 non-owner repeat raters**, without establishing present activity. Sixty exposures needs ≥62.5% of the ceiling. At hypothetical 20–40% uptake, that ceiling supplies only 19–38 exposures. `PROTOCOL.md:642–647` otherwise leaves judgments sealed indefinitely.
   **Change:** obtain aggregate eligibility/reachability counts before registration. If 60 is unsupported, register **30 exposures or a fixed recruitment deadline**, whichever comes first; analyse once after session closure, with ≥20 retained respondents required and unchanged decision margins. This is a less decisive test, not an 80%-powered substitute. It already pairs members; extra ranks 11–20 cannot increase information about the first-ten estimand.

5. **Medium — arithmetic is sound; full-verdict power is not established.** `PROTOCOL.md:613–635` and `items/012-t3-protocol/RESULTS.md:27–42` correctly calculate 59/59/28 and acknowledge the +1 point-estimate floor. But variance multiplier 2, complete labels, and zero extra harm are unsupported planning assumptions. At true +1, primary passage is approximately 50%; with independent primary/harm statistics, joint passage at n=60 is about **40%**, before guards.
   **Change:** add joint-power sensitivity calculations over clustering, overlap, Seen rates and unknown labels. With disjoint tops, just one unknown G1 slot per member adds +1 to the conservative bound when other contributions balance. Do not describe incomplete-data blocking as demonstrated harm.

6. **Medium — the builder lacks an exposure definition, while storage is over-specified.** `PROTOCOL.md:497–499,521–524,676–683` specifies cards and an answer-version array, but not navigation, card visibility events, or instructions distinguishing unfamiliarity from rejection. Assignment rows alone cannot distinguish “never reached” from “viewed, unanswered.”
   **Change:** freeze response instructions, navigation and submission behaviour; record nullable per-card first-display timestamps separately from session exposure. Require auditable answer revisions, but leave array-versus-child-table storage to normal development.

7. **Low — A3(c) is substantially precise; clarify its T3 denominator.** `PROTOCOL.md:290–297` correctly specifies absolute distance **before** averaging views, equal member weights, direction and strict interval rule, matching `items/009-composition/distance.py:100–105`.
   **Change:** at `PROTOCOL.md:582`, explicitly define own-mix titles as rated `in_pool && has_fingerprint` titles, independent of eligibility set E, and specify pre-exposure exclusion when that denominator is empty.

The union, blinding, shared-title cancellation, Seen-as-zero-hit treatment and conservative unknown-harm coefficients are sound (`PROTOCOL.md:487–552`). Preserve them; complete overlap correctly means no incremental win can be demonstrated.
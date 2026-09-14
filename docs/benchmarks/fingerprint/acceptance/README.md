# Live DNA acceptance — September 14, 2026

**Subsequent update:** [The Matrix and Preacher have been regenerated and verified](regeneration.md) after the highlight-validator fix. The report below records the original acceptance run; its statements about invalid stored records describe that earlier state. Other acceptance gates remain open.

**Acceptance failed and remains open.** Ten titles were generated and embedded, but two contain invalid highlight keys. Actual monthly guardrail wording and one request's exact cost also remain unverified. The DNA generation schedule is disabled.

Canonical ticket: [Run the acceptance criteria on the ten benchmark titles](https://github.com/alp82/goodwatch-monorepo/issues/39), under [Implement the Windmill fingerprinting strategy](https://github.com/alp82/goodwatch-monorepo/issues/35).

## Results

| Criterion | Result | Evidence |
| --- | --- | --- |
| Ten valid DNA records with route provenance | **Fail: 8/10 satisfy the independently checked structural rules.** All ten pass the existing Pydantic schema and have 74 integer scores in range; that schema permits invalid highlight names. | [Independent validation](independent-validation.json), [database verification](postflight-job.json) |
| Generation cost below $0.05 from usage.cost | Ten successful generation responses log **$0.006699506**. One earlier request has missing usage; retain its full **$0.001798208** reservation. Budget remains below the ceiling, but exact accounting is incomplete. | Per-title `*-evidence.json`, [failed fallback](preacher-evidence.json) |
| Essence vectors present for all ten | Pass: ten successful embedding steps, ten finite 768-dimensional essence vectors, and fingerprints matching all 74 scores in schema order. | [Database verification](postflight-job.json) |
| Injected primary failure reaches fallback | Pass on the second attempt: Preacher received an injected 500 for the primary, then generated on `openrouter:qwen/qwen3.7-flash@alibaba`. This does not make its invalid highlight acceptable. | [Successful fallback execution](preacher-retry-evidence.json) |
| Forced 402 pauses without failed flow and releases title | Pass: selected Matrix record released; daily Redis pause; zero embeddings; unchanged production flow succeeds with an empty batch while paused. | [402 flow](402-evidence.json), [state](402-state-job.json), [production flow](402-paused-flow-evidence.json) |
| Actual monthly guardrail wording recognised | **Unverified.** Production inference credential cannot access guardrail management. A synthetic monthly message is not provider evidence. | [Access result](guardrail-access-job.json) |
| Monthly pause lasts until next UTC month | Pass for explicitly synthetic `Monthly budget exceeded (acceptance fixture)`: measured expiry is October 1, 2026, 00:00 UTC. | [State](monthly-state-job.json), [production flow](monthly-paused-flow-evidence.json) |
| Unrelated 403 remains visible | Pass: injected permission error fails the flow; no fallback, pause or new DNA. | [Permission flow](permission-evidence.json) |
| Judge quality and flag score movement ≥3 | Reviewed below: **26 score changes across eight titles**. Highlight order changed for all ten; membership changed for nine. | [Full comparison](comparison.json) |

## Execution and limits

Deployed script content matches commit `255ae627f47520335e3acb8acfc51b6a944a0f2c`; [script hashes](deployed-scripts.json) record the runtime versions. Inputs were the ten existing MongoDB benchmark records; their original title, year and overview match the frozen corpus. All ten are premium tier by popularity. Preacher deliberately used fallback injection.

Paid runs used live Windmill preview flows, with the deployed `crawl_all_by_id` structure, its real iteration/flattening steps, an instrumented call to deployed `fetch.main`, and the deployed vectors step. Only one title ran at a time. The request interceptor reserved a conservative byte-derived input bound and maximum output cost before each provider request; it also supplied the deliberate failures. Preview payloads record the exact instrumentation and Python lock. This is real Windmill/OpenRouter/Gemini/MongoDB execution, but is **not a run of the completely unmodified top-level selector over all ten**. The unchanged `generate_dna` flow was run twice while paused and returned zero embeddings both times.

No production code, flow definition, schedule or provider limit was changed. Production DNA and vectors were written for all ten benchmark records. **The Matrix and Preacher currently retain invalid generated highlights**; they require repair through the validation follow-up. No hand-edited replacement highlights were substituted to make acceptance pass. Test-only selection changes to The Matrix were restored to its original `2025-06-13 10:43:31.387000` timestamp. Both injected Redis pauses were removed; [final state](final-pause-state-job.json) and the postflight verify no remaining pause.

Three initial read-only harness jobs failed while resolving dependencies; switching the harness to the deployed Python 3.11 fetch lock corrected that. Those failures did not call inference. An evidence collector initially tried to load Windmill's all-zero empty-loop job sentinel; the production paused flow itself had succeeded. The collector was corrected and the complete evidence captured.

## Cost ledger

The eleven real generation HTTP attempts comprise ten successful responses with cost metadata and one unresolved response on the first Preacher fallback check. Synthetic 500/402/403 responses make no provider calls. No repair calls were triggered by the two invalid highlight lists because the production validator accepted them.

- Known logged generation cost: **$0.006699506**.
- Retained reservation for missing usage: **$0.001798208**; not a measured charge and not zero.
- Conservative embedding bound: **$0.001643600**, using 8,218 UTF-8 bytes including 256 bytes of framing allowance per essence text, at the paid text rate of $0.20 per million tokens. This is a bound/estimate, not logged billing. [Google pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-embedding-2).
- Combined conservative accounting: **$0.010141314**, below the approved $0.05.

The key usage counter was $0.020251256 before and $0.027569874 in the saved later snapshots, a delta of $0.007318618. Its freshness and attribution are not established, so this is not forced to equal the per-request ledger. The missing first-fallback response's HTTP status, body and ID were not saved by the initial interceptor. A subsequent attempt with diagnostic capture succeeded. The original cause therefore remains unknown; no production bug diagnosis is claimed from this alone.

## Agent quality review

The baseline is the selected model's first-pass POC result from commit `a7841d2`: F for the nine normal premium runs and D for the forced-fallback Preacher. Inputs match, but the production prompt/envelope differs from the POC; these changes cannot be attributed solely to model randomness. This acceptance run does not replace the unchanged-configuration repeat runs in [Run F/D repeat runs and measure embedding cost](https://github.com/alp82/goodwatch-monorepo/issues/40).

The judgments below apply the production trait definitions and [the owner's original notes](completed-review.original.json). They are qualitative agent judgments, not new owner approval or a claim that the POC scores are ground truth.

| Title | Changes of at least 3 points | Judgment |
| --- | --- | --- |
| The Matrix | satire_parody 4→0; fantasy 3→0; crime 5→0; political 6→3; gaming 6→2; meta_narrative 4→7 | Lower satire/fantasy are defensible; lower crime moves toward the owner's complaint that it was too high, although zero is aggressive. Political/gaming shifts are interpretive. Meta-narrative 7 seems inflated: a story about reality is not necessarily self-referential storytelling or fourth-wall breaking. Mystery remains 7 and warfare 6, preserving earlier concerns. Highlight list is invalid, not merely a preference difference. |
| Fight Club | eroticism 2→6; warfare 0→3; coming_of_age 4→7 | Eroticism is arguable but elevated; warfare conflicts with the military-conflict definition. Coming-of-age 7 is a clear concern given the youth-to-adulthood definition and the owner's objection to excessive coming-of-age on D. Dropping capitalism and satire highlights in favor of cinematography/editing weakens the thematic emphasis. |
| Everything Everywhere All at Once | romance 2→5; futuristic 8→4; coming_of_age 0→8; meta_narrative 5→8 | Reduced futurism and violence 6 move toward the owner's F feedback. Romance 5 is defensible for the relationship strand. The coming-of-age increase addresses an earlier cross-candidate concern that it was understated, but 8 risks overstating a secondary strand. Meta-narrative 8 needs calibration rather than assuming multiverse complexity equals self-reference. Revised highlights remain broadly representative. |
| Das Kanu des Manitu | meta_narrative 4→8; world_immersion 5→8; visual_stylization 3→6 | Parody/reference emphasis fits the accepted baseline. The elevated self-reference, immersion and stylization are not substantiated by the frozen synopsis alone; retain as uncertain rather than inventing scene-level evidence. Loss of physical/situational comedy highlights changes the focus. |
| Inside Out | None | Stable relative to the owner-approved F baseline. New highlights emphasize growing up, emotion and catharsis; no new large-score concern. |
| Breaking Bad | pop_culture 2→6; spiritual 1→4; philosophical 5→8 | Spiritual 4 appears inflated: moral conflict alone does not establish spiritual content. Philosophical 8 is arguable but high; pop-culture 6 may confuse the show's cultural impact with in-work references. Highlight membership is identical, only its order changed. |
| Game of Thrones | None | Stable against F, but that preserves the owner's earlier concerns about scare/coming-of-age/nostalgia rather than resolving them. New highlights retain politics/warfare and emphasize spectacle/tension; fantasy and family dynamics remain high scores despite dropping out of highlights. |
| Adolescence | cringe_humor 2→6; ambiguity 4→7 | Cringe-humor 6 likely confuses distress or social discomfort with comedy. Ambiguity 7 and mystery 9 risk overemphasizing a whodunit reading; replacing coming-of-age with mystery in highlights reinforces that concern. Acting/direction remain strong, consistent with owner preferences. |
| Black Mirror | cringe_humor 4→7; meta_narrative 2→5 | Both can apply to individual anthology episodes but seem elevated as overall-series traits. Eroticism 4 moves toward the owner's complaint that F overstated it. The changed highlight from tension to philosophy remains defensible. |
| Preacher | situational_comedy 5→2; political 6→2; family_dynamics 4→1 | Lower politics is defensible; situational comedy and family dynamics may now be understated. Contemporary realism 3 addresses the owner's D complaint that it was too high. Cringe 1 remains low in light of the owner's F feedback, even though it is not a ≥3 change against D. Invalid `erotica` highlight is a structural failure. |

Overall, the generation/embedding and pause paths execute, but the content cannot receive an unqualified acceptance pass. The invalid highlights are a concrete implementation defect; the semantic concerns remain flagged for the follow-up review rather than being repaired by editing scores manually.

## Proposed follow-ups

These are reviewable drafts, not published issues. The repository's tracker instructions require ticket-breakdown approval before publication.

1. [Reject invalid highlight keys before persisting DNA](followups/validate-highlights.md).
2. [Reconcile the unlogged fallback attempt and complete acceptance cost evidence](followups/reconcile-cost.md).
3. [Capture and verify the actual monthly guardrail rejection](followups/monthly-response.md).

After approval, create these as children of the implementation map and add native dependencies blocking acceptance. Keep the acceptance ticket open; do not add it to Decisions so far or enable the schedule.

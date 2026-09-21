# Production release: ticket alignment

2026-09-17. Research for [Deploy and verify the completed recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/94), under [Deliver a continuous recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/82). Inspected checkout `ef163b0ac13be83069fa042a192d274f35c85acf`, current issue bodies, the accepted prototype resolution, and GitHub dependency metadata. Only this report was written; no implementation, deployment, account session, or live recovery exercise occurred.

## Recommendation

Keep this as the final execution and acceptance task. Its current ownership is correct: integrate delivery, prove the candidate locally, recheck operational readiness, establish candidate-specific state compatibility, deploy, repeat acceptance in production, and keep the task open after a failed release even if recovery succeeds. These obligations follow the [confirmed acceptance resolution](https://github.com/alp82/goodwatch-monorepo/issues/87#issuecomment-5721672847).

Add three concrete clarifications without expanding the agreed scope:

1. **Candidate evidence:** Record how the candidate incorporates accepted revision `ef163b0` and the completed delivery changes, including any selective integration or superseding implementation. Verify the exact built/deployed revision; a closed prototype ticket or its branch's existence is not integration evidence. Preserve the accepted narrow design and do not restore rejected prototype UI/storage.
2. **Release surfaces:** Inventory the actual candidate's changed runtime surfaces. Remix server routes deploy with the webapp; any changed Windmill flows, externally stored configuration, or persisted schema/data need their own verified deployment, sequencing, and recovery evidence. Do not assume a Coolify success deploys all backend changes or that every candidate requires a Windmill release.
3. **Acceptance record:** Record a scenario/evidence matrix referencing the canonical decisions: environment, candidate revision, viewport, controlled account state, steps, expected/observed result, and limitations. Include recovery after interruption and changes made during the new release. Mark unexecuted required scenarios as outstanding rather than replacing them with HTTP checks or inherited prototype evidence.

The existing requirement to record unrelated baseline issues and use contemporaneous TypeScript/Lighthouse comparisons is appropriate. Do not replace it with a historical error count or arbitrary score.

## Accepted artifact and integration boundaries

The [accepted experience resolution](https://github.com/alp82/goodwatch-monorepo/issues/86#issuecomment-5721529691) selects `ef163b0`: real detail links from the large Taste card, the details explore bar, return to the same quiz position, Previous/Next, and type/genre/year refinements. It explicitly rejects replacement layouts, miniature dialogs, extra prototype progress/signup UI, and separate preview action storage. It also says additional presentation requiring a user decision needs live review; the final task should not infer approval of new signup/import presentation merely from prototype closure.

Actual [ExploreBar.tsx](../../../goodwatch-webapp/app/ui/explore/ExploreBar.tsx), lines 26–34 and 46–61, uses the existing pool or requests 100 smart titles, then filters/sorts that pool. [exploration.tsx](../../../goodwatch-webapp/app/ui/taste/exploration.tsx), lines 23–40, reads/writes tab-local sessionStorage. These match the accepted limitations. They do not prove all-entry-point continuity, persistent cross-browser account transfer, catalog-wide refinements, or availability correctness. The [artifact walkthrough](../../../goodwatch-webapp/app/ui/explore/ExploreBar.md), lines 5–11, describes the specific local behavior to retain. Its final sentence still describes review status; the issue's later resolution is the authority for acceptance.

This checkout is the accepted artifact revision itself, as confirmed by `git log -1`. That proves its local presence only. No comparison with the future integrated candidate or live production revision was possible in this research.

## Runtime and recovery realities

The existing import backend is a Remix action: [api.import-guest-interactions.ts](../../../goodwatch-webapp/app/routes/api.import-guest-interactions.ts), lines 7–12, authenticates the request; lines 52–84 issue independent Crate upserts for scores, Wishlist, and skips through `Promise.all`. This code alone does not demonstrate atomic transfer; successful writes can precede another write's failure. The [guest import hook](../../../goodwatch-webapp/app/ui/onboarding/hooks/useGuestRatingImport.ts), lines 28–44, removes browser guest keys on success and reports errors otherwise. Candidate acceptance must observe agreed partial-failure/retry and data-preservation behavior rather than infer it from a successful response or progress animation.

These storage boundaries mean restoring a container does not restore removed browser keys or reverse already-written account rows. The release task correctly owns proof that its final storage/import implementation remains recoverable after deployment and rollback without overwriting newer account activity. Preparation can establish the operator mechanism and constraints, but cannot certify compatibility for code not yet implemented. No requirement to perform a destructive production rollback drill follows from this; establish the actual mechanism and evidence using the verified runbook and controlled checks.

The webapp [package scripts](../../../goodwatch-webapp/package.json), lines 7–11, build Remix and run its server; frontend and these server routes are part of that application. Separately, [the Windmill workflow](../../../.github/workflows/push-windmill-workspace.yml), lines 3–9, deploys flow-path changes on `main`; lines 58–67 retain deleted entries and skip external variables/secrets/resources. Therefore reverting application code is not a complete recovery plan when the actual candidate changes those other surfaces. The preparation report covers current hosting/access uncertainties; this task must revalidate them for its actual release rather than duplicate that research now.

The [webapp instructions](../../../goodwatch-webapp/AGENTS.md), lines 6–16, require Chrome DevTools and Lighthouse, prohibit automated webapp tests, and use the existing localhost:3003 server. The [acceptance resolution](https://github.com/alp82/goodwatch-monorepo/issues/87#issuecomment-5721672847) requires local and production runtime coverage for all named entry points and account states. Prototype scores and earlier HTTP-only checks cannot stand in for that coverage. Any controlled-account limitation allowed to remain explicit in an earlier evidence ticket still has to be resolved for mandatory final acceptance.

## Dependency completeness

Read-only first-party GitHub `issues/{number}/dependencies/blocked_by` queries on 2026-09-17 showed:

| Task | Existing blockers relevant to final delivery |
| --- | --- |
| [Deploy and verify the completed recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/94) | [Verify journey deployment access and recovery procedure](https://github.com/alp82/goodwatch-monorepo/issues/93), [Implement shared guest progress and discovery continuity](https://github.com/alp82/goodwatch-monorepo/issues/89), [Implement confirmed account transfer and recovery](https://github.com/alp82/goodwatch-monorepo/issues/90), [Implement interest discovery and explicit watchability checks](https://github.com/alp82/goodwatch-monorepo/issues/92). |
| [Implement confirmed account transfer and recovery](https://github.com/alp82/goodwatch-monorepo/issues/90) | Accepted experience selection, shared guest delivery, and [Verify authenticated guest handoff and import recovery](https://github.com/alp82/goodwatch-monorepo/issues/88). |
| [Implement interest discovery and explicit watchability checks](https://github.com/alp82/goodwatch-monorepo/issues/92) | Accepted experience selection, shared guest delivery, and [Verify availability timestamps for the 30-day watchability rule](https://github.com/alp82/goodwatch-monorepo/issues/91). |
| [Implement shared guest progress and discovery continuity](https://github.com/alp82/goodwatch-monorepo/issues/89) | Accepted experience selection. |

Sources: authenticated reads of the [release blockers](https://api.github.com/repos/alp82/goodwatch-monorepo/issues/94/dependencies/blocked_by), [transfer blockers](https://api.github.com/repos/alp82/goodwatch-monorepo/issues/90/dependencies/blocked_by), [watchability blockers](https://api.github.com/repos/alp82/goodwatch-monorepo/issues/92/dependencies/blocked_by), and [guest blockers](https://api.github.com/repos/alp82/goodwatch-monorepo/issues/89/dependencies/blocked_by).

No missing blocking edge was established: authenticated evidence and timestamp evidence are transitively required through their delivery tasks, and accepted prototype selection is already closed. Duplicate direct edges are unnecessary for the current graph. Re-evaluate after this alignment review creates or changes tasks; the map still contains in-scope fog, and the existing release body correctly forbids closing the map while required work or fog remains.

## Limits

No final implementation candidate exists in this investigation. Its schema changes, deployment surfaces, runtime acceptance results, current deployment rights, restore capability, and production state compatibility remain unverified. This report recommends tightening execution evidence, not declaring readiness or reopening the user-confirmed functional gate.

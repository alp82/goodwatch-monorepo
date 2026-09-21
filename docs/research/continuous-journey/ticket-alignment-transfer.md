# Account transfer implementation: ticket alignment

Research date: 2026-09-17; inspected revision `ef163b0ac13be83069fa042a192d274f35c85acf`. Target: [Implement confirmed account transfer and recovery](https://github.com/alp82/goodwatch-monorepo/issues/90). Read-only source and issue research, with no runtime, account, tracker, or implementation changes.

## Recommendation

Keep this delivery ticket and its scope. Its broad behavior is correctly aligned with the [guest-progress decision](https://github.com/alp82/goodwatch-monorepo/issues/84#issuecomment-5705214162), but sharpen five implementation boundaries below. This is substantially more than adding a confirmation dialog to the existing import. No new merge-policy decision is needed; the remaining human decision is any material presentation choice, since the [accepted prototype resolution](https://github.com/alp82/goodwatch-monorepo/issues/86#issuecomment-5721529691) explicitly did not approve signup/import-review presentation.

## Proposed ticket additions, supported by source

### 1. Establish account creation provenance independently of onboarding

Add: “Distinguish a newly created account from an existing account using the actual authentication lifecycle; missing account data, incomplete onboarding, or entering through Sign Up is insufficient evidence for automatic transfer. Cover password authentication, existing Google OAuth entry, delayed confirmation and returning to the original browser.”

Why: current auth form uses Supabase signup/password/OAuth, but the common auth provider only exposes the current user and revalidation; no transfer classification appears in these paths. The onboarding hook initializes missing settings as incomplete and automatically imports for any incomplete account. Thus an old account with no settings currently follows the same path as a newly created account. Sources: [auth form](../../../goodwatch-webapp/app/ui/auth/CustomAuthForm.tsx#L27) (27–89), [auth provider](../../../goodwatch-webapp/app/ui/auth/AuthProvider.tsx#L17) (17–43), [onboarding initialization](../../../goodwatch-webapp/app/routes/api.user-settings.get.tsx#L102) (102–128), [import step](../../../goodwatch-webapp/app/ui/onboarding/hooks/useOnboardingStep.ts#L44) (44–75). Reliable provenance mechanism is an engineering choice to establish, not a prescribed new schema or permission to bypass review.

### 2. Make selection an actual write boundary, preserving member data

Add: “Read account values for review; transfer only confirmed changes, with score replacements and preference changes initially unselected. Preserve member reviews, watched/favorite state and unselected account entries, and retain canonical title identity. Do not apply the guest exclusive-action model to the member library.”

Why: current import accepts an untyped-at-runtime interaction array and directly upserts scores/Wishlist/skips, without account comparison or per-change selection. Current member state already exposes separate scores, Wishlist, watched, favorites and skips, and scores include review text. Sources: [import API](../../../goodwatch-webapp/app/routes/api.import-guest-interactions.ts#L14) (14–84), [member state](../../../goodwatch-webapp/app/types/user-data.ts#L9) (9–27), [member reads](../../../goodwatch-webapp/app/server/userData.server.ts#L36) (36–62).

A reuse trap matters here: the normal score helper writes `review: review || null`, so calling it for a score-only guest replacement could erase an existing written review. Normal member score/skip writes canonicalize retired title IDs; the import endpoint currently does not. Preserve these member boundaries while sharing code where appropriate. Sources: [score writer](../../../goodwatch-webapp/app/server/scores.server.ts#L40) (40–56), [skip writer](../../../goodwatch-webapp/app/server/skipped.server.ts#L35) (35–51), [canonical identity](../../../goodwatch-webapp/app/utils/title-identity.ts#L1) (1–10). These are focused consequences of “preserve account data not selected for change,” not a request for a library redesign.

### 3. Treat interactions and preferences as one recoverable transfer

Add: “Persist enough pending-transfer state to recover the selected changes, target account and completion status across navigation, reload and retry; report completion only after all selected interactions and preferences succeed. Support preferences-only transfers, partial row/table success, lost responses and settings-write failure. Clear declined or unselected guest changes only at the agreed completion point.”

Why: current import runs separate table promises; generic upsert executes individual rows sequentially. There is no encompassing transaction in this code. Browser success immediately removes the guest interaction storage, while country/providers are separately saved later. Thus preserving storage on an error response is only part of the required recovery. Sources: [table writes](../../../goodwatch-webapp/app/routes/api.import-guest-interactions.ts#L52) (52–99), [row writes](../../../goodwatch-webapp/app/utils/crate.ts#L230) (230–242), [success clearing](../../../goodwatch-webapp/app/ui/onboarding/hooks/useGuestRatingImport.ts#L28) (28–45), [preference writes](../../../goodwatch-webapp/app/ui/onboarding/hooks/useOnboardingActions.ts#L17) (17–51).

The settings mutation currently parses JSON without checking HTTP success, and its server helper can return null for missing/invalid data. Completion must use actual successful persistence, not merely a resolved fetch or mutation callback. Sources: [settings client](../../../goodwatch-webapp/app/routes/api.user-settings.set.tsx#L38) (38–65), [settings server](../../../goodwatch-webapp/app/server/user-settings.server.ts#L86) (86–118). Choose recovery mechanics from the existing backend; no database migration or transaction is assumed.

### 4. Integrate the existing auth and guest-state lifecycle

Add: “Own auth-route return propagation, pending-transfer recovery and completed-transfer/logout cleanup; use the shared guest-progress contract for snapshot, completion and restore. Keep account caches isolated and verify no in-memory guest state reappears after completed transfer/logout.”

Why: auth route switches use bare Sign In/Sign Up links and lose return context; both routes immediately navigate authenticated users. Header sign-in captures the URL only on mount. Sources: [form links](../../../goodwatch-webapp/app/ui/auth/CustomAuthForm.tsx#L212) (212–231), [signin return](../../../goodwatch-webapp/app/routes/sign-in.tsx#L42) (42–53), [signup return](../../../goodwatch-webapp/app/routes/sign-up.tsx#L35) (35–46), [header link](../../../goodwatch-webapp/app/ui/auth/SignInButton.tsx#L8) (8–17).

The existing auth provider already revalidates on account change and evicts prior-account query entries, so extend that integration instead of inventing a second auth subsystem. Logout removes caches/dismissal state, while Taste maintains local in-memory interactions that can be persisted again when unauthenticated. Sources: [auth reconciliation](../../../goodwatch-webapp/app/ui/auth/AuthProvider.tsx#L33) (33–43), [logout](../../../goodwatch-webapp/app/ui/auth/SignOutLink.tsx#L19) (19–33), [Taste persistence](../../../goodwatch-webapp/app/ui/taste/hooks/useTasteScoring.ts#L15) (15–44). Resurrection is a code-derived risk requiring runtime verification, not a proven failure.

### 5. Correct the AFK presentation assumption and clarify dependencies

Change the mode to “AFK implementation of confirmed behavior; HITL for material import-review presentation decisions and unavailable controlled-account access.” Link the final prototype resolution, rather than implying that it selected an import review. The accepted direction is small additions to existing flows; do not revive the rejected signup/progress redesign. This follows the [prototype resolution](https://github.com/alp82/goodwatch-monorepo/issues/86#issuecomment-5721529691), not a new approval requirement for routine engineering choices.

[Verify authenticated guest handoff and import recovery](https://github.com/alp82/goodwatch-monorepo/issues/88) supplies baseline evidence and fixtures. [Implement shared guest progress and discovery continuity](https://github.com/alp82/goodwatch-monorepo/issues/89) supplies shared storage/context behavior. Specify their integration contract before competing implementations touch those state paths; completion of this transfer ticket requires integrated browser evidence, but bounded implementation work need not wait for all baseline scenarios to become passing future behavior. Keep deployment in [Deploy and verify the completed recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/94).

## Acceptance and confidence

Retain the existing desktop/mobile, new/existing accounts, conflicts, decline versus close, retry, logout, return-context and second-browser checks. Explicitly include existing incomplete onboarding, preference-only progress, unselected review text/member state preservation and failure after interaction success. These instantiate agreed behavior rather than introducing fresh product scope. The [production acceptance resolution](https://github.com/alp82/goodwatch-monorepo/issues/87#issuecomment-5721672847) remains canonical; [webapp instructions](../../../goodwatch-webapp/AGENTS.md#L14) require Chrome DevTools and the existing localhost server, with no automated tests.

Confidence: high in source-level gaps and implementation-boundary recommendations. Actual Supabase account-creation semantics/configuration, controlled mailbox access, partial-write runtime behavior and production state were not verified. No ticket is resolved by this report.

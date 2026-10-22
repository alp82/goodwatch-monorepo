# R4 guest release: manual retry compatibility

This is a separate incremental client build after the frozen readiness/guest-beta-r1 pins. It does not activate a retained app or install on the physical phone. Contract3 DTOs and proposal/Agree semantics are unchanged.

The API can return429 `limit_reached` or503 `busy`, with `error.retryable:true` and `Retry-After` integer seconds. Retryable failures retain the exact admission bootstrap (including secret, nickname and invite) or persisted command envelope, even when a prior ambiguous attempt may have committed. Existing `outcome_unknown`/`busy` behavior remains compatible.401/403/404/410 and terminal error codes take precedence; definitive nonretryable failures clear the pending request. The client never infers a new sequence from a rate error.

Only decimal integer delays1..21600 are accepted. Missing, malformed, negative, date-form, zero or excessive values use a bounded two-second fallback. A local countdown disables Retry; reaching zero only re-enables the button. It never replays a request, answers a card or agrees to a proposal. Both the send guard and command queue check the deadline. Readiness automation stops while an uncertain command is pending.

Commands persist envelope+deadline, with backward-compatible reading of the previous bare-envelope format. Native admission bootstraps use SecureStore and an invite-intent-specific key. Browser pending bootstrap data uses this tab's sessionStorage, is never a room bearer/account grant, and is cleared after confirmed admission/existing-member recovery or definitive failure. Room HTTP credentials remain HttpOnly cookies on web. No bootstrap secret enters an invitation URL, shared snapshot, activity message, log or artifact.

A stored request is restored without replay after app/tab reload. Its nickname/invite remain fixed until reconciliation, and the remaining cooldown is retained. Storage failure blocks creating a new bootstrap or sending an unpersisted command. Backgrounding does not turn countdown expiry into a network action.

Preview package/signing identity remain `com.yepwatch.preview` and the original private preview certificate. New versionCode/buildNumber3 and separate `preview-r3`/`beta-web-r3` outputs preserve the first APK/export. No permanent store key, account or cloud job is created. The public HTTPS/WSS origins stay `yepwatch.com`; local checks do not imply deployment.

The first R4 client pin and code2 APK are superseded: an in-memory bootstrap could bypass a failed initial storage write. The correction always persists the exact saved bootstrap before every admission submit, including manual retries; injected repeated storage failures must produce zero create/join requests until persistence succeeds. Frozen prior pins/artifacts remain unchanged.

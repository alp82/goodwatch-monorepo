# YepWatch live interaction update — 2026-10-23

New rooms use six-character uppercase/digit keys, excluding 0/O/1/I/L. A typed primary-key reservation chooses another deterministic candidate on collision, preserves original expiry after uncertain writes, and never reassigns another room's code. Existing sixteen-character and signed links retain their format and work. No additional database migration is needed beyond the short-invitation table already provisioned.

Proposal clients opt in to live poster pointer delivery. Positions are bounded, sampled at most once per 280ms, and interpolated on receipt. Pressed horizontal movement stays at the contact point to avoid broadcasting the Yep/Nope swipe direction. Vertical movement, mouse hover and press/release remain visible. No title, vote or agreement identity is carried. Heartbeats do not repeat positions, positions expire after 1.5 seconds, and older clients receive frames with the new field removed.

Avatars are 44px, with squish, movement, and neutral hop/sparkle reactions. Only the person's own avatar distinguishes Yep from Nope. The outgoing poster stays offscreen until title replacement; replacement resets before paint. Take back occupies a reserved split-button slot, so agreement/withdrawal does not change wall or button bounds.

Checks:

- 56 client unit tests; typecheck and lint pass (one existing legacy unused-import warning).
- Full 43 browser checks passed, followed by seven focused checks after the final pointer/layout refinements. Covers both animated swipe directions, delayed response, exact agreement bounds, live pointer transmission/rendering/release, and 375/390/1440 layouts.
- 34 gateway tests pass, nine opt-in integration tests skipped. New two-gateway test exercises opt-in delivery, old-client stripping, bounds, stale-pointer expiry, and release. These gateways use isolated fixture authority and in-memory fanout.
- 34 backend tests pass with real disposable Crate relational and control tests enabled, including restart, capacity, acknowledgement recovery and invitation collision/replay.
- API bundle compiles; no YepWatch TypeScript diagnostics. Broader existing catalog/UI/cache diagnostics still prevent claiming a full webapp typecheck pass.
- Browser screenshots inspected for the split agreement control and over-poster touch marker. Screenshots use fixture titles, not catalog availability evidence.

The original device-only swipe flash did not reproduce in the headless baseline sampling; the code change removes the outgoing-card reverse entrance and passes the same sampling checks. Physical confirmation remains necessary. No production deployment, device install, user vote, or user agreement was performed for this update. In the user-authorized test room only the assistant's test host accepted its first twenty suggestions, producing four matches; neither human actor was driven.

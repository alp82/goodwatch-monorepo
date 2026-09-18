# Account-transfer review preview

Presentation checkpoint for [Implement confirmed account transfer and recovery](https://github.com/alp82/goodwatch-monorepo/issues/90), still open.

Open the existing dev server at <http://localhost:3003/wishlist?prototype=account-transfer>. The same query can be used on another existing discovery route. This development-only preview replaces the onboarding banner for the preview visit. It uses fixed sample data and memory-only actions, never real account writes, authentication, or guest-storage changes. Reload resets it.

## Live decision

Does this compact desktop dialog / mobile bottom sheet fit the existing experience for reviewing guest changes, with a persistent “Review progress” banner after closing?

The confirmed rules are unchanged: new entries can be selected individually or in bulk; score replacements and preferences start unchecked; account and guest values are shown together; successful confirmation discards unselected changes; explicit decline discards all guest changes; closing leaves the transfer pending. The preview starts all entries unchecked, requiring selection before transfer.

Try “Select all new entries,” select a score/preference change, close and reopen, then transfer or keep the account unchanged. To see recovery, close the review, expand “Preview controls / state,” enable “Simulate interrupted transfer,” reopen and transfer. The selected set becomes fixed in the simulated retry state. Close, disable the simulation, reopen and retry to see completion. Reset returns to the initial sample state. These are presentation states only; there is no implemented persistence or recovery backend.

## Why this is a live checkpoint

The implementation ticket explicitly says: “Use incremental presentation and seek live review for material user-facing choices without reopening confirmed transfer rules.” The accepted connected-exploration prototype explicitly did not approve an import-review design. This introduces the missing review surface, so its placement/presentation remains a live user decision. Earlier live feedback rejected radically different replacement layouts; this preview therefore offers one incremental treatment rather than new redesign variants.

## Browser checks, 2026-09-18

Chrome DevTools against localhost:3003, isolated `transfer90` browser context. Desktop 1440×1000 and mobile 390×844. Bulk selection selected only the three new entries; conflicting score/country/services stayed unchecked. Close/reopen retained selections. Escape left the transfer pending. Explicit decline showed unchanged-account completion. Simulated interruption retained the confirmed selection, disabled changes to it, and retry completed the same selected set. Real guest storage remained untouched. Mobile document width stayed 390px.

Lighthouse mobile snapshot with review open: accessibility 96, best practices 100, SEO 100. The accessibility finding is unnamed shared navigation links. Snapshot auditing does not measure performance or establish navigation/loading scores. Local reports: `/tmp/goodwatch-transfer90/lighthouse/report.{json,html}`. Screenshots: `/tmp/goodwatch-transfer90/desktop.png` and `/tmp/goodwatch-transfer90/mobile.png`.

Repository typecheck still fails on existing diagnostics; none name the prototype or app shell. Formatting and whitespace checks pass. No automated tests added. Existing dev server remains running. No deployment or production transfer changes.

## Resume after live review

Record the user's actual presentation decision here and on the ticket, then implement the approved experience with real account-scoped selection/pending state, reliable new-account classification, idempotent selected writes/readback, preferences, auth return, shared-store cleanup, and account isolation. Complete the ticket's controlled-account desktop/mobile acceptance matrix; preview checks do not satisfy those delivery gates. Do not close the ticket or append a resolved map decision based on this preview.

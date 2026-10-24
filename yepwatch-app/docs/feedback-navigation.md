# Home and iPhone feedback — 24 October 2026

The chosen home design is variant A from throwaway branch `prototype/yepwatch-install-entry` (prototype commit `a5eaf9ee3`). Production contains only the selected layout: real install QR codes, a compact looping explainer, and create/join/return-to-room controls. `/beta` redirects home. The explainer finishes with a stylized TV scene; its centered SVG play/pause control appears on hover, touch or keyboard focus. Reduced motion shows the final scene without animation.

Poster art starts transparent and fades in after loading. A changed image source gets a new loading state, so a late response for a previous title cannot reveal the next poster prematurely.

Back closes the nearest panel, then returns from matches to voting. On iOS/web, a rightward swipe beginning in the reserved leftmost 20 pixels performs the same action; a drag starting on the poster still votes. The room disables iOS's route-pop gesture so it cannot bypass the in-room navigation. The edge owns its gesture until release, including inside scrollable drawers.

After Tonight, Back opens a read-only match wall. Returning to Tonight keeps the final decision. Review exposes no proposal, agreement or take-back actions and sends no decision-changing commands. Choose again remains the explicit new-round action. The home shortcut restores the existing room and identity.

Verification includes browser fixtures for final-decision preservation, edge versus poster gestures, delayed image responses, create/join and recent-room recovery; checks at 320×568, 375×667, 390×844, 844×390 and 1440×900; typecheck, lint and Android/iOS Hermes exports. Browser gesture checks do not replace physical iPhone testing. Native fixes require the new store build; deploying the website does not update an installed app.

Android uses the system edge gesture and `BackHandler`/`Modal.onRequestClose`, without a second custom edge responder. Predictive route dismissal is disabled so system Back reaches the in-room handler rather than closing the Activity. Build 10 exposed the bypass during native testing and is not the published Android update; the correction is build 11. iPhone build 10 is approved.

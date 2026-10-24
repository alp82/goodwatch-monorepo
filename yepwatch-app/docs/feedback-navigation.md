# Home and iPhone feedback — 24 October 2026

The chosen home design is variant A from throwaway branch `prototype/yepwatch-install-entry` (prototype commit `a5eaf9ee3`). Production contains only the selected layout: real install QR codes, a compact looping explainer, and create/join/return-to-room controls. `/beta` redirects home. The explainer finishes with a stylized TV scene; its centered SVG play/pause control appears on hover, touch or keyboard focus. Reduced motion shows the final scene without animation.

Poster art starts transparent and fades in after loading. A changed image source gets a new loading state, so a late response for a previous title cannot reveal the next poster prematurely.

Back closes the nearest panel, then returns from matches to voting. On iOS/web, a rightward swipe beginning in the reserved leftmost 20 pixels performs the same action; a drag starting on the poster still votes. The room disables iOS's route-pop gesture so it cannot bypass the in-room navigation. The edge owns its gesture until release, including inside scrollable drawers.

After Tonight, Back opens a read-only match wall. Returning to Tonight keeps the final decision. Review exposes no proposal, agreement or take-back actions and sends no decision-changing commands. Choose again remains the explicit new-round action. The home shortcut restores the existing room and identity.

Verification includes browser fixtures for final-decision preservation, edge versus poster gestures, delayed image responses, create/join and recent-room recovery; checks at 320×568, 375×667, 390×844, 844×390 and 1440×900; typecheck, lint and Android/iOS Hermes exports. Browser gesture checks do not replace physical iPhone testing. Native fixes require the new store build; deploying the website does not update an installed app.

Android uses the system edge gesture and `BackHandler`/`Modal.onRequestClose`, without a second custom edge responder. Predictive route dismissal is disabled so system Back reaches the in-room handler rather than closing the Activity. Build 10 exposed the bypass during native testing and is not the published Android update; the correction is build 11. iPhone build 10 is approved.

The Android workaround follows the [Expo predictive Back configuration](https://docs.expo.dev/versions/v58.0.0/config/app/#predictivebackgestureenabled) and the [React Native API 33–35 callback issue](https://github.com/react/react-native/issues/58407). Re-enable predictive navigation only after verifying both hardware Back and system-edge Back against the contextual room handler on affected Android versions.

Signed Android build 11 was upgraded over build 10 on an owned Pixel 8/API 35 emulator. System Back, system edge, header Back and drawer dismissal passed; Tonight and its read-only review retained the same final choice. The public APK download was verified without an Expo login. Physical iPhone gestures and physical-device audio remain unverified in this round.

## Tonight streaming links

Tonight shows the final decision's checked provider offers directly, filtered to the room's selected services. Branding reuses country-specific catalog metadata and GoodWatch's logo-card treatment; metadata never creates availability. Duplicate provider families prefer their direct link. Search and availability-page fallbacks are labelled separately. All services remain reachable in a bounded scrolling list, and a distinct GoodWatch link opens the full movie/show page. The details drawer reuses the same links. No provider URL or episode entitlement is invented.

## Build 13: entry, configuration and poster transitions

The home logo moves into its header, then the intro begins, the two installation cards arrive, and browser actions follow. Installed apps use the same local intro artwork with Create, Join, GoodWatch sign-in and the existing room shortcut. Native intro playback pauses in the background; reduced motion shows the settled TV image.

GoodWatch sign-in no longer requires a guest nickname. An unnamed admission starts as Guest and keeps that actor through the existing account-linking flow; no profile name is guessed. All sign-in buttons carry the GoodWatch mark.

Room configuration keeps Save outside the scrolling fields and providers. Country choices prioritize the current selection, an explicit region from the configured device/browser locale, and GoodWatch's curated common-country order, followed by the complete alphabetical remainder. This is a locale suggestion, not geolocation or live popularity analytics. Saved and manually chosen countries take precedence.

A cached poster now waits for the asynchronous motion preference before revealing itself. The same opacity animation owns the fade on Android (the image's built-in fade is disabled). Reduced-motion voting keeps the outgoing card offscreen until the next title resets its position.

Validation: 63 unit tests, 89 browser checks, typecheck/lint (one pre-existing warning), and both native exports passed. The regression reproduces a cached image arriving before the native motion-setting response, then verifies monotonic fading, reduced motion and failed preference reads. Native release validation is recorded with the build evidence when complete.

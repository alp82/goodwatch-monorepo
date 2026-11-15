# YepWatch store assets

- Google icon: `icon-512.png` (512×512 RGB PNG).
- Apple marketing icon: `icon-1024.png` (1024×1024 RGB PNG, no alpha channel).
- Google feature graphic: `feature-graphic-1024x500.png` (1024×500 RGB PNG).
- Galleries (rethink, 2026-11-15): `android/gallery-*.png` (8, 1080×1920), `ios-iphone-medium/gallery-*.png` (8, 1206×2622), `ios-iphone/gallery-*.png` (6, 1320×2868) and `ios-ipad/gallery-*.png` (6, 2064×2752), in filename order. Each frame is a caption headline over one unretouched native screenshot or native screen-recording frame, on a background from the app palette (amber, near-black, red, green, warm brown).

Artwork comes from the existing YepWatch SVG mark and Gabarito typeface. Run `node --import tsx scripts/build-store-assets.ts` from `yepwatch-app` after installing app/webapp dependencies. It also regenerates the crawlable policy pages from the same content used by the app. It does not generate screenshots.

## Gallery pipeline

1. **Native captures.** `scripts/capture-store-rethink.py` drives the real app with Maestro against the public API (fixtures off). The phone is the host "Alex"; four disposable peers (Mia, Sam, Priya, Leo) join through the API, add one idea each, Yep the titles that should match, say I'm in and pick tiebreak favorites. It saves screenshots and native recordings (Yep/Nope looks, the match moment, the spin) to `.expo/store-rethink/<family>/`. At the end the peers leave and the phone resets its taste profile (Profile, Reset my taste, which sends `DELETE /proposal/profile`).
   - iOS: the EAS profile `store-capture-rethink` (`.eas/build/capture-rethink.yml`) downloads the simulator app named by `YEPWATCH_SIMULATOR_ARCHIVE` (build it with the `store-simulator` profile) and captures iPhone 17 Pro (`iphone-medium`), iPhone 17 Pro Max (`iphone-large`) or iPad Pro 13-inch (`ipad`) as set in `YEPWATCH_GALLERY_FAMILIES`. Run one family per job: a family takes about 20 minutes on the worker and EAS stops jobs at 45 minutes, before the artifact upload. Download the build artifact; it holds only screenshots, recordings and `capture.json`.
   - Android: `node scripts/build-store-android.mjs` repacks the E2E harness's release-like base APK with the current source and the public origins. Then, on a networked emulator: `python3 scripts/capture-store-rethink.py android --device emulator-5578 --app-id dev.yepwatch.e2e --apk .expo/store-android/yepwatch-store.apk`.
2. **Pick frames.** Chosen screenshots and recording frames (extracted at native size with ffmpeg, never resized or retouched) live in `artifacts/store-gallery-rethink/native/<family>/`.
3. **Compose.** `python3 scripts/compose-store-gallery.py store/gallery-rethink.json` writes the store frames and a contact sheet per device (`artifacts/store-gallery-rethink/contact-*.png`), plus `frames.json` with captions and hashes. `gallery-manifest.json` records the capture runs.

Use `node scripts/export-store-copy.cjs <destination>` for individual paste-ready listing fields. The canonical source is `store/en-US.json`. Google uses the short and full descriptions and the release notes; Apple additionally has subtitle, promo text and keywords.

For Apple, set `YEPWATCH_EAS_CLI_ROOT` to an installed `eas-cli` directory. `node scripts/apple-store-state.cjs` reads the version state (read only). `node scripts/upload-apple-gallery.cjs --apply --replace --output <private-result.json>` replaces each screenshot set with the gallery and reads it back; without `--replace` it keeps earlier uploads at the end, and without `--apply` it only inspects. `node scripts/sync-apple-listing.cjs --apply` writes the complete text records. Neither submits for review.

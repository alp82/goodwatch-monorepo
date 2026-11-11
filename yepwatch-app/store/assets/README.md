# YepWatch store assets

- Google icon: `icon-512.png` (512×512 RGB PNG).
- Apple marketing icon: `icon-1024.png` (1024×1024 RGB PNG, no alpha channel).
- Google feature graphic: `feature-graphic-1024x500.png` (1024×500 RGB PNG).
- Android phone screenshots: `android/01-choose-together.png` through `04-tonights-pick.png` (1080×2400), direct native emulator captures. They use two disposable guests and a finite public catalog snapshot with the real room engine on isolated local services. No personal account or private invitation appears.
- Apple screenshots: `ios-iphone/01-choose-together.png` (1320×2868) and `ios-ipad/01-choose-together.png` (2064×2752), genuine native home screens. Apple processed both successfully. These are the minimum required display sets; group-flow screenshots were not completed for Apple.

Artwork comes from the existing YepWatch SVG mark and Gabarito typeface. Run `node --import tsx scripts/build-store-assets.ts` from `yepwatch-app` after installing app/webapp dependencies. It also regenerates the crawlable policy pages from the same content used by the app. It does not generate screenshots.

Apple capture uses the native simulator artifact from EAS build `7f5a5b83-0a97-4efe-b1f1-1ae2d6ec53ec`, with `com.yepwatch.app`, version 1.0.0 (17). The final capture script records native home screens without creating rooms or signing in. `store-simulator` builds a fresh simulator artifact and captures it; `store-capture-existing` captures the pinned artifact. Update that archive URL before reusing a different build. Download only the named screenshot PNGs for store use; private debug artifacts must not be committed or uploaded to the store.

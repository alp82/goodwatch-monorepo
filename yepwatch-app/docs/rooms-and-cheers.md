# Rooms and decision cheers

The approved Ledger home replaces the single recent-room shortcut. Active rooms stay on the main home; past decisions live in History. Names are remembered, Back preserves room membership, and explicit Leave keeps the existing dropped-place behavior.

The shared frame keeps the logo and people in the header. Back, the current view and quiet Undo live in the subheader. Mobile uses the available viewport; desktop has a centered, borderless frame with bounded height and aligned content/actions.

A final decision stays final. Back reviews the matches without voting or proposing. The owner can choose **Start again**, adjust the existing settings, and explicitly start a new round. Cancelling that settings view leaves the decision intact.

The final poster supports public cheers through the real gateway. Taps and holds throw randomized popcorn past the poster, with one smooth poster spring. When all non-dropped participants hold for 350 ms, Marquee lights appear. Releasing, backgrounding, leaving the view, a lost connection or expired evidence ends the hold. There is no Projector or explanatory cheering count.

Cheering is temporary activity, not a vote or agreement. New clients opt in; older installed builds remain compatible. Seeds synchronize decorative compositions, and each participant counts once regardless of open sessions. Reduced motion uses still feedback. Native and web use React Native primitives, not the prototype's DOM animation code.

## Local checks

```sh
cd yepwatch-app
npm ci --install-links
npm run typecheck
npm run lint
npm test
npx playwright test
```

Gateway checks use isolated fixtures and a disposable broker:

```sh
cd yepwatch-realtime
npm ci
npm run build
YEPWATCH_TEST_VALKEY_IMAGE=valkey/valkey:8.1 npm test
```

The design references remain preserved on `prototype/yepwatch-your-rooms` at `adf5467e3` and `prototype/yepwatch-cheering`; no prototype controls, synthetic peers or fixture availability are part of the release. Release build/deployment results are recorded separately in `artifacts/releases/build-15.json` once completed.

# YepWatch usage analytics

Rybbit is self-hosted at https://a.seen.is. Production web uses site
`b28bba760aaf`; Android and iOS share mobile site `96d946d8bf70`
(`com.yepwatch.app`). No secret API key belongs in the app.

`src/core/analytics.ts` is the product entry point. `analytics-policy.ts` maps
routes to named screens and accepts only a fixed event vocabulary. Screen views
start after the boot cover and room restoration finish. Taste mode is a separate
screen; auth callbacks, previews and unknown routes are excluded. Consecutive
views of the same named screen are deduplicated, including navigation between
two rooms on the same screen.

Events are `room_created`, `room_joined`, `room_returned`, `round_started`,
`vote_submitted`, `proposal_submitted`, `agreement_submitted`,
`match_interest_changed`, `match_confirmation_submitted`, `favorite_submitted`,
`room_left`, and native `app_open`. Room creation/join events describe completion of the
local admission workflow; command events describe a successful command response.
These are best-effort client events, not exact counts of unique server records.
Retries, recovered admissions, blocked requests and offline devices can affect
totals. Agreement submissions do not mean the whole room reached a decision.

No event properties carry room/participant/account IDs, invitation tokens,
credentials, names, ideas, titles, vote direction, agreement direction, or
error messages. Query strings, fragments and referrers are not sent. `/room/:id`
becomes `/room`; `/r/:invite` becomes `/invite`. Rybbit still receives network
connection information and platform details to derive visitor/device statistics.

The web adapter calls Rybbit's public ingestion API directly, with credentials
omitted and `referrerPolicy: no-referrer`. It writes no visitor identifier and
does not load the automatic tracking script. This deliberately avoids replay,
DOM, form, URL-parameter and error collection, even if those features are on in
the site's dashboard. Browser opt-out flags `disable-rybbit` in localStorage and
`window.__RYBBIT_OPTOUT__` are honored. Remote dashboard tracking switches do not
control this explicit web adapter; use the build switch below to disable it.

Native uses the pinned official `@rybbit/react-native` SDK, manual safe screen
contexts and an independent anonymous installation ID in Expo SecureStore.
Local data erasure deletes that ID and resets the SDK. No account identification,
error tracking or route-parameter tracking is enabled. Native lifecycle events
come from the app's hook, rather than independent SDK listeners.

Development mode, fixtures, web hosts other than `yepwatch.com`, and builds with
`EXPO_PUBLIC_ANALYTICS_ENABLED=false` send nothing. Store screenshot profiles
disable analytics. The switch is read at build/export time; use it for any
additional automated or preview exports that target production hosts. Failed
requests never block product actions, and individual requests time out after
four seconds. The web adapter drops failures; the native SDK's queue is in
memory and is not a durable event log.

Verify with `npm run typecheck`, `npm run lint`, and `npm test` in `yepwatch-app`.
`tests/analytics.test.ts` exercises redaction, exclusions, failure isolation,
the web request and the actual native SDK against a mocked network. Release the
web export and mobile update through the normal YepWatch release process.
The SDK is JavaScript only: adding it left the locally calculated native
fingerprint unchanged against the task base. Compare against installed target
builds before publishing OTA (see `ota-updates.md`).
Bundle checks and mocked requests do not establish production ingestion: after
release, check actual web visits and a real device in Rybbit's live view.

References: [Rybbit ingestion API](https://rybbit.com/docs/api/sending-events),
[React Native SDK](https://rybbit.com/ko/docs/sdks/react-native),
[Expo screen tracking](https://docs.expo.dev/router/reference/screen-tracking/).

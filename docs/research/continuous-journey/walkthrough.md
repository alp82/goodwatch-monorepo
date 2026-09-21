# Continuous recommendation journey: browser evidence

2026-09-16. Supports [Verify guest and member journeys across discovery entry points](https://github.com/alp82/goodwatch-monorepo/issues/83) in [Deliver a continuous recommendation journey](https://github.com/alp82/goodwatch-monorepo/issues/82).

## Scope and method

Existing development server, `http://localhost:3003`, at checkout `7cab71eb21bd80ee23fb986ad8ebc78fb1242034`. Chrome DevTools MCP 1.3.0, invoked through its installed stdio server because this session did not expose its tools directly. Fresh isolated Chromium profile; desktop 1440×1000 and mobile emulation 390×844 with touch. These are local runtime observations, not production verification or physical-device testing. No app fixes or automated tests were added.

Initial guest state was empty. UI actions scored American Beauty 8, saved The Witcher with Want to See, and skipped Schindler's List. Country was changed to Germany through the title selector; Discover provider controls stored `8,9` (Netflix and Amazon Prime Video). Later controlled fixtures used real IDs from `/api/smart-titles`: 19 scores followed by one actual UI score to check the cap, and five scores to inspect the first recommendation reveal. Fixture scores are synthetic, not user preferences or evidence of recommendation quality. No account data was changed.

## Reproduced observations

| Scenario | Viewport / steps | Observed result |
| --- | --- | --- |
| Homepage → Taste | Desktop: Start Taste Quiz; mobile: revisit homepage with progress | Homepage leads through `/taste` to `/taste/quiz`. Guest homepage still advertises starting and rating five movies when stored progress exists. |
| Guest actions and reload | Desktop: score, Want to See, Skip, then reload `/taste/quiz` | All three interactions survive in `onboarding_ratings` and appear in recent actions. Count is one rating, not three. Current unacted-on title changed from Eternal Sunshine to Succession after reload. |
| First recommendation reveal | Five-score fixture; desktop and mobile: Reveal, click Lucy | Both display recommendations, including Lucy and Twelve Monkeys. Clicking Lucy does nothing: same page, no dialog or new tab. The recommendation area has no title-detail links, save actions, or country/provider information. Only its surrounding Save My Taste link is present. See screenshots below. |
| Guest cap and dismissal | Desktop: 19-score fixture, Continue Rating Instead, score Saving Private Ryan 8 | At 20 scores, signup replaces the quiz. Maybe Later restores the quiz, but Skip immediately restores signup; storage stays at 20 interactions. Mobile reload also shows the cap prompt, and Maybe Later dismisses it. Mobile post-dismissal scoring/skip was not exercised. |
| Saved-title continuity | Desktop: `/wishlist` after Want to See in Taste | Says “You don't have any titles in your Wishlist.” The stored guest plan for The Witcher remains in browser storage. |
| Detail score and save | Desktop: `/movie/14-american-beauty`; mobile: `/movie/27205-inception?country=DE` | American Beauty's detail view says “What's your score?” despite the initial guest score. Want to See on both tested detail pages opens Please Sign In instead of storing a guest plan. Escape dismisses the desktop prompt. Rate This exposes the score selector; submitting a detail rating was not successfully exercised. |
| Mobile prompt geometry | Mobile: Inception → Want to See | Sign-in panel is 400px wide at x=-26 in a 390px viewport; its left border is clipped. Screenshot below. |
| Country/provider continuity | Desktop: title Show selectors → Germany; Discover → Streaming → Custom, edit providers; open Reacher | Browser storage contains `country=DE`, `withStreamingProviders=8,9`. Custom Discover URL carries both. Reacher detail arrival adds `?country=DE`. Inception's DE detail view displays Netflix plus other services, including Sky Go and WOW, rather than only the selected services. This records displayed offers, not provider playback verification. |
| Discover and return | Desktop: filtered Discover → Reacher → browser Back; mobile: direct filtered Discover | Discover results load in both widths; mobile document width is 390px. One desktop Back action goes from Reacher with `?country=DE` to Reacher without that parameter, not back to Discover. Full list/scroll restoration after further Back actions was not verified. |
| Search | Desktop: search Inception from Reacher | Search dropdown displays a correct Inception title link plus other matches. It exposes title links, not guest rate/save controls. The attempted result click was followed too quickly by viewport emulation to establish completed navigation; direct Inception navigation was verified separately. |
| Category/exploration arrivals | Mobile: `/movies` → Feel Good; desktop: direct `/movies/moods/feel-good`, `/shows` | Category navigation and populated exploration results load. Feel Good adds `?page=1`; it links to title details and Advanced Filters. On mobile, both Available on my Streaming Services and Show only what I didn't watch open sign-in prompts despite stored guest preferences/scores. Escape closes each. |
| Authentication entry and return context | Desktop header after client navigation; mobile detail prompt → Sign In; mobile Sign In → Sign Up | Header sign-in URL stays tied to the document's earlier page after client navigation (e.g. movie URL while on Discover, `/movies` while on Feel Good). A newly opened detail prompt correctly includes current title and country. Switching to Sign Up drops `redirectTo`; switching back also has a bare sign-in URL. Guest storage survives these unauthenticated route changes. |

Mobile auth interaction caveat: an initial tool click on Sign up landed on the fixed Movies bottom navigation. DOM hit-testing initially confirmed overlap, but after scrolling settled the link was reachable and worked. Treat this as a scroll/occlusion follow-up, not a permanent inability to sign up.

## Code-supported findings, not authenticated runtime verification

Paths below are relative to `goodwatch-webapp/app/` in the checkout above.

- `ui/taste/components/RecommendationSwiper.tsx`: desktop and mobile cards are plain image/text containers without navigation handlers. This explains the reproduced inert suggestions.
- `routes/api.guest-recommendations.ts` and `server/guest-recommendations.server.ts`: this recommendation path takes scored items and exclusions, with no country/provider input. It caps supplied scored items at 20. Eligibility needs an explicit watchability decision; displayed suggestions do not establish availability on selected services.
- `ui/taste/TasteQuiz.tsx` and `ui/taste/features.ts`: the 20-rating gate intercepts score, skip, and plan handlers. Dismissal is component state. The UI presents a next genre unlock at 30 while the guest cap is 20.
- `ui/onboarding/hooks/useOnboardingStep.ts`: completed country and streaming onboarding returns before reading guest interactions. Existing completed accounts can therefore bypass this import path; actual account behavior is unverified.
- `routes/api.import-guest-interactions.ts`: imports scores, wishlist items, and skips using separate upserts in `Promise.all`. It does not import country, providers, or discovery context, and does not write watch history. Ordinary `ui/user/actions/ScoreAction.tsx` updates both score and watched state. Partial success, overwrite semantics, and recovery require account-backed verification.
- `ui/onboarding/hooks/useGuestRatingImport.ts`: successful import removes guest interactions and the legacy feature key and invalidates user data. Errors retain data; the banner exposes Retry. Successful retry and partial failure were not exercised.
- `ui/onboarding/hooks/useOnboardingActions.ts`: continuing from import uses guessed country or US. `StreamingSelector.tsx` can preselect browser-stored providers. Do not generalize this to a verified migration of all preferences.
- `ui/auth/SignInButton.tsx`: captures return URL only on mount. `ui/auth/CustomAuthForm.tsx` links between sign-in/up without the return parameter, consistent with observations.

## Access limits and implications

No authenticated controlled test account/session was available in the isolated browser. Signup was not submitted and no confirmation email was sent. New-account import, existing-account merge, successful authentication return, other-device email confirmation, member Wishlist rendering, dismissal during import, and import failure/retry are **not verified**. No database credentials or existing personal browser sessions were used to impersonate an account.

The findings are sufficient to inform the progress, watchability, and connected-experience decisions. The most direct break is the inert recommendation reveal; guest state separation, signup return context, cap behavior, and mobile prompt placement also need explicit treatment. They do not establish recommendation quality, production failure rates, or abandonment. Authenticated handoff needs a separate controlled walkthrough before delivery can be accepted.

## Screenshots

- [Desktop recommendation reveal](desktop-recommendations.png)
- [Mobile recommendation reveal](mobile-recommendations.png)
- [Mobile detail save prompt](mobile-save-dialog.png)

Transient raw MCP call log: `/tmp/gw83-browser-log.jsonl` in the originating workspace. The report and screenshots carry the durable evidence; do not depend on that temporary log in later sessions.

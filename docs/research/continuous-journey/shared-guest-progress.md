# Shared guest progress and discovery continuity

Implemented for [Implement shared guest progress and discovery continuity](https://github.com/alp82/goodwatch-monorepo/issues/89). Account review/import and release remain separate delivery tickets.

## Storage and account-transfer contract

`app/utils/guest-progress.ts` is the browser interaction boundary:

- Keep the existing `onboarding_ratings` array. Each record has `tmdb_id`, `media_type` (`movie` or `show`), `type` (`score`, `plan`, `skip`), optional `score`, and `timestamp`. Identity includes media type; known retired movie IDs normalize through the existing title-identity mapping. Reads validate and collapse duplicate identities. Existing score-only records are recognized.
- `readGuestInteractions` / `useGuestInteractions` provide the current browser snapshot. Writes replace the title's previous interaction. Removal only removes the matching interaction type. Same-document subscribers update immediately; this adds no cross-tab synchronization promise.
- `canGuestRate` / `updateGuestInteraction` enforce twenty current distinct ratings. Edits and non-score interactions remain available. Failed storage writes retain in-memory progress; browser persistence requires functioning browser storage.
- `snapshotGuestProgress` returns interactions plus existing browser `country`, `withStreamingProviders`, and raw discovery/Taste/search snapshots. Account-transfer code should capture these before changing account preferences. No member data is copied into this store.
- `clearGuestProgress` is the completed-transfer/explicit-decline cleanup interface. It clears interactions and guest unlock/reminder state, retaining country/services and discovery/search context. Do not call on authentication, failed/partial transfer, or review dismissal. The account-transfer delivery ticket must replace its legacy direct cleanup with this interface after confirmed success.

Persistent discovery keys: `goodwatch_discovery` holds per-URL scroll positions, per-path last URL, and the last discovery target; `taste_exploration` holds loaded exploration titles, current rating queue, selected title, view, filters and carousel index; `goodwatch_search` holds the search query. The old tab-local Taste snapshot is read as a migration fallback. Auth/account pages do not overwrite the last discovery target. Re-entering a bare listing restores its saved query; explicit query navigation and clearing filters on the same page remain possible. This restores context, not an immutable recommendation list.

## Runtime verification, 2026-09-18

Chrome DevTools MCP against the existing `http://localhost:3003` server, desktop 1440px and mobile 390px. Guest browser context isolated from the authorized authenticated fixture. Threshold setup used controlled browser-storage fixtures, followed by actual UI actions; no automated tests were written.

- Direct Matrix details arrival: Want to See stored one plan; rating 8 replaced it and immediately displayed My Score 8. Want to See then replaced the score and appeared as a hydrated Matrix card in Wishlist.
- Taste → A Clockwork Orange details → rate 7 → Taste: same current card restored, with shared rating. Ordinary reload and a subsequent bare Taste visit preserve the queue, beyond the explicit resume link.
- Twenty-rating fixture: a distinct Matrix rating opened the limit explanation without adding a score. Existing A Clockwork Orange score changed 7→9 with no prompt. Want to See and Skip worked at the cap; replacing the rated title with a plan lowered count to nineteen.
- Reminder appeared at ten current ratings. Dismissal survived subsequent navigation/reload. Mobile Taste Skip at twenty replaced the current score, reduced count to nineteen, and advanced from A Clockwork Orange to Ozark.
- Mobile Wishlist rendered movie A Clockwork Orange and show Game of Thrones with real posters, titles, scores, and correct `/movie`/`/show` links. Details and Wishlist had document width 390 at a 390px viewport.
- Discover retained `sortBy=release_date&type=movie&country=DE` and scroll 650 through reload and details/back. A subsequent bare Discover visit restored the same query and scroll. Search `Matrix` survived a full navigation/reload.
- Existing member fixture: Game of Thrones retained score 8, watched state, and Wishlist simultaneously. Authenticated Wishlist rendered its show card/score alongside existing movie entries; guest replacement semantics did not overwrite member library behavior.
- Mobile Wishlist Lighthouse: accessibility 91, best practices 92, SEO 100. Existing shared navigation link names/contrast, third-party console/inspector findings remain; no performance score was collected by this MCP audit. Local reports: `/tmp/goodwatch-guest89-lighthouse/report.{json,html}`.
- Repository typechecking remains blocked by existing diagnostics. No automated tests or deployment performed.

## Limits and next ownership

Existing member server mutations and independent library flags are retained. Review/import conflict selection, new-account preference transfer, retry/partial-import recovery, cross-device email explanation, and successful handoff cleanup are owned by [Implement confirmed account transfer and recovery](https://github.com/alp82/goodwatch-monorepo/issues/90). Watchability/freshness and production acceptance remain in their existing map tickets. Wishlist metadata hydration intentionally uses public title data; its pre-existing streaming filter UI remains disabled.

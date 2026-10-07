# Member data caches

What the webapp caches per member, how long, and which write resets it. The reset guarantees are in
[ADR 0006](adr/0006-reset-markers-for-the-data-cache.md). Who a request belongs to is in
[member-session.md](member-session.md).

## Rules

- A request without a member reads nothing: `getUserData` and `getUserSettings` return their empty value before any
  cache or Crate call.
- Every member cache is keyed by the user ID alone and is declared with `declareResettableCache`.
- A write resets after `REFRESH TABLE`. The user data reads filter by `user_id`, and Crate shows a write to such a read
  only after a refresh. Without it, a read between the write and Crate's own refresh would store the old rows.
  `resetUserDataCache` and `resetUserSettingsCache` run the refresh themselves, so a write path only calls the reset
  after its last write. If the refresh fails, the reset still runs, and a second reset follows 2 seconds later.
- Member responses stay `private, no-store`. These caches hold data, never HTML.

## Caches

| Cache | Key | Fresh | Stale | Holds |
| --- | --- | --- | --- | --- |
| `user-data-v2` | user ID | 5 minutes | none | Scores, Want to See, the watch state, favorites, skipped, Not interested |
| `user-settings` | user ID | 5 minutes | none | Country, services, onboarding state, For you |
| `share-profile-by-user-v1` | user ID | 5 minutes | none | The member's handle, or that there's none |
| `share-profile-page-v1` | handle | 10 seconds | 10 seconds | A public profile: handle, public lists, their titles. The short lifetime bounds an old anonymous profile page, see [page-cache.md](page-cache.md#share-list-pages) |
| `onboarding-media` | user ID, search text | 0 | none | Not cached: only the rating quiz reads it |

Five minutes bounds what a reset can't reach: a write that timed out and lands later, a change made in Crate by hand,
an old build that writes without a reset during a deploy, and a reset that Valkey didn't confirm. The
deleted-titles job leaves user tables alone. Two jobs in `goodwatch-flows` write a member's watch log without a
reset, the migration of the watch history and the job that fills a Seen press once a show has an episode list
([the data model](implementation/tracking/data-model.md), section 6); the five minutes bound those too.

The watch state is `user-data-v2` since `watched` became `watchState`: the build before and this one can't read
each other's entries, and both answer for a moment while a deploy rolls
([the switch](implementation/tracking/switch-to-the-watch-state.md)). `resetUserDataCache` refreshes `user_score`,
`user_wishlist`, `user_watch_log`, `user_watch_state`, `user_favorite`, `user_skipped` and `user_not_interested`.

## Write paths

| Write | Where | Resets |
| --- | --- | --- |
| Rate, change, or remove a score | `updateScores`, which also sends tracking the `rate` event | `user-data-v2` |
| Want to See | `updateWishList` | `user-data-v2` |
| Favorites | `updateFavorites` | `user-data-v2` |
| Not interested | `updateSkipped` | `user-data-v2` |
| Every tracking event: a watch, the Seen press, a date in the log | `applyTrackingEvent` | `user-data-v2` |
| Today's Seen button | `updateWatchHistory`, through `applyTrackingEvent` | `user-data-v2` |
| "I watched it" and its undo | `finishTitle`, `undoFinishTitle`, through `applyTrackingEvent` and `updateWishList` | `user-data-v2` |
| IMDb import and its undo | `ratingsChanged` in `imdb-import/apply.server.ts`, after the movies are settled | `user-data-v2` |
| Guest progress transfer | `resetGuestImportCaches` | `user-data-v2`, `user-settings` |
| Delete a member's tracking data | `deleteTrackingData` | `user-data-v2` |
| Save settings | `setUserSettings` | `user-settings` |
| Create, edit, show or hide, delete, restore a list | `resetListView` | The list view, the owner's two profile caches |
| Claim a handle, delete account data | `claimHandle`, `deleteAccountData` | Every list view of the owner, both profile caches |

The owner of a profile reads their lists from Crate on every view, so they see their own writes even when a reset is
unconfirmed.

## The browser

The root loader holds the member and their user data. It runs for a full page load and after a sign-in or sign-out,
not for a navigation (`app/utils/root-revalidation.ts`). After that, the browser's `user-data` query is the copy the
page shows: a mutation updates it at once, and it refetches `/api/user-data` when it's older than a minute and a
component asks for it, or when the tab becomes visible again.

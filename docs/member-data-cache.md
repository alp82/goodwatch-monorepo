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
| `user-data` | user ID | 5 minutes | none | Scores, Want to See, watched, favorites, skipped |
| `user-settings` | user ID | 5 minutes | none | Country, services, onboarding state, For you |
| `share-profile-by-user-v1` | user ID | 5 minutes | none | The member's handle, or that there's none |
| `share-profile-page-v1` | handle | 5 minutes | 5 minutes | A public profile: handle, public lists, their titles |
| `onboarding-media` | user ID, search text | 0 | none | Not cached: only the rating quiz reads it |

Five minutes bounds what a reset can't reach: a write that timed out and lands later, a change made in Crate by hand,
an old build that writes without a reset during a deploy, and a reset that Valkey didn't confirm. No job outside the
webapp writes these tables: `goodwatch-flows` has no writer, and the deleted-titles job leaves user tables alone.

## Write paths

| Write | Where | Resets |
| --- | --- | --- |
| Rate, change, or remove a score | `updateScores` | `user-data` |
| Want to See | `updateWishList` | `user-data` |
| Favorites | `updateFavorites` | `user-data` |
| Not interested | `updateSkipped` | `user-data` |
| Watched | `updateWatchHistory` | `user-data` |
| "I watched it" and its undo | `finishTitle`, `undoFinishTitle` | `user-data` |
| IMDb import and its undo | `ratingsChanged` in `imdb-import/apply.server.ts` | `user-data` |
| Guest progress transfer | `resetGuestImportCaches` | `user-data`, `user-settings` |
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

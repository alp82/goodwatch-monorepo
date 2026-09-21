# Loading personal title state

Source audit: 2026-09-15. Proposal, not an implementation. Database measurements are separate.

## Conclusion

The browser does not inherently need every score, review, watch-history entry, wishlist entry, favorite and skipped title. Current components share one full-data query as a convenience. Prefer server rendering with authentication plus state for the initially rendered titles, followed by fetching batches for additional titles as they appear. Fetch aggregate counts and paginated collections separately. Downloading everything in the background is possible as a temporary migration step, but preserves unnecessary work and creates synchronization problems.

## What consumers actually need

| Consumer | Current dependency | Smallest useful replacement |
| --- | --- | --- |
| Header | Browser-resolved authentication | Server-verified user identity and avatar URL |
| Title controls and cards | Full `UserData` via score/flag accessors | Score and wishlist/watched/favorite/skipped flags for displayed titles |
| Home/taste progress and feature unlocks | `Object.keys(scores).length` | Rating count |
| Recent taste actions | Scan/sort all scores, wishlist and skipped entries; take five; then request title metadata | Latest five relevant actions with title metadata |
| Wishlist route | Enumerates the entire wishlist map | Server-filtered/sorted page of wishlist titles |
| Discovery filters and recommendations | Already query personal data on the server | Keep server computation; return state for result titles |

Sources: [auth](../../goodwatch-webapp/app/utils/auth.ts), [accessors](../../goodwatch-webapp/app/hooks/useUserDataAccessors.ts), [TasteProfile](../../goodwatch-webapp/app/ui/taste/TasteProfile.tsx), [recent actions](../../goodwatch-webapp/app/ui/taste/hooks/useRecentActions.ts), [wishlist](../../goodwatch-webapp/app/routes/wishlist.tsx), [discovery joins](../../goodwatch-webapp/app/server/discover.server.ts), [recommendations](../../goodwatch-webapp/app/server/user-recommendations.server.ts), [quiz selection](../../goodwatch-webapp/app/server/onboarding-media.server.ts).

Additional observations:

- The [full-data getter](../../goodwatch-webapp/app/server/userData.server.ts) runs five queries in parallel, includes every review and action timestamp, and disables server caching (`ttlMinutes: 0`). No current browser reader of `ScoreData.review` was found. Ordinary badges need neither review text nor timestamps.
- [Taste's loader](../../goodwatch-webapp/app/routes/taste._index.tsx) fetches full data during prefetch, then fetches it again solely to derive the rating count.
- The homepage already has a [bounded watchlist query](../../goodwatch-webapp/app/server/watchlist-items.server.ts), which demonstrates that full collection download is unnecessary. It needs pagination/sort/filter extensions for the dedicated wishlist page.
- The existing wishlist route cannot simply receive a partial map: it treats that map as the whole collection. Its map conversion also discards media type and does not supply the metadata later needed by cards. A collection endpoint should return complete card records, preserving `movie` versus `show`.

## Proposed loading sequence

1. **Initial request:** resolve the verified user once per request, share identity with the initial browser auth state, and load personal state for the detail title or first result batch. On a detail page the ID is already in the URL; list-page IDs become available after their title query. Fetch counts only on routes that display them.
2. **Initial render and hydration:** render the avatar and known personal state into HTML, then hydrate the same query keys into the browser cache. The app already has a [HydrationBoundary and 60-second stale time](../../goodwatch-webapp/app/root.tsx). TanStack documents this exact prefetch/dehydrate/hydrate pattern, including Remix, and recommends request-isolated caches and a positive stale time to avoid an immediate duplicate fetch. [Official SSR guide](https://tanstack.com/query/latest/docs/framework/react/guides/ssr).
3. **Afterward:** obtain personal state alongside subsequent result pages, carousel batches, search results and next quiz items. Optionally prefetch the next batch near the viewport or on navigation intent. SSR cannot know the precise client viewport reliably; use the first rendered page/batch, then client visibility signals.

This is one React hydration followed by incremental data fetching; it does not require a second React hydration or streaming infrastructure. Public title information can retain independent server caches, while personalized HTML/loader responses need private caching. [Current route headers](../../goodwatch-webapp/app/routes/wishlist.tsx) declare shared caching, and [server auth](../../goodwatch-webapp/app/utils/auth.ts) collects refreshed cookies without returning them; both need correction before expanding personalized SSR.

## Cache contract and migration complexity

**Do not put a partial map under the existing full-data key.** [The current key](../../goodwatch-webapp/app/routes/api.user-data.tsx) is only `['user-data', userId]`. Counts would become subset counts, unloaded titles would look unmarked, and a fresh partial value could suppress the intended full fetch. TanStack requires keys to uniquely describe the data, including parameters that change the result. [Official query-key guide](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).

Recommended shape: a batch endpoint returns a complete state object for **every requested composite title key**, including explicit null score and false flags when no interaction exists. Normalize into per-title cache entries such as `['user-data', userId, 'title', mediaType, tmdbId]`; keep counts, recent activity and collection pages under separate keys in the same user namespace. Batch network requests at the page/list boundary to avoid one request per card. A simpler batch-key cache is possible, but mutations must update every cached batch containing the title. This cache design is a proposal inferred from the app's consumers.

**Unknown must differ from false.** [Current accessors](../../goodwatch-webapp/app/hooks/useUserDataAccessors.ts) return false/null when no query data exists. With incremental loading, absence means “not fetched yet” until a title response explicitly confirms no interaction. Show pending state for unknown titles and avoid choosing add/remove actions from an assumed false flag. Keep errors distinct from an empty collection.

**Mutations are the main refactor.** [Optimistic hooks](../../goodwatch-webapp/app/hooks/useUserDataMutations.ts) snapshot and replace the full map and cancel its query. [Legacy API actions](../../goodwatch-webapp/app/utils/api-action.ts) invalidate and explicitly refetch the whole namespace; they also disable controls whenever any user-data fetch runs. Replace this with title-specific pending/update behavior and targeted invalidation of counts, recent actions and affected collection pages. A background fetch must not overwrite a newer optimistic change. TanStack's documented pattern cancels outgoing reads, snapshots, rolls back errors and invalidates on settlement. [Official optimistic-update guide](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates).

Avoid whole-account rollback for concurrent title mutations; reconcile only the affected record and relevant aggregates. A count increments only when a previously absent score becomes present, not when changing an existing score. Propagate cancellation through batch fetches and guard delayed responses against changed accounts. Preserve namespace cleanup on [sign-out](../../goodwatch-webapp/app/ui/auth/SignOutLink.tsx).

## Assessment

Scoped SSR is feasible within the existing framework. The query itself is a contained change; the broader effort is migrating cache semantics, mutations, counts and collection consumers consistently. A temporary scoped-first/full-background mode still requires explicit coverage and safe merging, so it is not automatically the easiest option. Adopt full background loading only if measurement shows a worthwhile navigation benefit; no audited feature requires it as a permanent architecture.

This architectural conclusion does not establish that the current payload is the main performance problem. If the measured full payload and query cost are modest, sharing server-loaded authentication and hydrating the existing complete query can be the simpler first fix. That removes the browser authentication/data waterfall while preserving current consumers. Compare its added server response time with scoped loading before committing to the larger migration. Scope query performance depends on predicate/query shape, not just the number of returned rows; measure representative batches as well as one title.

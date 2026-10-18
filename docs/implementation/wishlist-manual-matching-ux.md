# Wishlist imports: matching titles yourself

Implementation dated 2026-10-18. This document describes the behavior as built. It extends the wishlist preview in [shared wishlist imports: UX](shared-wishlist-imports-ux.md) and replaces that document's decision 8. Only wishlist previews (source `wishlist`) change.

Scope: the rows that need matching are wishlist file entries whose file gives no type. The current experimental producer is a prototype Netflix reader in the browser extension (version 0.0.1); a live test is pending. Nothing in the product names Netflix or any other service as supported.

## Rules

1. **The member chooses every match.** No result is preselected, ranked, or applied automatically. That includes a single result whose title equals the file's.
2. **The file's evidence stays separate from the match.** The file's title, year, type, and ID show next to the chosen GoodWatch title and are never replaced by it. The UI shows nothing the server didn't send, so it never guesses a year, type, or poster.
3. **Only entries the server lists can be matched.** These are originally valid wishlist rows whose file gave no type (movie or show). Invalid and unsupported rows, and rows with a known type, can't be matched.
4. **One choice per entry.** The server groups rows that share a source, profile, and source ID into one entry. The UI sends the entry's `representativeIndex` and never groups rows itself. Rows without a source ID are separate entries, even with the same title.
5. **Counts change only on the server.** **Update preview** asks for a new preview, which the server classifies again. The member then confirms that preview with the existing **Add to Want to See**.
6. **Leaving an entry unmatched needs no action.** Unmatched titles aren't added.
7. **No provider claims.** The UI shows the source name and ID that the file contains, verbatim. It doesn't name supported services or show availability.
8. **Pending changes live in memory only.** Nothing goes to `sessionStorage`, `localStorage`, or the server before **Update preview**. The match queries use the app's default caching, with no custom `staleTime`.

## API used

| Call | Use in the UI |
| --- | --- |
| `summary.wishlistMatchCount` | The match block shows when it's above 0. It counts entries, including entries already matched, so the block stays after every entry is matched. |
| `GET /api/imports/:id/matches?offset=N` | The panel's entries, 50 per page: `{ groups, total, offset, hasMore }`. Each group has `representativeIndex`, `item`, `entryCount`, up to 3 `evidenceVariants`, and `hasMoreEvidence`. **Show more** loads the next page. The UI never fetches every page up front. |
| `GET /api/imports/:id/matches?entry=ROW` | `{ group }`: the entry that holds any eligible row, including a repeated row or an entry on a page that isn't loaded. Used by **Change** in the outcome lists. |
| `GET /api/imports/:id/matches?index=I&q=Q[&type=movie\|show]` | One entry's search in the local GoodWatch catalog. Returns up to 20 titles with `mediaType`, `tmdbId`, `title`, `year`, and `posterPath`. `q` is 2 to 100 characters. There's no year filter. |
| `POST /api/imports/:id/resolve` | `{ choices: [{ index, target: { mediaType, tmdbId } \| null }] }`, 1 to 100 changes. Null clears a match. Entries left out keep their match. Returns 201 with `{ import, parentImportId }`. |
| `item.wishlistResolution` | The match a preview holds: canonical `title`, `year`, `mediaType`, and `tmdbId`. |
| `item.wishlistOriginal` | The file's own row, used for the evidence. |
| Errors | New matching errors return `{ error, code }`. The UI branches on `code` and shows the text for that code from `app/domain/wishlist-match-copy.ts`, never a code. |

The parent preview isn't deleted or locked. Each preview can be confirmed on its own, for example from another tab. The UI leaves the parent and shows the new preview.

## Where it appears

The block sits between the Seen fieldset and **How titles compare**, only when `summary.wishlistMatchCount > 0`:

> **Titles GoodWatch couldn't match**
>
> Your file doesn't say whether these {n} entries are movies or shows, so GoodWatch didn't match them on its own. You can find each one yourself. Titles you don't match aren't added.
>
> [**Match titles**]

With one entry, the text reads "this entry is a movie or a show … match it … find it yourself".

**Match titles** loads the panel's code on first use (`lazy` with `reloadOnStaleChunk`, preloaded on pointer enter or focus). The list loads only then. The button turns into **Hide matching** (`aria-expanded`). Hiding the panel keeps it mounted and keeps every pending change.

## Match panel

Heading **Match titles** (`h4`) takes focus when the panel opens or is shown again.

### Entry

| Part | Content |
| --- | --- |
| Line 1 | The file's title, or **No title in your file** |
| Line 2 | Year if the file has one, **Type unknown**, **ID {sourceId}**, and **Listed {n} times** when the entry has more than one row |
| Line 3 | **Your match:** {Title} ({year}) · {Movie or Show}, **Match removed**, or **Not matched**. A pending change adds **· Not in this preview yet**. |
| Note | "You also chose this title for "{other}"." or "… for {n} other entries." when shown entries share a chosen title |
| Buttons | **Find a match**, or **Change** and **Clear** |

Accessible names: "Find a match for {title}", "Change the match for {title}", "Clear the match for {title}".

Under the list: **Show more** while the server has more pages, and "Showing {shown} of {total}", where `total` is the server's count.

### Entry, open

1. **From your file** (definition list): Title, Year, and Type (**Not in your file** when missing), and ID as "{sourceId} ({source})". For more than one row: "Listed {n} times in your file. Your match applies to every one." and the server's evidence variants, plus "Other spellings too" when `hasMoreEvidence`. When the source URL is `https:`, a link **Open on {host} (new tab)**.
2. **Search form** (`role="search"`): field **Search GoodWatch** (prefilled with the file's title, `maxLength` 100), type radios with legend **Show** (**Movies and shows**, **Movies**, **Shows**, default **Movies and shows**), and **Search**. The file's title is searched once when the entry opens, if it has at least 2 characters. After that, a search runs only on **Search** or Enter.
3. **Results** (`fieldset`, legend **Which GoodWatch title is "{title}"?**): radio cards in the server's order, none checked. Each card shows the poster (46 × 69, `alt=""`, `tmdbFixedImage`, `loading="lazy"`), the title, and year · type. The card for the entry's current match says **Your match**.
4. **Use this match** (off until a card is checked) and **Cancel**.

**Use this match** closes the entry, moves focus to **Change**, and announces "Matched to {Title} ({year}), {movie or show}." **Cancel** or Escape closes the entry and moves focus to its toggle. **Clear** announces "Match cleared." and moves focus to **Find a match**. Arrow keys move the checked card but never commit a match.

### Search states

| State | Text |
| --- | --- |
| Under 2 characters | Type 2 to 100 characters to search. (No request.) |
| Searching | Spinner and **Searching** |
| Results | "{n} results." With 20: "Showing the first 20. Add more words from the title to narrow the search." |
| No results | No GoodWatch titles match "{query}". Try the original title, another spelling, or fewer words. If you can't find it, leave it unmatched. It won't be added. |
| No results with a type | The same, and **Search movies and shows**, which searches again without the type |
| Failed | The message for the error, with **Try again** |
| No title in the file | Your file has no title for this entry. Search by name, or open the link from your file to see what it is. (The link clause only when there's a link.) |

### Footer

- "{n} changes aren't in this preview yet. Update the preview to count them." (singular: "1 change isn't … count it.") Shown only with pending changes. The count is the number of pending changes in memory, not a count of matches on unloaded pages.
- **Update preview** (off without changes; pending text **Updating preview**) and **Discard changes**.
- Errors appear here (`aria-live="assertive"`). For codes `wishlist_preview_required`, `wishlist_snapshot_required`, and `wishlist_row_not_resolvable`, **Choose the file again** calls the preview's `onBack`.

## Limit of 100 changes

One update takes at most 100 changes. `choose()` in `WishlistImportPreview` enforces the limit for every caller:

- At 100 pending changes, an entry without a pending change can't take one. Its **Clear** is off, with `aria-describedby` pointing to the footer's "That's the most changes for one update. Update the preview to keep them, then match more." Its editor still opens and searches, but **Use this match** is off with the same sentence.
- An entry with a pending change can still change it, or go back to the preview's match, which removes the pending change.
- A rejected choice is announced with the same sentence instead of being dropped silently.
- Pending changes are never dropped or split into hidden requests to fit the limit.

## Locked while importing or updating

While **Add to Want to See** or **Update preview** runs, no match can change, because a choice made then would disappear with this preview. Every matching control is off: **Find a match**, **Change**, and **Clear** in the panel, the search field, type radios, result cards, **Search movies and shows**, **Use this match**, **Update preview**, **Discard changes**, and **Change** in the outcome lists. `choose()`, discard, update, and the outcome-list **Change** handler also return early. **Cancel** stays on, because closing an editor changes nothing.

While **Update preview** runs, **Add to Want to See** and **Choose another file** are off too.

## Pending changes and Confirm

A pending change is a choice that differs from the match the preview holds. Choosing the held match again removes the pending change. Changes live only in the preview component's memory:

- Hiding the panel, showing more entries, and opening an entry from the outcome lists keep them.
- A failed update keeps them, so **Update preview** can run again.
- A successful update shows the new preview, which holds them on the server.
- **Choose another file**, leaving Settings, and reloading lose them.

With pending changes, **Add to Want to See** is off with this reason (`aria-describedby="wishlist-import-unapplied"`): "Your matches aren't in this preview yet. Choose Update preview to add them, or Discard changes. Choosing another file or leaving this page discards them."

## New preview

On success, `useResolveWishlistImport` stores the new summary under its own detail key. `WishlistImportPreview` calls `onPreviewReplaced(next, { rewatchReset })`, and `SourceImportFlow` opens the new ID with focus. The new preview mounts fresh, so the Seen choice is back to **Leave them as Seen**. It shows under the intro:

> Updated with your changes. The counts include them.

When the member had chosen **Add them as Want to rewatch** with Seen titles present, it adds: "Your choice for titles you've already seen is back to Leave them as Seen." Nothing is confirmed automatically.

## Rows matched by you, in the outcome lists

`SourceItem` shows a row with `wishlistResolution` like this:

> **Game of Thrones** · 2011 · Show · **Matched by you** · [**Change**]
> From your file: GoT · Type unknown · ID 70305903

**Change** appears only in a preview with entries to match. It shows the panel and opens the row's entry:

1. When the entry is already shown, it opens at once.
2. Otherwise the panel asks `GET …/matches?entry=ROW` and shows **Opening the entry**. The answer opens the entry, after the loaded ones, without loading other pages. When **Show more** later loads that entry's page, the entry appears once, in its page position.
3. When the lookup fails, the panel shows the error's message with **Try again**, or **Choose the file again** for the restart codes, and focus moves to the heading. The request stays open until the entry opens.

Focus moves to the open entry's search field. Unmatched rows keep the existing **Search** link to Discover.

## Error messages

`app/domain/wishlist-match-copy.ts` maps every matching error code to the member's text in `WISHLIST_MATCH_ERROR_MESSAGES`. The backend's `WishlistMatchError` uses the same map. On the client, `request()` in `SourceImportHooks.ts` uses the text for any known `code`, so a member never reads a code or a different wording. `wishlistMatchErrorMessage(code)` returns null for unknown codes. `WISHLIST_MATCH_RESTART_CODES` lists the codes that offer **Choose the file again**. `ImportRequestError` keeps `status` (0 when offline) and `code`.

## Files

| File | Change |
| --- | --- |
| `app/domain/wishlist-match-copy.ts` | New. Error copy by code. |
| `app/ui/imports/WishlistMatchPanel.tsx` | New, lazy. Entries, entry lookup, editor, search, footer. |
| `app/ui/imports/WishlistImportPreview.tsx` | Match block, pending changes, the 100-change limit and lock in `choose()`, resolve mutation, Confirm gating, updated note. |
| `app/ui/imports/SourceImportHooks.ts` | `ImportRequestError` with copy by code, `useWishlistMatchGroups`, `useWishlistMatchEntry`, `useWishlistMatchCandidates`, `useResolveWishlistImport`. |
| `app/ui/imports/SourceImportCounts.tsx` | Matched-by-you rows, **Change**, and its lock. |
| `app/ui/imports/SourceImportPreview.tsx`, `SourceImportCurrent.tsx`, `SourceImportFlow.tsx` | Pass `onPreviewReplaced` and `updated`. |
| `app/ui/imports/wishlist-match-interaction.test-support.tsx` | Happy-dom flow with a stand-in network: paged list, entry lookup, search, resolve, held Confirm. |
| `app/ui/imports/WishlistImport.test.ts` | 16 interaction tests. |
| `app/ui/imports/wishlist-import-render.test-support.tsx` | Wraps the static preview in a `QueryClientProvider`. |

## Verified

`node --test app/ui/imports/*.test.ts`: 81 pass. The interaction tests cover the lazy entry, no automatic pick with one result, Escape and focus, a choice blocking Confirm, the payload with a null clear, a failed update keeping changes, the new preview resetting the Seen choice, authored copy for restart codes, every entry matched, **Change** from an outcome row, **Change** after **Hide matching** on another row and on the same row, **Change** on a repeated row and on an unloaded page (with a failed lookup and retry, and no duplicate after **Show more**), the lock during Confirm, the 100-change limit for **Clear** and **Use this match**, search only on submit, and the type-filter fallback. The tests run in happy-dom and click only visible buttons.

Chromium run, October 18, 2026: the real preview, lazy panel, and query hooks against synthetic API replies, at 390 px and 1280 px. It checked keyboard selection and focus, a failed update and its retry, the new child preview, loading, empty, and error states, and layout without horizontal overflow. The final stable rebuild passed the **Change**, **Hide matching**, **Change** regression at both widths. For the method and screenshots, see `wishlist-browser-validation/matching-browser-validation.md` in the validation checkout.

The Chromium run used no live provider, real account, or server-side matching, and didn't apply or undo an import.

## Open

- A screen reader run. No assistive technology has been tested.
- A run against the live server and providers: real matching, apply, and undo.
- A live run with the prototype Netflix reader's files.

## Release checks

Validated against main `6f0f3d01`: production build passes; all 25 changed TypeScript/TSX files pass Biome. Full suite: 3,490 tests, 3,487 pass, one failure, one skip and one existing TODO. The failure in `tv-title-render.test.ts` (rating-strip controls) reproduces on the clean main baseline. Typecheck reports the same 185 diagnostics as clean main, with no added or removed diagnostics after normalizing line locations. Public service tests cover derived preview, Confirm, receipts, and Undo, including separate original and selected identities; the real catalog candidate query also passed a bounded read-only integration check.

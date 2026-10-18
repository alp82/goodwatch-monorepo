# Wishlist imports: reviewing suggested matches

Implementation dated October 18, 2026. This document describes the behavior as built. It extends [matching titles yourself](wishlist-manual-matching-ux.md), which still holds for everything not named here. The design is [suggested matches review](../research/wishlist-exploration/automatic-matching-ux.md), first release. The evidence that shaped it is in [automatic Netflix wishlist matching: measured feasibility](../research/wishlist-exploration/netflix-automatic-matching-validation.md).

Only wishlist previews (source `wishlist`) change. See [release checks](wishlist-suggestions.md#release-checks) for validation and known baseline failures.

## Rules

1. **A suggestion counts only after the member accepts it.** Accepting creates a pending change, like a manual choice. **Update preview** sends it through the existing `POST /api/imports/:id/resolve`, and the new preview counts it. **Add to Want to See** stays the final confirm. Nothing resolves on its own.
2. **The only evidence is the Netflix ID.** The server suggests a title only when the file's own Netflix ID matches a Netflix link GoodWatch already has for one candidate. Every suggestion reads **Same Netflix ID as your file**. The UI claims nothing more: no "verified", no percentages, no "best match".
3. **The member's choices win.** A pending choice or clear always shows instead of a suggestion, including one that loads or reloads later. A match the preview already holds hides the suggestion.
4. **A failure is never "no match".** An entry whose suggestion page failed, or that the server couldn't check, reads **Not checked yet**, not **Not matched**.
5. **Every suggestion stays reviewable.** Each one shows next to the file's title, year, type, and ID, with a poster when the catalog has one. Each can be accepted, changed, or taken back before **Update preview**.
6. **Suggestions load on interaction only.** Nothing is asked for until the member opens the panel, and then only for the entries on loaded pages.

## API used

| Call | Use in the UI |
| --- | --- |
| `GET /api/imports/:id/suggestions?offset=N` | Suggestions for 10 entries in the order of `/matches`: `{ groups, total, offset, hasMore, nextOffset }`. Each group has `representativeIndex`, `state` (`suggested`, `manual`, `unavailable`, or `already_resolved`), and, when suggested, `proposal` (`mediaType`, `tmdbId`, `title`, `year`, `posterPath`). The UI asks for offsets 0, 10, 20, and so on, only up to the number of entries loaded from `/matches`. |
| `POST /api/imports/:id/resolve` | Unchanged. An accepted suggestion goes as `{ index, target: { mediaType, tmdbId } }`, the same as a manual choice. There's no separate basis for accepted suggestions. |

Types come from `WishlistSuggestion` and `WishlistSuggestions` in `app/domain/imports.ts`. The UI reads `reason` only to stay quiet: it never shows a reason code or the server's error text for suggestions.

## Loading

`useWishlistSuggestions` in `app/ui/imports/SourceImportHooks.ts` runs one query per page of 10, with these properties:

- **Sequential.** A page is asked for only after every page before it answered or failed. This also holds when **Try again** retries pages that aren't next to each other, such as offsets 0 and 20. A page that answered or failed stays enabled, so retrying an earlier page doesn't ask for it again.
- **Bounded by what's loaded.** The 50 entries of a `/matches` page mean 5 suggestion requests. **Show more** loads the next `/matches` page, and its suggestion pages follow. An entry that a **Change** in the outcome lists opened from outside the loaded pages gets no suggestion request. It's matched by hand as before.
- **Cancellable.** Each request passes TanStack Query's `AbortSignal` to `fetch`. When the preview is replaced, the panel unmounts and an open request is aborted. The new preview asks for nothing until its own panel opens.
- **No incidental refetch.** A preview never changes, so its suggestions don't either. The queries turn off refetching on window focus, reconnect, and mount, and retrying a cached failure on mount (`retryOnMount: false`). A member who leaves the page and comes back sees failed pages as **Not checked yet** until they choose **Try again**. Otherwise a stale cache would ask for every loaded page at once, up to 5 per `/matches` page. There's no custom `staleTime`. The key holds the import ID, the offset, and a retry round.
- **Partial answers.** An entry missing from a page that answered reads as unavailable.
- **Explicit retry.** **Try again** gives each page that failed, or that holds an unavailable entry, a new retry round. Those pages load again in turn. Other pages aren't asked again.

Hiding the panel keeps it mounted, so the pages already due keep loading one at a time and nothing is asked twice. Hiding never asks for a page of entries that isn't loaded.

Measured by the backend on the authorized 77-entry Netflix file: 75 suggested, 2 manual, 0 unavailable, in 8 suggestion pages.

## Where it appears

The block keeps its place and its condition (`summary.wishlistMatchCount > 0`):

> **Titles to check before you add them**
>
> Your file doesn't say whether these {n} entries are movies or shows, so GoodWatch didn't add them on its own. Review them to accept a match GoodWatch suggests or to find each one yourself. Titles you don't accept or match aren't added.
>
> [**Review matches**]

With one entry, the text reads "this entry is a movie or a show … add it … Review it … find it yourself". The button turns into **Hide matching** as before. The block shows no suggestion count, because the server doesn't send a total for suggestions.

## Panel

The heading **Review matches** (`h4`) takes focus when the panel opens, as before. The list keeps the file's order in one list. Rows don't move between sections when suggestions arrive, so an open entry and focus stay where they are.

Under the heading, in this order:

1. While any page loads: a spinner and **Looking for matches**.
2. When entries weren't checked: "GoodWatch couldn't check some titles for a match right now. You can still match them yourself. {n} titles weren't checked." and **Try again** (accessible name "Try again to check titles for a match"). This sits in an assertive live region.
3. When shown entries have no suggestion: "{n} titles have no suggestion. Match them yourself:" ("1 title has no suggestion. Match it yourself:") and one link-style button per entry, named by the file's title (accessible name "Match {title} yourself"). See [Entries without a suggestion](#entries-without-a-suggestion).
4. When there are suggestions to accept: "Each title shows what your file says next to the suggestion. Check them before you accept." and the bulk button.

When a load ends with suggestions, the polite live region says "GoodWatch suggested matches for {n} titles. Check each one before you accept it."

### Entry

Lines 1 and 2 are unchanged: the file's title, then year, **Type unknown**, **ID**, and **Listed {n} times**. A poster (46 × 69, `alt=""`) shows to the left when the row's suggestion or match has one.

| Row state | Line 3 | Buttons |
| --- | --- | --- |
| Suggested | **Suggested:** {Title} ({year}) · {Movie or Show} · Same Netflix ID as your file | **Accept**, **Change** |
| Accepted | **Your match:** {Title} ({year}) · {Type} · Accepted · Not in this preview yet | **Change**, **Undo accept** |
| Looking | Looking for a match | **Find a match** |
| Not checked (failed or unavailable) | Not checked yet | **Find a match** |
| Manual (no suggestion) | Not matched | **Find a match** |
| Chosen by hand, or already matched | As before | As before |

Accessible names: "Accept the suggestion for {title}", "Change the match for {title}", "Undo accept for {title}".

- **Accept** records the suggestion as a pending change through the same `choose` as a manual pick, with the same lock and 100-change limit. Focus moves to the row's **Change**. The polite region says "Accepted {Title} ({year}), {movie or show}."
- **Change** opens today's editor, prefilled with the file's title. A title chosen there replaces the suggestion.
- **Undo accept** takes back the pending change. Focus moves to the row's **Accept**. The region says "{title} isn't accepted anymore."
- Not accepting is the way to leave a suggestion out. An unaccepted suggestion is never added.

### Entries without a suggestion

With 75 suggestions and 2 exceptions, the exceptions would sit somewhere in a list of 77. The panel names them above the list instead of moving them:

- **Which entries.** Loaded entries whose suggestion state is `manual` and that have no pending change. Entries that weren't checked keep their own message and **Try again**.
- **When.** The list shows only when shown entries also have suggestions, and only for up to 10 exceptions. A file with mostly exceptions is already a list of them.
- **What a name does.** It opens that entry's search in place, in the main list, with focus in the search field. It works like **Find a match**.
- **When a name goes away.** After the member matches the entry or clears its change, the name leaves the shortcut list.

The main list keeps the file's order, so suggestion offsets, open entries, focus, and **Change** from the outcome lists work as before.

### Accepting all shown

The button reads **Accept the {n} suggestions shown**. It covers only loaded rows with a suggestion and no pending change. Rows the member already accepted, chose, or cleared are skipped.

- **Atomic.** `acceptAll` in `WishlistImportPreview.tsx` builds the whole next draft in one update. It either accepts every row or none.
- **Limit.** When the pending changes plus {n} pass 100, the button is off. "There's room for {r} more changes in this update, so GoodWatch can't accept all {n}. Update the preview first, or accept them one at a time." describes it (`aria-describedby`).
- **Announcement.** "Accepted {n} suggestions. They aren't in this preview yet." When rows the member changed were skipped, it adds "{k} you changed stay as you set them."
- **Focus and undo.** The button stays the same element when its label changes, so keyboard focus stays on it and never falls to the page. It becomes **Undo accept all** when nothing is left to accept, and **Accept the {n} suggestions shown** again after an undo. When more suggestions load after a bulk accept, both buttons show.
- **Undo accept all** takes back only the bulk accepts still pending as accepted. A row the member changed, cleared, or took back one by one after the bulk accept keeps its state. The preview tracks bulk ownership by row and drops a row from it on any later manual change. The region says "Took back {n} accepted suggestions."
- **Discard changes** also clears bulk ownership.

### Footer

The footer is unchanged except for its pending text:

- Only accepted suggestions pending: "{n} accepted suggestions aren't in this preview yet. Update the preview to count them."
- A mix: "{n} changes aren't in this preview yet, {x} of them accepted suggestions. Update the preview to count them."
- No accepted suggestions: as before.

## Unchanged

- Pending changes block **Add to Want to See**, with the existing "Your matches aren't in this preview yet" reason.
- While **Add to Want to See** or **Update preview** runs, every control is off: **Accept**, bulk accept, **Undo accept**, **Undo accept all**, **Try again**, **Change**, and the editor.
- The new preview remounts the preview component, so the draft, bulk ownership, and the panel reset, as before. Untouched suggestions are asked for again only when the member opens the new preview's panel.
- The Seen fieldset and Want to rewatch, library deduplication, the immutable preview chain, the receipt, and Undo import don't change.

## Code

| File | Part |
| --- | --- |
| `app/ui/imports/SourceImportHooks.ts` | `useWishlistSuggestions`, `WishlistRowSuggestion`, `sourceImportKeys.suggestions` |
| `app/ui/imports/WishlistImportPreview.tsx` | Block copy, `revert`, `acceptAll`, `undoAccepted`, bulk ownership |
| `app/ui/imports/WishlistMatchPanel.tsx` | Loading and failure states, bulk bar, entry line 3, **Accept** and **Undo accept**, footer text |
| `app/domain/wishlist-match-copy.ts` | `WISHLIST_SUGGESTION_COPY`, `wishlistSuggestionNote` |

## Tests

`app/ui/imports/WishlistImport.test.ts` drives the real flow in happy-dom through `wishlist-match-interaction.test-support.tsx`. The stub network answers `/suggestions` 10 at a time and can fail, hold, or leave out entries. The tests cover the following:

- Nothing loads until the panel opens.
- Requests carry a signal and arrive in pages of 10, one at a time.
- The suggestion shows with its poster and reason.
- **Accept**, **Undo accept**, and the resolve body.
- Bulk accept skips a manual choice.
- **Undo accept all** keeps changes made afterwards.
- The bulk limit.
- A failed page reads **Not checked yet**, without the server's text.
- **Try again** asks only for unchecked pages, and a manual match wins over a later suggestion.
- Loading state with manual matching.
- Cancellation on a new preview.
- The lock during **Update preview**.
- Paging with **Show more**.
- No requests for pages between when a **Change** opens an entry from elsewhere.
- No new suggestion requests when the tab regains focus or the connection returns, with the panel open or hidden.
- **Try again** on unchecked pages 0 and 20 asks for page 20 only after page 0 answers.
- After a remount that keeps the query cache, failed pages aren't asked for again until **Try again**, which still goes one page at a time.
- Keyboard focus stays on the same bulk button through accept and undo. A deliberate remount of the button makes this test fail.
- The names of entries without a suggestion, and opening one in place.

The support script writes its results and exits only after the pipe takes them all. Its output is larger than one pipe buffer, and exiting early cut it off intermittently.

## Known limits

- **No total.** The block and panel can't say how many suggestions the whole file has, only how many are shown.
- **One list, not two sections.** The design's **Suggested matches** and **Match these yourself** sections aren't built. One list in file order keeps rows from moving while suggestions load. The names of entries without a suggestion, listed above the entries, take the place of the second section.
- **No sticky footer on phones.** **Update preview** is at the end of the panel, as before.
- **No accepted basis.** Accepted suggestions reach the server as member choices. The outcome lists and receipt don't label them, and suggestion quality can't be measured from stored data.
- **No "suggested for another entry" note.** The built "You also chose this title for …" note covers accepted suggestions once they're pending. It doesn't name unaccepted suggestions that share a title.
- **Real-browser checks pass** in Chromium at 390 px and 1,280 px: keyboard exception navigation, manual corrections, bulk accept/Undo focus and preservation, pending Update/Confirm locks, retries, child-preview reset, Confirm/receipt/Undo, and successful/error cache behavior across focus, reconnect and remount. The harness renders the actual import components with synthetic API responses; source hashes confirm the tested bundle matches the final files. No console errors or horizontal overflow were observed. A screen-reader run remains open.

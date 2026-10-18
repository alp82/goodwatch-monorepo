# Wishlist imports: suggested matches review (UX design)

Design date: October 18, 2026. Updated October 18, 2026 with measured aggregate evidence. Status: design only. Nothing here is built.

Owner of this document: UX for wishlist imports. It proposes how the existing manual matching panel grows into a review of matches that GoodWatch suggests. The backend design is in [batch wishlist candidate matching](automatic-matching-backend.md). The [measured evidence](#measured-evidence-from-the-77-entry-sample) section sets the first release. The [later tiers](#later-tiers-not-in-the-first-release) section keeps the fuller design for when correctness is validated.

Inputs: [matching titles yourself](../../implementation/wishlist-manual-matching-ux.md) (as built), [shared wishlist imports UX](../../implementation/shared-wishlist-imports-ux.md) (decision 8, Netflix slice, prototype verdict), [identifier-free wishlist matching](identifier-free-wishlist-matching.md), [batch wishlist candidate matching](automatic-matching-backend.md), `CONTEXT.md`, and `goodwatch-webapp/app/ui/imports/` (`WishlistImportPreview.tsx`, `WishlistMatchPanel.tsx`, `SourceImportCounts.tsx`, `SourceImportHooks.ts`). This design used only the aggregate results reported for the authorized sample. No member file, capture, or per-row result was read for it. All titles in examples are invented.

## The problem

A member captured 77 titles from their Netflix list. The file gives no type and no year for any of them, so all 77 sit in **Titles GoodWatch couldn't match**, and the member has to search and choose 77 times. Most of that work is likely confirming the obvious. The design goal is to move the obvious work into a fast, explicit check and spend the member's attention on the rows that are really unclear.

## Measured evidence from the 77-entry sample

The backend ran candidate retrieval against an authorized 77-entry Netflix wishlist sample. The following table gives the aggregate results. No per-row data appears in this document.

| Step | Proposals |
| --- | --- |
| Canonical and original title retrieval (top 10 per type), joined with the exact Netflix ID parsed from GoodWatch's existing streaming links | 59 |
| Added by exact translation and `alternative_title` alias retrieval, joined on the same Netflix ID | 16 |
| **Total proposals backed by the file's own Netflix ID** | **75 of 77** |
| Rows with more than one ID-backed candidate (candidate-set collisions) | 0 |
| Rows without ID corroboration | 2 |

Other facts from the same run:

- The uploaded 77-entry JSON file has an unknown type and no year for all 77 entries. "Same title and year" can't be the main evidence.
- A separate, earlier saved Netflix HTML page gives a type and a year for 24 of the 77 entries. All 24 agree with the catalog proposals. That page is a cross-check only, not an input to the proposals.
- The 75 proposals need no new export or capture. They use only the Netflix ID and title from the uploaded JSON file, plus the local catalog. They don't need the HTML page.

What the run doesn't show:

- It isn't a global audit of Netflix ID to title collisions across the catalog. It checked collisions only inside each row's candidate set.
- It doesn't validate that GoodWatch's streaming-link data is correct.
- It isn't 75 verified matches. Nobody compared the proposals with the titles the member meant.

### What this means for the design

- **Suggested only.** All 75 proposals start as **Suggested**. None counts in the preview until the member accepts it. The first release has no **Matched by link** tier and no automatic resolution. Those wait for the collision audit and a member-reviewed correctness check.
- **Bulk acceptance is worth building.** 75 of 77 rows are in one tier, so a reviewed "accept these" action saves the most work.
- **Inline candidates aren't needed yet.** With 0 collisions, no row in the sample needs a choice between candidates. The 2 exceptions go to today's manual editor.
- **The evidence wording changes.** The proposals rest on the Netflix ID, not on title and year. The reason text says so.

## Principles

These carry over the built rules and add what suggestions need.

1. **Suggest, don't decide.** GoodWatch proposes a match. A proposal never counts in the preview until the member accepts it. In the first release this holds for every row, including rows backed by a Netflix ID.
2. **Say why, not how sure.** Each proposal shows the evidence that produced it, in words. The UI shows no percentages, scores, stars, or "best match" labels. Nothing implies a probability that nobody measured.
3. **No popularity tiebreak.** When several titles share a name, GoodWatch doesn't pick the popular one.
4. **The file's evidence stays visible.** The file's title, year, type, and ID show next to every proposal and every match, unchanged. This is rule 2 of the built panel.
5. **Confirmation stays explicit.** Accepting proposals creates pending changes. **Update preview** puts them in a new preview. **Add to Want to See** imports. Nothing imports on its own, and nothing is skipped silently.
6. **Every proposal stays reviewable.** Each one is visible as its own row before and after acceptance, and each one can be changed or undone before **Update preview**.
7. **Minimal change.** Keep the block, the panel, the editor, the footer, the 100-change limit, the lock, the immutable preview chain, and Undo.

## First release: suggestions plus manual exceptions

### The block

The block keeps its place between the Seen fieldset and **How titles compare**. Counts come from the server and each line hides when its count is 0.

> **Titles to check before you add them**
>
> Your file doesn't say whether these 77 entries are movies or shows. GoodWatch suggested a match for {s} of them by their Netflix ID.
>
> - {s} suggested. Check them, then accept.
> - {m} to match yourself.
>
> Titles you don't accept or match aren't added.
>
> [**Review matches**]

The button replaces **Match titles** and keeps its behavior: lazy load, `aria-expanded`, **Hide matching** when open, and pending changes kept while hidden.

Suggestions come from a separate paged request after the preview loads (the backend's proposed sidecar). The preview never waits for them. If the suggestion count isn't known yet, the block shows today's text with **Review matches**, and the panel loads suggestions when it opens. If the suggestion request fails, or returns no suggestions, the block and panel fall back to today's text, **Match titles**, and today's manual list.

### The panel

The panel heading **Review matches** (`h4`) keeps taking focus on open. Under it are two sections, in this order, each with its own heading and count. There's no filter in the first release.

1. **Suggested matches ({s})**
2. **Match these yourself ({m})**

The sections are list headings, not tabs. The member scrolls through suggestions first because that's where most rows are.

### Suggested entry

Each entry keeps the built three lines. Line 1 is the file's title. Line 2 is the file's year, type, ID, and **Listed {n} times**. Line 3 holds the proposal.

> **Harbor Lights**
> No year in your file · Type unknown · ID 80054321
> **Suggested:** Harbor Lights (2016) · Show · Your file's Netflix ID links to this title · [**Accept**] [**Change**]

When the proposal came through a translated or alternative title, the reason adds the matched name, so a member can see why a different title appears: **Suggested:** Lights on the Harbor (2016) · Show · Your file's Netflix ID links to this title · Also known as "Harbor Lights".

After **Accept**, line 3 reads **Your match:** Harbor Lights (2016) · Show · **Accepted** · **Not in this preview yet**, with **Change** and **Undo accept**.

- **Change** opens today's editor: the **From your file** list, the search form prefilled with the file's title, and result cards. Choosing a result replaces the proposal with the member's choice.
- Not accepting is the way to leave a suggestion out. An unaccepted suggestion is never added. The first release needs no separate **Leave out** action.
- Every row shows its poster, title, year, and type, so the member can check each proposal before or after a bulk accept.

### Exceptions entry

Rows in **Match these yourself** keep today's entry with **Find a match** and today's editor. They show no proposal and no guess.

### Accepting suggestions in bulk

Suggestions load in pages from the server, using the backend's page size, with **Show more** and "Showing {shown} of {s}". Above the list:

> **Accept the {n} suggestions shown** · Each row shows what your file says next to the suggestion. Check them first.

- The action covers only loaded rows that the member hasn't accepted, changed, or chosen yet. It never covers unloaded pages. Its name says the count.
- It creates one pending choice per row. With 75 suggestions, a full accept fits in the 100-change limit of one update.
- When the remaining room is smaller than the count, the button is off and the footer explains the limit. It never accepts part of the list.
- After it runs, focus stays on the button, which becomes **Undo accept all** for that batch. The live region says "Accepted {n} suggestions. They aren't in this preview yet."
- Rows the member already changed keep their state. The announcement says so: "Accepted 47 suggestions. 3 you changed stay as you set them."

There's no bulk action for the exceptions.

### Footer and confirmation

The footer is unchanged, with one addition: the pending text names what's pending. "{n} changes aren't in this preview yet: {x} accepted, {y} chosen. Update the preview to count them."

**Update preview** sends every pending choice, accepted and chosen, through the existing explicit resolve request. The server creates a new immutable child preview with the counts. **Add to Want to See** then imports, as today. The member confirms twice: once to count the choices and once to add the titles.

On phones the footer sticks to the bottom of the panel's scroll area while the panel is open, so **Update preview** stays reachable during a long review. The list gets bottom padding equal to the footer's height, so the footer doesn't cover the focused row.

### States

| Moment | What the member sees |
| --- | --- |
| Preview loaded, suggestions loading | The block's text without counts. In the panel, the **Suggested matches** section shows **Looking for matches** and today's manual list stays usable. |
| Suggestions loaded | Counts appear. A polite live region says "Suggestions are ready for {s} titles." Nothing already chosen changes. |
| Suggestion request failed | "GoodWatch couldn't suggest matches right now. You can still match titles yourself." with **Try again**. Every untyped row behaves as today. |
| Some groups unavailable | Those rows join **Match these yourself** with **Not checked yet** on line 3. The section adds "{n} titles weren't checked." with **Try again**. |
| Bulk accept or **Update preview** runs | Today's lock: every matching control is off, **Cancel** stays on. |
| **Update preview** failed | Pending changes stay, including bulk accepts. **Update preview** can run again. |
| New preview | Today's note "Updated with your changes. The counts include them." Accepted rows now count as matched. Untouched suggestions stay suggestions. |

**Not checked yet** is separate from **No match found**. A row that matching couldn't reach must not read as "GoodWatch looked and found nothing".

### Immutable preview and Undo

- **Suggestions are a sidecar of one preview.** They don't change the preview. A suggestion becomes part of a preview only when the member accepts it and **Update preview** creates the child preview.
- **The server revalidates every accepted target** on each child preview, as it does for manual choices. Stale suggestion data never authorizes a missing target.
- **Receipt and Undo don't change.** Undo takes every title this import added off Want to See, whatever its basis.
- **The parent preview stays confirmable**, as today.

### Unchanged and skipped titles

- **Already on Want to See**: line 3 adds **Already on Want to See · No change**. Accepting it is allowed and harmless.
- **Seen**: a match to a Seen title follows the existing Seen fieldset. Line 3 adds **Seen · Stays Seen unless you choose Want to rewatch**.
- **Not interested**: follows the existing rule and copy.
- **Two entries, one title**: two Netflix IDs can link to one title. The built note "You also chose this title for …" also covers suggestions: "GoodWatch suggested this title for "{other}" too." Both rows stay visible. The title is added once.
- **Not accepted or not matched**: never added. The outcome lists keep them under unmatched with the file's evidence and **Search**.

### Accessibility

- Proposal, evidence, and pending state are always words on line 3, never color or an icon alone.
- Each entry is a list item whose accessible name includes the file's title. Button names include it too: "Accept the suggestion for Harbor Lights", "Change the match for Harbor Lights".
- After **Accept**, focus moves to the same row's **Change**, and the live region says "Accepted Harbor Lights (2016), show."
- Bulk results, suggestion arrival, and failures use the existing live regions: polite for progress, assertive for errors.
- Controls are at least 44 px tall. At 390 px wide nothing scrolls sideways. **Accept** and **Change** wrap below line 3 on narrow screens, **Accept** first.
- A screen reader run is still open for the built panel. Do it for this design before shipping.

### Smallest change from what's built

| Area | Change |
| --- | --- |
| Server | The backend's paged suggestions sidecar, read-only. Resolve, child preview, confirm, receipt, and Undo stay as built. |
| `WishlistImportPreview.tsx` | Block text with the suggested and manual counts, **Review matches**. Pending changes gain a kind (accept or choose) for the footer text. `choose()` keeps the limit and lock. |
| `WishlistMatchPanel.tsx` | Two sections, line 3 with the proposal, **Accept**, **Undo accept**, page-scoped bulk accept, sticky footer on phones. The editor, search, and footer logic stay. |
| `wishlist-match-copy.ts` | Reason text by evidence code and new error codes. The UI never builds a reason from free text. |

The first release doesn't need any of the following:

- **Matched by link** or any automatic resolution
- A **Leave out** action or a way to exclude a trusted row
- Inline candidate cards or a **Needs your choice** section
- A tier filter
- A new `wishlistResolution.basis` for accepted suggestions, or basis labels in the outcome lists and receipt
- **Stop looking**
- A new Netflix export or capture

## Later tiers (not in the first release)

The following parts of the original design stay valid. Build them only when the evidence calls for them.

| Tier or feature | Build it when |
| --- | --- |
| **Matched by link**: an ID-backed row counts before the member acts, can be changed or left out | The global Netflix ID collision audit is clean, and a member-reviewed check shows the ID-backed proposals are correct. Needs a resolve option to leave out a trusted row. |
| **Needs your choice**: inline `fieldset` of up to three candidates in neutral order (year, then type), **None of these**, **Use this match**, no bulk action | Real captures produce rows with more than one candidate. The sample had 0. |
| Title-only **Suggested** reasons, such as **Same title and year** | A file carries a year, and the year comes from the file, never inferred. The uploaded sample JSON had no year for any of its 77 entries. |
| Tier filter (radio group, **Needs your choice** first) | The panel has three or more nonempty groups. |
| **Suggested, accepted by you** labels in the outcome lists and receipt | The backend stores accepted suggestions as their own basis. This also supports measuring suggestion quality. |

Two rules hold for any later tier:

- **Downgrade, never upgrade.** If any check disagrees, the row drops a tier. A title-only result never becomes **Matched by link**.
- **Remakes are ambiguous by default.** When the same title exists with different years and the file has no year, the row needs a choice, whatever the popularity.

## Questions for the backend results

Answered by the sample:

1. **Tier rates.** 75 of 77 ID-backed proposals, 0 candidate-set collisions, 2 without ID corroboration. The first release is shaped around this result.
2. **Year source.** The uploaded JSON has no type or year for any of its 77 entries. A separate, earlier saved Netflix HTML page gives type and year for 24 of them, and all 24 agree with the proposals. The proposals depend on neither.
3. **When matching runs.** In a separate paged sidecar after the preview, not inside it.
4. **Change limit.** 75 accepted suggestions fit in one update of 100 changes, through the existing explicit resolve.

Still open:

1. **Correctness.** How often is an ID-backed proposal wrong when a member checks it? Is the Netflix ID ever reused, regional, or season-level in GoodWatch's streaming links? This decides whether **Matched by link** ever ships.
2. **Coverage beyond this sample.** Do other captures have collisions or more rows without ID corroboration? That decides whether **Needs your choice** is needed.
3. **Season and episode scope.** Can a Netflix ID point to a season? A season or episode must never become the whole show silently.
4. **Evidence codes.** The fixed set of reasons, such as Netflix ID through canonical title and Netflix ID through alias, so each one has authored text.
5. **Latency.** Time per page for 77 rows and for 1,000.
6. **Rematch on update.** Does the sidecar for a child preview return the same suggestions for untouched rows? Returning the same ones is easier to explain.

## Recommendation

Ship the first release as **Suggested** plus manual exceptions. Show the 75 ID-backed proposals as **Suggested** with the Netflix ID reason, per-row **Accept** and **Change**, and one bulk accept that covers only loaded rows. Send the 2 exceptions to today's editor. Keep every proposal visible and changeable, count nothing until **Update preview**, and keep **Add to Want to See** as the final confirm. Don't call any row matched, don't resolve anything automatically, and don't claim 75 verified matches. Add **Matched by link**, inline candidates, and the filter only after the collision audit, a member-reviewed correctness check, and wider samples call for them.

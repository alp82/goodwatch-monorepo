# Shared wishlist imports: UX

Status: first release implemented on branch `feat/shared-wishlist-imports`, 2026-10-18, not yet committed or deployed. Owner of this document: UX for wishlist imports. The [first release](#first-release-what-is-built) section describes the product as built. The [Netflix slice](#netflix-slice-designed-not-built) section is design only. Nothing in it is in the product.

Inputs: [native imports](native-imports.md), [shared wishlist format](shared-wishlist-format.md), [wishlist exploration](../research/wishlist-exploration/README.md) and its [alternative](../research/wishlist-exploration/alternative-routes.md), [browser](../research/wishlist-exploration/browser-routes.md), and [Watcharr validation](../research/wishlist-exploration/watcharr-validation.md) reports, [streaming watchlist research](../research/streaming-watchlist-imports.md), `CONTEXT.md`, and the Imports UI in `goodwatch-webapp/app/ui/imports/`.

Watcharr's unmodified pinned backend has now been run locally with synthetic accounts: its authenticated native export response is a regression fixture. The rendered Watcharr export dialog and real streaming accounts remain untested. See [runtime validation](../research/wishlist-exploration/watcharr-validation.md).

## Decisions

1. **One source row for both paths: Watcharr / wishlist file.** It uses backend source `wishlist`. Its upload reads the original `watcharr-export.json` and a wishlist file that another tool saved for GoodWatch. There is no second row, no format-specific history, and no `?source=` alias.
2. **The shared format stays out of the UI.** The product never says "format", "version", "schema", or "envelope". Technical details live in [the format doc](shared-wishlist-format.md).
3. **No streaming service row.** A source search for Netflix and other streaming services says GoodWatch can't import that list yet and points to Trakt, TMDB, and Plex. It no longer suggests Generic CSV.
4. **Ordinary members never paste scripts, use API keys, or convert files.**
5. **Wishlist imports only add.** Missing titles never remove anything. Every wishlist preview says so.
6. **Seen titles stay Seen by default.** Adding them as Want to rewatch is an explicit choice in the preview.
7. **Not interested follows the existing import rule.** Adding a title to Want to See takes it off Not interested, and Undo doesn't mark it Not interested again. Every wishlist preview says so, and the Undo result offers **Mark Not interested again** for each such title.
8. **No match editor.** Only ID matches and unique title-and-year matches of a known type apply. Other rows are unmatched, with a **Search** link.
9. **The wishlist preview is shorter** than the general preview. It hides the data-type checkboxes, the rating conflict radios, and the watch-date choice. Its button reads **Add to Want to See**, without a count.

## First release: what is built

### Source list entry

| Field | Value |
| --- | --- |
| Name (`IMPORT_SOURCE_NAMES.wishlist`) | Watcharr / wishlist file |
| Logo | None. Letter tile **W**. Watcharr publishes no brand terms. |
| Gets | Want to See |
| Wait | Right away |
| Search words | watcharr, self-hosted, planned, watchlist, json, wishlist |
| Position | After MovieLens, before Generic CSV |

"wishlist file" is lowercase everywhere, so it isn't read as the member's GoodWatch Wishlist.

### File recognition in the top box

`recognizeImportFile` reads the first 64 KB of a file that starts with `{` or `[`. A file within 64 KB is parsed whole. A longer one is judged by the start of its text. Recognition only routes the file. The server validates every field.

| What the file shows | Result |
| --- | --- |
| An object with `"format": "goodwatch-wishlist"` and `"version": 1` | **wishlist file**, sent to `wishlist` |
| The same with another version | Not recognized. "This wishlist file uses a newer layout than GoodWatch reads. Ask the maker of the tool that saved it for a file GoodWatch can read." |
| An array whose first row has a Watcharr `status` and a `content` or `game` object | **Watcharr export**, sent to `wishlist` |
| `[]` named exactly `watcharr-export.json` | **Watcharr export**. Watcharr refuses to export an empty list, so the name is required. |
| Other JSON, or JSON that doesn't parse | Not recognized. "GoodWatch reads JSON exports from Watcharr and wishlist files made for GoodWatch. Upload the file as you got it, without editing it." |

The catch-all hint now reads: "GoodWatch reads ZIP, CSV, XML, gzip, and JSON exports. Upload the file as the site gave it to you, without opening or renaming it."

The Watcharr recognition comment distinguishes synthetic runtime validation from a real member export.

### Upload panel

| Field | Text |
| --- | --- |
| Heading | Upload your Watcharr export or wishlist file |
| Instructions | From Watcharr: open Settings, choose Export, then choose Export in the Export Watched List window. Upload the watcharr-export.json file it downloads, without opening or editing it. |
| | From another tool: if a tool saved your list as a wishlist file for GoodWatch, upload that file as the tool saved it. |
| | Maximum size: 20 MB. |
| Notes | GoodWatch adds titles to Want to See and never removes titles that aren't in the file. From Watcharr, only movies and shows marked Planned are added. Ratings, other statuses, tags, and games aren't imported. |
| Hint | Drop watcharr-export.json or your wishlist file here, or choose it from your device. |
| Button | Choose JSON file |
| Wrong file | Choose watcharr-export.json from Watcharr, or a wishlist file made for GoodWatch. |
| Too large | That file is larger than 20 MB. Choose a smaller JSON file. |

The Watcharr labels come from its source code and weren't seen in a running app. Check them against a local Watcharr build before announcing the import.

### Preview

The general preview is unchanged. A preview with source `wishlist` shows, from top to bottom:

1. **Check before you import**, then "Here is what we found in **{file name}**. Nothing has been saved yet."
2. **About this file**: an amber box with the import's warnings, when there are any. The server adds a coverage warning when a file reports partial or unknown completeness, and Watcharr files always report unknown.
3. Two short lines, on every wishlist preview:
   - "Importing only adds titles to Want to See. It never removes anything from your Wishlist."
   - "Adding a title to Want to See takes it off Not interested. Undo takes the title off Want to See but doesn't mark it Not interested again."
4. **{n} titles you've already seen**, only when the preview has conflicts. For wishlist imports, a conflict means a matched title that is Seen in GoodWatch. It uses the existing `conflictChoice` option:

   | Radio | `conflictChoice` | Detail |
   | --- | --- | --- |
   | **Leave them as Seen** (default) | `keep` | They stay off your Wishlist. |
   | **Add them as Want to rewatch** | `source` | They go on your Wishlist to watch again. Nothing else changes. |

   With one title, the labels read "1 title you've already seen", **Leave it as Seen**, and **Add it as Want to rewatch**.
5. **How titles compare**: the outcome list with wishlist labels, and the total **Entries in your file**.
6. **Add to Want to See** (while starting: **Adding to Want to See**) and **Choose another file**.

The preview sends `{ kinds: ["want"], conflictChoice, watchDates: "preserve" }`. The watch-date value has no effect, because a wishlist import adds no watches.

#### Outcome labels

| Outcome | General label | Wishlist label |
| --- | --- | --- |
| `new` | New in GoodWatch | New to your Wishlist |
| `unchanged` | Already the same in GoodWatch | Nothing to change |
| `conflict` | Different in GoodWatch | Seen in GoodWatch |
| `unmatched` | Not in the GoodWatch catalog | Not matched to a GoodWatch title |
| `unsupported` | Data GoodWatch can't import | Not added to Want to See |
| `invalid` | Rows we couldn't read | Entries we couldn't read |

`unchanged` covers titles already on the Wishlist and shows whose GoodWatch status (Watching, On hold, or Dropped) stays. Their row reasons say which. `unmatched` covers titles whose type the file didn't give, so "Not in the GoodWatch catalog" would be wrong for them.

#### Why the button has no count

The backend deduplicates matched wishlist entries by canonical title. It also checks each title again as it runs. A number would overstate what gets added, so the counts stay in the outcome list.

The button is off when nothing can be added:

- With seen titles left as Seen: "Nothing new to add. To add the titles you've already seen, choose Add them as Want to rewatch."
- Otherwise: "Nothing to add. GoodWatch already has the titles in this file, or can't add them."

#### Rows

- The type reads **Type unknown** when the file's evidence says `mediaType: "unknown"`. The server stores such rows as a movie, so the UI reads `wishlistEvidence.mediaType`, not `mediaType`.
- An unmatched row with a title has a **Search** link to Discover search (`searchHref`), which opens in a new tab. Screen readers hear "Search for {title} (new tab)".
- Other source imports keep their rows unchanged.

### Streaming services in source search

When a search finds no source but names a streaming service or tracker, the page shows:

> **GoodWatch can't import your {Service} list yet.**
>
> If you also keep a watchlist on Trakt, TMDB, or Plex, import it from there. To add titles now, search for them and choose Want to See.

Then the buttons **Open the Trakt import**, **Open the TMDB import**, and **Open the Plex import**. For Crunchyroll, **Open the MyAnimeList / Kitsu import** comes first. A button clears the search and opens that source.

Services matched by name or by a whole word: Netflix, Prime Video (amazon, prime), Disney+ (disney), Max (hbo, hbo max), Hulu, Apple TV, Paramount+ (paramount), Peacock, Crunchyroll, WOW (sky), RTL+ (rtl), Joyn, ARD, ZDF, JustWatch, Simkl, and Google TV. A search of three or more letters also matches the start of a name. The message makes no claim about what a provider offers.

### Receipt and Undo

The existing result screen applies, with these wishlist differences:

- The warnings box is headed **About this file**, not **Export notes**.
- The secondary button reads **Import another file**.
- The Undo question reads: "Undo this import? GoodWatch takes the titles this import added off Want to See. Titles you changed since then stay as you left them. Titles the import took off Not interested aren't marked Not interested again. The result lists them so you can put them back."

The result itself comes from the server. A title taken off Not interested reads "Off Not interested, because you added it to Want to See. Undo won't put it back." After Undo, the same title is under **Not put back** with **Mark Not interested again**.

An imported wish never creates a watch, a show status, or activity.

## Server strings

These strings come from `app/server/imports/wishlist.server.ts` and `preview.server.ts`, which the backend owns. The UI shows them unchanged. The parser wording below has been applied. The shared unmatched-match and receipt wording remain unchanged.

| Current | Proposed |
| --- | --- |
| Choose a GoodWatch Wishlist JSON file or a Watcharr JSON export. | Choose watcharr-export.json from Watcharr, or a wishlist file made for GoodWatch. |
| This Wishlist file uses an unsupported format version. | This wishlist file uses a newer layout than GoodWatch reads. Ask the maker of the tool that saved it for a file GoodWatch can read. |
| This Wishlist file has invalid metadata. | This wishlist file is missing details GoodWatch needs, or has details it can't read. Save it again with the tool that made it. |
| That Wishlist file has more than 50,000 items. | That file has more than 50,000 titles. GoodWatch imports up to 50,000 at a time. |
| That export is larger than 20 MB. | That file is larger than 20 MB. |
| This file may contain only part of the source Wishlist. Importing adds titles and never removes missing titles. | This file may hold only part of your list. Titles that aren't in the file stay as they are in GoodWatch. |
| This Wishlist file has an invalid item. | GoodWatch couldn't read this entry. |
| The source did not say whether this title is a movie or a show. | The file doesn't say whether this is a movie or a show, so GoodWatch can't match it. Search for it to add it. |
| This entry has no supported title identifier. | This entry has no ID or year, so GoodWatch can't match it safely. Search for it to add it. |
| This Watcharr file has an invalid entry. | GoodWatch couldn't read this Watcharr entry. |
| Only Watcharr titles marked PLANNED are imported as Want to See. | Only titles marked Planned in Watcharr are added to Want to See. |
| This Watcharr entry is not a movie or show. | Only movies and shows can go on your Wishlist. |
| Seen in GoodWatch. Choose whether to add this title as Want to rewatch. | No change. It matches the preview's seen-titles choice. |
| (unique match failed) This title could not be matched uniquely in the GoodWatch catalog. | For wishlist rows: "More than one GoodWatch title matches, or none does. Search for it to add the right one." |

The receipt's kept reason for a seen title left as Seen is the shared "You chose to keep what GoodWatch has." (`app/domain/import-result.ts`). For wishlist imports, "Left as Seen, as you chose." would be clearer. That file is outside this UI's scope.

## Netflix slice: designed, not built

Nothing in this section is in the product. It ships only after a real Netflix archive or capture has been checked. A throwaway prototype of the preview, with synthetic data, explores it. See [Prototype](#prototype).

### Evidence order for title-only rows

The backend decides, and the UI only displays:

1. A Netflix ID that resolves through GoodWatch's own streaming-link data to exactly one title applies, with basis **Matched by Netflix link**.
2. An exact title with two or three candidates is shown as a suggestion, with nothing preselected.
3. More candidates, or none: unmatched, with **Search**.

Never apply a title-only guess without the member's selection.

### Suggested matches

Group heading: **{n} titles need your choice**. Intro: "These titles came without a year, so GoodWatch found more than one possible match. Choose the right one, or leave a title out."

Each title is one group: **"The Office"** from your list, then one radio card per candidate (poster, title, year, Movie or Show, **On Netflix** when known), then **None of these**. Cards are at least 44 px tall. On `sm` and wider, candidates sit in a grid of up to three. A group of more than five titles shows five, then **Show {n} more**. There's no "add all" button.

The button count is exact here only if the backend deduplicates entries by source ID before matching. See the prototype verdict.

### Netflix row and archive copy

When the archive route is validated:

- Instructions: "Request your data from Netflix at netflix.com/account/getmyinfo. Netflix emails you a download link, which can take up to 30 days. Upload the ZIP as Netflix gives it to you."
- Notes: "GoodWatch reads only your My List from the ZIP. Your viewing activity isn't imported here."
- An archive with several profiles opens with **Which profile's My List?** and one radio per profile, with its title count. Profiles are never merged.

Verify the URL, the wait, and whether the server can read only `MyList.csv` against a real archive before shipping this copy.

### Netflix capture status

| Route | Who it suits | Status |
| --- | --- | --- |
| Official data request ZIP (`MyList.csv` inside) | Every member, no tools | Header known from a 2023 parser only. Not checked against a current archive. |
| Store-installed browser extension that saves a wishlist file | Desktop members | Not built. Research only. |
| Console snippet or bookmarklet | Developers | Never in the product |

## Prototype

`/tmp/goodwatch-wishlist-orchestration/wishlist-preview-prototype.html` is a throwaway, single-file logic prototype. It is not a product route. It shows a partial Netflix capture (6 of 10 reported titles), title-only rows with ambiguous candidates, a seen title, a Not interested title, a duplicate entry, and Undo. It uses synthetic data, with no network and no persistence. Every screen carries a "PROTOTYPE - NOT LIVE-TESTED" banner. It is preserved on [prototype/wishlist-capture-review](https://github.com/alp82/goodwatch-monorepo/blob/prototype/wishlist-capture-review/docs/prototypes/wishlist-imports/capture-review.html), outside `main`. Chromium completed all 17 guided steps at both 390 px and 1280 px with no JavaScript errors or horizontal overflow.

Question: does the preview stay honest about coverage, title-only guesses, the add count, Not interested, and Undo?

Verdict:

- **Coverage box: holds up.** "This file holds 6 of 10 titles" and the "stay as they are" line read clearly, and the box goes away when the capture is complete. The reported total is the capture's own count, not proof of completeness.
- **Duplicates must be dropped by source ID before matching.** In the first model, the same Netflix entry listed twice was matched twice. With different choices, one wish became two titles. The prototype now drops the repeat first. The backend needs the same rule before a match editor ships.
- **Preselection makes the count a guess.** A suggestion preselected because one candidate is on Netflix goes into the button count without the member looking at it. The Netflix slice should preselect nothing. The evidence order in this document already leaves preselection out, while the prototype still shows it so the effect is visible.
- **Seen opt-in and Not interested: hold up.** The count rises by one when a seen title is added as Want to rewatch. Undo takes added titles off Want to See and leaves Not interested cleared, and **Mark Not interested again** puts it back.

## Validation cases

These use synthetic fixtures. They don't establish compatibility with a real account.

| # | Case | Expected | Covered by |
| --- | --- | --- | --- |
| 1 | Watcharr file with Planned movies and shows | Recognized in the top box; previewed as `wishlist` | `ImportFileRecognition.test.ts`, `ImportSourcesPage.test.ts` |
| 2 | Watcharr file longer than 64 KB | Recognized from its start; only the head is read | `ImportFileRecognition.test.ts` |
| 3 | Shared file, version 1, on one line | Recognized as a wishlist file, not as CSV | `ImportFileRecognition.test.ts` |
| 4 | Shared file, newer version | Not recognized; newer-layout hint | `ImportFileRecognition.test.ts` |
| 5 | `[]` as `watcharr-export.json` and as another name | Recognized only under Watcharr's name | `ImportFileRecognition.test.ts` |
| 6 | Seen title | Default leaves it Seen; Want to rewatch sends `conflictChoice: "source"` | `WishlistImport.test.ts`, `ImportSourcesPage.test.ts` |
| 7 | Nothing to add | Button off, with the reason | `WishlistImport.test.ts` |
| 8 | Title with unknown type | **Type unknown** and a **Search** link (new tab) | `WishlistImport.test.ts` |
| 9 | Source search "netflix", "disney", "crunchyroll" | No-support message with the right links; no Generic CSV hint | `ImportSourcesPage.test.ts` |
| 10 | Source search "watcharr" | One row: Watcharr / wishlist file | `ImportSourcesPage.test.ts` |
| 11 | Undo question | Says Not interested isn't put back | `ImportSourcesPage.test.ts` |
| 12 | 390 px wide, keyboard, screen reader | No horizontal scroll; 44 px controls; radios grouped with a legend | Not yet checked in a browser |
| 13 | A real Watcharr export | Imports Planned titles | Synthetic account response from running unmodified backend checked; real member/browser export not checked |

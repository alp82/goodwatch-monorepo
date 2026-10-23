# IMDb Watchlist import (#757)

IMDb's existing upload at `/settings/imports` now accepts the title-list CSV family
as well as Ratings. Ratings continue through the existing importer. Confirmed
Watchlist/custom-list uploads use the shared preview, selected kinds, confirm,
receipt, and Undo paths under `imdb_list`; the page and history present them under
the existing IMDb row. No database migration, external API call, or account scope
is added.

## Official evidence and the header ambiguity

IMDb's [Watchlist FAQ](https://help.imdb.com/article/imdb/track-movies-tv/watchlist-faq/G9PA556494DM8YBA)
defines Watchlist as movies/shows the person wants to watch and describes sorting
by the date added. The [Lists FAQ](https://help.imdb.com/article/imdb/track-movies-tv/lists-faq/GNQMN47VZSE7KW38)
documents CSV export and the distinct public IMDb and personal ratings shown on a
list. IMDb's [ratings guidance](https://help.imdb.com/redirect/votestopfaq?votestopfaqWho=)
documents the separate Ratings export.

The official help does not publish a versioned CSV schema. IMDb-hosted export
examples corroborate the column semantics:

- [Watchlist date-added explanation](https://community-imdb.sprinklr.com/conversations/imdb-app-android-fire-devices/watch-list-date-added/5f4a79d38815453dba8c5419): `Created` is the date the title entered Watchlist.
- [List export columns and Created](https://community-imdb.sprinklr.com/conversations/imdbcom/updates-to-list-pages/5f4a79d78815453dba8cdc5f?commentId=5f4a7b2d8815453dbacd1b27&page=1&replyId=5f4a7d6d8815453dba3225cc): custom lists use the same Position/Const/Created/Modified/Description family.
- [Export redesign examples and IMDb staff responses](https://community-imdb.sprinklr.com/conversations/imdbcom/listlike-pages-beta/65eb48a1e093635d1b21e0e7?page=2): exports can include personal ratings, filenames are not stable identifiers, and historical date formats varied.

Consequently it is impossible to distinguish Watchlist from a custom title list
by header alone. The classifier distinguishes Ratings, title lists, and unknown
files, giving list headers priority even if they contain Your Rating/Date Rated.
A list-shaped file requires one explicit My Watchlist / A custom list choice.
Neither filename nor row contents are used to invent that intent, and the API
rejects an ambiguous list request without the choice. This is the deliberate
exception to automatic detection required to avoid turning an arbitrary list
(such as movies a person dislikes) into Want to See.

## Mapping

| File evidence | GoodWatch behavior |
| --- | --- |
| Watchlist movie/show membership | Want to See, using the exact typed IMDb ID match. |
| Created, valid ISO day | `addedAt`, preserved in the resulting Wishlist creation date. |
| Already Seen movie/show | Separate Want to rewatch opt-in, independent of rating/review conflict policy. Existing watches and show status stay intact. |
| Personal Your Rating / legacy You rated | Whole-number 1–10 score; blank means no score. Public IMDb Rating is never a personal rating. |
| Rated Watchlist movie | Offered as a rewatch wish because a personal movie score makes it Seen in GoodWatch. No viewing date is inferred. |
| Description | Original list note in preview/receipt, visibly unsupported as a review. |
| Position / Modified | Original list metadata in preview/receipt; no manual Wishlist order or viewing date is inferred. |
| Date Rated | Original rating provenance in preview/receipt, never a watch date. Rating application follows the existing shared writer. |
| Custom-list membership | Visible unsupported observation; never automatically becomes Want to See. Its personal movie/show scores can still be imported. |
| Episode/short/game/unknown types | Visible unsupported observations retaining their list fields and supplied score. No parent-show intent is invented. |
| Malformed personal score | Invalid score observation; an otherwise valid wish remains available. |
| Invalid or ambiguous Created format | Original string retained and an actionable note displayed. The new GoodWatch wish uses import time rather than guessing a source date. |

The adapter preserves original list notes, positions, Created/Modified strings,
and personal rating/date fields in stored observations. The preview's row details
and the receipt's Original IMDb list entries disclosure expose them. An original
CSV cannot supply a general list name/description that it does not contain; the
uploaded filename remains on the receipt. General list storage and scoped scores
remain separate destination-model work.

## Verification

Fixtures under `app/server/imdb-import/fixtures/` are synthetic. The Watchlist
and custom-list fixtures intentionally have identical headers. They cover movies,
shows, episode entries, personal/public scores, multiline notes, and different
Created/Modified/Date Rated/release dates. No member export is committed or used.

Test-first cycles cover header recognition, Watchlist normalization, original added
dates, independent rewatch consent, shared confirm/Undo, custom-list safety, and
the existing IMDb upload's browser flow. Additional tests cover malformed dates
and ratings, Seen shows, ownership/HTTP validation, and reopening a list import
under the existing IMDb history. The existing Ratings parser and suites continue
to pass.

- Imports suites: 590 passed, no failures.
- Webapp typecheck: 210 existing diagnostic lines, identical to the baseline; none added.
- Chrome preview: selected ratings and wants, independent rewatch consent with Keep my GoodWatch changes, no runtime errors or horizontal overflow at 390 px.
- [Desktop preview](imdb-watchlist-preview-desktop.png).
- [Mobile preview](imdb-watchlist-preview-mobile.png).

The screenshots render the actual shared preview and stylesheet with the summary
and rows generated by the synthetic service test, inside a local harness. The
surrounding Imports/IMDb headings are harness markup. No live IMDb account,
authenticated production member, or live CrateDB import was exercised.

No blocking questions remain. Header-only Watchlist/custom-list identification
cannot be implemented honestly; explicit list intent is enforced instead.

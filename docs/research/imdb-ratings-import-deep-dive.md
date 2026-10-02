# IMDb ratings import: deep dive

Research date: 2026-09-30, synthesized 2026-10-01. Status: exploration, not an approved implementation plan. This extends [the first-pass note](imdb-ratings-import.md) and covers what it left open: how competitors import IMDb ratings today, whether any authorized or legally compelled route to a user's ratings exists, and how real tools actually retrieve ratings from a signed-in browser.

Three parallel research agents produced Parts A–C from official documentation, legal texts, source code and a handful of unauthenticated HTTP probes. The synthesis below is drawn from those parts; the citations live in the parts and were not independently re-checked during synthesis. No IMDb account was signed in to, no forms were submitted, nobody was contacted, and nothing here is legal advice. Every statement about authenticated IMDb behaviour is inferred from other tools' source code.

## Synthesis

### What changed since the first-pass note

| Question left open | Finding | Part |
| --- | --- | --- |
| Does Trakt import personal IMDb ratings? | Yes. Its importer is open source, runs in the browser, and also writes a watch-history entry dated with the rating date unless the person turns that off. | A |
| Does any competitor sync IMDb ratings continuously? | No. Every first-party route is a manual, repeatable CSV upload. | A |
| Is there an authorized, user-consented API to a person's IMDb ratings? | None found. The IMDb API is B2B and title/name only, Login with Amazon grants profile data only, and Amazon's Data Portability API has no IMDb ratings scope. | B |
| Can EU law force continuous access? | No. DMA Art. 6(9) does not reach IMDb (Amazon is a gatekeeper only for Marketplace and Advertising). GDPR Art. 20 very likely covers ratings but yields a user-requested copy, not a sync channel. | B |
| How do real tools read ratings from a signed-in browser? | Three routes: automate IMDb's own export, walk the ratings pages at 250 per page, or call the internal GraphQL `userRatings` query. All run inside an imdb.com tab. | C |
| Can a server or a bare extension service worker fetch IMDb? | Not credibly. imdb.com answered non-browser requests with an AWS WAF challenge, and the GraphQL endpoint allows credentialed CORS only from `https://www.imdb.com`. | C |
| How often does IMDb break these tools? | About every one to two months in 2026. Since 2026-07-23 a headless browser no longer passes the WAF challenge unaided. | C |

### Conclusions

1. **CSV import stays the foundation, and nothing better is available to anyone.** It is the only route that is supported by IMDb, low risk, and what every competitor ships. The first note's recommendation stands and is now better supported.
2. **Continuous sync cannot honestly be promised.** No authorized route exists, service-side retrieval is blocked technically and carries the highest legal risk, and in-browser retrieval breaks roughly monthly. The realistic ceiling is "updates when you ask, from a desktop browser signed in to IMDb".
3. **If an extension is built, it should assist IMDb's own export from inside the user's imdb.com tab.** That is the lowest-risk automated route (it triggers a feature IMDb offers and feeds the same CSV importer), and a content script is the only architecture that works across Chrome, Firefox and Safari. Reading ratings pages or internal GraphQL in the user's session is technically richer but sits in the medium-risk band and is the most breakage-prone.
4. **Do not use the unauthenticated GraphQL `userRatings` route.** One small 2026 repository claims it returns ratings, including private ones, with no login. It was deliberately not tested. It looks like an IMDb access-control gap, proves no ownership of the profile, is rate limited, and reportedly returns a non-commercial-use disclaimer. It would make "paste your profile URL" sync trivial, which is exactly why it is tempting and why it should stay out of the product.
5. **A second manual source is worth one test: IMDb's account-data archive.** GDPR Art. 20 very likely entitles users to their ratings in machine-readable form, but the archive's format and whether it contains ratings are undocumented.
6. **Service-side sync is only reachable through a written agreement with IMDb.** Published licences start at about $150,000 per year for bulk metadata and none include user data, so treat this as a long shot to be raised only if continuous sync becomes strategic.

### What to copy and what to avoid in the import UX

These refine the UX proposed in the first note; the evidence is in Part A.

- **Keep "rated means Seen", never invent a watch date.** Every competitor and IMDb itself treat a rating as watched. Trakt's default of using the rating date as the watch date is the most common complaint found (one user got 2,000 films on a single day).
- **Offer undo.** Letterboxd states there is none, and Trakt's current importer shows none for file imports. This is a cheap differentiator.
- **Make the receipt add up.** Rows in file = imported + unchanged + skipped + invalid, with a reason per skipped row and a download of the leftovers. TMDB's importer silently detected 5,145 of 5,847 rows.
- **Skip unknown title types with a stated reason.** Trakt imports anything it does not recognise as a movie; Yamtrack and Ryot skip with a per-row warning.
- **Explain IMDb's export wait.** No competitor's instructions mention that IMDb prepares the export asynchronously and that the file appears on the exports page.
- **Match headers by name and tolerate schema drift.** IMDb changed the ratings export in 2017 and again made the rating value a decimal in January 2026; both broke importers that assumed a fixed shape.
- **Run the import as a server-side job.** Trakt's in-browser import stops if the person navigates away.
- **Use import as an acquisition entry point.** Trakt's sign-up opens with "Already tracking elsewhere?", and TV Time's shutdown on 2026-07-15 sent its users looking for importers.

### Extension design constraints, if the spike goes ahead

From Part C; all need confirmation with a signed-in test account.

- Request only `https://www.imdb.com/*` (or `activeTab` plus `scripting` for click-to-sync) and let the content script own the loop, posting results in batches.
- Never handle IMDb credentials or cookies. Tools that log in on the user's behalf hit captchas, one-time codes and new-location warnings.
- Accept both user-ID formats: legacy `ur…` and the opaque `p.…` introduced in 2026. Record the `ur…` ID as the stable account identity.
- Never infer deletions from a short or failed retrieval, and distinguish "export failed" from "no ratings".
- Ship a remotely readable health flag so a broken extractor degrades to "use CSV for now" without waiting for a store release.
- Do not imply IMDb endorsement in the store listing, and declare transmission of ratings to GoodWatch as the extension's single purpose.

### Risk bands

Part B's assessment, as risk inputs rather than legal advice.

| Band | Routes |
| --- | --- |
| Low | Upload of an IMDb-provided CSV export; upload of an account-data archive; a user-initiated extension that triggers IMDb's own Export and hands the file to GoodWatch |
| Medium | An extension that reads ratings pages or internal endpoints in the user's session and sends the ratings to GoodWatch |
| High | Server-side retrieval with stored user credentials or cookies; crawling profiles at scale; anything that defeats the WAF challenge |

IMDb's Conditions of Use and `robots.txt` prohibit automated extraction without written consent and make no exception for a user's own data. No public enforcement against a personal sync tool was found; IMDb's observed pushback is technical.

### Next evidence steps

| Step | What it settles |
| --- | --- |
| Export ratings from a real account, rerate one title, export again | Actual headers, encoding, decimal ratings, date semantics, and how long preparation takes |
| Request the account-data archive on the same account | Whether it contains ratings and in what format |
| Run that export against the GoodWatch catalog | Measured match coverage by title type |
| Time-boxed, signed-in extension spike on one's own account | Whether in-tab export assistance works end to end; the open items listed at the end of Part C |
| Counsel review before shipping any in-session extraction | EU contract and database-right position, and US exposure after any objection from IMDb |

### Decisions still open

Carried over from the first note and unchanged by this research: movies only or series too, which rating wins on a first-import conflict, whether an explicitly enabled sync may overwrite untouched imported ratings, and how much browser-independent freshness matters. This research adds one: whether an extension that only saves a few clicks over a manual export is worth building and maintaining at all.

---

## Part A: Competitor importers and UX patterns

Research date: 2026-09-30. This builds on `docs/research/imdb-ratings-import.md` and focuses on what is **new or deeper**. Sources are official help pages, staff forum posts, and source code; every claim is linked. "Unverified" means no primary source was reachable. No accounts were created and no forms were submitted. Criticker, Taste.io, Serializd FAQ and Reelgood returned HTTP 403 to automated fetches, so parts of their rows rely on search-indexed or archived copies.

### TL;DR: findings that change or deepen the first-pass note

1. **Trakt now imports IMDb personal ratings, and its importer is open source.** The first note left this unverified. The current importer is client-side Svelte code in the public `trakt/trakt-web` repo (commit `86cdf107`, 2026-09-30). From an IMDb ratings CSV it creates both a `ratings` item (1–10, `rated_at` = `Date Rated`) and a `history` item with `watched_at` = `Date Rated`. The review screen shows one toggle per action, so a person can switch off History. [ImdbParser.ts](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/parsers/ImdbParser.ts), [ImportSummary.svelte](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/_internal/import/ImportSummary.svelte)
2. **Everyone treats a rating as "watched".** Trakt, Letterboxd, Simkl, Yamtrack and Watcharr all do, and IMDb does too: "IMDb will now also register any movie or TV show you add a Rating to … as having been watched." GoodWatch's "rated ⇒ Seen" rule matches the industry and IMDb's own model. [IMDb Watched FAQ](https://help.imdb.com/article/imdb/new-features-updates/mark-as-watched-faq/GR2SD7Y4LZVNHUVH)
3. **Using `Date Rated` as the watch date is the top recurring complaint.** One Trakt user ended up with "2000 movies with the same date". Trakt staff: "In case of IMDB data, we assume … the date on which you rated it also when you watched something. But I can see how that's not always something you might want." They later added `"unknown"` watch dates to CSV/JSON. Letterboxd makes diary entries from IMDb dates opt-in and warns there is no undo. [Trakt thread](https://forums.trakt.tv/t/86719), [Letterboxd migration guide](https://letterboxd.com/about/migrating-from-imdb/)
4. **No competitor offers ongoing IMDb sync.** Every first-party route is a manual, repeatable CSV upload. Continuous sync exists only in third-party scripts (see the first note), plus JustWatch's import of *IMDb lists*, which is list-based, not ratings-based (scope unverified).
5. **Undo is rare.** Letterboxd: "There is no undo after the confirmation step. Be careful!" Trakt's legacy importer had per-import undo ([staff, Nov 2024](https://forums.trakt.tv/t/32483)). In the V3 client code, "Undo this sync" appears only for streaming-service syncs, not browser imports (inference from code). Simkl recommends downloading a backup first. [Letterboxd](https://letterboxd.com/about/importing-data/), [Simkl CSV](https://simkl.com/apps/import/csv/)
6. **Unmatched handling:** the best current pattern is Trakt V3's post-import tabs. "Multiple matches" lets you pick from poster candidates, then "Import selected". "Skipped" offers "Download skipped items" as CSV. Letterboxd corrects matches *before* confirming. TMDB keeps a per-import history listing each row's status. [ImportComplete i18n](https://github.com/trakt/trakt-web/blob/main/projects/client/i18n/meta/en.json), [TMDB staff](https://www.themoviedb.org/talk/5a68359ac3a36844b400666e)
7. **Silent row loss from IMDb CSV quirks is real.** In the TMDB thread, a user's 5,847-row file was detected as 5,145. Staff: "IMDb's files are not very well formatted … I simply had to skip the row". IMDb has changed the ratings export schema before, which broke importers. [TMDB 2018](https://www.themoviedb.org/talk/5a68359ac3a36844b400666e), [TMDB 2017](https://www.themoviedb.org/talk/5a07310492514107290015a1)
8. **Unknown IMDb title types get mis-typed by default.** Trakt maps any unmapped `Title Type` (Short, Video, TV Special, TV Episode spelled differently, …) to `movie`. Yamtrack and Ryot skip unknown types with a per-row warning. [Trakt parser](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/parsers/ImdbParser.ts), [Yamtrack](https://github.com/FuzzyGrim/Yamtrack/blob/HEAD/src/integrations/imports/imdb.py)
9. **TV Time shut down on 2026-07-15.** It is no longer a competitor. Its users migrated to Trakt, Serializd, Simkl and others, which shows the value of an importer as an acquisition channel ("Already tracking elsewhere?"). [AlternativeTo news](https://alternativeto.net/news/2026/7/tv-time-is-shutting-down-its-service-on-july-15-2026-here-are-some-great-replacements/), [Trakt i18n "before the service shut down"](https://github.com/trakt/trakt-web/blob/main/projects/client/i18n/meta/en.json)

### Per-product matrix

| Product | Route | Imports IMDb personal ratings? | Scale conversion | Matching | Marks rated as watched? | Repeat / dedup / conflict | Undo | Continuous IMDb sync? |
|---|---|---|---|---|---|---|---|---|
| **Trakt (V3 web)** | IMDb CSV upload (ratings + watchlist, max 2 files), parsed in browser, written via Trakt sync API | **Yes** (1–10, `rated_at`) | None needed; clamps/rounds; values <1 dropped ("A third party dump that writes 0 for 'unrated' must not be clamped up") | IMDb ID first (`MOVIE_IDS = imdb,tmdb,trakt`); title+year fuzzy match only for rows without IDs | **Yes by default**: History item with `watched_at` = `Date Rated`; user can untoggle History | Ratings via `/sync/ratings` (overwrite semantics assumed, unverified). Legacy importer "ignores duplicates by default now" (staff 2024-11-26). No conflict UI | Legacy: "Any import can be undone via your settings page". V3 import: not found in code | No |
| **Letterboxd** | CSV upload on website (1 MB limit per file) | **Yes, optional** ("option to include the ratings … or to ignore them") | 1–10 → 0.5–5 (`Rating10` "will be converted to 0.5–5 scale") | Exact on `imdbID`/`tmdbID`/URI; best-guess on title/year/director | **Yes**: "All films imported to your Profile will be automatically marked as watched" | Updates diary entry with same film+date; merges duplicate lines with the same date; conflict with an existing rating not documented | **None**: "There is no undo after the confirmation step" | No |
| **Simkl** | IMDb CSV upload (IMDb-specific page) | Unverified for the IMDb page (generic CSV importer supports `Rating` 1–10) | Same 1–10 | Unverified (generic CSV supports IMDB_ID, TMDB_ID+Type, title) | **Yes** in Auto mode: "Movies that you rated on IMDB will be marked as watched" | Suggests backup; "You can clean your watchlist and ratings, then import your backup again" | Via backup/clean only | No |
| **TMDB** (catalog site; GoodWatch's metadata source) | CSV via Settings → Import List, target list "Rated" | **Yes**; staff: "I only use the IMDB id, rating and date" | Same 1–10 (integer only per [community](https://www.themoviedb.org/talk/647e91c80e29a22be29399d5)) | IMDb ID | n/a (ratings list) | Import history with per-row "Imported? / Reason" ("Couldn't find IMDB ID") | Unverified | No |
| **Criticker** | Member-only import tool, IMDb/Letterboxd/CSV | **Yes** | Configurable translation tables to 0–100 ("you have the opportunity to translate scores … but many people just use the defaults"); default IMDb mapping unverified | Unverified | Unverified | 2016 bug report: imported ratings did not show on title pages ([forum](https://web.archive.org/web/20250212171939/https://www.criticker.com/forum/viewtopic.php?t=5770)) | Unverified | No |
| **JustWatch** | Import **IMDb lists** (public or personal) into "My Lists" (Nov 2023) | No first-party ratings import found; community script imports ratings as the Seen list plus like (≥7) / dislike (≤4) | 10-point to binary (script) | Title lookup (script) | Script: ratings go to the Seen list | Unverified | Unverified | Imported lists: refresh behaviour unverified |
| **Serializd** | Imports TV Time and Trakt only | No IMDb ("Serializd supports importing data from TV Time and Trakt") | – | – | – | – | – | No |
| **Moviebase** | Sends users to Trakt (import CSV into Trakt, then connect Trakt) | Indirect via Trakt | – | – | – | – | – | Trakt sync, not IMDb |
| **Plex** | No first-party IMDb ratings import found. Community web tool "Ratings-To-Plex-Ratings" | Community tool: yes (to server library ratings) | IMDb 1–10 direct; Letterboxd ×2 | Library match; Title Type toggles (Movie/TV Series/Mini/TV Movie) | Optional "mark as watched" | Preview "current vs. new ratings"; unchanged skipped unless force-overwrite; dry-run | "Clear All Ratings" | No |
| **Taste.io, MovieLens, Mubi, Reelgood** | No first-party IMDb ratings import found (Taste.io onboarding is "Calculate Your Taste" by rating titles) | Unverified / not found | – | – | – | – | – | No |
| **TV Time** | Shut down 2026-07-15 | n/a | – | – | – | – | – | – |
| **Yamtrack** (self-hosted) | IMDb CSV upload; mode "new" or "overwrite" | **Yes**, raw 1–10 score | None | `Const` → TMDB `/find` (first result per type) | **Yes**: "if user rated it, they completed it" → COMPLETED; movie `end_date` = latest of Created/Modified/Date Rated | "new" skips existing; "overwrite" deletes then re-creates. If 2+ rows map to the same TMDB ID, **none imported**, with a warning | No | No |
| **Ryot** (self-hosted) | IMDb CSV | **No**: reads only `Const` and `Title Type`, adds to Watchlist collection | – | TMDB find by IMDb ID | No | Per-row failure records | – | No |
| **Movary** (self-hosted) | No IMDb personal-ratings importer. Ratings import from Trakt/Letterboxd; `imdb_sync` job is a separate job type (likely aggregate IMDb ratings; unverified) | No | – | – | – | – | – | No |
| **Watcharr** (self-hosted) | IMDb CSV (ratings or list), editable review table before import | **Yes** (`Math.floor(Your Rating)`, rating date kept) | None | IMDb ID, then name search fallback | Yes (default status FINISHED) | Unverified | Unverified | No |

Sources per row: Trakt ([parser](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/parsers/ImdbParser.ts), [ratings payload](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/engine/buildRatingsPayload.ts), [pickIds](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/engine/pickIds.ts), [announcement + staff replies](https://forums.trakt.tv/t/32483)); Letterboxd ([import guide](https://letterboxd.com/about/importing-data/), [IMDb migration](https://letterboxd.com/about/migrating-from-imdb/)); Simkl ([IMDb page](https://simkl.com/apps/import/imdb/), [CSV page](https://simkl.com/apps/import/csv/)); TMDB ([staff 2018](https://www.themoviedb.org/talk/5a68359ac3a36844b400666e), [user guide 2017](https://www.themoviedb.org/talk/58a4180b92514165c5001533)); Criticker ([archived getting-started](https://web.archive.org/web/20250824114324/https://www.criticker.com/get-started-with-criticker/)); JustWatch ([press release republished](https://everymoviehasalesson.com/blog/2023/11/justwatch-adds-new-lists-feature-and-imports-your-imdb-lists), [community script](https://github.com/vinismarques/imdb-to-justwatch)); Serializd ([homepage FAQ](https://www.serializd.com/)); Moviebase ([guide](https://moviebase.app/resources/how-to-switch-to-moviebase-from-another-tracker)); Plex ([community tool](https://github.com/primetime43/Ratings-To-Plex-Ratings)); Yamtrack ([imdb.py](https://github.com/FuzzyGrim/Yamtrack/blob/HEAD/src/integrations/imports/imdb.py)); Ryot ([lib.rs](https://github.com/IgnisDa/ryot/blob/HEAD/crates/services/importer/imdb/src/lib.rs), [docs](https://github.com/IgnisDa/ryot/blob/HEAD/apps/docs/src/importing/imdb.md)); Movary ([ImportService.php](https://github.com/leepeuker/movary/blob/main/src/Service/ImportService.php), [JobType.php](https://github.com/leepeuker/movary/blob/main/src/ValueObject/JobType.php)); Watcharr ([import page](https://github.com/sbondCo/Watcharr/blob/HEAD/src/routes/(app)/import/+page.svelte), [process page](https://github.com/sbondCo/Watcharr/blob/HEAD/src/routes/(app)/import/process/+page.svelte), [server import.go](https://github.com/sbondCo/Watcharr/blob/HEAD/server/feature/imprt/import.go)).

### Trakt in detail (the most complete reference implementation)

**Architecture.** Parsing and matching run in the browser ("Import your data from other services directly in your browser."). The pipeline:

1. Parse the files.
2. Resolve movies that have no ID by batched title+year match, 100 per request, against `POST /v3/search/match/movies`. Each result is `matched | ambiguous | not_found | invalid`.
3. Write to Trakt in chunks: `sync.history.add`, `sync.watchlist.add`, `sync.ratings.add`, then lists.

[syncToTrakt.ts](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/syncToTrakt.ts), [resolveMovieIds.ts](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/engine/resolveMovieIds.ts), [matchMovies.ts](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/engine/matchMovies.ts)

**IMDb specifics** ([ImdbParser.ts](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/parsers/ImdbParser.ts)):
- The file kind is detected by the presence of a `Your Rating` column in the first row. Only rows whose `Const` starts with `tt` are kept.
- `Title Type` normalisation maps `movie`/`tvmovie` → movie, `tvseries`/`tvminiseries` → show, and `tvepisode` → episode. **Everything else defaults to movie.**
- Each ratings row produces **two** items: a rating and a history play dated `Date Rated`.

**State machine** ([ImportTypes.ts](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/ImportTypes.ts)): `idle → reading → parsing → review → matching → syncing → complete | error`.

**UX copy** (verbatim, [en.json](https://github.com/trakt/trakt-web/blob/main/projects/client/i18n/meta/en.json)):
- Onboarding: "Already tracking elsewhere?" / "Bring your watch history, watchlist, and ratings with you. Importing takes just a couple of minutes." / "Import your ratings and watchlist from an IMDb export." / "Import from {service}" / "See all import options".
- Guide: "IMDb on Trakt? Lights, camera, action! ✨ Download your IMDb watchlist as a .csv and import it here in seconds." The steps are: "Go to IMDb and login", "Visit your watchlist", "Click on Export", "Visit your ratings", "Click on Export", "Upload the .csv files here". **The guide says nothing about IMDb's delayed export preparation.**
- Review: "{count} items for History", "{count} ratings", "{count} items for Watchlist", each with a toggle; "Start Import".
- Free tier: "Your import exceeds the free tier limit. Upgrade to VIP to import all {count} items." The check covers history, watchlist and list counts, not ratings ([ImportSummary.svelte](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/_internal/import/ImportSummary.svelte)).
- Progress: "Matching movies {processed} / {total}…", "Syncing {processed} / {total} items…". Leaving the page mid-import asks: "Your import is in progress. Navigating away will stop it. Are you sure?"
- Receipt: "{count} items synced successfully." / "{count} items failed." / "{count} movies couldn't be matched and were skipped:" / "{count} movies matched more than one title. Pick the right ones and import them:". Tabs are "Multiple matches" and "Skipped". Buttons: "Import selected", "Don't import", "Download skipped items", "Import more".
- The skipped-items CSV has columns `title,year,action,watched_at` ([toUnresolvedCsv.ts](https://github.com/trakt/trakt-web/blob/main/projects/client/src/lib/sections/settings/import/toUnresolvedCsv.ts)).

**Known complaints:**
- Imported plays all dated on the rating date ([thread 86719](https://forums.trakt.tv/t/86719)).
- An IMDb Watchlist import landed in History ("Trakt reported '204 items imported' … All 102 titles were added to my History instead"). Unanswered from 2026-07-12 to 2026-09-28 ([thread 115628](https://forums.trakt.tv/t/115628)).
- "it only imported 27 of my 800ish movies" ([thread 32483 #44](https://forums.trakt.tv/t/32483/44)).
- Series ratings without episode ratings produced almost nothing. Staff: "if we marked entire shows as watched that would be adding a ton of data. It also wouldn't really be accurate" ([#30](https://forums.trakt.tv/t/32483/30)).
- An ID-namespace collision in custom JSON: a TMDB ID matched a Trakt movie ([#36](https://forums.trakt.tv/t/32483/36)).

### Cross-cutting UX patterns

| Pattern | Who does it | Notes for GoodWatch |
|---|---|---|
| **Onboarding entry point** "Already tracking elsewhere?" plus a persistent Settings → Import | Trakt (welcome wizard + Settings), Criticker (Getting Started step 2: "get a jumpstart") | Criticker explicitly positions import as solving cold start ("matching doesn't start until you hit at least 10 ratings"), which is the same motivation as Taste |
| **Source picker, then per-source guide with deep links** to IMDb's ratings and watchlist pages | Trakt, Simkl, Letterboxd | Nobody explains IMDb's asynchronous export preparation or the exports page. This is a gap GoodWatch can fill |
| **Pre-commit review with per-category counts and toggles** | Trakt (History / Watchlist / Ratings toggles), Letterboxd ("include the ratings … or … only import the films"; opt-in diary dates), Simkl (Auto / Plan to watch / I've seen this), Yamtrack (new vs. overwrite mode) | Toggle "Also mark as Seen" is standard. Default is on everywhere |
| **Row-level match review** | Letterboxd (fix or remove before confirm), Watcharr (editable table), Plex tool (posters, current vs. new) | Letterboxd explicitly warns about "TV entries that have matched to similarly named films" |
| **Ambiguity resolution with candidates** | Trakt V3 (poster candidates, "Import selected") | Only relevant for title-matched rows. IMDb CSVs always have `Const`, so exact-ID matching avoids most of it |
| **Progress with counts, cancel, leave-page guard** | Trakt | Client-side import dies on navigation. A server-side job avoids that |
| **Receipt with failed / skipped / downloadable leftovers** | Trakt (CSV of skipped), TMDB (per-row history with reason), Yamtrack (warnings listing), Ryot (failed items by step) | Keep a persistent import history page, not just a toast |
| **Safety net** | Trakt legacy undo; Simkl backup download + "clean" then re-import; Plex tool dry-run; Letterboxd none | Undo is a differentiator |
| **Scale conversion** | Letterboxd 10→5 half-stars; Criticker user-editable translation table to 0–100; JustWatch script 10→like/dislike | GoodWatch is 1–10, so no conversion is needed. Do not copy the Criticker complexity |

### Anti-patterns (from official forums and code)

1. **Inventing watch dates from `Date Rated`** (Trakt default) leads to thousands of plays on one day and a user asking for bulk edits. Letterboxd's opt-in with a warning is better. GoodWatch already plans "no watch date", which is correct. [Trakt 86719](https://forums.trakt.tv/t/86719), [Letterboxd](https://letterboxd.com/about/migrating-from-imdb/)
2. **Defaulting unknown types to movie** (Trakt) risks shorts, video games and podcasts being imported as films. Prefer the Yamtrack/Ryot style of explicit per-row skip reasons.
3. **Silent row drops** (TMDB): the count detected differed from rows in the file, with no explanation. Always reconcile "rows in file = imported + skipped + invalid". [TMDB](https://www.themoviedb.org/talk/5a68359ac3a36844b400666e)
4. **Hard-coding the export schema.** IMDb changed only the ratings export in 2017 and broke TMDB's importer until a staff fix. [TMDB](https://www.themoviedb.org/talk/5a07310492514107290015a1)
5. **Duplicate plays on re-import** (Trakt at launch, fixed within about 10 days). Re-import must be idempotent from day one. [Trakt #25](https://forums.trakt.tv/t/32483/25)
6. **No undo plus destructive options** (Letterboxd's bold warning; Yamtrack "overwrite" deletes existing items first).
7. **"All-or-nothing" on duplicates** (Yamtrack): if two IMDb rows map to the same TMDB ID, neither is imported. Surface these as a conflict instead.
8. **Wrong destination bug with a misleading success count** (Trakt watchlist → history, "204 items imported" for 102 rows). Receipts should count per destination and match the file. [Trakt 115628](https://forums.trakt.tv/t/115628)
9. **Expanding series ratings into episode plays** was rejected by Trakt as inaccurate. It supports GoodWatch's plan to never convert an episode rating into a show rating, and vice versa.

### Open / unverified items

- Whether Trakt's `/sync/ratings` overwrites an existing different rating on re-import, and whether the V3 importer registers an undoable batch server-side. The code shows no batch ID.
- Simkl: whether the IMDb-specific importer carries `Your Rating` into Simkl ratings. Its page only says rated movies become watched.
- Criticker default IMDb→0–100 mapping, and the Criticker, Taste.io, Mubi and Reelgood help pages (all 403 or not found).
- JustWatch IMDb-list import: whether it accepts the ratings page, and whether imported lists refresh.
- Movary `imdb_sync` semantics (assumed aggregate-rating refresh).

---

## Part B: Authorized routes and legal constraints

Research date: 2026-09-30. Extends `docs/research/imdb-ratings-import.md`, which already covers the ratings CSV export, the IMDb API's title/name scope, and the account-data request's 5-day/90-day windows. **This is not legal advice.** The findings are risk inputs for a product decision. Quotes are verbatim from the fetched page unless marked *[paraphrase]*. Sources that were blocked or not verified verbatim are flagged.

### TL;DR for the decision

1. **I found no authorized, user-consented API route to a person's IMDb ratings.** The IMDb API is B2B only (AWS SigV4 plus a staff-issued API key) and covers only title/name data. Login with Amazon exposes only profile, user_id and postal code. Amazon's DMA-driven Data Portability API has about 70 OAuth scopes, but none cover IMDb ratings or watchlists; its only IMDb reference is IMDbPro subscription billing.
2. **DMA Art. 6(9) does not reach IMDb.** Amazon is a gatekeeper only for "Marketplace" and "Amazon Advertising".
3. **The strongest legal lever is GDPR Art. 20.** Ratings are data the user "actively and knowingly provided" under contract, so the portability right very likely applies, and Art. 20(2) grants direct controller-to-controller transfer "where technically feasible". However, IMDb is not obliged to build compatible systems, and its current delivery is a one-off, email-verified archive. It is not a sync channel.
4. **Automated retrieval conflicts with the plain Conditions of Use and robots.txt.** The Conditions contain no carve-out for a user acting on their own data, and robots.txt ends `User-agent: * / Disallow: /`. US precedent (*Facebook v. Power Ventures*) shows that user permission does not defeat the platform's rights once the platform expressly revokes access. Meanwhile, I found no public IMDb enforcement against personal sync tools (see §4).
5. **Only a direct licensing or partnership conversation could legitimize service-side sync.** Published data licenses start at about $150,000 per year for bulk metadata, and none of them include user data.

---

### 1. Authorized and partner routes

#### 1.1 IMDb API / data licensing (data.imdb.com, AWS Data Exchange)

- **Scope:** "The IMDb API provides an industry standard solution to receive real-time access to premier IMDb title and name entertainment datasets." Its documentation sections are only Title/Name, Box Office and Search. The pages contain no user, OAuth, consent, rating or watchlist concepts. [API overview](https://data.imdb.com/documentation/api-documentation/)
- **Auth model is B2B only:** it requires "An AWS Account", "AWS Access Keys", and an API key that "was sent to you by a member of IMDb staff". "Subscription requests will be processed by IMDb staff within five business days." There is no end-user authorization flow, so user-level data cannot be delegated through it. [Getting access](https://data.imdb.com/documentation/api-documentation/getting-access/), [Key concepts](https://data.imdb.com/documentation/api-documentation/key-concepts/)
- **Products:** Essential Metadata, Box Office Mojo, and add-ons (Meters, User Reviews, Parents Guide, Trivia). "IMDb Ratings" here means the aggregate: "The world-renowned IMDb 1-10 star rating, a daily-computed average of votes". [data.imdb.com](https://data.imdb.com/) (the URL `imdb.com/licensing/` redirects here)
- **Pricing signal:** the AWS Marketplace listing "IMDb Essential Metadata for Movies/TV/OTT (Bulk Data)" shows **$150,000.00** for a 12-month contract. Its data-sensitivity label is "No personal data". [AWS Marketplace listing](https://aws.amazon.com/marketplace/pp/prodview-yeuyizioqmfsy), verified in the raw HTML. API product prices were not checked.
- **Contact paths (not used):** the "Contact Us" form on data.imdb.com, `imdb-licensing-support@imdb.com` (given in the release notes for evaluation access) [release notes](https://data.imdb.com/documentation/), and the developer contact at `https://help.imdb.com/contact/developer/` [API overview](https://data.imdb.com/documentation/api-documentation/).
- **Non-commercial use** is limited to the published datasets: "The data must be taken only from the datasets made available … You may not use data mining, robots, screen scraping, or similar online data gathering and extraction tools on our website. If the information/data you want is not present in our datasets, it means it's not available for non-commercial usage." [Can I use IMDb data in my software?](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)
- **The "IMDb Partners" page** lists only content suppliers (ERC, Famous Frames, MPA, MPTV, WGA, WireImage). No partner that receives user data is listed. [IMDb Partners](https://help.imdb.com/article/imdb/general-information/imdb-partners/G8TZTG4LR6ZV4LXZ)
- **Known recipients of user ratings:** the only documented recipients are Amazon and its affiliates. "We share user information with our parent corporation (Amazon.com, Inc.), the subsidiaries it controls…" Other sharing occurs for transactions and service providers, and "Other than as set out above, you will receive notice when personal information about you might be shared with third parties". I found no public third-party partner that receives IMDb user ratings. Whether Prime Video/Fire TV use them internally is plausible but was not verified. [IMDb Privacy Notice, last updated Aug 3 2026](https://www.imdb.com/privacy)
- **Assessment:** no public product exists. A bespoke partnership remains a theoretical route, and its availability and terms are unknown (*unverified*). The privacy notice lists, as data the user gives IMDb, "use Login with Amazon or otherwise link your IMDb account to a third-party business". That shows account linking to third parties exists as a concept, but I found no public program for it.

#### 1.2 Login with Amazon (LWA)

- IMDb now runs on Amazon's account system: "IMDb now uses Amazon's account system for sign-in and new account creation" (updated 5 Aug 2026). [Use your Amazon account for IMDb](https://help.imdb.com/article/imdb/general-information/use-your-amazon-account-for-imdb/GAW6LFMJ8HBGPKXL). US Amazon users are auto-signed in. [IMDb SSO with Amazon](https://help.imdb.com/article/imdb/general-information/imdb-single-sign-on-with-amazon/G9JR2GEAFLVH72VV)
- **Standard LWA scopes are only `profile`, `profile:user_id` and `postal_code`.** None grants IMDb data. [LWA customer profile](https://developer.amazon.com/docs/login-with-amazon/customer-profile.html)
- **Amazon Data Portability API** (the DMA compliance tool, which uses LWA OAuth with `portability::*` scopes) is the only consumer-consented Amazon data API. Its [Available scopes](https://developer.amazon.com/docs/amazon-data-portability/available-scopes.html) page (last updated Sep 30, 2026) lists Category 1–3 scopes: orders, reviews of *products* (1–5 stars), lists (for example "occasion lists"), search history, and Alexa/Echo/Fire TV/Kindle device metrics. It has **no IMDb rating, IMDb watchlist or Prime Video watch-history scope**. "IMdbPro" appears only as a value in the digital-subscriptions enum. [Upcoming scopes](https://developer.amazon.com/docs/amazon-data-portability/upcoming-scopes.html): "There are no planned upcoming scopes at the moment." Access requires business identity verification and a security assessment, plus allowlisting through a support case. [Allowlisting](https://developer.amazon.com/docs/amazon-data-portability/portability-allowlist.html)
- **Consequence:** LWA can authenticate a GoodWatch user as an Amazon customer, but it cannot retrieve their IMDb ratings. A "request additional data categories" channel exists; the Commission's DMA portal links `https://www.amazon.de/hz/contact-us/foresight/hubgateway-issues-12`. [DMA developer portal: end-user data portability](https://digital-markets-act.ec.europa.eu/developer-portal/end-user-data-portability_en) Using it is possible, but Amazon has no duty to add non-CPS data (see §3.3).

### 2. IMDb Conditions of Use and robots.txt

Source: [imdb.com/conditions](https://www.imdb.com/conditions), fetched 2026-09-30. It has no visible "last updated" date.

- **License grant:** "…grants you a limited, non-exclusive, non-transferable, non-sublicenseable license to access and make personal and non-commercial use of the IMDb Services, … and not to download (other than page caching) or modify this site, or any portion of it, except with express written consent of IMDb." and "The IMDb Services or any portion of such services may not be reproduced, duplicated, copied, sold, resold, visited, or otherwise exploited for any commercial purpose without express written consent of IMDb."
- **Robots and Screen Scraping:** "You may not use data mining, robots, screen scraping, or similar data gathering and extraction tools on this site, except with our express written consent as noted below."
- **Consent path:** "We do allow the limited use of robots and crawlers, such as those from certain search engines, with our express written consent. If you are interested in receiving our express written permission to use robots or crawlers on our site, please contact our Licensing Department".
- **Account responsibility:** "…you agree to accept responsibility for all activities that occur under your account or password, including use by any person you permit to access IMDb Services through your account." Delegating access is therefore contemplated, but the user remains liable. "IMDb reserves the right to refuse service, terminate accounts…"
- **IMDb Software** (apps): "You may not … use it, or any portion of it, over a network" and there is a "No Reverse Engineering" clause. This is relevant if an extension calls internal app/GraphQL endpoints *(inference)*.
- **Own-data carve-out:** **none.** The Conditions do not distinguish a user extracting their own ratings. The only sanctioned self-service path is the site's own Export feature (see the first-pass note).
- **Law and forum:** Washington law, with mandatory JAMS arbitration and a class waiver. There is an IP carve-out for injunctions in King County. The arbitration clause governs "you and IMDb". GoodWatch as a non-user company would not be bound by it, but also would have no license at all *(inference)*.

**robots.txt** ([imdb.com/robots.txt](https://www.imdb.com/robots.txt), fetched 2026-09-30):

```
# Use of any device, tool, or process designed to data mine or scrape the content
# using automated means is prohibited without prior written permission from IMDb.
# For authorized data access and licensing inquiries, see: https://www.imdb.com/licensing/
...  (named search/social/Amazon bots) Allow: / ... Disallow: /user/ur*/reviews ...
User-agent: *
Disallow: /
```

The file has no specific rules for `/user/…/ratings`, `/list/` or `/exports/` because **every non-allowlisted agent is disallowed from the entire site**. Robots.txt is not law. It is, however, evidence of express non-consent, which matters for trespass, CFAA-style or ToS arguments.

**Anti-bot posture:** a third-party scraper project reports its scraper as "non‑functional due to the enforcement a web application firewall on imdb.com". [Ember-MM issue #30](https://github.com/nagten/Ember-MM-Newscraper/issues/30). This is a secondary source that was not verified.

### 3. Data portability law

#### 3.1 GDPR Art. 20 (portability) and Art. 15 (access)

Canonical text: [EUR-Lex 32016R0679](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679). EUR-Lex was bot-blocked, so the verbatim text below was taken from the mirror [gdpr-info.eu](https://gdpr-info.eu/art-20-gdpr/).

- **Art. 20(1):** "The data subject shall have the right to receive the personal data concerning him or her, which he or she has provided to a controller, in a structured, commonly used and machine-readable format and have the right to transmit those data to another controller without hindrance from the controller to which the personal data have been provided, where: (a) the processing is based on consent … or on a contract pursuant to point (b) of Article 6(1); and (b) the processing is carried out by automated means."
- **Art. 20(2):** "…the data subject shall have the right to have the personal data transmitted directly from one controller to another, where technically feasible."
- **Recital 68:** "The data subject's right to transmit or receive personal data … should not create an obligation for the controllers to adopt or maintain processing systems which are technically compatible." It also says "Data controllers should be encouraged to develop interoperable formats". [Recital 68](https://gdpr-info.eu/recitals/no-68/)
- **Art. 15(3):** "The controller shall provide a copy of the personal data undergoing processing. … Where the data subject makes the request by electronic means … the information shall be provided in a commonly used electronic form." [Art. 15](https://gdpr-info.eu/art-15-gdpr/)
- **Art. 12(3):** the controller must respond "without undue delay and in any event within one month of receipt of the request", extendable "by two further months". **Art. 12(5):** repetitive requests may be charged for or refused as "manifestly unfounded or excessive". [Art. 12](https://gdpr-info.eu/art-12-gdpr/) This limits Art. 20 as a *frequent* sync mechanism *(inference)*.
- **WP29 Guidelines WP242 rev.01** (endorsed by the EDPB in 2018) [PDF](https://ec.europa.eu/newsroom/article29/redirection/document/44099):
  - "provided by the data subject" covers "Data actively and knowingly provided by the data subject" and "Observed data provided by the data subject by virtue of the use of the service". **Personal ratings fit squarely here.**
  - "As a good practice, data controllers should start developing … download tools and Application Programming Interfaces" (a recommendation, not an obligation).
  - "The GDPR does, however, prohibit controllers from establishing barriers to the transmission."
  - The sending controller "is not responsible for compliance of the receiving data controller", and it "should set safeguards to ensure they genuinely act on the data subject's behalf".
- **IMDb's own position:** IMDb.com, Inc. (Seattle) is the controller, and Amazon Europe Core S.à r.l. (Luxembourg) is its EU representative. The privacy notice cites "Performance of a contract when we provide you with IMDb Services" and states "you have the right to request access to, correct, and delete your personal data, and to ask for data portability." [IMDb Privacy Notice](https://www.imdb.com/privacy). Contract-based processing means Art. 20 very likely applies to ratings *(inference; IMDb has not stated this per data category)*.
- **What IMDb actually delivers:** a "Request my data" flow (`/registration/data-requests/`) with email verification within 5 days and a 90-day download window. For Amazon-linked accounts: "Accessing your Amazon personal information will include your IMDb and IMDbPro account associated data." [Request account data](https://help.imdb.com/article/imdb/general-information/how-can-i-request-my-imdb-account-data/GPM94GL779DCMTY5). **The archive's file format and ratings schema are not documented publicly. This is unverified and needs a real test request.**
- **Can GoodWatch trigger an Art. 20(2) direct transfer on the user's behalf?** The legal text permits it "where technically feasible", but IMDb offers no endpoint for it. In practice this means a manual request that IMDb could answer with the same archive. Whether a mandated agent (GoodWatch) can file the request is not addressed in Art. 20. Practice among DPAs varies *(uncertain)*. **Practical reading:** the GDPR guarantees a periodic, user-initiated, machine-readable copy, which strengthens the CSV-import path. It does **not** guarantee continuous API sync.

#### 3.2 EU Data Act (Reg. (EU) 2023/2854)

*[paraphrase, not verbatim-verified: EUR-Lex blocked]* Its access and sharing rights (Arts. 3–5) cover data generated by **connected products and related services** (IoT), and Chapter VI covers switching between data processing (cloud/SaaS) providers. A website rating feature is neither. The cloud-switching chapter targets customers of data-processing services, not consumers of a media database. **This regulation is likely not relevant.** [EUR-Lex 32023R2854](https://eur-lex.europa.eu/eli/reg/2023/2854/oj)

#### 3.3 DMA (Reg. (EU) 2022/1925) Art. 6(9)

- Text: "The gatekeeper shall provide end users and third parties authorised by an end user, at their request and free of charge, with effective portability of data provided by the end user or generated through the activity of the end user **in the context of the use of the relevant core platform service**, … including by the provision of continuous and real-time access to such data." (verbatim as quoted in search results; EUR-Lex could not be fetched) [EUR-Lex 32022R1925](https://eur-lex.europa.eu/eli/reg/2022/1925/oj)
- **Amazon's designated core platform services are exactly two:** "Marketplace | Case DMA.100018" and "Amazon Advertising | Case DMA.100016". [Official gatekeeper list](https://digital-markets-act.ec.europa.eu/gatekeepers_en)
- **Conclusion:** IMDb is not a designated CPS, so Art. 6(9)'s continuous, real-time portability duty does not apply to IMDb ratings. This also explains why Amazon's Data Portability API omits them (see §1.2).

#### 3.4 CCPA/CPRA (US-California users)

Cal. Civ. Code §1798.130(a)(3)(B)(iii) requires providing personal information "in a structured, commonly used, machine-readable format that may also be transmitted to another entity at the consumer's request without hindrance", "to the extent technically feasible". [§1798.130 (public.law mirror)](https://california.public.law/codes/civil_code_section_1798.130); the official source is [leginfo](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.130), which timed out. Like the GDPR, this yields a copy, not a sync API. IMDb links to "additional state-specific privacy disclosures" from its privacy notice.

### 4. Enforcement signals and precedents (brief, practical)

#### IMDb/Amazon enforcement against scrapers and sync tools

- **GitHub DMCA repo:** a code search for "imdb" in [github/dmca](https://github.com/github/dmca) returned 13 notices. None was filed by IMDb against a scraper or sync tool. The hits were studio/Amazon Content Services piracy notices that cite IMDb title pages as proof of ownership, for example [2026-09-29-amazon.md](https://github.com/github/dmca/blob/master/2026/09/2026-09-29-amazon.md), plus an MIT-attribution dispute between two IMDb scraper libraries ([2026-07-29-imdbinfo.md](https://github.com/github/dmca/blob/master/2026/07/2026-07-29-imdbinfo.md)). Caveat: GitHub code search may not index every file.
- **Open-source scrapers persist publicly:** as of 2026-09-30 (checked with `gh api`), [cinemagoer](https://github.com/cinemagoer/cinemagoer) had its last push on 2026-08-25 (about 1.3k stars), [imdbinfo](https://github.com/tveronesi/imdbinfo) on 2026-09-25, [IMDB-Trakt-Syncer](https://github.com/RileyXX/IMDB-Trakt-Syncer) on 2026-07-20, and [TraktRater](https://github.com/damienhaynes/TraktRater) on 2026-08-30. [imdb-trakt-sync](https://github.com/cecobask/imdb-trakt-sync) was archived on 2026-08-02; the first-pass note attributes this to Trakt API access, not IMDb.
- **No public C&D letter, lawsuit or Chrome Web Store takedown by IMDb against a personal rating-sync tool was found** (web search, 2026-09-30). Absence of evidence is weak evidence: C&D letters are usually private. IMDb's observed enforcement is technical (WAF, CAPTCHA). A commercial, branded, well-known service is a more likely target than hobby tools *(inference)*.

#### Case law (risk framing, not legal advice)

| Case | Holding relevant here | Relevance to GoodWatch |
|---|---|---|
| *Facebook v. Power Ventures* (9th Cir. 2016) [opinion](https://cdn.ca9.uscourts.gov/datastore/opinions/2016/12/09/13-17102.pdf) | A tool used *with users' permission* initially had "arguable permission", but once Facebook sent a C&D, continued access violated the CFAA. "Once permission has been revoked, technological gamesmanship or the enlisting of a third party to aid in access will not excuse liability." Also: "a violation of the terms of use of a website, without more, cannot be the basis" for CFAA liability. | **This is the closest analogue.** User consent does not immunize a service that retrieves user data from a platform that objects. Before any C&D, the ToS-violation risk is contractual, not criminal (US). After a C&D, the risk escalates sharply. |
| *hiQ v. LinkedIn* (9th Cir. 2022) [opinion](https://cdn.ca9.uscourts.gov/datastore/opinions/2022/04/18/17-16783.pdf) | CFAA "without authorization" likely does not apply to *public* data. But the court also said "breach of contract … trespass to chattels … may also lie". On remand (N.D. Cal., Nov 2022), hiQ was held to have breached the User Agreement. It settled with a $500k consent judgment and an injunction (secondary: [Proskauer](https://newmedialaw.proskauer.com/2022/12/08/hiq-and-linkedin-reach-proposed-settlement-in-landmark-scraping-case/)). | Private ratings sit behind login, so the public-data line does not help. Ending up in breach of contract is the realistic exposure. |
| *Meta v. Bright Data* (N.D. Cal. No. 3:23-cv-00077, Jan 23 2024) [docket](https://www.courtlistener.com/docket/66706470/meta-platforms-inc-v-bright-data-ltd/) | Meta's terms did not bar **logged-off** scraping of public data by a non-user (secondary: [FBM summary](https://www.fbm.com/technology/publications/major-decision-affects-law-of-scraping-and-online-data-collection-meta-platforms-v-bright-data/)). | This cuts **against** logged-in extraction. Ratings sync needs the user's session, where the ToS clearly binds. |
| *Ryanair v PR Aviation* (CJEU C-30/14, 15 Jan 2015) [CURIA](https://curia.europa.eu/juris/liste.jsf?num=C-30/14) | *[paraphrase; the verbatim operative part could not be fetched]* Where a database is protected by neither copyright nor the sui generis right, the Database Directive does not stop its maker from imposing contractual limits on use (subject to national law). | In the EU, IMDb's scraping ban can be enforced as a contract term against users regardless of database-right status. Note the corollary: if the database *is* protected, Arts. 8/15 give lawful users a non-waivable right to extract *insubstantial* parts, bounded by Art. 7(5) (systematic repeated extraction). A single user's own ratings are plausibly insubstantial, but this argument is untested *(uncertain)*. |
| *CV-Online Latvia v Melons* (CJEU C-762/19, 3 Jun 2021) (secondary: [Bird & Bird](https://www.twobirds.com/en/insights/2021/uk/cv-online-latvia-cjeu-complicates-the-enforcement-of-database-rights)) | Sui generis infringement requires a risk to the maker's investment. | This supports the view that extracting user-contributed personal ratings creates low database-right risk. The contract/ToS risk remains. |

**Net risk picture *(inference)*:**

- **Low risk:** CSV upload of an IMDb-provided export, a GDPR archive upload, or a user-initiated export-assist extension that clicks IMDb's own Export button and hands the file to GoodWatch.
- **Medium risk:** an extension that reads the rating pages or internal endpoints in the user's session and transmits the ratings to GoodWatch. The user breaches the ToS; GoodWatch faces inducement/tortious-interference exposure, and the risk escalates on a C&D.
- **High risk:** server-side scraping with stored user credentials or cookies, or crawling public profiles at scale.

### 5. Chrome Web Store policy

Source: [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) (last updated 2025-05-22). Quotes were verified against the page HTML.

- "Do not facilitate unauthorized access to content on websites, such as circumventing paywalls or login restrictions." Reading the user's *own* logged-in data is not circumvention of a login, but a reviewer or IMDb could frame a ToS-forbidden extraction as "unauthorized" *(uncertain)*.
- "We don't allow content that harms or interferes with the operation of the networks, servers, or other infrastructure of Google or any third-parties." This bears on request volume and rate limiting.
- Limited Use: "Extensions may only collect, use, or transmit user data that is necessary for the extension's disclosed single purpose". Transfers to third parties are allowed only "If necessary to providing or improving your single purpose…". The requirements "also apply to scraped content or otherwise automatically gathered user data." Transmitting IMDb ratings to GoodWatch is allowed if it is the disclosed single purpose and has a privacy policy.
- "An extension must have a single purpose that is narrow and easy to understand."
- "Request access to the narrowest permissions necessary…" and "Don't attempt to 'future proof' your Product by requesting a permission…". Use a host permission for `imdb.com` only.
- "don't represent that your product is authorized by, endorsed by, or produced by another company". Do not imply an IMDb partnership, and use the IMDb name carefully (trademark).
- **There is no explicit rule requiring compliance with third-party site ToS.** Store approval is therefore a separate question from IMDb authorization, as the first-pass note says. Trademark or unauthorized-access complaints from Amazon could still trigger removal (*no IMDb-specific precedent found*).

### 6. Suggested next steps (no contact made)

1. Test the GDPR/account-data request on a real account and document the archive format and whether ratings are included. If they are, add "IMDb data archive" as a second import source.
2. Treat any automated extension as an **export-assist** feature (it triggers IMDb's own Export and handles the download) rather than a scraper. Keep it user-initiated.
3. If continuous sync becomes strategic, send a written inquiry to `imdb-licensing-support@imdb.com` or the data.imdb.com contact form, explicitly asking about user-authorized rating export. Optionally, submit a request through Amazon's "request additional data categories" channel for an IMDb-ratings scope in the Data Portability API.
4. Get counsel review before shipping any in-session extraction, especially regarding EU-law interplay (Ryanair, Database Directive Arts. 8/15) and US exposure after any C&D (Power Ventures).

---

## Part C: Reading ratings from a signed-in browser

Research date: 2026-09-30 (probes run 2026-09-30 ~21:45 UTC from a Danish IP / CloudFront POP CPH50). Follow-up to `docs/research/imdb-ratings-import.md`; this note covers only what that note left unproven: *how real tools actually retrieve ratings today*, and what that implies for an MV3 extension.

Method: read source of real tools (raw GitHub, a Chrome Web Store CRX unpacked in memory, Greasy Fork script source), official Chrome/MDN/WebKit docs, and six unauthenticated HTTP probes. No login, no bulk requests, no challenge bypass. Nothing here was tested with a signed-in IMDb session: everything about authenticated behaviour is inferred from other people's code and is marked accordingly.

Labels: **[source]** = read in code; **[probe]** = observed directly; **[doc]** = official documentation; **[claim]** = asserted by a third party, not verified; **[unverified]** = not established.

---

### 1. Bottom line

1. There are four known ways to get a user's ratings, all in use by real tools today:
   - **A. Export automation** (click Export on the ratings page, poll `/exports`, download CSV). Used by RileyXX and cecobask. Complete, includes rating date, but asynchronous and entirely DOM-selector driven.
   - **B. Ratings-page pagination** (`/user/<id>/ratings/?page=N`, 250 per page), read from DOM or from `__NEXT_DATA__`. Used by the only Chrome extension found that does this (Movie Ratings Sync) and by a 2026 userscript.
   - **C. GraphQL `userRatings(userId:, first:)` on `api.graphql.imdb.com`**. One request returns rating value, full ISO timestamp, title type and parent series. Used by one small 2026 repo. Reportedly needs no authentication at all, even for private ratings **[claim]**; this looks like an IMDb access-control gap rather than a supported route and should not be built on (section 3.3).
   - **D. Per-title persisted query `PersonalizedUserData`** with `credentials: 'include'` from an imdb.com page, to attach the user's rating to known title IDs. Used by the same 2026 userscript.
2. **A content script (or injected tab) on `www.imdb.com` is the robust architecture; a bare service-worker fetch is not.** `www.imdb.com` answers non-browser requests with an AWS WAF JavaScript challenge **[probe]**, and the GraphQL endpoint only allows credentialed CORS from `https://www.imdb.com` **[probe]**. Every working browser-based tool found runs inside an imdb.com page.
3. **Breakage frequency is high.** cecobask's syncer needed IMDb-side fixes roughly monthly in 2026 (Jan, Apr x2, May x2, Jun x2, Jul x3) before being archived; Kometa's persisted-query hash for the watchlist changed 12 times in the 12 months to May 2026.
4. **Existing adoption is tiny.** The one Chrome extension that reads personal IMDb ratings has 21 users. No extension with meaningful adoption does this; none was found to have been removed, but removal history is **[unverified]** (stores do not list removed items).
5. IMDb's `robots.txt` (fetched 2026-09-30) disallows everything for `User-agent: *` and states that scraping by automated means "is prohibited without prior written permission from IMDb". The GraphQL endpoint reportedly returns a "Public, commercial, and/or non-private use ... is not allowed" disclaimer with every response **[claim]**. The permission question in the first note is unchanged and is sharpened by this.

---

### 2. Direct observations (probes, 2026-09-30)

| # | Command (abridged) | Result |
| --- | --- | --- |
| 1 | `curl -A <Chrome UA> https://www.imdb.com/robots.txt` | 200. Header comment: "Use of any device, tool, or process designed to data mine or scrape the content using automated means is prohibited without prior written permission from IMDb." Named crawlers get a specific list including `Disallow: /user/ur*/reviews`; `User-agent: *` gets `Disallow: /`. |
| 2 | `curl -A <Chrome UA> https://www.imdb.com/user/ur0000001/ratings/` | **HTTP 202, empty body, `x-amzn-waf-action: challenge`**, `access-control-expose-headers: x-amzn-waf-action`. No HTML, so `__NEXT_DATA__` presence could not be checked directly. |
| 3 | `curl -A <Chrome UA> https://www.imdb.com/title/tt0111161/` | Same: 202 + `x-amzn-waf-action: challenge`. The challenge is site-wide, not specific to user paths. |
| 4 | `curl -X OPTIONS https://api.graphql.imdb.com/` with `Origin: chrome-extension://<id>` | 204 with **`x-cors-rejected: 1`** and no `access-control-allow-*` headers. |
| 5 | Same with `Origin: https://www.imdb.com` | 204, `access-control-allow-origin: https://www.imdb.com`, **`access-control-allow-credentials: true`**, `access-control-allow-methods: POST`, `access-control-max-age: 600`. `caching.graphql.imdb.com` behaves the same and additionally allowed the requested `x-imdb-user-country` header. |
| 6 | `curl -X POST https://api.graphql.imdb.com/` with a trivial public `title(id)` query, with and without browser UA + imdb.com Origin, **without** `x-imdb-client-name` | **403** from `awselb/2.0`. Consistent with Kometa's 2026-07-30 fix (section 3.2): requests must send `x-imdb-client-name: imdb-web-next`. I did not retry with that header. |

Implications:
- A plain HTTP client (including a server-side GoodWatch job) cannot fetch imdb.com HTML without executing the WAF challenge. A real browser tab solves it transparently; a service-worker `fetch()` would receive the 202 challenge unless a valid `aws-waf-token` cookie already exists in the profile **[inference; unverified in an extension]**.
- CORS on GraphQL is restricted to imdb.com origins with credentials. A page-context or content-script fetch on `www.imdb.com` satisfies it. An extension service worker with host permissions is not subject to CORS in Chrome **[doc]**, but whether IMDb additionally rejects a `chrome-extension://` Origin header server-side on POST is **[unverified]** (the preflight rejection header suggests the edge function inspects Origin).

---

### 3. IMDb web internals as used by real tools

#### 3.1 Export flow (route A)

**cecobask/imdb-trakt-sync** (Go + headless Chrome via go-rod; archived 2026-08-02, last push 2026-08-02).
File: https://raw.githubusercontent.com/cecobask/imdb-trakt-sync/main/internal/imdb/api.go

- Auth: sets cookie `at-main` on `.imdb.com`; `ubid-main` is set to the literal string `"dummy"` with the comment `// value does not matter` (commit a53905d6, 2025-06-28, "do not require imdb cookie ubid-main"). So **`at-main` alone carries the web session** **[source]**.
- Paths: `pathExports = "/exports"`, `pathRatings = "/user/%s/ratings"`, `pathWatchlist = "/list/watchlist"`, `pathLists = "/profile/lists"`.
- Start export: click `div[data-testid='hero-list-subnav-export-button'] button`, **or** open `button[data-testid='hero-list-subnav-actions-menu-button']` and click the "Export" item. Comment in source: "IMDb currently serves two different UI variants for the export action ... which one a given page load gets appears to vary." It then waits for a network request whose URL contains **`pageAction=start-export`**. The underlying request (GraphQL mutation name or REST call) is not named in any source found: **[unverified]**.
- Poll: reload `/exports` every 30 s, up to 30 attempts, until no `span[data-testid='export-status-button'].PROCESSING` remains for the matching `li[data-testid='user-ll-item']`.
- Download: click `button[data-testid='export-status-button']` and capture the browser download. The download URL (S3 presigned or otherwise) is never read by the tool, so its shape and lifetime are **[unverified]**.
- Ratings row is identified by link `href` prefix `/user/<userID>/ratings`.
- CSV header checked with exact equality: `Const, Your Rating, Date Rated, Title, Original Title, URL, Title Type, IMDb Rating, Runtime (mins), Year, Genres, Num Votes, Release Date, Directors`. Rating parsed as float since commit 141f0d4e (2026-01-27, issue #96 "Unmarshal double into int"); date parsed as date-only.

**RileyXX/IMDB-Trakt-Syncer** (Python + Selenium; last commit 2026-07-20).
File: https://raw.githubusercontent.com/RileyXX/IMDB-Trakt-Syncer/main/IMDBTraktSyncer/imdbData.py

- Uses the alias **`https://www.imdb.com/list/ratings`** (no user ID needed) and the same export-button selector; polls `/exports/` every 30 s for up to 1200 s looking for the text "in progress" in `.ipc-metadata-list-summary-item`; finds the download button by matching the row text "ratings".
- For reviews it loads **`https://www.imdb.com/profile`** and waits for the redirect URL to contain `user/` to learn the user path.
- Uses no GraphQL at all (repo-wide search for "graphql" returned nothing).

**RatS** (`RatS/imdb/imdb_ratings_parser.py`, last touched 2024-05-07): still calls the legacy synchronous URL `https://www.imdb.com/list/export?list_id=ratings&author_id=<id>` and reads the user ID from `//div[@data-userid]` on `/profile`. This predates the asynchronous export page; whether it still works is **[unverified]** and unlikely.
https://raw.githubusercontent.com/StegSchreck/RatS/master/RatS/imdb/imdb_ratings_parser.py

**TraktRater** (`Sites/IMDbWeb.cs`): scraper logic dates from 2020-06-07 and targets pre-redesign markup (`lister-page-next`, `paginationKey`, `mode=detail`). Treat as dead for web scraping; its CSV path is the usable one.
https://raw.githubusercontent.com/damienhaynes/TraktRater/master/Sites/IMDbWeb.cs

#### 3.2 Ratings page, `__NEXT_DATA__`, pagination (route B)

The ratings page is a Next.js page with a `__NEXT_DATA__` script. Not observed directly (probe 2 was challenged), but three independent sources read it:

- **Greasy Fork "Movie Rating Sync"** (id 584280, v1.0, created 2026-06-25, updated 2026-06-29, 42 installs; `@match https://www.imdb.com/*`, `@grant GM_addStyle`).
  https://greasyfork.org/en/scripts/584280-movie-rating-sync/code
  - User ID: `JSON.parse(#__NEXT_DATA__).props.pageProps.requestContext.sidecar.account.userId`, falling back to `/user/(ur\d+)` in the URL.
  - Fetches `https://www.imdb.com/user/${uid}/ratings/?page=${p}` same-origin, regex-extracts `__NEXT_DATA__`, reads **`props.pageProps.mainColumnData.advancedTitleSearch`** with `edges[]` and `pageInfo.hasNextPage`; node shape `edge.node.title.{id,titleText,originalTitleText,releaseYear,titleType}`.
  - It does **not** take the rating value from those edges. It sets `rating: null` and then fills ratings with a separate GraphQL call (route D below). Whether the user's rating value is present in `__NEXT_DATA__` edges is therefore **[unverified]**; this script's behaviour suggests it is not reliably there.
- **Movie Ratings Sync extension** (section 4) reads the rendered DOM instead: per-item `aria-label` matching `/your rating[:\s]+(10|[1-9])\b/i`, total from a header like "1 - 250 · 1179 titles". Its comments record that item shells mount first and "rating widgets" hydrate later, so scraping too early yields "250 items with 0 parseable ratings". This corroborates that ratings arrive client-side after the initial payload.
- **cecobask** reads `__NEXT_DATA__` on `/list/watchlist`: `props.pageProps.aboveTheFoldData.{authorId, authorProfileId, listId}`.

Pagination facts from the extension's source comments (`lib/targets/imdb.js`): legacy params `view=detail, start=N, count=M` are silently stripped; **`?page=N` is honoured, 250 items per page**; the canonical sort param is `sort=date_added%2Cdesc` (a literal comma triggers a redirect that kills the content script); **`/user/me/ratings/` returns 404**.

#### 3.3 GraphQL

Endpoint `https://api.graphql.imdb.com/` (POST JSON). `caching.graphql.imdb.com` serves GET persisted queries for the web app and returns 403 to non-browser clients per one source **[claim]**.

**Required header.** Kometa PR #3445 (merged 2026-07-30): "IMDb GraphQL requests were being rejected with HTTP 403 because they did not identify the IMDb web client"; fix was to send `x-imdb-client-name: imdb-web-next`. Matches probe 6.
https://github.com/Kometa-Team/Kometa/pull/3445 and https://raw.githubusercontent.com/Kometa-Team/Kometa/master/modules/imdb.py (`_graph_request`)

**Auth on GraphQL is the cookie.** TobiasPankner/Letterboxd-to-IMDb (last commit 2026-01-25) posts to `api.graphql.imdb.com` with only `content-type` and the browser's full `cookie` header, and detects failure by an error message containing "Authentication"; HTTP 429 is handled as a rate limit. No `x-amzn-sessionid` or CSRF token is sent in any source read. Which individual cookies are required on the GraphQL host is **[unverified]** (the tool passes the whole cookie string).
https://raw.githubusercontent.com/TobiasPankner/Letterboxd-to-IMDb/master/letterboxd2imdb.py

**Page-context fetch works with `credentials: "include"`.** Greasy Fork "IMDB Ratings Importer" (id 463836, v2.01, 503 installs, updated 2024-05-22, `@include https://www.imdb.com/user/ur*/ratings*`, `@grant none`) calls `fetch("https://api.graphql.imdb.com/", {credentials: "include", mode: "cors", headers: {Accept: "application/graphql+json, application/json", "content-type": "application/json"}})` with `mutation UpdateTitleRating($rating: Int!, $titleId: ID!) { rateTitle(input: {rating: $rating, titleId: $titleId}) { rating { value } } }`. This is a write, but it proves the cross-subdomain credentialed pattern from an imdb.com page, consistent with probe 5. Note its `@include` only matches `ur` IDs, so it will not run for accounts whose URL uses the new `p.` form.
https://greasyfork.org/en/scripts/463836-imdb-ratings-importer/code

**Operations seen in source:**

| Operation | Kind | Used by | Notes |
| --- | --- | --- | --- |
| `userRatings(userId: ID!, first: Int!)` → `total`, `edges.node.userRating{value date}`, `edges.node.title{...}` | plain query text | MichaelHP23/imdb-ratings-graphql `src/imdb.js` (commit 33cb3311, 2026-09-24) | Accepts only `ur…` IDs; a `p.…` ID gives "Internal server error". `first: 250` used. Cursor pagination (`after`, `pageInfo`) not exercised by the tool: **[unverified]**. A `RatingsSortBy` enum exists but values are unknown; introspection is disabled. `date` is a full ISO timestamp (CSV is date-only). |
| `userProfile(input: {profileId})` → `userId`, `nickName` | plain query text | same repo; Kometa `_resolve_profile_id` | Maps new `p.…` profile ID to legacy `ur…` ID. |
| `PersonalizedUserData` | persisted, sha256 `7c4e0771…99cc` | Greasy Fork 584280 | Variables `{locale, idArray, includeUserData: true, includeWatchedData: true, location, fetchOtherUserRating: false}`; returns `userRating.value` per title; sent with `credentials: 'include'`. |
| `WatchListPageRefiner` / `TitleListMainPage` / `AdvancedTitleSearch` | persisted | Kometa | Variables `urConst` / `lsConst`, `first` (100 for lists, 250 for search), `after` cursor from `pageInfo.endCursor`; result under `predefinedList.titleListItemSearch` or `list.titleListItemSearch`. Hashes are fetched from a separate repo because they rotate. |
| `UpdateTitleRating` (`rateTitle`) | mutation text | Letterboxd-to-IMDb, Greasy Fork 463836 | Write path; not needed for import. |

No source was found for a persisted ratings-page operation named `RatingsPage` / `userRatingsSearch`, nor for the export-request mutation. GitHub code search for those names returned nothing. **[unverified]**

**The unauthenticated `userRatings` claim.** The MichaelHP23 README states that `api.graphql.imdb.com` "answers `userRatings(userId:)` with no authentication at all" and "a private account's ratings came back unchanged in testing." https://github.com/MichaelHP23/imdb-ratings-graphql (created 2026-09-12, 0 stars, 4 commits). I did **not** test this: doing so means reading another account's possibly private data. Assessment:
- If true, it is an authorization gap on IMDb's side, likely to be closed without notice; the same code already handles an "Authentication required" error and a "withheld" case (total > 0 but no rows).
- It gives no proof that the person importing owns the profile, which the first note already flagged as the problem with public-profile routes.
- The README quotes a disclaimer returned with every response: "Public, commercial, and/or non-private use of the IMDb data provided by this API is not allowed."
- The repo's Cloudflare Worker example needed a 429 workaround within 8 days (commits 2026-09-20, 2026-09-24), so server-side callers are rate limited.
- What it legitimately tells us is the **schema**: an authenticated page-context call to `userRatings` for the user's own ID would return value + timestamp + type + parent series in one or a few requests. That is the most attractive technical route for an extension, but it is the least proven for authenticated, paginated use.

#### 3.4 Discovering the user ID

IMDb now has **two ID formats**: legacy `ur<digits>` and an opaque `p.<~26 alphanumerics>` profile ID that appears in profile URLs. This change broke tools in 2026:

- cecobask #97 (2026-04-11): scraper picked up a `p.` string instead of `ur…`; export download then failed because the exports row link uses the `ur` ID.
- cecobask #101 (2026-05-03): "IMDb appears to have updated their frontend again" → empty user ID → `/user//ratings` 404.
- cecobask #103 (2026-06-04): fixed by switching from `authorId` to `authorProfileId` (commit 56298257, 2026-06-06).
- Kometa error text: "If your config uses a ur### ID, update it to the p.xxxxxxx format shown in your watchlist URL."

Discovery methods seen, in order of apparent robustness:
1. `__NEXT_DATA__.props.pageProps.requestContext.sidecar.account.userId` on any imdb.com Next page (Greasy Fork 584280).
2. `__NEXT_DATA__.props.pageProps.aboveTheFoldData.authorProfileId` on `/list/watchlist` (cecobask).
3. Redirect target of `/profile` or `/list/ratings` (RileyXX, RatS).
4. Any `a[href*="/user/"]` in the nav on the homepage, polled for 3 s because the nav renders lazily (Movie Ratings Sync).
5. GraphQL `userProfile(input:{profileId})` to convert `p.` → `ur` when a query needs the legacy form.

A GoodWatch extension must accept both formats and should record the `ur` ID as the stable account identity.

---

### 4. Existing extensions and userscripts that read personal ratings

| Tool | Store facts (checked 2026-09-30) | Permissions | How it reads |
| --- | --- | --- | --- |
| **Movie Ratings Sync** (Chrome, id `jkdkeklemkmcjaoflaohgmpnngkofihn`) https://chromewebstore.google.com/detail/jkdkeklemkmcjaoflaohgmpnngkofihn | **21 users**, no ratings, v1.8.4, updated 2026-07-27, by "KC-IT"; declares handling of PII, authentication information, website content; manifest also carries a Firefox `gecko` id. `homepage_url` repo 110kc3/filmweb-export contains only a README, so source was read from the CRX. | MV3. `permissions: cookies, storage, downloads, identity, alarms`; `host_permissions: https://www.imdb.com/*, https://www.filmweb.pl/*, https://api.trakt.tv/*`; content script on `https://www.imdb.com/*` at `document_idle`. | Service worker checks sign-in by `chrome.cookies.get` for `at-main`, `sess-at-main` or `x-main` (comment: `ubid-main` and `session-id` exist for anonymous users too). Opens a **background tab** on the homepage to find the user ID, then navigates a tab through `/user/<id>/ratings/?sort=date_added%2Cdesc&page=N` and has the content script scrape the DOM. 5-minute cap for exhaustive runs. Also offers IMDb CSV upload, described in its own source as "the robust" alternative. No GraphQL, no `__NEXT_DATA__` for ratings. |
| **Movie Rating Sync** userscript (Greasy Fork 584280) | 42 installs, created 2026-06-25, updated 2026-06-29 | `@match https://www.imdb.com/*` | Same-origin `fetch` of ratings pages → `__NEXT_DATA__`; ratings via `PersonalizedUserData` persisted query. |
| **IMDB Ratings Importer** userscript (Greasy Fork 463836) | 503 installs, updated 2024-05-22 | `@grant none` | Write-only (CSV → IMDb) via `UpdateTitleRating`. |
| Firefox AMO: "IMDb to Letterboxd Rating" (27 users, updated 2024-08-11), "IMDb to Trakt" (18 users, updated 2024-08-09) | From AMO search API | not inspected | Low adoption, stale; mechanism **[unverified]**. |
| Greasy Fork "IMDb Enhancer" (583777) | 13 installs, updated 2026-09-28 | not inspected | Exports list/search results to a spreadsheet; personal-ratings handling **[unverified]**. |

The scale of evidence is small: the largest reader has 21 users. No extension with thousands of users reads personal IMDb ratings. Removed extensions could not be identified from store listings **[unverified]**.

The Movie Ratings Sync version history embedded in its comments is itself a breakage log for route B: v0.9.0 load-more loop, v0.9.4 hydration settle delay raised from 600 ms to 2000 ms, v0.9.5 switch to `?page=N`, v0.9.6 wait for rating widgets to hydrate, v0.9.7 URL-encoding fix to avoid a redirect that tears down the content script.

---

### 5. Anti-bot and breakage history

**AWS WAF.**
- Site-wide JS challenge on `www.imdb.com` for non-browser clients **[probe 2, 3]**.
- cecobask commit 58040d9b (2026-01-25) "Add AWS WAF challenge handling (#95)" detects `script[src*='token.awswaf.com']` and waits for the challenge script to reload the page.
- cecobask #106 (2026-07-25, "since 23/7/2026"): "waf challenge did not complete after 10 attempts" in headless Chrome on GitHub Actions. The maintainer's fix (commit 78882b54, 2026-07-25) computes an `aws-waf-token` with a third-party solver library. That is circumvention of a protection and is not an option for GoodWatch; it also shows that **from 2026-07-23 a headless browser no longer passed the challenge unaided**.
- cecobask commit 763af2f1 (2026-04-13): cookies set before the WAF redirect chain could be dropped.
- Kometa comments describe direct GraphQL as the route that "bypasses HTML scraping + AWS WAF"; openweb's notes say introspection is forbidden and HTML requests return 202.

A real user's browser tab passes the challenge as part of normal browsing, so an in-tab extension does not need to do anything about it. Whether a WAF **CAPTCHA** (as opposed to the silent challenge) is ever served on these paths to real users is **[unverified]**.

**Login CAPTCHA.** Both syncers that log in with credentials hit captchas (RileyXX prints captcha instructions; cecobask #48, 2024-07-08, reports captcha plus emailed OTP on new devices; #47 reports "login from new location" emails). Not relevant to an extension that reuses the existing session, and a strong reason never to handle IMDb credentials.

**Rate limiting.** HTTP 429 handled by Letterboxd-to-IMDb and by the MichaelHP23 worker. Thresholds **[unverified]**.

**Breakage timeline, cecobask/imdb-trakt-sync (IMDb-side causes only):**

| Date | Issue | Cause |
| --- | --- | --- |
| 2024-07 | #46, #47, #48 | Move to headless login; captcha/OTP |
| 2025-06-28 | #86, commit e908c6c6 | Authenticated-state selector changed |
| 2025-10-05 | #94 | `a[data-testid='list-author-link']` not found (UI change) |
| 2026-01-25 | #95/#96 | WAF challenge appears; rating value became a decimal |
| 2026-04-11 | #97 | User ID now `p.` form |
| 2026-05-03 | #101 | User ID selector empty |
| 2026-05-17, 2026-07-12 | commits 881a839e, 6e4bbf47, e702c470 | List-count element changed "multiple times" |
| 2026-06-04 | #103 | `authorId` vs `authorProfileId` |
| 2026-07-23 | #106 | WAF challenge no longer passable headless |

Roughly eight IMDb-driven fixes in the first seven months of 2026.

**Persisted-query hash rotation.** Kometa-Team/IMDb-Hash updates `WATCHLIST_HASH` whenever IMDb's bundle changes: 2025-06-03, 06-09, 06-19, 07-11, 09-05, 09-30, 10-05, 10-08, 2026-01-13, 03-11, 05-22 (plus a manual "Fix IMDb Hash" on 2026-07-30). An extension that hard-codes a persisted hash (as Greasy Fork 584280 does) should expect to break about monthly; plain query text (as `userRatings` above) avoids hash rotation but depends on the server continuing to accept non-persisted queries.
https://github.com/Kometa-Team/IMDb-Hash

---

### 6. MV3 architecture specifics

**Chrome.**
- Service worker / extension-page fetch with `host_permissions` is cross-origin capable; content scripts are not: "Content scripts initiate requests on behalf of the web origin that the content script has been injected into." https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Cookies on extension-initiated requests: "Requests from an extension to a third-party are treated as same-site if the extension has host permissions for the third-party. This means SameSite=Strict cookies can be sent. Note that this only applies to network requests ... **and does not apply if third-party cookies are blocked.**" https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies
  - So a service-worker fetch to `www.imdb.com` / `api.graphql.imdb.com` normally carries `at-main`, but for users who block third-party cookies (and in Incognito, where that is the default) it may not. The SameSite attribute of `at-main` is **[unverified]** (needs a signed-in session to inspect).
  - Chrome dropped the third-party-cookie phase-out (announced 2025-04-22; Privacy Sandbox wound down 2025-10) per press coverage; I did not locate the primary Google post in this session, so treat the dates as **[secondary source]**. User-level blocking remains possible.
- Host permissions needed for the service-worker route would be both `https://www.imdb.com/*` and `https://api.graphql.imdb.com/*`. The content-script route needs only `https://www.imdb.com/*` (or `activeTab` + `scripting` for click-to-sync).
- A content script on `www.imdb.com` has: the WAF token already satisfied, first-party cookies, an allowed CORS origin for GraphQL with credentials (probe 5), and DOM access to `__NEXT_DATA__` (it is an inert JSON script tag, readable from the isolated world without MAIN-world injection).
- Service-worker lifetime limits make multi-page walks fragile; the content script should own the loop and post results in batches.

**Firefox.** Host permissions grant "XMLHttpRequest and fetch access to those origins without cross-origin restrictions, but not for requests from content scripts." In MV3 they are optional and user-revocable; from Firefox 127 they are shown in the install prompt. https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/host_permissions. Cookie behaviour of background fetch under Total Cookie Protection was not established **[unverified]**. The content-script route avoids the question.

**Safari.** WebKit bug 260676 "Manifest v3 — fetch with credentials should include Cookies associated with host_permissions": status NEW, opened 2023-08-24, last modified 2026-08-10, no fix version. Background fetch does not send SameSite=Lax/Strict cookies. https://bugs.webkit.org/show_bug.cgi?id=260676. Apple forum threads (2024 to 2025, unanswered) also report missing Cookie headers from background fetch in non-default Safari profiles: https://developer.apple.com/forums/thread/783498. On Safari the content-script route is the only credible one.

**Bookmarklet / userscript.** Technically the same as the content-script route: same-origin `fetch('/user/<id>/ratings/?page=N')` and credentialed GraphQL both work from page context (Greasy Fork 463836 and 584280 do exactly this). The remaining problem is delivery to GoodWatch: a cross-origin POST from imdb.com is subject to IMDb's Content-Security-Policy `connect-src`, which I could not read because the page was challenged **[unverified]**; a redirect/`window.open` hand-off with the payload would sidestep CSP but has size limits. Userscript managers can use `GM_xmlhttpRequest` with `@connect`.

---

### 7. What this means for GoodWatch

Ranking of acquisition adapters for the spike proposed in the first note:

1. **Assisted export, in-tab (route A).** Navigate the user's own tab to `/list/ratings`, trigger Export, watch `/exports`, capture the CSV. Complete data with a stable, documented-by-IMDb artefact; feeds the same CSV importer. Costs: asynchronous wait, two UI variants for the button, selector churn, and the download itself lands in the browser's download flow (the extension would need the `downloads` permission or to fetch the link in page context; the link shape is unverified).
2. **Ratings-page walk, in-tab (route B).** `?page=N` at 250/page gives a complete snapshot in `ceil(total/250)` navigations or same-origin fetches. IDs and titles come from `__NEXT_DATA__`; rating values need either hydrated DOM (`aria-label "Your rating: N"`) or a follow-up GraphQL call. Rating date availability on this route is unverified. This is what the one shipping extension does, and it needed five fixes in a few minor versions.
3. **Authenticated `userRatings` GraphQL from a content script (route C, own ID only).** Smallest and richest (timestamp, episode→series). Unproven for authenticated paginated use, depends on undocumented schema, and sits right next to an apparent access-control gap that IMDb may close in a way that changes the query. Worth a time-boxed check in the spike; not a foundation.
4. **Service-worker-only fetch.** Not recommended: WAF challenge on HTML, CORS/Origin handling on GraphQL, third-party-cookie setting dependence, and broken on Safari.

Do not use the unauthenticated `userRatings` route server-side, even though it would make "paste your profile URL" sync trivial: it relies on what looks like a privacy defect, proves no ownership, is rate limited, and carries an explicit non-commercial-use disclaimer.

Planning assumptions supported by the evidence: expect an IMDb-side break every one to two months; ship a remotely readable "extractor health" flag and a CSV fallback; accept both `ur` and `p.` IDs; never infer deletions from a short page; keep the permission/partnership question open, since `robots.txt` now states the prohibition in the first lines.

### 8. Open items (need a signed-in test account)

- Is the user's rating value and rating date present in ratings-page `__NEXT_DATA__`, or only after hydration?
- Does `userRatings` support `after`/`pageInfo`, what is the max `first`, and does it work with the session cookie for the user's own ID?
- Name and transport of the export request (`pageAction=start-export`) and the form/lifetime of the CSV download URL.
- SameSite/HttpOnly attributes of `at-main`, `sess-at-main`, `x-main`; which are needed on `api.graphql.imdb.com`.
- Whether a service-worker fetch with host permissions passes WAF and GraphQL Origin checks.
- IMDb's CSP `connect-src` (matters for bookmarklets).
- Rate-limit thresholds for page fetches and GraphQL.
- Whether `/list/ratings` and `/profile` redirects still resolve for `p.`-ID accounts.

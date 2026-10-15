# Export routes for TMDB, Netflix and Simkl

Research date: 2026-10-15. Question: [issue #608](https://github.com/alp82/goodwatch-monorepo/issues/608). Consumer: the owner's sample collection in [issue #372](https://github.com/alp82/goodwatch-monorepo/issues/372). Background: [the import sources inventory](../import-sources-inventory.md).

No account was signed in to, no export was requested, and nobody was contacted. The "current UI" evidence comes from public pages fetched on 2026-10-15 and from the platforms' help centers.

Confidence labels:

- **Confirmed:** read from a first-party source, such as a help center, staff post, or the live page markup served by the platform.
- **Secondary:** read only in a third-party guide, importer, or forum post.
- **Unconfirmed:** not established. The owner's run should settle it.

## Summary

- **TMDB still has "Export CSV" on the ratings, watchlist and favorites pages, and the file arrives by email.** The live pages on 2026-10-15 still ship the menu ("Import List", "Export CSV") and the dialog text "We will create the export and send it to you via email" ([live ratings page](https://www.themoviedb.org/u/Rei366/ratings/movie)). The menu opens from an unlabeled "..." options button that only the list's owner sees. That is the most likely reason the owner missed it. TMDB has no paid tier for this, and Settings has no account-wide export.
- **Netflix has two routes, and both need a web browser.** "Download all" sits at the bottom of a profile's Viewing activity page and produces one CSV per profile ([Netflix help](https://help.netflix.com/en/node/101917)). The full account archive is requested at `netflix.com/account/getmyinfo` and can take up to 30 days ([Netflix help](https://help.netflix.com/en/node/100624)). Neither needs a specific plan. An active account is needed for Viewing activity.
- **Simkl's backup lives under Apps → Export (`simkl.com/apps/backup/`), not under Settings.** The live page offers a JSON ZIP ("OR FREE ONCE A MONTH"), a CSV backup, and VIP-only monthly auto backups to Google Drive or email ([live backup page](https://simkl.com/apps/backup/)). The owner's VIP account covers all three, because VIP includes "All PRO perks" ([plans page](https://simkl.com/vip/)). Export works only on the website, not in the mobile apps ([Simkl docs](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/faq/can-i-export-and-back-up-my-simkl-data-using-the-mobile-app-or-is-it-only-available-on-the-web)).

| Platform | Route | Device | Paid tier needed | Delivery | Wait |
| --- | --- | --- | --- | --- | --- |
| TMDB | Ratings, Watchlist or Favorites page → "..." → Export CSV → Export | Web browser | No | Email | "A few minutes" |
| Netflix, quick CSV | Account → Profiles → profile → Viewing activity → Download all | Web browser | No, but the account must be active | Browser download | Immediate |
| Netflix, archive | `netflix.com/account/getmyinfo` → Submit request | Web browser (secondary) | No | Email link to a ZIP | Up to 30 days |
| Simkl, JSON ZIP | Apps → Export → ".zip archive with .json file" → Download backup | Web browser | No: free once a month; VIP also gets monthly auto backup | Browser download | Unconfirmed, possibly minutes |
| Simkl, CSV | Apps → Export → "Simple .CSV file backup" → Download backup | Web browser | Pro or VIP, per Simkl's plan page; sources disagree | Browser download | Unconfirmed |

## TMDB

### Route

- **Where the export lives.** Each of the three account lists has the same options menu with two entries, "Import List" (linking to `/settings/import-list`) and "Export CSV". The live markup of the ratings, watchlist and favorites pages on 2026-10-15 contains this menu (confirmed: [ratings](https://www.themoviedb.org/u/Rei366/ratings/movie), [watchlist](https://www.themoviedb.org/u/Rei366/watchlist), [favorites](https://www.themoviedb.org/u/Rei366/favorites)). The page script sets the list type to `ratings`, `watchlist` or `favourites` on the respective page (confirmed, same pages).
- **How it opens.** The menu is a click tooltip attached to an element with the class `list_option_wrapper` (confirmed, same pages). That element is not in the markup served to a signed-out visitor, so it renders only for the list's owner. Its exact position in the redesigned header (the markup now uses `ratings-header-redesign`) could not be seen without signing in (unconfirmed). Older descriptions place it as "the three dots icon" next to the list title (confirmed: [Travis Bell, staff, 2021-02-08](https://www.themoviedb.org/talk/5b801e399251416c8c00e3ec?page=2); [moderator, 2019-09-26](https://www.themoviedb.org/talk/5d8c7a56109cd000293e0ba5)), described by a moderator as the "Gray Round Button with the ellipsis next to the list title" ([same thread, 2021](https://www.themoviedb.org/talk/5b801e399251416c8c00e3ec?page=2)). A community answer gives the path as: next to "My Ratings", select Movies or TV, then the three dots, then "Export CSV" (secondary: [2023 thread](https://www.themoviedb.org/talk/647e91c80e29a22be29399d5)). Users have called the option "hidden" since 2021 and asked for it in Settings, with no staff reply (secondary: [feature request](https://www.themoviedb.org/talk/610c1fadee43e8005e444a4c)).
- **The dialog.** "Export CSV" opens a dialog titled "Export CSV" with the text: "If you'd like to have a copy of this list exported to a CSV, click the "Export" button below. We will create the export and send it to you via email. Depending on the size of your list, this can take a few minutes to complete." It has one button, "Export". On success the page shows "Success" (confirmed: [live page markup](https://www.themoviedb.org/u/Rei366/ratings/movie)).
- **What the button sends.** `PUT /u/<username>/export_csv` with only `list_type` (confirmed, same markup). No media type is sent, so one file most likely covers both movies and TV (unconfirmed inference). A public CSV derived from a TMDB export mixes `movie` and `tv` rows in one file (secondary: [sample, 2021](https://github.com/fogrew/gurylev.com/blob/HEAD/src/_data/watched.csv)).
- **Custom lists cannot be exported.** Staff said so in 2021 and in January 2024 promised the work "in the next 2-3 months". Users were still asking in March 2026 without a staff reply (confirmed: [thread page 2](https://www.themoviedb.org/talk/5b801e399251416c8c00e3ec?page=2)).

### Device, tier and delivery

- **Device.** Web only. No first-party TMDB mobile app was found. App Store searches return only third-party apps built on the TMDB API, and TMDB's [archived apps page](https://web.archive.org/web/20211113000319/https://www.themoviedb.org/apps) lists third-party clients (unconfirmed). The export dialog has a mobile layout (`width: mobileDevice ? "95%" : "600px"`), so a phone browser may work (confirmed markup; behavior unconfirmed).
- **Tier.** TMDB accounts are free, and nothing on the export path mentions a paid plan (confirmed: the dialog text above).
- **Delivery.** Email to the account's address, "a few minutes" (confirmed: dialog text). Whether the email carries an attachment or a download link is unconfirmed. A 2018 user reported an emailed export that was empty except for its header, which staff then fixed (secondary: [2018 thread](https://www.themoviedb.org/talk/5b801e399251416c8c00e3ec)).
- **Account-wide export.** None in the product. The privacy policy (effective 2026-08-24) offers a personal-data copy on request through `privacyrequest@xperi.com` or a consumer request form, with no stated response time (confirmed: [TMDB privacy policy](https://www.themoviedb.org/privacy-policy)). That is a legal data request, not a list export, and is not recommended for #372.

### Files and expected columns

- **File names.** Unconfirmed. One 2020 script reads the ratings file as `ratings.csv` (secondary: [blog post](https://sarg.org.ru/blog/tmdb-export/)).
- **Header.** `TMDb ID,IMDb ID,Type,Name,Release Date,Season Number,Episode Number,Rating,Your Rating,Date Rated` (secondary: [2021 sample](https://github.com/fogrew/gurylev.com/blob/HEAD/src/_data/watched.csv)). The Watcharr importer reads `Name`, `Release Date`, `Type` (`movie` or `tv`), `TMDb ID`, `Your Rating` and `Date Rated` from a TMDB export (secondary: [Watcharr source](https://github.com/sbondCo/Watcharr/blob/HEAD/src/routes/%28app%29/import/process/%2Bpage.svelte)).
- **Value formats.** In the 2021 sample, `Release Date` and `Date Rated` are UTC ISO 8601 (`2020-07-07T20:18:17Z`), `Rating` is TMDB's average and `Your Rating` is the user's score as `10.0` (secondary: [sample](https://github.com/fogrew/gurylev.com/blob/HEAD/src/_data/watched.csv)). The `Season Number` and `Episode Number` columns suggest episode ratings may appear in the ratings file (unconfirmed).
- **Watchlist and favorites columns.** Unconfirmed. They likely share the header without a rating date.

## Netflix

### Route 1: "Download all" (quick CSV)

- **Steps.** "From a web browser, go to your Account page. Select Profiles, then choose a profile. Open Viewing activity." Then: "To download a list into a spreadsheet, select Download all at the bottom of the page." (confirmed: [Netflix help, "How to see viewing history and device activity"](https://help.netflix.com/en/node/101917)).
- **Device.** The help article gives web-browser steps only (confirmed, same page). The mobile apps do not offer the download (secondary: [guide, updated 2024](https://maxdalton.how/tutorial/how-to-download-netflix-personal-information/); [Guiding Tech](https://www.guidingtech.com/reset-netflix-watched-episodes-shows-queue/)). `netflix.com/viewingactivity` opens the page for the active profile (secondary: [netflix-narc guide, 2026-08](https://github.com/Kilo59/netflix-narc/blob/HEAD/docs/getting-started/exporting-netflix-csv.md)).
- **Scope.** One profile per download: the page lists "the TV shows and movies that have been watched on each profile" (confirmed: [help](https://help.netflix.com/en/node/101917)).
- **Tier.** No plan restriction is mentioned. "If your account is no longer active, you'll have to download a copy of your information to see your viewing history" (confirmed, same page).
- **File.** `NetflixViewingHistory.csv`, two columns, title and date (secondary: [netflix-narc guide](https://github.com/Kilo59/netflix-narc/blob/HEAD/docs/getting-started/exporting-netflix-csv.md); [Netflix-to-Trakt config](https://github.com/jensb89/Netflix-to-Trakt-Import/blob/HEAD/config_defaults.ini)). The expected header is `Title,Date` (unconfirmed). The date has no time and follows the display locale, for example `28.02.23` in German, `2021-02-05` in Canada, or `MM/DD/YY` (secondary: [Netflix-to-Trakt config](https://github.com/jensb89/Netflix-to-Trakt-Import/blob/HEAD/config_defaults.ini); [netflix-narc guide](https://github.com/Kilo59/netflix-narc/blob/HEAD/docs/getting-started/exporting-netflix-csv.md)).

### Route 2: account archive

- **Steps.** "Go to https://www.netflix.com/account/getmyinfo and follow the instructions." "It may take up to 30 days from the date we verify your request to produce the requested information." (confirmed: [Netflix help, "What personal information Netflix holds about you and how to request a copy"](https://help.netflix.com/en/node/100624)). The privacy statement (last updated 2026-04-10) points to the same URL (confirmed: [privacy statement](https://help.netflix.com/legal/privacy)).
- **Who can request.** The account owner. A profile user with an email on the profile writes to `privacy@netflix.com` instead, and "the account owner will be notified" (confirmed: [help](https://help.netflix.com/en/node/100624)).
- **Where it sits in the account pages.** "Download your personal information" in the account settings. Guides describe it under Settings or under Security, then "Submit Request" (secondary: [guide, updated 2024](https://maxdalton.how/tutorial/how-to-download-netflix-personal-information/); [PopSci](https://www.popsci.com/diy/request-data-from-netflix-apple-spotify-google/)). The current label and section are unconfirmed; the direct URL avoids the question.
- **Verification and delivery.** A "Confirm Your Request" email, a password prompt, then a second email when the file is ready; its link asks for the password again and downloads a ZIP. One author's request took two days (secondary: [guide](https://maxdalton.how/tutorial/how-to-download-netflix-personal-information/)). The ZIP is said to stay downloadable for 7 days (secondary, seen only in a search snippet: [BitsaboutMe](https://bitsabout.me/en/data-request-netflix/)).
- **Scope.** The whole account. `ViewingActivity.csv` has a `Profile Name` column, so all profiles are in one file (secondary: [importer schema, 2026-04](https://github.com/onfabric/context-use/tree/HEAD/context_use/providers/netflix)).

### Archive files and expected columns

All secondary, from importer schemas ([context-use](https://github.com/onfabric/context-use/tree/HEAD/context_use/providers/netflix), [instantiator.dev, 2023](https://instantiator.dev/post/netflix-history/)):

| File | Expected header |
| --- | --- |
| `CONTENT_INTERACTION/ViewingActivity.csv` | `Profile Name, Start Time, Duration, Attributes, Title, Supplemental Video Type, Device Type, Bookmark, Latest Bookmark, Country` |
| `CONTENT_INTERACTION/Ratings.csv` | `Profile Name, Title Name, Thumbs Value, Rating Type, Star Value, Event Utc Ts, Region View Date, Device Model` |
| `CONTENT_INTERACTION/MyList.csv` | `Profile Name, Title Name, Country, Utc Title Add Date` |

The ZIP also holds account, device and billing folders (secondary: [guide](https://maxdalton.how/tutorial/how-to-download-netflix-personal-information/)). Those must stay out of #372. `Start Time` is parsed as UTC by the importer above (secondary).

## Simkl

### Route

- **Where it lives.** Top navigation **APPS** (`/apps/`), then the **Export** tab (`/apps/backup/`). The other tabs are Automatic trackers, Mobile Apps, Chrome Extensions, Discord, iCal/RSS, Import and Security (confirmed: [live backup page](https://simkl.com/apps/backup/)). The docs give the same path, "Apps → Export → Backup" (confirmed: [export data formats](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/export-data-formats)). No docs page places it under Settings. The CSV import page (`/apps/import/csv/`) also has a "DOWNLOAD BACKUP" button (confirmed: [live import page](https://simkl.com/apps/import/csv/)).
- **What the page shows (2026-10-15).** Four sections (confirmed: [live backup page](https://simkl.com/apps/backup/)):
  1. "Automated Full Backup to Google Drive or Email", badged "VIP REQUIRED": "full backup in JSON format delivered to your Google Drive or Email every month automatically", with "SAVE TO Google Drive" and "SEND TO Email" buttons.
  2. ".zip archive with .json file", "DOWNLOAD BACKUP", badged "OR FREE ONCE A MONTH".
  3. "Simple .CSV file backup", "DOWNLOAD BACKUP": "Only contains your last watched episode number and does not contain data about each episode".
  4. "Export using API", badged "FREE FOR EVERYONE".
- **Device.** "Currently, the process of exporting and backing up your SIMKL data is exclusively available through the official website" (confirmed: [Simkl FAQ](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/faq/can-i-export-and-back-up-my-simkl-data-using-the-mobile-app-or-is-it-only-available-on-the-web)).

### Tier

The sources disagree, but the owner's VIP account is covered either way.

- **JSON ZIP, manual.** Free once a month, per the live page badge (confirmed: [backup page](https://simkl.com/apps/backup/)) and the docs, "All Users (Free & VIP)" (confirmed: [export options](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/export-options)). The older formats page labels it "Pro feature" (confirmed but outdated: [export data formats](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/export-data-formats)).
- **CSV.** "PRO Members Only" (confirmed: [export options](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/export-options)). The plans page lists "Manual CSV backup" among PRO perks (confirmed: [plans page](https://simkl.com/vip/)). The button calls `checkUserPerm(event,'export-csv',true)`, where the third argument is named `checkPro`; the JSON button calls it without that flag (confirmed: [backup page markup](https://simkl.com/apps/backup/)).
- **Auto backup.** VIP only (confirmed: [backup page](https://simkl.com/apps/backup/); [scheduling FAQ](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/faq/can-i-schedule-automatic-exports-of-my-data-on-simkl)).
- **VIP includes Pro.** The VIP plan lists "All PRO perks +", "Auto backup" and "RSS, JSON, CSV list export" (confirmed: [plans page](https://simkl.com/vip/)).
- **When access is denied.** If the server says the account lacks the permission, clicking a download button opens the "Join" dialog instead of downloading (confirmed: `checkUserPerm` in the [backup page markup](https://simkl.com/apps/backup/)). A VIP account that sees the Join dialog is a Simkl-side problem worth reporting in #372.

### Delivery and wait

- **Manual buttons** link to `/ajax/full/apps.php?action=listbackup_json` (ZIP) and `/ajax/full/apps.php?action=listbackup` (CSV), so both are browser downloads (confirmed: [backup page markup](https://simkl.com/apps/backup/)).
- **Wait.** The page says "Please wait 1-5 minutes while we create your backup" in the auto-backup confirmations (confirmed, same page). The wait for a manual download is unconfirmed.

### Files and expected columns

- **JSON ZIP.** Contains user profile metadata, movies, TV, anime and watchlist with ratings, memos and external IDs (confirmed: [export data formats](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/export-data-formats)), and "the complete episode list of every show or series you've marked as watched" (confirmed: [data-included FAQ](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/faq/what-data-is-included-in-the-exported-file-e.g.-watched-episodes-ratings-comments-etc.)). The JSON file inside is `SimklBackup.json` with top-level `movies`, `shows` and `anime` arrays; entries carry `status`, `added_to_watchlist_at`, `last_watched_at`, `user_rating`, `user_rated_at`, a `movie` or `show` object with `ids`, and `seasons[].episodes[].watched_at` (secondary: [tally importer](https://github.com/Aunali321/tally/blob/HEAD/internal/importer/simkl.go); [trackarr](https://github.com/Soviann/trackarr/blob/HEAD/internal/service/backup.go)). The ZIP file name and whether rewatch sessions are included are unconfirmed.
- **CSV.** Title, IDs, year, last episode watched, last watched date, rating and memos, but only the most recent episode per show (confirmed: [data-included FAQ](https://docs.simkl.org/how-to-use-simkl/advanced-usage/import-export-data/exporting-from-simkl/faq/what-data-is-included-in-the-exported-file-e.g.-watched-episodes-ratings-comments-etc.)). The import page calls the CSV "this version of backup" and documents the Simkl CSV format: `Type`, `SIMKL_ID`, `TVDB_ID`, `TMDB_ID`, `IMDB_ID`, `MAL_ID`, `Title`, `Year`, `LastEpWatched` (`S04E08`), `Watchlist`, `WatchedDate` (`DD-MM-YYYY` or `MM/DD/YYYY`, UTC, optional time), `Rating` (1 to 10), `Memo` (confirmed: [CSV import page](https://simkl.com/apps/import/csv/)). That the backup uses exactly these headers is unconfirmed. The file name is unconfirmed.

## Owner checklist

General rules for every platform, from #372: keep original file names, folder layout and bytes; do not open and re-save CSVs in Excel; keep private originals outside the repository; post only file manifests, headers and sanitized observations to #372.

For each file, record in #372: platform, export date and time, account tier, site language or locale, your time zone, options chosen, delivery route (download or email), wait time, original file name and size.

### TMDB

1. On a computer, open a web browser and sign in at `https://www.themoviedb.org/login`.
2. Note the email address on the account. The exports go there.
3. Open your ratings: click your avatar, then **Ratings**, or go to `https://www.themoviedb.org/u/<username>/ratings`.
4. Look for a small round **"..."** button near the "My Ratings" heading or the Movies and TV tabs. It shows only on your own pages. Click it.
5. In the small menu that shows **Import List** and **Export CSV**, click **Export CSV**.
6. In the "Export CSV" dialog, click **Export**. Expect a "Success" notice.
7. Repeat steps 4 to 6 on `https://www.themoviedb.org/u/<username>/watchlist` and `https://www.themoviedb.org/u/<username>/favorites`.
8. Wait a few minutes. Check the inbox and the spam folder for three emails.
9. Save each attachment or linked file unchanged into the private `goodwatch` folder.
10. Record for #372: the three file names, sizes and headers; the email subject and sender; whether the file came as an attachment or a link; minutes from click to email; whether each file mixes `movie` and `tv` rows; whether episode rows appear in the ratings file; the `Date Rated` format; site language; your time zone.
11. If no "..." button appears on any of the three pages, take a screenshot of the page header and record that in #372. Do not look for the export in Settings: Settings has only **Import List**.

### Netflix

1. On a computer, open a web browser (not the Netflix app) and sign in at `https://www.netflix.com`.
2. Open **Account** (`https://www.netflix.com/account`), then **Profiles**, choose your profile, then **Viewing activity**.
3. Scroll to the bottom and click **Download all**. The browser saves a CSV, expected as `NetflixViewingHistory.csv`.
4. Repeat steps 2 and 3 for any other profile you want to include. Save each profile's file in its own subfolder named after the profile, without renaming the file.
5. Record for #372: profile name, file name, size, header, row count, the date format seen (for example `28.02.23`), the profile's display language, your time zone, and one example each of a movie and an episode title string.
6. For the full archive, go to `https://www.netflix.com/account/getmyinfo` as the account owner and submit the request.
7. Open the "Confirm Your Request" email, confirm, and enter your password if asked.
8. Wait. Netflix allows up to 30 days. Record the request date.
9. When the "ready" email arrives, open its link within a few days, enter your password, and save the ZIP unchanged.
10. Record for #372: request date, ready date, ZIP name and size, and the folder manifest. Inspect only `CONTENT_INTERACTION/ViewingActivity.csv`, `Ratings.csv` and `MyList.csv`: headers, row counts, timestamp format, and whether thumbs ratings and My List entries are present. Leave account, device and billing files out of the issue.

### Simkl

1. On a computer, open a web browser (not the Simkl app) and sign in at `https://simkl.com`.
2. In the top navigation, click **APPS**, then the **Export** tab. The direct link is `https://simkl.com/apps/backup/`.
3. Check what the page shows for your VIP account: whether the auto backup section still says "VIP REQUIRED" or offers **SAVE TO Google Drive** and **SEND TO Email**. Record it.
4. Under **.zip archive with .json file**, click **DOWNLOAD BACKUP**. Save the ZIP unchanged.
5. Under **Simple .CSV file backup**, click **DOWNLOAD BACKUP**. Save the CSV unchanged.
6. If either click opens a "Join" or sign-up dialog instead of a download, take a screenshot and record it. That means Simkl does not see the account as entitled to that download.
7. Leave the Google Drive and email auto backups off. The manual ZIP is the same JSON format.
8. Record for #372: account tier (VIP), the ZIP name and size, the JSON file name inside, top-level keys, whether episode `watched_at` values and rewatch sessions are present, any `1970-01-01T00:00:01Z` placeholder dates; the CSV name, size, header and date format; site language; your time zone; minutes from click to download.

## Open questions

1. **TMDB "..." button position.** Where the options button renders in the redesigned list header for a signed-in owner. Only the owner can see it. If it is missing, a fallback diagnostic is to run the same request the button sends (`PUT /u/<username>/export_csv` with `list_type` set to `ratings`, `watchlist` or `favourites`) from the browser console while signed in. That is a one-off check for the owner, not a route for members.
2. **TMDB file details.** File names, whether movies and TV share a file, whether episode ratings are included, and whether the email has an attachment or a link.
3. **Netflix quick CSV.** The exact header and file name. All evidence is secondary.
4. **Netflix archive.** The current location of "Download your personal information" in the account pages, the link expiry, and whether the archive's headers still match the importer schemas.
5. **Simkl CSV tier.** The docs and the plans page say Pro or VIP; it does not matter for the owner but does for members on a free plan.
6. **Simkl JSON details.** ZIP file name, whether rewatch sessions survive in the backup, and how often a free account can download (the badge says once a month).

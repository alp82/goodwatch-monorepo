# User feedback channels: competitor scan and strategy proposal

Research date: 2026-10-23. Code facts are read from `origin/main` with `git show`; nothing in code, schedules or data was changed. Competitor facts come from each service's own help pages, docs, page HTML or public APIs, fetched on 2026-10-23. Where a page blocked the fetcher, the claim is marked **(snippet)** if it rests on a search result snippet, or **not verified** if nothing primary was readable.

Labels used below: **verified repo** means source-backed behavior on `origin/main`; **documented** means an official page says it; **measured** means we ran the request ourselves; **proposal** means a recommendation; **decision** means the owner must choose.

## Main findings

1. **Upstream-first is the norm.** Letterboxd, Trakt, Simkl and Serializd get their catalog from TMDB or TVDB and send data fixes there. They keep their own report button for things the upstream doesn't model, such as duplicates or networks.
2. **IMDb and TMDB are the two correction models.** IMDb takes structured, per-field corrections with evidence and staff review, and shows private status in an update history. TMDB lets anyone edit live, with moderator field locks, change history and public report threads with an open or closed status.
3. **Simkl has the best self-serve flow.** On a title page it asks "what's wrong" from a fixed list, offers an instant refresh with a live result, and then links to a public Discord channel.
4. **Availability services have no title-level report.** JustWatch and Reelgood offer generic support forms or email only. No competitor lets a member flag a wrong streaming offer in place.
5. **Review sites close the loop poorly.** Rotten Tomatoes and Metacritic route data errors to email or a support form. IMDb and Letterboxd state that review reporters get no follow-up.
6. **No commercial competitor captures a suggested value plus a source link** in a structured form. Only IMDb (evidence for credits) and Wikipedia/Wikidata (edit requests, per-statement references) treat evidence and status as first-class.
7. **Feature voting is common among trackers.** Trakt uses a public Featurebase board with roadmap and changelog. Simkl uses UserVoice with public statuses. Plex uses a Discourse category with votes.
8. **Screenshot capture has two families.** Sentry's widget uses `getDisplayMedia`, which prompts every time and doesn't work on phones. DOM-rendering libraries need no prompt and allow element masking, at some fidelity cost. TMDB posters send `access-control-allow-origin: *` (measured), so DOM capture can include them.
9. **Discord webhooks are enough for routing.** They allow 20 MiB per file, 10 embeds with 6,000 characters in total, and can create a forum post with tags. Rate limits come in headers and must be read, not hard-coded.
10. **GoodWatch already has most of the parts.** It has SMTP mail, Discord REST code with a bot token, a Discord webhook for monitoring, Sentry replay with redaction, and a same-origin, rate-limited report endpoint. There's no feedback form yet, and `/support` is a `mailto:` link.

## What GoodWatch has today

All **verified repo** on `origin/main`.

- **Support page.** [`support.tsx`](../../goodwatch-webapp/app/routes/support.tsx) shows a `mailto:hello@goodwatch.app` button and FAQ tiles. There's no form and no Discord link on that page.
- **Discord.** The footer invite [`links.tsx`](../../goodwatch-webapp/app/ui/footer/links.tsx) points to `discord.gg/TVAcrfQzcA`. [`InviteCard.tsx`](../../goodwatch-webapp/app/ui/footer/InviteCard.tsx) names a `feedback` channel. The webapp has a Discord bot with REST helpers ([`server/discord/rest.server.ts`](../../goodwatch-webapp/app/server/discord/rest.server.ts), `DISCORD_BOT_TOKEN`) that can post to channels.
- **Discord webhook.** Monitoring jobs post through a Windmill variable `f/monitoring/discord_webhook_url` ([`backup_check.py`](../../goodwatch-flows/windmill/f/monitoring/backup_check.py)). The webapp has no feedback webhook.
- **Email.** `nodemailer` sends auth mail through Purelymail SMTP with a retry queue ([`mail.server.ts`](../../goodwatch-webapp/app/server/auth/mail.server.ts), `AUTH_SMTP_USER`, `AUTH_SMTP_PASSWORD`). There's no Resend or other provider.
- **Sentry.** `@sentry/remix` `^10.22.0` runs replay with `redactSearchTelemetry` and blocks `.search-private` ([`sentry-browser.ts`](../../goodwatch-webapp/app/telemetry/sentry-browser.ts)). The feedback integration isn't enabled. PostHog (`posthog-js ^1.295.0`) is installed.
- **A report endpoint to copy.** The "wrong title?" control on social posts posts to [`api.social.wrong-title.ts`](../../goodwatch-webapp/app/routes/api.social.wrong-title.ts). Its handler ([`wrong-title.server.ts`](../../goodwatch-webapp/app/server/talked-about-now/wrong-title.server.ts)) checks Origin and `Sec-Fetch-Site`, caps the body at 2 KB, rate-limits 20 per 10 minutes per address, and makes reports idempotent by hashing title and post.
- **Country.** [`api.guess-country.tsx`](../../goodwatch-webapp/app/routes/api.guess-country.tsx) uses an ipapi.co lookup, then `Accept-Language`. Request locale already carries country and language.
- **App version.** `goodwatch-webapp/package.json` says `0.6.6`. A build commit SHA would identify a deploy better (**decision** on source).

## Competitor comparison

| Service | Channels | Entry point | What is captured | Moderated / visible | Status back |
| --- | --- | --- | --- | --- | --- |
| IMDb | Edit page, review report, contact form | "Edit Page" at page bottom, pencil per item | Structured per-field form, evidence link or upload | Staff review, 1 to 7 days | Private update history with decline reasons |
| TMDB | Live edit, report, discussions, email | "Edit" on entry, report in Overview menu, per season and episode | Problem type, language, free text | Live edits, volunteer moderators, field locks, public report threads | Public open or closed thread |
| Letterboxd | TMDB upstream, flag icon, help center | Flag near running time; data fixes on TMDB | Duplicate flag; review report reasons | Human moderators; reports mostly actioned in 48 h | None for content reports |
| Trakt | Report link, forum, Featurebase board, GitHub | Title page "Report" after TMDB fix | Free text (form fields not verified) | Moderators set some fields by hand | Board statuses for ideas |
| Simkl | Refresh flow, Discord, UserVoice, support site | Title page "Refresh data" | Issue type picker, then live refresh | Public Discord channel | Live refresh result; idea statuses |
| JustWatch | Support form, in-app "send feedback" (snippet) | Support site; partner widgets link the form | Free text | Not visible | Not verified |
| Reelgood | Email, Zendesk form (snippet) | FAQ, TV app "contact support" | Free text | Not visible | Not verified |
| Rotten Tomatoes | Fandango contact form, Airtable form for missing reviews, review flags | Help desk page, FAQ | Link or title, year, director | Staff check against sources | None found |
| Metacritic | Editorial email, review report modal | Flag icon on each user review | Required reason (16 options), optional note | Moderators | None found |
| Plex | Forum, in-app "Report Issue" | Item context menu | Free text, goes to the server owner, not Plex | Public forum, volunteer answers | Forum replies |
| Serializd | Email, Discord | Homepage FAQ and footer | Free text | Not verified | Not verified |
| MDBList | Discord, Reddit, email | Site header and docs | Free text | Public channels | Informal |
| TV Time | Shut down 2026-07-15 | n/a | n/a | n/a | n/a |
| Wikipedia / Wikidata | Open edit, talk page, edit requests | Edit tab, talk tab | "Change X to Y" plus reference per statement | Patrol, full history | Done or Not done on the request |

## Competitor notes

### IMDb

- Every title and name page has "Edit Page" under "Contribute to this page" ([help](https://help.imdb.com/article/contribution/contribution-information/how-do-i-contribute-data-to-imdb/GVZTHQ48SWS47WDK)). Pencil "EDIT" icons next to items open the right form ([help](https://help.imdb.com/article/contribution/contribution-information/correcting-existing-data/GPFQGX9CFSHW5YUX)).
- The form is per field. Items are colour-coded before submit, and staff review takes 1 to 7 days. Members see accepted and declined items in their update history ([status FAQ](https://help.imdb.com/article/contribution/contribution-information/imdb-update-status-faq/GLLZ3NML4PJYA6AL)).
- Credits need evidence, such as a link to on-screen credits (snippet, [verification](https://help.imdb.com/article/contribution/contribution-information/how-can-i-submit-additional-verification-for-a-credit-submission/GN93ME9NVXHVE36E)).
- Review reports use a "…" menu and a reason list. IMDb says it is "unable to follow up on individual reports" ([help](https://help.imdb.com/article/contribution/contribution-information/how-do-i-edit-remove-or-report-a-review/G6Q9LAZC72JMLDQB)).

### TMDB

- "Our data is 100% user contributed." Anyone with an account can edit, and edits go live at once ([bible](https://www.themoviedb.org/bible/general), [FAQ](https://www.themoviedb.org/faq/website)).
- Moderators lock confirmed fields to prevent vandalism. A lock is disputed through a report with a source ([bible](https://www.themoviedb.org/bible/general)).
- The report button offers types such as Duplicate, Bad Image, Incorrect Content and DMCA, plus "Extra Details". TV has report buttons at series, season and episode level ([bible](https://www.themoviedb.org/bible/general)).
- A report becomes a public thread under the title's Discuss area with an open or closed status ([example](https://www.themoviedb.org/tv/136315-the-bear/discuss/69fcbf2502d4e1356759feff)). Users report waits of months (snippet, [thread](https://www.themoviedb.org/talk/6609d7ff1d78f201638a338f)).

### Letterboxd

- Data fixes go to TMDB, and changes show "within 30 hours" ([film data](https://letterboxd.com/about/film-data/)). Duplicates are flagged with an icon near the running time (same page).
- Content reports are reviewed by people, "the majority … within 48 hours", and the reporter "may not even be aware any action has been taken" (snippet, [journal](https://letterboxd.com/journal/troll-patrol/)).
- The help center and contact page returned 403 (**not verified**).

### Trakt

- Metadata comes from TMDB. Members fix it there, wait 24 to 48 hours, then use "Report" on the title page ([forum FAQ](https://forums.trakt.tv/t/how-does-movie-tv-show-information-metadata-get-updated-how-can-i-refresh-or-sync-trakt-to-tmdb/22124)). The report form's fields are **not verified**.
- Feature ideas live on a public Featurebase board with roadmap and changelog ([roadmap.trakt.tv](https://roadmap.trakt.tv/)). A bot links GitHub issues to the board ([issue](https://github.com/trakt/trakt-web/issues/3242)).

### Simkl

- A title page "Refresh data" flow first points to TVDB. It then asks for an issue type (missing episode, wrong episode details, wrong IMDb or TMDB id, duplicate, show ended, other), refreshes in about a minute and shows the result. If that fails, it links to a public Discord channel and says "All requests are public" (page HTML of [a show page](https://simkl.com/tv/44832/cinemasins)).
- Upstream-first policy: [FAQ](https://docs.simkl.org/how-to-use-simkl/faq/how-to-add-new-shows-missing-episodes-and-movies-to-simkl). Feature voting on UserVoice with public statuses ([board](https://support.simkl.org/forums/264009-top-ideas-from-the-community)).

### JustWatch and Reelgood

- JustWatch's support site has an "Ask a human" form and no article on wrong offers ([support](https://support.justwatch.com/)). Partners are told to link users to the general feedback form ([partner docs](https://apis.justwatch.com/docs/content_partner/)). An in-app "send feedback" menu exists per a snippet only.
- Reelgood points to `support@reelgood.com` and a Zendesk form (snippet, [FAQ](https://reelgood.com/faq), 403 to the fetcher).

### Rotten Tomatoes and Metacritic

- Rotten Tomatoes: "Tell us about missing or incorrect movie or TV information" links a Fandango contact form ([help desk](https://www.rottentomatoes.com/help_desk)). Staff check reports against their sources and may contact the distributor ([FAQ](https://www.rottentomatoes.com/faq)). Missing critic reviews go through an Airtable form (same FAQ).
- Metacritic has no data correction form, only an editorial email ([help](https://metacritichelp.zendesk.com/hc/en-us/articles/17483587919511)). Each user review has a flag that opens a modal with 16 required reasons and an optional note (page HTML of [user reviews](https://www.metacritic.com/movie/the-godfather/user-reviews/)).

### Plex

- In-app "Report Issue" sends free text to the admin of the friend's server, not to Plex ([support](https://support.plex.tv/articles/share-and-report/)).
- Metadata errors go to a public forum category after "Fix Match" ([support](https://support.plex.tv/articles/upgrading-a-movie-library-to-the-use-the-new-plex-movie-agent/), [forum](https://forums.plex.tv/c/plex-media-server/metadata-adding-files/124)). Members there describe fixes that never come ([thread](https://forums.plex.tv/t/944970.json)).
- Bug reports follow a template: version, steps, logs, platform ([support](https://support.plex.tv/articles/201643703-reporting-issues-with-plex-media-server/)).

### Serializd, MDBList, TV Time

- Serializd: bugs by email to `help@serializd.com`, Discord in the footer, data from TMDB ([home](https://www.serializd.com/)).
- MDBList: Discord and Reddit, and a product updates feed without voting ([new features](https://mdblist.com/new-features/)).
- TV Time shut down on 2026-07-15 ([TechCrunch](https://techcrunch.com/2026/07/02/popular-tv-tracking-app-tv-time-is-shutting-down-as-company-focuses-on-ai)).

### Wikipedia and Wikidata

- Edit requests on protected pages use a "Change X to Y" form and are closed as Done or Not done ([edit requests](https://en.wikipedia.org/wiki/Wikipedia:Edit_requests)). Every edit is in page history and can be undone ([history](https://en.wikipedia.org/wiki/Help:Page_history)).
- Each Wikidata statement carries a reference such as "reference URL" and "retrieved" date ([sources](https://www.wikidata.org/wiki/Help:Sources)).

## Product feedback patterns

- **Sentry User Feedback.** `feedbackIntegration` adds a corner button with name, email, message and screenshot ([docs](https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/), [configuration](https://docs.sentry.io/platforms/javascript/guides/remix/user-feedback/configuration/)). It attaches URL, tags and a replay of the moments before submit ([product docs](https://docs.sentry.io/product/user-feedback/)). The screenshot uses `getDisplayMedia` with `preferCurrentTab` and grabs one frame ([source](https://github.com/getsentry/sentry-javascript/blob/develop/packages/feedback/src/screenshot/components/useTakeScreenshot.tsx)), and the editor can highlight or hide areas ([editor](https://github.com/getsentry/sentry-javascript/blob/develop/packages/feedback/src/screenshot/components/ScreenshotEditor.tsx)). "Screenshots aren't supported on mobile devices." `captureFeedback()` accepts a custom form. Sentry has a server-side LLM spam filter. Bundle size is **not verified**.
- **Vercel Toolbar.** Comments on previews with screenshots, synced to Slack and convertible to Linear, Jira or GitHub issues ([comments](https://vercel.com/docs/comments), [integrations](https://vercel.com/docs/comments/integrations)). Every commenter needs a Vercel account, so it fits internal review, not members ([production](https://vercel.com/docs/vercel-toolbar/in-production-and-localhost/add-to-production)).
- **Linear.** The support form takes a message plus images or video ([contact](https://linear.app/contact/support)). Linear Asks turns Slack, email or forms into triage issues ([Asks](https://linear.app/docs/linear-asks)), and customer requests link a quote to an issue ([docs](https://linear.app/docs/customer-requests)). The in-app feedback menu is **not verified**.
- **GitHub.** Issue forms in YAML with inputs, dropdowns, checkboxes and required fields ([syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)). Discussions support upvotes and polls ([about](https://docs.github.com/en/discussions/collaborating-with-your-community-using-discussions/about-discussions)). It needs a GitHub account, which most members lack.
- **PostHog surveys.** Popover, headless API, or a feedback button tab, with URL and flag targeting ([docs](https://posthog.com/docs/surveys/creating-surveys)). Answers are events linked to session replay ([surveys](https://posthog.com/docs/surveys)). 1,500 responses a month free ([pricing](https://posthog.com/surveys/pricing)). No screenshots.
- **Canny and Featurebase.** Voting boards, roadmap and changelog. Canny emails voters on status changes ([help](https://help.canny.io/en/articles/1291127-status-change-emails)) and has a free tier with 25 tracked users ([pricing](https://canny.io/pricing)). Featurebase has a widget with a screenshot editor and duplicate suggestions ([install](https://help.featurebase.app/en/help/articles/1261560-install-feedback-widget)); identity needs a server-signed JWT ([identify](https://help.featurebase.app/en/articles/6151321-identifying-users-and-syncing-data)).

## Technical options

### Screenshot capture

| Option | How | Size (min / gzip) | Maintained | Notes |
| --- | --- | --- | --- | --- |
| `getDisplayMedia` | Native screen share, one frame | 0 | Browser API | Prompt every time, needs a click and HTTPS. No Chrome Android. Pixel-perfect ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)) |
| html2canvas | Re-paints DOM on canvas | 199 / 46.5 KB | Last release 2022 | No `filter`, `object-fit`, `box-shadow` ([features](https://html2canvas.hertzen.com/features)) |
| html2canvas-pro | Maintained fork | 209 / 63 KB | Release 2026-10 | Same approach ([repo](https://github.com/yorickshan/html2canvas-pro)) |
| html-to-image | SVG `foreignObject` clone | 13.5 / 5.3 KB | Last release 2025-02 | `filter` option for masking ([repo](https://github.com/bubkoo/html-to-image)) |
| modern-screenshot | html-to-image fork, workers | 25.7 / 9.7 KB | Release 2026-04 | `filter`, fetch options, placeholders ([repo](https://github.com/qq15725/modern-screenshot)) |
| snapdom | `foreignObject` clone | about 279 / 94 KB (measured file) | Release 2026-10 | `exclude`, `redactInputs()`, proxy fallback ([repo](https://github.com/zumerlab/snapdom)) |

Sizes are from Bundlephobia, except snapdom, which the research agent measured from the package file.

- **CORS (measured).** `image.tmdb.org` answers with `access-control-allow-origin: *` on GET and OPTIONS. DOM capture can include posters without a proxy. A poster the browser cached without CORS can still taint the canvas, so use the library's cache-bust or fetch options.
- **Fidelity (not verified).** No library documents `backdrop-filter`. GoodWatch uses blur overlays, so test real pages before choosing.
- **Region Capture** crops a tab capture to an element, Chrome and Edge desktop only ([Chrome docs](https://developer.chrome.com/docs/web-platform/region-capture)).

### Discord webhooks

From [webhook](https://docs.discord.com/developers/resources/webhook), [message](https://docs.discord.com/developers/resources/message), [uploads](https://docs.discord.com/developers/reference#uploading-files) and [rate limits](https://docs.discord.com/developers/topics/rate-limits).

- `POST /webhooks/{id}/{token}` with `content` up to 2,000 characters and up to 10 embeds. All embeds together hold at most 6,000 characters. Field values hold 1,024, descriptions 4,096.
- Files go as `multipart/form-data` (`files[n]`), up to 20 MiB per file by default, and 25 MiB per request. An embed can show a file with `attachment://shot.png`.
- In a forum channel, `thread_name` creates one post per report and `applied_tags` sets tags. `?wait=true` returns the message, so we can store its id.
- `allowed_mentions: {"parse": []}` stops member text from pinging `@everyone`.
- Rate limits come back in `X-RateLimit-*` headers and 429 bodies with `retry_after`. Discord says not to hard-code limits. 10,000 invalid requests in 10 minutes from one IP triggers a temporary ban.

### Spam protection

- **Cloudflare Turnstile.** Free, works without Cloudflare proxying, with managed, non-interactive and invisible modes ([overview](https://developers.cloudflare.com/turnstile/), [widget](https://developers.cloudflare.com/turnstile/concepts/widget/)). The server must call `siteverify`; tokens last 300 s and are single use ([validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)). Invisible mode needs a privacy policy addendum.
- **Honeypot field and minimum time to submit.** Common practice, no primary standard. Cheap first layer.
- **Rate limits.** The repo already has an in-process limiter ([`rate-limit.server.ts`](../../goodwatch-webapp/app/server/talked-about-now/rate-limit.server.ts)). It is per process, so limits are per instance.

## Strategy proposal

All **proposal** unless marked.

### Build order

1. **One feedback endpoint and one Discord forum.** `POST /api/feedback` copies the wrong-title handler: same-origin check, size cap, zod schema, per-address and per-member rate limit, idempotency key. It posts to a private staff forum channel via webhook, one post per report, with tags `bug`, `idea`, `data`, `contact`. It also emails `hello@goodwatch.app` through the existing SMTP transport for contact messages and anything the webhook fails to deliver.
2. **Contact form on `/support`.** Replace the `mailto:` with a short form: topic, message, email (prefilled and locked for members), honeypot. Keep the address visible as a fallback.
3. **"Report a problem" on title, season, episode and person pages.** This is the most valuable piece, because no competitor does structured availability or title analysis reports. A small link near each data block opens a sheet:
   - **What's wrong:** score, where to watch, cast or crew, title analysis, episodes, title details, other.
   - **Field-specific follow-ups:** for where to watch, the provider, country and "not there", "missing" or "wrong price or type". For scores, which source. For an episode, the season and episode.
   - **Suggested value** and **source link**, both optional.
   - The client fills title id, media type, country, provider ids and page section, so the member types little.
4. **Feedback nudge.** A small "Feedback" tab that expands to one text box, "Include a screenshot" (off by default, with a preview), and Send. Desktop and phone both work.
5. **Thumbs on title analysis and the taste line.** One tap, optional reason. Store as data, summarize weekly in Discord rather than one post per tap.
6. **Later:** public changelog page; idea voting (start with Discord forum reactions); member status back for data reports.

### Skip

- **Sentry's feedback widget UI.** Its screenshot needs a permission prompt and doesn't work on phones. Use our own UI and, when a replay is running, attach the Sentry replay id or call `Sentry.captureFeedback` so staff can open the replay.
- **Paid boards** (Canny, Featurebase) and **GitHub issues** for members. They add accounts and cost before we have volume.
- **Sending members to TMDB.** Superseded: members correct data on GoodWatch directly (see owner decisions).

### Payload and metadata

- **Always:** report kind, message (max about 2,000 characters), URL path and query, route id, viewport and device pixel ratio, user agent, locale, country, color scheme, build commit SHA, timestamp.
- **When signed in:** member id and handle. No email in Discord; staff look it up.
- **Optional:** screenshot (PNG or WebP, capped at about 2 MB, well under 20 MiB), Sentry replay id, PostHog session id.
- **Never:** cookies, tokens, `localStorage`, query parameters that carry secrets (MCP or OAuth codes), form contents.

### Routing

- **Discord:** a private staff forum channel per kind, or one forum with tags (**decision**). Embed fields hold title, kind, page, member and build. Use `allowed_mentions: {"parse": []}` and `?wait=true`.
- **Email:** contact messages always, plus a fallback when Discord fails. Reply-to is the member's email only for contact messages.
- **Webhook URL** lives in an env variable like other secrets, never in the client.
- **Storage:** keep a row per report in Crate, at least for data reports, so we can dedupe, count and later show status (**decision**).

### Spam and abuse

- Honeypot plus minimum time to submit on all forms.
- Rate limits: per address and per member, for example 5 an hour for guests and 20 for members.
- Turnstile only on guest submissions, and only if spam shows up (**decision**).
- Strip links and mentions from Discord display text, and cap length.

### Privacy

- Screenshots are opt-in per report, with a preview before send.
- Mask before capture: `.search-private` (already used by Sentry replay), a new `data-feedback-private` attribute, all inputs, avatars of other members, and the feedback sheet itself.
- Say in the form what is sent and where. Update the privacy policy to name Discord as a processor of feedback.
- Delete screenshots after a retention period (**decision**).

### Corrections flow

1. The member picks the field, gives the wrong value (prefilled), a suggested value and an optional source.
2. The report lands in Discord with links: the GoodWatch page, the TMDB or IMDb page, and the source.
3. Staff triage: fix upstream (TMDB edit), fix our mapping or title analysis, or close.
4. Same field, same title, same suggestion from several members raises priority; dedupe on a hash of title, field and suggested value.
5. Later, members see "Thanks, fixed" or "Fixed on TMDB, updates within a day" in their notifications or library.

## Owner decisions (2026-10-25)

1. **Discord:** one private staff forum channel with tags (`bug`, `idea`, `data`, `contact`).
2. **Storage:** every report gets a row in Crate, so we can dedupe, count, and send status back.
3. **Guests:** guests can send every kind of report. Add Turnstile only if spam appears.
4. **Screenshots:** kept, with no retention limit and no extra privacy notice in the form. Discord attachment links expire, so screenshots are stored on our side and the Crate row points to them.
5. **Corrections:** members don't get sent to TMDB or other sources. They correct data on GoodWatch directly. This replaces the "Skip open editing" item and steps 1 to 3 of the corrections flow:
   - A member correction is stored as a GoodWatch override for one field of one title, season, episode, or person.
   - Overrides must survive the next TMDB, IMDb, or availability import. Imports write source values; the page shows the override on top.
   - Every override keeps who changed it, when, the old value, the new value, and the source link, and staff can revert it from the Discord post.
   - Staff may still fix the upstream source when that helps everyone.

6. **Live or reviewed:** corrections from trusted members (older accounts, or past corrections that staff kept) go live at once. Everyone else, guests included, waits for staff approval in Discord.
7. **Correctable fields:** plain facts only: cast and crew, dates, episode titles, and a streaming provider that is wrong or missing. Title analysis and scores are computed, so members flag them and staff review.

## Open questions for the owner

1. Which version string: build commit SHA from Coolify, `package.json` version, or both? Default: build commit SHA.
2. Public changelog and idea voting now, or after volume grows? Default: later.

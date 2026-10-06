# Discovery search: draft ticket breakdown

Date: 2026-10-06. Evidence for every ticket is in [discovery-search-opportunity.md](discovery-search-opportunity.md).

## Published on 2026-10-06

The owner approved the breakdown on 2026-10-06 and moved the PostHog ticket to the front, so that visitor evidence exists before and after the changes. The drafts below keep their original numbering and are superseded by these issues, which hold the agreed scope.

Map: [#347: Find out whether Google keeps GoodWatch's pages, then test discovery pages](https://github.com/alp82/goodwatch-monorepo/issues/347)

| Issue | Ticket | Draft | Blocked by |
| --- | --- | --- | --- |
| [#348](https://github.com/alp82/goodwatch-monorepo/issues/348) | Restore PostHog access and record the search-landing baseline | 11 | none |
| [#349](https://github.com/alp82/goodwatch-monorepo/issues/349) | Read the Search Console reports the API can't show, and resubmit the sitemap | 1 | none |
| [#350](https://github.com/alp82/goodwatch-monorepo/issues/350) | Stop sending crawlers to hubs for unknown and old URLs | 2 | #348 |
| [#351](https://github.com/alp82/goodwatch-monorepo/issues/351) | Regenerate the sitemap with honest dates, on a schedule | 3 | #348 |
| [#352](https://github.com/alp82/goodwatch-monorepo/issues/352) | Give the start page crawlable links to titles and hubs | 4 | #348 |
| [#353](https://github.com/alp82/goodwatch-monorepo/issues/353) | Record the index state of a fixed sample every week | 5 | none |
| [#354](https://github.com/alp82/goodwatch-monorepo/issues/354) | Decide whether a bounded set of pages stays indexed | 6 | #349 to #353 |
| [#355](https://github.com/alp82/goodwatch-monorepo/issues/355) | Decide how the title page answers "movies like X" | 7 | #354 |
| [#356](https://github.com/alp82/goodwatch-monorepo/issues/356) | Make the title page answer "movies like X" | 8 | #355 |
| [#357](https://github.com/alp82/goodwatch-monorepo/issues/357) | Repair the mood pages as theme pages | 9 | #354 |
| [#358](https://github.com/alp82/goodwatch-monorepo/issues/358) | Check the German results by hand and decide on German | 10 | #354 |
| [#359](https://github.com/alp82/goodwatch-monorepo/issues/359) | Decide whether to scale, hold or drop search as a channel | 12 | #348, #356, #357, #358 |

## Drafts as written before approval

## Proposed focused map: Find out whether Google will keep GoodWatch's pages, then test discovery pages

### Destination

GoodWatch knows, from Search Console data, whether a bounded set of its pages stays in Google's index and whether a small set of pages written for discovery searches earns impressions. The map ends with a decision to scale, hold or drop search as a channel. It does not end with a page per title.

### Notes

- **Order:** indexing first. Tickets 7 to 10 don't start until the gate in ticket 6 is passed, because their result can't be measured while Google shows only the start page.
- **Bounded set:** the 1,000 title pages, 87 category pages and hubs in today's sitemap. Don't raise the sitemap limit inside this map.
- **Measurement:** Search Console only, read through the API with the key outside the repo. Impressions and index states, not rank trackers. No paid services.
- **Shared files:** tickets 2, 3 and 4 touch routes, robots.txt and the sitemap generator while the viral spike map ([#237](https://github.com/alp82/goodwatch-monorepo/issues/237)) is active on the same webapp. Coordinate merges with that map's orchestrator, and every push to `main` deploys.
- **Vocabulary:** use CONTEXT.md. "Mood" already has a fixed meaning there; a page built on other attributes is not a Mood.
- **Out of scope:** a "like X" page for every title, an editorial or blog program, community and outreach, translated pages, raising the sitemap beyond 1,000 titles, the brand-name question (other products called GoodWatch), and Bing.

### Order at a glance

| # | Ticket | Mode | Blocked by |
| --- | --- | --- | --- |
| 1 | Read the Search Console reports the API can't show, and resubmit the sitemap | Owner | none |
| 2 | Stop sending crawlers to hubs for unknown and old URLs | AFK | none |
| 3 | Regenerate the sitemap with honest dates, on a schedule | AFK | none |
| 4 | Give the start page crawlable links to titles and hubs | AFK | none |
| 5 | Record the index state of a fixed sample every week | AFK | none |
| 6 | Gate: does a bounded set of pages stay indexed? | Owner | 1, 2, 3, 4, 5 |
| 7 | Decide how the title page should answer "movies like X" | Owner | 6 |
| 8 | Make the title page answer "movies like X" | AFK | 7 |
| 9 | Repair the mood pages as theme pages | AFK | 6 |
| 10 | Check the German results by hand and decide on German | Owner | 6 |
| 11 | Restore PostHog access and measure search landings | Owner, then AFK | none |
| 12 | Decide: scale, hold or drop | Owner | 8, 9, 10 |

---

## 1. Read the Search Console reports the API can't show, and resubmit the sitemap

Mode: owner (needs the Search Console login). Blocked by: none.

### Goal

Settle which of two readings explains why Google shows only the start page: Google assessed the pages and dropped them, or Google has no working route to them.

### Steps

1. Security and Manual actions: record whether any action exists.
2. Page indexing: export the report (counts per reason, and the example URLs).
3. Crawl stats: export requests per day, response codes, file types and host status for the longest period offered. Look at 2026-10-03 and 2026-10-04 in particular.
4. Sitemaps: resubmit `https://goodwatch.app/sitemaps/sitemap.xml`. Record whether the nested-index error is gone and all four children are read.
5. URL Inspection, "Test live URL", on one movie page and one show page from the sitemap. Record the rendered HTML's title, canonical and whether the related titles are present.
6. Request indexing for about ten pages: `/movies`, `/shows`, `/discover`, `/explorer`, two mood pages, two movies, two shows.

### Done when

The exports and answers are attached to the ticket with their date, and the resubmission date is recorded for ticket 5.

## 2. Stop sending crawlers to hubs for unknown and old URLs

Mode: AFK. Blocked by: none.

### Goal

A URL that doesn't exist answers 404, and a URL that moved answers a 301 to its new address, so that Google stops receiving redirects to `/`.

### Scope

- Unknown one- and two-segment paths (`/qwertyzzz`, `/movies/qwertyzzz`) answer 404 instead of 302 (`routes/$type._index.tsx:41`, `routes/$type.$category._index.tsx:84`, `routes/$type.$category.$page.tsx:74`).
- `/tv-shows` and `/tv-shows/<rest>` answer 301 to `/shows` and `/shows/<rest>`.
- `/explore/<type>/<category>/<text>` answers 301 to `/<type>/<category>/<text>` where that page exists, else 404.
- Removed sitemap files under `/sitemaps/` answer 404 or 410, not 302.
- `http://` and `www.` answer 301, not 302 (`goodwatch-proxy/traefik/goodwatch-balance.yaml`). This is a live proxy setting: prepare the change, the owner applies it.
- robots.txt gains `Disallow: /discover/*?`, because title pages link to `/discover/<type>?...` URLs that redirect into disallowed ones.
- `?page=2` on a category page gets a canonical that matches what it shows.
- Hubs stop emitting an empty `{}` JSON-LD block (`utils/meta.ts:32`).

### Done when

Each case above has a test or a smoke check, and the smoke script requests them after the deploy.

## 3. Regenerate the sitemap with honest dates, on a schedule

Mode: AFK. Blocked by: none.

### Goal

The sitemap Google reads lists only URLs that answer 200 with a matching canonical, and its `lastmod` shows that the pages changed in September 2026.

### Scope

- Run the generator under the freshness rule of `fcde8190`; the live files predate it.
- `lastmod` is at least the deploy date of the title page rebuild (2026-09-25), since the page changed for every title then. Today only 57 of 700 movies carry a September 2026 date.
- Check every listed URL once before publishing: status 200 and a canonical equal to the listed URL.
- Schedule the generator, and say in the ticket where it runs.
- Keep 1,000 titles. Person pages stay out until ticket 6.

### Done when

The live sitemap passes the check, the schedule has run once, and the owner has resubmitted it (ticket 1, step 4, again if it changed).

## 4. Give the start page crawlable links to titles and hubs

Mode: AFK. Blocked by: none.

### Goal

A crawler that reads only the start page's server HTML finds title pages and every hub through plain, visible links.

### Context

Today `/` links to no `/movie/`, `/show/` or `/person/` page, and seven hub links sit in a visually hidden block (`app/ui/living-room/TvScreens.tsx:132`). The TV's picks load from an API that robots.txt disallows.

### Scope

A server-rendered row of title links and visible hub links on the start page, within the render path budget of the viral spike map. The living room's look and behaviour are the owner's: propose the placement and get it confirmed before building.

### Done when

The server HTML of `/` contains the links for a visitor without cookies, and the Lighthouse numbers of the start page are not worse.

## 5. Record the index state of a fixed sample every week

Mode: AFK. Blocked by: none.

### Goal

A dated series that shows whether Google's view of the site is changing, so the gate in ticket 6 rests on measurements.

### Scope

- A script beside `goodwatch-webapp/scripts/gsc.py` that inspects a fixed list of 50 URLs through the URL Inspection API: the start page, 6 hubs, 8 mood and genre pages, 25 titles from the sitemap, 5 person pages, 5 old URL shapes.
- Each run appends the coverage state, last crawl time and Google's canonical per URL, plus the week's impressions and clicks per URL shape, and the sitemap download dates.
- First run now, as the baseline: on 2026-10-06, 58 of 60 inspected URLs were "URL is unknown to Google".

### Done when

The baseline and at least four weekly runs after the sitemap download are recorded in a file under `docs/research/discovery-search/`.

## 6. Gate: does a bounded set of pages stay indexed?

Mode: owner decision. Blocked by: 1, 2, 3, 4, 5.

### Question

Four to six weeks after Google downloads the new sitemap: are title and category pages from the bounded set indexed, and do they stay?

### Outcomes

- **Indexed and staying:** continue with tickets 7 to 10.
- **Crawled but not indexed:** Google reads the pages and declines them. Look at what the declined pages have in common before doing anything else; tickets 7 and 9 may then be the remedy, on a smaller set.
- **Still unknown, or a manual action:** stop the map here and record the decision on the living roadmap. Search is closed to this site for now.

## 7. Decide how the title page should answer "movies like X"

Mode: owner decision, with `/grilling`. Blocked by: 6.

### Question

What does the related section say and show so that it is an honest answer to "movies like X"?

### To decide

- The heading and whether the page title or description mentions it. Today the heading is "Related Movies and Shows" and "like" appears nowhere.
- The reason per result. Candidates: the two or three attributes the pair shares most strongly, taken from the fingerprint. Today the only explanation is "Overall: Similar vibe."
- Availability on the cards, in the visitor's country.
- Order. Cosine scores span only 0.02 to 0.03 across the 32 shown, so obscure titles sit beside classics. Options: blend in votes, or keep cosine and show fewer.
- What the fingerprint can't see: country, language, director, franchise. Whether to add a "same director" or "same country" row from data GoodWatch already has, and whether to keep sequels out.
- Whether a question "What is similar to X?" joins the FAQ block.

### Done when

The decisions are recorded on the ticket, with two or three example titles written out by hand.

## 8. Make the title page answer "movies like X"

Mode: AFK. Blocked by: 7.

### Goal

The decisions of ticket 7, built for the title pages in the sitemap.

### Done when

The server HTML of a title page carries the heading, a reason per result and availability as decided, and ticket 5's weekly record marks the deploy date.

## 9. Repair the mood pages as theme pages

Mode: AFK. Blocked by: 6.

### Goal

Each of the 40 mood pages shows a list a searcher would accept for its name, and no two pages are near-copies.

### Scope

- Order by something other than TMDB popularity. Sorted by votes, the slow burn horror set reads The Shining, Alien, Get Out; sorted by popularity, mind-bending reads The Odyssey, The Shawshank Redemption, 12 Angry Men.
- One rule set per mood word. Today the mood pages, the Moods of CONTEXT.md and the Explorer's islands each define "feel-good" and "mind-bending" differently. Resolve this with `/domain-modeling` first; it changes shared vocabulary.
- Apply the context and suitability filters the pages already declare, or remove them.
- Remove or merge pages that are near-empty (motivational shows: 3 titles) or near-copies (feel-good and funny share 20 of their first 40).
- An H1, and no emoji in the meta description.
- Add at most six pages for attributes that give list-sized sets and that people type: for example slow burn, dark comedy, nonlinear, surreal. No plot-device pages: unreliable narrator, heist and time loop exist only in tropes, which cover 59% of the top 20,000 movies and are no longer crawled.

### Done when

The pages are live, each list was read by a person before release, and ticket 5's record marks the deploy date.

## 10. Check the German results by hand and decide on German

Mode: owner (a browser in Germany). Blocked by: 6.

### Question

Is "Filme wie X" worth a German page, given that GoodWatch's page text is English only?

### Steps

- Run the six German queries of the research sample, and six more with a provider ("Filme wie Interstellar Netflix"), in a clean browser profile in Germany. Record the first page: who ranks, whether an AI answer shows, whether Reddit shows.
- The agent's tool was US-only. It found thin results for two queries; the review found two template-driven competitors (filmstarts.de, suchefilme.com) for a third.

### Done when

The record is on the ticket with a yes or no on German, and what a German page would need if yes.

## 11. Restore PostHog access and measure search landings

Mode: owner for access, then AFK. Blocked by: none.

### Goal

Know what search visitors do, which Search Console can't show.

### Scope

- Reconnect the PostHog plugin used in [#54](https://github.com/alp82/goodwatch-monorepo/issues/54#issuecomment-5687054567); it is not installed in the current sessions.
- Search-referred sessions by week since 2026-03-01: landing page, referring domain, and identities with `$autocapture`, with `NOT $virt_is_bot`.
- Answer one question first: were the April to July 2026 clicks on "goodwatch app" (132 to 158 a month, USA mobile) people who interacted with the site, or people looking for another product of the same name?

### Done when

The query definitions and results are added to the research document.

## 12. Decide: scale, hold or drop

Mode: owner decision. Blocked by: 8, 9, 10.

### Question

After at least six weeks of Search Console data on the changed pages: did discovery queries reach them, and is a larger effort justified?

### Evidence to bring

- Impressions, clicks and position for queries matching "like", "similar", "wie", "ähnlich" and the mood words, per page group, before and after.
- Index states from ticket 5.
- What PostHog shows about those visitors, if ticket 11 is done.

### Outcomes

Scale (more titles in the sitemap, more attribute pages, German), hold (keep what exists, spend nothing more), or drop search as a channel. Record the decision and its reasons on the living roadmap.

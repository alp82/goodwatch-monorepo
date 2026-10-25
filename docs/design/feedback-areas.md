# Feedback areas by page type

This page lists every page type of the webapp and the parts of each page that a reader can report on with the
Feedback tab. Fix mode reads the same definitions from
`goodwatch-webapp/app/ui/feedback/areas.ts`, so change both together.

## How the Feedback tab uses this

The Feedback tab shows on every page, including error pages. When the reader opens it, the panel offers:

- **Fix something on this page**, when the page shows at least one of its type's areas. Fix mode outlines each area
  with a **Fix** or **Flag** badge and lists the areas in the panel. Picking an area opens its chips.
- **Send feedback**, always: one text box for a bug or an idea, and an optional screenshot.

Guests see an optional **Your email (if you want an answer)** field in Send feedback and in every Fix or Flag form.
Members don't see it; staff answer at their account's email.

The title and person pages ask richer questions from the page's own data (`app/ui/feedback/problems.ts`): which
service, offer type and country, which episode, person, credit or score. Requests follow
`docs/implementation/feedback/fix-mode-contract.md`.

A page type with no areas gets **Send feedback** only. An area that the page doesn't show right now (for example, an
empty list or a part that only members see) isn't listed.

## What readers can fix and what they can only flag

Members can correct these facts (owner decision):

- Cast and crew
- Dates (release, air, career years)
- Episode titles
- A wrong or missing streaming service

Everything the site computes is **flag only**: scores, title analysis, recommendations, rankings, taste data, search
result quality, and availability counts. Staff look at flags and fix the source or the match; nobody edits these by
hand.

In the tables:

- **Fix** means every chip suggests a correction.
- **Fix and flag** means the area mixes correctable facts and computed values.
- **Flag only** means every chip is a flag.
- Each chip list ends with **Something else**, which asks for a few words. In an area with fixes it goes to staff
  review, even from trusted members. In a flag-only area it's a flag.

Routes not listed below don't render a page: `api.*` and other resource routes (`og.*`, `sitemap*`, `blog.rss[.]xml`,
`mcp`, `.well-known` files, `go.stream.*`), redirects that only move to another page (`search`, `wishlist`,
`living-room`, `tv.$showKey`, `tv-shows.$`, `explore.*`, `discord.add`, `settings.hidden`, `settings.streaming`,
`settings.where-you-watch`, `pmwiki.$`), `browser-check` (410), callbacks (`discord.link.callback`) and `dev.*` routes.

## Page types

### Start page

Routes: `_index.tsx`, `living-room.tsx (redirect)`. Try it at `/`.

| Area | Type | Chips |
| --- | --- | --- |
| Rows on the TV | Fix and flag | A title isn't on this service; A service is missing a title; A pick doesn't fit its row (flag); A score looks wrong (flag); Something else (staff review) |
| How it works | Flag only | A number is out of date (flag); It doesn't work like this (flag); Something else |

### Discover

Routes: `discover.($type).tsx`, `search.tsx (redirect)`. Try it at `/discover`.

| Area | Type | Chips |
| --- | --- | --- |
| Search | Flag only | The best match is wrong (flag); A title I expected is missing (flag); Results don't fit what I typed (flag); Something else |
| Filters | Flag only | A filter doesn't do what it says (flag); A service is missing from the list (flag); A mood or genre is missing (flag); Something else |
| Count | Flag only | The count looks wrong (flag); Something else |
| Results | Fix and flag | Wrong streaming service on a title; Wrong year; A title doesn't fit the filters (flag); A score looks wrong (flag); The order looks wrong (flag); Something else (staff review) |

### Category page (by mood, genre or service)

Routes: `$type._index.tsx`, `$type.$category._index.tsx`, `$type.$category.$page.tsx`, `explore.$type.$category.$text.tsx (redirect)`, `tv-shows.$.tsx (redirect)`. Try it at `/movies/moods`.

| Area | Type | Chips |
| --- | --- | --- |
| Titles | Fix and flag | Wrong year; Wrong streaming service on a title; A score looks wrong (flag); Wrong poster (flag); Something else (staff review) |
| Order | Flag only | A title doesn't belong here (flag); A title is missing (flag); The order looks wrong (flag); Something else |

### Best-of list

Routes: `$type.best.tsx`. Try it at `/movies/best`.

| Area | Type | Chips |
| --- | --- | --- |
| Ranking | Flag only | A title is ranked too high or low (flag); A title doesn't belong here (flag); A title is missing (flag); Something else |
| Title details | Fix and flag | Wrong year; Wrong genre (flag); A score looks wrong (flag); Something else (staff review) |
| Intro and counts | Flag only | The count looks wrong (flag); Something else |

### People list

Routes: `people.tsx`. Try it at `/people`.

| Area | Type | Chips |
| --- | --- | --- |
| People | Fix and flag | Wrong known-for title; Wrong main job; Wrong photo (flag); The order looks wrong (flag); Something else (staff review) |

### Title page (movie or show)

Routes: `movie.$movieKey.tsx`, `show.$showKey.tsx`, `tv.$showKey.tsx (redirect)`. Try it at `/show/136315-the-bear`.

The season and episode view is the Episodes part of a show's page; there is no separate season page.

| Area | Type | Chips |
| --- | --- | --- |
| Scores | Flag only | A score looks wrong or old (flag); A score belongs to another title (flag); Something else |
| Where to watch | Fix | It's not on a service listed here; A service has it, but it's missing; A link opens the wrong page; Something else (staff review) |
| Title analysis | Flag only | The description doesn't fit (flag); A scale is off (pace, tone, …) (flag); “Good for” doesn't fit (flag); Something else |
| Episodes | Fix and flag | Wrong episode title; Wrong air date; An episode is missing; An episode score looks wrong (flag); Something else (staff review) |
| Details | Fix and flag | Wrong year or date; Wrong number of seasons or episodes; The description is wrong (flag); Something else (staff review) |
| Cast and crew | Fix | Wrong character name; Someone isn't in it; Someone is missing; Something else (staff review) |
| Similar titles | Flag only | A title isn't similar (flag); A title is for a different audience (flag); Something else |
| Media | Flag only | A trailer is for another title; A video doesn't play; A video or image doesn't fit; Something else |

### Person page

Routes: `person.$personKey.tsx`. Try it at `/person/287-brad-pitt`.

| Area | Type | Chips |
| --- | --- | --- |
| Details | Fix and flag | Wrong main job; Wrong career years; Wrong photo (flag); Something else (staff review) |
| What stands out | Flag only | A trait doesn't fit them; The chart looks off; Something else |
| Credits | Fix | A title isn't theirs; Wrong role or character; A title is missing; Something else (staff review) |

### Member profile

Routes: `u.$handle._index.tsx`. Try it at `/u/<handle>`.

What a member writes about themselves (bio, list names, hot takes) is theirs; reporting a member is a separate, later decision.

| Area | Type | Chips |
| --- | --- | --- |
| Stats | Flag only | A count looks wrong (flag); A chart looks wrong (flag); Something else |
| Taste | Flag only | The viewer type doesn't fit (flag); A taste word doesn't fit (flag); Something else |
| Match | Flag only | The match looks wrong (flag); Something else |
| Titles | Fix and flag | Wrong year or poster on a title; A title shows that wasn't added (flag); A score shows wrong (flag); Something else (staff review) |
| Score spread | Flag only | The spread looks wrong (flag); Something else |

### Member profile tab

Routes: `u.$handle.scores.tsx`, `u.$handle.seen.tsx`, `u.$handle.shows.tsx`, `u.$handle.wishlist.tsx`, `u.$handle.taste.tsx`, `u.$handle.lists._index.tsx`. Try it at `/u/<handle>/taste`.

| Area | Type | Chips |
| --- | --- | --- |
| Titles | Fix and flag | Wrong year or poster on a title; A title shows that wasn't added (flag); Something else (staff review) |
| Taste | Flag only | The viewer type doesn't fit (flag); A taste number looks wrong (flag); Something else |

### Shared list

Routes: `u.$handle.lists.$id.tsx`, `lists.$id.tsx`. Try it at `/u/<handle>/lists/<id>`.

| Area | Type | Chips |
| --- | --- | --- |
| Titles and services | Fix | It's not on a service listed here; A service has it, but it's missing; A link opens the wrong page; Something else (staff review) |

### For you

Routes: `for-you.tsx`. Try it at `/for-you`.

| Area | Type | Chips |
| --- | --- | --- |
| Picks | Fix and flag | A pick doesn't fit my taste (flag); I've seen it already (flag); It's not on my services; Something else (staff review) |

### Watch next and My movies

Routes: `watch-next.tsx`, `my-movies.tsx`, `wishlist.tsx (redirect)`. Try it at `/watch-next`.

| Area | Type | Chips |
| --- | --- | --- |
| Top picks | Fix and flag | It's not on that service; The order looks wrong (flag); Wrong runtime (flag); Something else (staff review) |

### My library

Routes: `my-library._index.tsx`, `my-library.$list.tsx`, `my-library.scores.tsx`, `my-library.hidden.tsx`, `my-shows.tsx`, `lists.mine.tsx`. Try it at `/my-library`.

Members only; signed-out readers see the sign-up prompt and get Send feedback only.

| Area | Type | Chips |
| --- | --- | --- |
| Titles | Fix and flag | Wrong next episode or air date; Wrong streaming service; A title I added is missing (flag); A count looks wrong (flag); Something else (staff review) |

### Taste

Routes: `taste._index.tsx`, `taste.quiz.tsx`, `taste.fingerprint.tsx`, `taste.everyone.tsx`, `taste.tsx (layout)`. Try it at `/taste`.

| Area | Type | Chips |
| --- | --- | --- |
| Your taste | Flag only | My viewer type doesn't fit (flag); A taste group doesn't fit (flag); A title to rate is wrong for me (flag); Something else |

### Explorer

Routes: `explorer.tsx`. Try it at `/explorer`.

| Area | Type | Chips |
| --- | --- | --- |
| Map | Flag only | A title is on the wrong island (flag); An island's name doesn't fit (flag); Something else |

### Hot on socials

Routes: `hot-on-socials.tsx`. Try it at `/hot-on-socials`.

| Area | Type | Chips |
| --- | --- | --- |
| Ranking | Flag only | A title shouldn't be here (flag); A post is about another title (flag); The order looks wrong (flag); Something else |

### Blog

Routes: `blog._index.tsx`, `blog.$slug.tsx`. Try it at `/blog`.

No data parts. The panel offers **Send feedback** only.

### Info pages

Routes: `about.tsx`, `how-it-works.tsx`, `use-with-ai.tsx`, `support.tsx`, `discord._index.tsx`, `discord.link.tsx`, `privacy.tsx`, `terms.tsx`, `disclaimer.tsx`. Try it at `/about`.

No data parts. The panel offers **Send feedback** only.

### Sign in and account access

Routes: `sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`, `auth.mcp.consent.tsx`. Try it at `/sign-in`.

No data parts. The panel offers **Send feedback** only.

### Settings

Routes: `settings.tsx (layout)`, `settings._index.tsx`, `settings.account.tsx`, `settings.profile.tsx`, `settings.services.tsx`, `settings.country.tsx`, `settings.language.tsx`, `settings.imports.tsx`, `settings.connected-apps.tsx`, `settings.discover-privacy.tsx`. Try it at `/settings`.

No data parts. The panel offers **Send feedback** only.

### List editor

Routes: `lists.new.tsx`, `u.$handle_.lists.$id_.edit.tsx`. Try it at `/lists/new`.

No data parts. The panel offers **Send feedback** only.

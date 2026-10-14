# "Talked about now" on title pages

Implements [#558](https://github.com/alp82/goodwatch-monorepo/issues/558), part of
[the Talked about now map](https://github.com/alp82/goodwatch-monorepo/issues/537). The look is the featured
layout chosen in [#542](https://github.com/alp82/goodwatch-monorepo/issues/542) (prototype branch `ghostex/993cacf0`).

## What a visitor sees

Between the fingerprint and About: one large video and a feed beside it.

- **Lead:** the newest wide YouTube video (a Short only when there is no wide one). Several videos get a strip to
  switch the lead. A title without a video leads with its newest headline over its backdrop.
- **Feed:** Bluesky and Mastodon posts, six at first. Without posts the headlines are the feed; with posts the other
  headlines go under the lead ("More headlines").
- **Line under the heading:** the Wikipedia lift when the title is in the day's buzz top 20 (`doc.buzz_snapshot`,
  #555), naming the source and the day, and how many items the last 30 days brought.
- **Hidden** when the title has no visible posts, or the tables are missing or empty.
- **"Wrong title?"** on every item: the item goes at once, `POST /api/social/wrong-title` records the report, and the
  next read leaves the link out for everyone.

## Click to load

`goodwatch-webapp/app/ui/social-embed/` is the one facade for every source, shared with the start page's row:

- `target.ts` works out what an item loads (YouTube video id and whether it is a Short, Bluesky AT URI, Mastodon
  embed address) from the stored post alone. A post that doesn't fit its source keeps only its link.
- `SocialEmbed.tsx` is the facade, as a `card` or a feed `row`. Before the click: stored text, and for a video the
  title's own TMDB backdrop. No vendor thumbnail, no request to any third party. The button names who it loads.
- `players.tsx` holds the official players, each the vendor's own iframe with `strict-origin-when-cross-origin`:
  YouTube from youtube-nocookie.com, Bluesky from embed.bsky.app, Mastodon from the post's server. Bluesky's and
  Mastodon's embed scripts only create that iframe and set its height from a message; the page does that itself,
  so no vendor script runs on GoodWatch's page.
- `ui/details/YoutubePlayer.tsx` (trailer dialog, Media section) plays the same frame; `react-player` is gone.

## First view

The page's first view holds only an empty element (`TalkedAboutNowSlot`). When a visitor comes within 800 px of it,
the posts are requested (`GET /api/social/title`) and the section's chunk loads; the chunk is also fetched at the
first interaction. A visitor who doesn't scroll, Lighthouse, and a crawler request neither.

## Flag

`TALKED_ABOUT_NOW_TITLE=off|preview|on` (unset means off), in the style the `REC_*` flags had: read on every
request, so a container restart applies a change. `preview` shows the section to the Supabase user ids in
`TALKED_ABOUT_NOW_PREVIEW_USERS` (comma separated). The title loaders put the decision in their data; with `on`
an anonymous page carries it into the page cache, in preview only members (never cached) get it. The endpoints
check the flag again: off answers an empty section and refuses reports with 404.

`SOCIAL_DISABLED_LANES` (comma separated) switches matcher lanes off without rematching, as #556 suggests.

## Data

`server/talked-about-now/social-store.server.ts` runs #556's reference read (`Store.read_title`) and report
(`Store.report`) over `doc.social_post`, `doc.social_title_link` and `doc.social_link_report`. A missing table or
schema reads as nothing. The read is cached per title for 5 minutes (`talked-about-now-title-v1`, reset-guarded);
a report resets that entry before it answers. A surface with its own cache of posts adds its reset to `afterReport`
in `title-social.server.ts`.

`POST /api/social/wrong-title` takes `{ media_type: "movie" | "tv", media_tmdb_id, post_id, reason? }`. Same origin
only (`Origin`, and `Sec-Fetch-Site` when sent), JSON up to 2 KB, 20 reports per address per 10 minutes in each
process, 404 for a link that doesn't exist. It answers `200 { report_id, hidden: true }` after the report row is
written and refreshed. The report row is the only thing the webapp writes.

## Running it locally

Two settings for development only (ignored when `NODE_ENV=production`):

- `SOCIAL_REPORTS=memory`: reports stay in the process. Use it with production Crate, which must not be written to
  from a dev machine.
- `SOCIAL_FIXTURE=<path>`: the rows come from a JSON file. `fixture.json` here holds real public posts about
  Resident Evil (movie 1423191) from the #542 prototype, including a Short and a Mastodon post; its times move so
  that the newest post is two hours old.

Neither reaches the data cache. A dev server for the real pages without Valkey and without `APP_ORIGIN`:

```sh
cd goodwatch-webapp
set -a; . <main checkout>/goodwatch-webapp/.env; set +a
REDIS_HOST= APP_ORIGIN= TALKED_ABOUT_NOW_TITLE=on SOCIAL_REPORTS=memory npx remix vite:dev --port 3158
```

Then open `/movie/1147572` (Narnia: The Magician's Nephew) and scroll to the section.

## Checked on 14 Oct 2026

- 21 unit tests (`node --test app/server/talked-about-now/talked-about-now.test.ts app/ui/social-embed/target.test.ts`).
- The read on production Crate (read only): 10 posts for Narnia, 9 for VisionQuest, 10 for Clayface, 3 for Breaking
  Bad, in 130 to 240 ms from this machine; a missing schema reads as nothing.
- In Chromium, desktop and phone, on five titles: no request to `/api/social` or for the section's chunk in the
  first view, and no third party besides image.tmdb.org until a click. Play started the YouTube video (its time
  advanced); "Show post" loaded Bluesky's and Mastodon's frames at their own height; "Wrong title?" removed the item
  at once, answered 200 and the next read left it out.

# "Talked about now": relevant pieces only

Part of [the Talked about now map](https://github.com/alp82/goodwatch-monorepo/issues/537). The owner's rule: relevant
buzz only, quality over quantity. A title with no worthy piece shows none, never a random one.

The production audit of 15 October 2026 (`gw-handoff/relevance-audit-2026-10-15.md`, outside the repo) found that the
start row kept a place for a Bluesky or Mastodon voice, and all six voices it showed that day were noise. This change is
the webapp half of its recommendation ("Quality-ranked selection, no source quota"). Social discovery judges each
title–post link and writes `doc.social_relevance`; the webapp only reads it.

## What the webapp reads

`doc.social_relevance` has one row per judged link, keyed like `doc.social_title_link` (`media_type`,
`media_tmdb_id`, `post_id`), with `version`, `content_hash`, `status` (`keep` or `drop`), `kind`, `score`,
`dup_group`, `reasons` and `judged_at`.

Both reads, the title section's (`readTitleSql`) and the start row's (`socialQuery`), add the same inner join from
`relevanceJoin` in `app/server/talked-about-now/social-store.server.ts`, next to the content-quality join:

```sql
JOIN doc.social_relevance rel ON rel.media_type = l.media_type AND rel.media_tmdb_id = l.media_tmdb_id
  AND rel.post_id = l.post_id AND rel.content_hash = p.content_hash
  AND rel.version = 'relevance-1' AND rel.status = 'keep'
```

Then one link of each duplicate group per title (`COALESCE(rel.dup_group, l.duplicate_group, post_id)`), the
best-ranked by `score` (then the newest), and the rows ordered the same way. A link with no verdict, a `drop`, a verdict
of another version or of the post's content before an edit isn't shown.

**Before the table exists** Crate answers `RelationUnknown` (code 4041; checked on production on 15 October 2026). The
title section's read then answers nothing and the section stays hidden; the start row shows its titles without pieces.
There is no fallback to the unjudged links.

## Choosing a title's pieces on the start row

`pickItems` in `app/domain/talked-about-now.ts`:

- The best-ranked by `score`, up to three. No source has a place of its own, and nothing fills a gap: a title with one
  kept piece shows one, a title with none shows none.
- At most one video, and one piece of each duplicate group.
- English first only between equal scores (the start page is in English), then the newer.

The board's preview line is the best-ranked piece, whatever its kind (`previewOf`).

The title section shows every kept link (up to 50), best-ranked first: its lead is the best-ranked wide video, else the
best-ranked headline.

## Fixtures

The fixture store (`SOCIAL_FIXTURE`, development only) applies the same gate: a `relevance` row of version
`relevance-1`, status `keep`, for the link and the post's current `content_hash`, ranked by `score`, one per
`dup_group`. With `SOCIAL_FIXTURE` set the start row reads its pieces from the file as well (the ranking still comes
from Crate).

`fixture.json` here is the start page's board of 14 October (scored day; read on 15 October 2026): the eight titles'
real visible links read from production Crate. Its relevance rows stand in for the table until it exists. Their status
is the audit's editorial verdict (Relevant: `keep`, Not relevant: `drop`); the four links the audit didn't see have no
row and don't show. The Bluesky posts of private accounts (all judged not relevant) are left out of the file, as it is
public. The score is a stand-in, not social discovery's formula: the kind's weight (official video 1.0,
review 0.9, interview 0.85, news 0.8, social 0.6) times a 7-day freshness decay.

The audit found the deployed picker choosing 17 pieces for this board, six of them Bluesky noise. With this fixture the
board shows 14 and no Bluesky voice: Helluva Boss (all of its links were Bluesky noise) and Take Charge of My Heart (no
links) show none, Love of Your Life and NCIS: Origins one each, the other four three each.

Screenshots, taken on 15 October 2026 with this fixture on a dev server (production Crate for the ranking, read only):

- The start row: `../start-row/shots/desktop.png` and `phone.png` (`shots.mjs` there).
- The title section: `shots/title-movie-1147572.png` (Narnia: the trailer leads, three headlines beside it) and
  `shots/title-tv-213375.png` (VisionQuest: no video, so the best-ranked headline leads). Helluva Boss
  (`/tv/289892`) answered no items and showed no section (`shots/title-report.json`; taken while its dropped Bluesky
links were still in the file). `title-shots.mjs` takes them.

## First view

Production builds of `origin/main` (`d3867c10`) and of this branch, the same `SENTRY_RELEASE`, first-view scripts
(entry, root, route and their imports):

| | Base raw | Branch raw | gzip difference |
| --- | --- | --- | --- |
| Start page (`routes/_index`, 10 files) | 633,628 | 633,628 | +1 |
| Movie page (`routes/movie.$movieKey`, 18 files) | 842,622 | 842,622 | −12 |

Byte for byte the same size; the gzip differences are chunk names. The row's late chunk, `StartRow-*.js`, is 155 B
smaller raw (11,122 to 10,967), since the preview line no longer chooses by source.

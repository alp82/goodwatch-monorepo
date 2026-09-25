# Verdict: IMDb dataset collector prototype

This is a throwaway prototype from 2026-09-25 and does not belong on main. To re-run it:

```
uv run goodwatch-flows/windmill/f/imdb_datasets/PROTOTYPE_imdb_dataset_collector.py
```

The inputs live in `PROTOTYPE_wipe_me_work/inputs/` and are not committed. They are read-only Mongo exports, Wayback copies of older IMDb files, and TMDB season lists saved once. To see the demo, open `PROTOTYPE_imdb_ingest_demo.html` with a double-click.

Design research: `docs/research/season-episode-scores/imdb-replacement.md`.

## Q1: Does the diff-only ingest work end to end on real data?

Yes. It ran six times over real files, with a target seeded from today's production `imdb_*_rating` values:

| Run | Files | Result |
|---|---|---|
| 1. First load | ratings from 2026-09-23, episodes from 2026-08-09 | 80,165 TV and 468,597 movie writes. This replaces every scraped value and fixes 8,583 TV and 38,131 movie vote counts that were inflated 10×. It also wrote 808k episode rows and 74k season rows. |
| 2. Same ETags | same as run 1 | Skipped |
| 3. Forced rerun | same as run 1 | 0 writes, so the diff is idempotent |
| 4. Next day | ratings from 2026-09-24 | 858 TV and 3,755 movie writes. Writing every vote change would have been 8,441 and 32,504. It also made 6.9k episode writes and 1.2k season writes. |
| 5. Live download | today's files | 928 TV and 3,562 movie writes. Episode writes were 9,690: 1,469 new, 381 moved to another season, 26 moved to another show, and 80 removed. |
| 6. Live, same ETag | today's files | Skipped by a real HEAD request |

The rule "write when the rating changed or the vote count moved ≥1 % against the stored value" cuts daily writes about 10×. Because it compares against the stored value, slow vote growth still gets written once it adds up.

## Q2: What does the episode data look like?

- The catalog has 810k rated episodes across 38.9k shows. The median show has 8 rated episodes, p90 has 44, and the maximum is 3,912.
- IMDb has **no season 0**. Specials are episodes with no season number: 676k in total, 10k of them rated. TMDB keeps them in S0. Doctor Who has 199 TMDB specials but only 12 IMDb episodes with no season number.
- The grids have 1.49M episodes with fewer than 5 votes, which render as grey cells. They also have 599k numbering holes, meaning episode numbers with no IMDb episode at all.
- 326 seasons have more than 400 episodes (daily shows). 53 rated episodes sit in seasons numbered by year.
- Only 1 (season, episode) position is duplicated.
- IMDb lists announced future seasons with unrated placeholder episodes, for example Wednesday S3 and Euphoria S3.
- 259 tconsts are shared by several TMDB shows, up to 17 for one tconst.

## Q3: How well do IMDb and TMDB numbering line up?

Aired seasons of the 668 shows with at least 500 TMDB votes:

| Season structure | Shows |
|---|---:|
| Exact match | 441 |
| Same seasons, episode counts off by 1–2 | 95 |
| Off by 3 or more | 37 |
| IMDb has more seasons | 49 |
| TMDB has more seasons | 27 |
| Same total, split into seasons differently (Money Heist, anime) | 19 |

84% of TMDB cells get an IMDb rating when matched by (season, episode).

Per episode, I compared the title at the same position for the 201 most-voted shows:

| Title at the same position | TMDB episodes |
|---|---:|
| Same title | 17.6k |
| Different title (often only a translated title) | 2.2k |
| **Same title found at another position** | **705** |

That last row is a real shift, for example where IMDb splits a double episode into "Part 1/2", as in The Office, Friends and Grey's Anatomy. Only 134 of the 201 shows are fully clean.

## Q4: Does it fit the Windmill worker?

Yes, easily.

- A full run takes 2–3.7 s, including 1 s of download and 1.3 s of parsing and joining.
- Peak RSS for the whole process stays at or below 700 MB, with DuckDB set to 512 MB and 2 threads. The default worker has 4 GiB and 2 CPUs.
- The downloads take 63 MB of disk.
- The expensive part is Mongo:
  - Reading the stored values takes 15 s for movies and 2 s for TV.
  - Building the tmdb→imdb movie map with a scan of `tmdb_movie_details` took **206 s**.

## Design changes for the real implementation

1. **Diff against the stored Mongo values, not against yesterday's file.** This heals itself and needs no worker state. Keep the rule "rating changed, or votes changed by ≥1 %".
2. **Rewrite every scraped value on the first run.** Set a `source` field and use it. About 550k writes are expected, followed by a full `all_ratings` backfill.
3. **Treat a title that disappears from the file as missing, not deleted.** Set `dataset_missing_since` and keep the old value. There are 8.8k such scraped values today; some are wrong ids, such as a movie linked to the tconst of the series Dark. Clear them after a grace period, for example 30 days.
4. **Skip the run only when both ETags are unchanged and no TMDB IMDb id changed since the last run.** Otherwise a TMDB relink waits until IMDb's next publish.
5. **Key episodes by the episode tconst and seasons by (show tconst, season).** Do not key by TMDB id. Fan out to all mapped TMDB shows at sync time. With this key, moves become updates and leave no orphans.
6. **Render the grid in IMDb numbering.**
   - Never join IMDb ratings onto TMDB episodes by position.
   - If TMDB metadata is needed (stills, names), match it by title or air date, or only in seasons where the counts agree.
   - Episode titles for tooltips need `title.basics` (228 MB). Download it weekly, not daily.
7. **Specials are episodes with a null season.** Show them in their own "unnumbered" row and exclude them from season averages. Hide seasons that have no rated episode, since those are announced future seasons.
8. **Read the imdb→tmdb map from `imdb_*_rating`**, which already holds tmdb_id and imdb_id, or index `tmdb_movie_details.imdb_id`. Do not scan the details collection daily.
9. **Run it on the default worker.** The high-performance worker is not needed.
10. **Wayback has daily snapshots of the dataset files.** They are useful for replaying and tuning thresholds before launch.

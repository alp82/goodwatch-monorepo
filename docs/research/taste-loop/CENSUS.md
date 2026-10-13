# Census of the taste pack

Rows written up to 2026-10-13T08:50:00Z (T0). Counts only; built by `lab/pull.py` together with the pack.
Every count covers all members, tier A and tier B together, unless it says otherwise.

## Members and rows per table

| Table | Rows | Members |
|---|---:|---:|
| user_score | 9,017 | 231 |
| user_wishlist (Want to See) | 2,072 | 150 |
| user_skipped (Skip) | 13,812 | 170 |
| user_not_interested | 2 | 1 |
| user_favorite | 72 | 25 |
| user_watch_state | 8,159 | 255 |
| user_watch_log | 254,966 | 255 |
| user_import | 4 | 2 |
| user_import_item | 3,534 | 2 |
| user_setting, country and services | 702 | 358 |
| user_setting, any key (members only, nothing else pulled) | 1,793 | 391 |

Members with a row in any table (any `user_setting` key counts): 405.

## Members by number of ratings, and the tiers

| Ratings per member | Members | Tier A | Tier B | Ratings |
|---|---:|---:|---:|---:|
| 0 | 174 | 113 | 61 | 0 |
| 1 to 4 | 62 | 40 | 22 | 110 |
| 5 to 19 | 72 | 47 | 25 | 838 |
| 20 to 59 | 64 | 42 | 22 | 2,239 |
| 60 or more | 33 | 22 | 11 | 5,830 |
| All | 405 | 264 | 141 | 9,017 |

The owner is in tier A and wrote 1,004 of the 9,017 ratings. Ratings: 6,095 of movies, 2,922 of shows.

## Ratings by provenance

| Provenance | Ratings | Members | Ratings, owner apart |
|---|---:|---:|---:|
| typed | 8,117 | 223 | 7,113 |
| bulk | 431 | 31 | 431 |
| import | 469 | 1 | 469 |

- `import`: an applied import item exists for the same member and title. `bulk`: one of 5 or more of the member's ratings written within 2 seconds. `typed`: the rest.
- Of the imported ratings, 469 also sit in a bulk write, and 469 still have the score the import wrote.
- Ratings in a bulk write whatever their provenance: 900. Under the other reading of the rule (ratings chained by gaps under 2 seconds, 5 or more in the chain): 1,208.
- Write time is `created_at`. It differs from `updated_at` (the `edited` flag) on 300 of 9,017 ratings (3.3%), from 32 members.
- Ratings with a review: 1.

## Sittings

A new sitting starts after 6 hours or more without a rating by that member.

| Members with ratings | Members |
|---|---:|
| one sitting | 200 |
| two or more sittings | 31 |
| five or more sittings | 7 |
| ratings on one day (UTC) only | 200 |

Ratings written in a second or later sitting: 1,795, of which the owner 1,003.

## Want to See, Skip, Not interested

| Members with | Members |
|---|---:|
| 1 or more Want to See adds | 150 |
| 5 or more | 62 |
| 10 or more dated Want to See adds | 36 |
| 20 or more | 21 |
| Want to See adds in two or more sittings | 17 |
| 1 or more Skips | 170 |
| 10 or more Skips | 113 |
| 10 or more Want to See adds and 10 or more Skips | 28 |

- Every Want to See add has a date. Adds in a bulk write (5 or more within 2 seconds): 329 of 2,072.
- Want to See titles later rated (the rating was written after the add): 88 rows from 13 members.
- Want to See titles whose rating was written before the add or at the same moment: 88 rows from 14 members.
- Want to See titles not rated: 1,896 rows from 144 members.
- Not interested rows: 2, from 1 members.

## Imports

| Imports | Count |
|---|---:|
| imdb, done | 1 |
| imdb, preview | 1 |
| letterboxd, preview | 1 |
| trakt, preview | 1 |

- Import items with an applied score: 469, from 1 members.
- Import pairs where a prior score and an applied score both exist: 0; of these 0 differ.
- Import items where the source rating and the member's GoodWatch rating at preview both exist: 2; of these 1 differ.
- Import items that are not ratings (kind watch, want, favorite or review): 3,005, of which 0 were applied. Items that named no movie or show: 23.

## Watching

| Seen | Rows | Seen but not rated | Members with one or more | Members with 10 or more |
|---|---:|---:|---:|---:|
| Movies | 6,319 | 224 | 42 | 5 |
| Shows | 1,820 | 164 | 41 | 5 |

| Show status | Rows | Members |
|---|---:|---:|
| dropped | 5 | 1 |
| not_started | 1 | 1 |
| on_hold | 4 | 1 |
| seen | 1,820 | 148 |
| watching | 10 | 1 |

| Watch log rows by origin and date precision | Rows | Members |
|---|---:|---:|
| score, unknown | 2,276 | 75 |
| season, unknown | 85 | 1 |
| seen, unknown | 248,551 | 147 |
| single, moment | 4,054 | 175 |

- Members with watch logs: 255; with a dated watch: 175.
- Members with a show status: 148; with 5 or more started shows that have a status: 75.
- Members with a show status other than Seen (Watching, On hold, Dropped): 1.

## Titles

| Title universe | Titles |
|---|---:|
| all titles in the pack | 72,101 |
| touched by a member in any table | 4,666 |
| touched and missing from the catalog | 92 |
| reference pool | 71,839 |
| reference pool, movies | 58,802 |
| reference pool, shows | 13,037 |
| reference pool with a fingerprint | 60,759 |
| touched with a fingerprint | 4,516 |
| touched with text embeddings | 4,516 |

The reference pool is: movies and shows with a poster, a GoodWatch score and 1,000 or more votes.

| Rated titles (2,482) and ratings (9,017) with | Titles | Ratings |
|---|---:|---:|
| a fingerprint | 2,406 (96.9%) | 8,909 (98.8%) |
| a complete fingerprint (all 74 scores) | 2,406 (96.9%) | 8,909 (98.8%) |
| `imdb_user_score_normalized_percent` | 2,426 (97.7%) | 8,931 (99.0%) |
| `metacritic_meta_score_normalized_percent` | 1,906 (76.8%) | 8,221 (91.2%) |
| `metacritic_user_score_normalized_percent` | 2,071 (83.4%) | 8,487 (94.1%) |
| `rotten_tomatoes_tomato_score_normalized_percent` | 1,964 (79.1%) | 8,144 (90.3%) |
| `rotten_tomatoes_audience_score_normalized_percent` | 2,179 (87.8%) | 8,521 (94.5%) |
| `tmdb_user_score_normalized_percent` | 2,433 (98.0%) | 8,938 (99.1%) |
| `goodwatch_overall_score_normalized_percent` | 2,435 (98.1%) | 8,940 (99.1%) |
| `goodwatch_user_score_normalized_percent` | 2,435 (98.1%) | 8,940 (99.1%) |
| `goodwatch_official_score_normalized_percent` | 2,056 (82.8%) | 8,487 (94.1%) |
| in the reference pool | 2,386 (96.1%) | 8,890 (98.6%) |
| outside the reference pool | 96 (3.9%) | 127 (1.4%) |

- Want to See adds outside the reference pool: 66 of 2,072.
- Ratings of titles without a fingerprint come from 56 members.
- Titles a member touched that are no longer in the `movie` or `show` table stay in the pack, flagged, with no title data: 76 ratings, 25 Want to See adds and 222 Skips are on such titles.

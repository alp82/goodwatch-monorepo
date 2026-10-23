# MDBList watched history, ratings, and other lists (#711 follow-up)

The owner asked on October 23, 2026 whether GoodWatch can read more than the Watchlist from MDBList. This page records what MDBList's official API offers and what one read-only probe of the owner's account returned. Only route names, field names, types, counts, and date formats are recorded. No titles, IDs, or list names.

Sources: the [machine-readable schema](https://api.mdblist.com/schema/?format=json), downloaded October 23, 2026 (SHA-256 starts `ebd3473430938e9a`; it changed after October 19), and the [Swagger UI](https://api.mdblist.com/docs/). Every route here accepts the personal API key (`apikey`) or an OAuth bearer token.

## Routes that exist

| Need | Route | Notes from the schema |
| --- | --- | --- |
| Watched history | `GET /sync/watched` | Movies, shows, seasons, and episodes, one row per item with `last_watched_at`. `plays=all` gives one row per play (movies and episodes only) with `play_id` and `watched_at`, so rewatches appear more than once. `extended=ids_only` gives a light snapshot; shows then carry `completed` and `inprogress`. Cursor pagination, up to 1,000 rows per page. |
| One item's plays | `GET /sync/history/{mediatype}/{provider}/{id}` | Up to 200 most recent plays per item, with `truncated`. One request per item, so it's for spot checks only. |
| Ratings | `GET /sync/ratings` | Movies, shows, seasons, episodes. `rating` (whole number, rounded), `rating_precise` (1 to 10 in 0.5 steps), `rated_at`. Cursor pagination. |
| Removals and latest state | `GET /sync/journal` | Latest state per item for watched and ratings, including removals. Not a full history: it keeps 30 days (`retention_days`). |
| What changed | `GET /sync/last_activities` | Timestamps per category. Useful before a re-import, not for the first one. |
| Dropped | `GET /sync/dropped`, `GET /sync/seasons/dropped` | Dropped shows and dropped seasons. |
| Collection | `GET /sync/collection` | Owned copies (Plex, Jellyfin, and others). Not a GoodWatch concept. |
| Custom lists | `GET /lists/user`, then `GET /lists/{id}/items` | The member's own lists. Item envelope matches the Watchlist. |
| Liked lists, favorite people | `GET /lists/liked`, `GET /people/favorites` | Other people's lists the member liked; people, not titles. There is no favorite-titles route. |
| Up Next | `GET /upnext` | Per show: next episode and `progress` (watched and total episode counts). Derived from watched history. |
| Stats | `GET /user/stats` | Precomputed totals; `stats` was null on this account. |

## Probe of the owner's account

Account state: Breaking Bad season 1 marked watched; no ratings, collection, dropped items, custom lists, liked lists, or favorite people. 27 + 3 requests, all GET.

| Route | Rows | Shape |
| --- | --- | --- |
| `/sync/watched` | 9: 0 movies, 1 show, 1 season, 7 episodes | Show: `last_watched_at`, `show{title, year, ids{trakt, imdb, tmdb, tvdb, mdblist}, …}`. Season: `last_watched_at`, `season{number, name, ids{tmdb}, show{…ids}}`. Episode: `last_watched_at`, `episode{season, number, name, ids{tmdb, tvdb}, show{title, year, ids{tmdb, trakt, imdb, mdblist, tvdb}}}`. |
| `/sync/watched?extended=ids_only` | 9 | Show `{id, tmdb, last_watched_at, completed, inprogress}`: `completed: false`, `inprogress: true`. Season `{tmdb, last_watched_at}`. Episode `{tmdb, last_watched_at, season, episode, show}`, `show` = the show's TMDB ID on 7 of 7. |
| `/sync/watched?plays=all` | 7 episode plays, 7 distinct `play_id` | `play_id`, `watched_at`, `episode{…}`. Each play's `watched_at` equals that episode's `last_watched_at`. |
| `/sync/ratings` | 0 | Shape not observed. |
| `/sync/journal` | 8: 1 season and 7 episodes, all `watched`/`added` | `category, item_type, ids, status, action_at, value_at, season, episode, episode_tmdb_id, episode_tvdb_id`; `retention_days: 30`. `action_at` = `value_at` on 8 of 8. |
| `/upnext` | 1 | Next episode plus `progress`. |
| Others | 0 | `/sync/collection`, `/sync/dropped`, `/sync/seasons/dropped`, `/lists/user`, `/lists/liked`, `/people/favorites`; `/user/stats` returned `stats: null`. |

All 7 episodes, the season, and the show share one `last_watched_at`, and the journal's `action_at` equals `value_at`. The date is when the season was marked watched, not a separate viewing date per episode.

### Pagination and totals

- `/sync/watched` sends **no total**: no `pagination.total`, no `X-Total-Items`. `pagination` has `offset`, `limit`, `has_more`, and `next_cursor` while more rows exist. `X-Has-More` and `pagination.has_more` agree. `X-Matched-Items` is the page's row count.
- At `limit=2`, `/sync/watched` took 5 pages for 9 distinct rows and `plays=all` 4 pages for 7; both ended with `has_more: false` in header and body.
- The per-type reads (`mediatype=movie|show|season|episode`) returned 0 + 1 + 1 + 7 = 9, matching the combined read.
- `/lists/liked` and `/people/favorites` use page pagination with a `total`.

So for history, completeness rests on the end signal and the per-type cross-check, not on a count. The Watchlist had both.

## How the rows map to GoodWatch

GoodWatch's existing Trakt archive import (`files.server.ts`) already handles the same shapes: MDBList's sync API mirrors Trakt's.

| MDBList | GoodWatch | Rule |
| --- | --- | --- |
| Movie play (`plays=all`) | A watch of the movie, which makes it Seen | One watch per `play_id`, dated `watched_at`. Several plays are rewatches. |
| Episode play (`plays=all`) | A watch of the episode | TMDB numbering (`season`, `number`), parent show from `episode.show.ids`. Season 0 stays a special. |
| Season row | Nothing | It's derived from episode watches. |
| Show row | Nothing directly | A show is listed once any episode is watched. GoodWatch derives Seen from the last aired regular episode. `completed` is set by a background job and can lag. |
| Dropped show | Dropped | Only with nothing contradicting it, as the existing show-status imports do. |
| Movie or show rating | Score | Whole numbers 1 to 10 pass as is. Half steps follow the TMDB import's rule and round up (7.5 becomes 8). Rating a movie also makes it Seen, as GoodWatch's rule says. |
| Season or episode rating | Unsupported, kept visible | As in the Trakt import: "GoodWatch doesn't import season or episode ratings yet." |
| Custom lists | Unsupported, kept visible | As in the Trakt import. A custom list isn't Want to See. |
| Collection, liked lists, favorite people, Up Next, stats | Not read | Not GoodWatch concepts, or derived. |

**Dates:** a watch takes MDBList's date, since the source recorded one. A bulk "mark season watched" gives every episode the same timestamp, the moment of the click. GoodWatch can't tell that apart from a real viewing time.

## Free-tier cost for a large account

Assume 500 Watchlist titles, 2,000 movie plays, 20,000 episode plays, 300 shows, 3,000 ratings, and 10 custom lists of 200 titles, at 1,000 rows per page:

| Read | Requests |
| --- | --- |
| Watchlist | 1 |
| Watched plays (`plays=all`) | 22 |
| Show flags (`ids_only`, `mediatype=show`) | 1 |
| Ratings | 3 |
| Dropped shows and seasons | 2 |
| Custom lists (index + items) | 11 |
| **Total** | **about 40** |
| With per-type cross-checks | about 70 |

That's 4 to 7% of the free 1,000 a day, shared with the member's other MDBList apps, and well under the 1,000 reads per 5 minutes.

## Not observed

Rating rows (no ratings on the account), a movie watch, a rewatch, a dropped show, a custom list, and a large account's paging.

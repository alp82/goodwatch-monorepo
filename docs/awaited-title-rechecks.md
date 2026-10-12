# Daily offer rechecks for the titles members wait for

Issue [#457](https://github.com/alp82/goodwatch-monorepo/issues/457), for "newly available on your services"
([#456](https://github.com/alp82/goodwatch-monorepo/issues/456)). A title's streaming offers are rechecked about
every 30 days. A title a member waits for is rechecked once a day, so that an offer on one of the member's services
is in Crate about a day after TMDB lists it. Paths under `goodwatch-flows/windmill/` are shortened to `f/...`.

**Awaited title**: a title that a member with a country and at least one saved streaming service
(`user_setting` keys `country_default` and `streaming_providers_default`, both not empty) has as Want to See
(`user_wishlist`), or a show such a member has as Watching or On hold (`user_watch_state`).

## Parts

| Part | Path | What it does |
|---|---|---|
| List rules | `f/tmdb_api/awaited_titles.py` | Stores the list, says which titles are due, and when each is due again. Mongo only. |
| List job | `f/tmdb_api/tmdb_fetch_details_from_api/awaited` | Every hour: reads the awaited titles from Crate and stores them. The only part that reads Crate. |
| Queue | `f/tmdb_api/tmdb_fetch_details_from_api/next` | Each run of the details flow (every 15 s) puts up to 10 due awaited titles into its batch of 50. |
| Fetch | `f/tmdb_api/tmdb_fetch_details_from_api/fetch` | Unchanged. One TMDB request per title, which includes `watch/providers` for every country. |
| Publication | `f/sync/copy/tmdb_streaming` | Unchanged. Publishes every title whose details were fetched since its last run. |

There is no new flow and one new schedule, for the list job.

## How it works

**The list** is the Mongo collection `tmdb_awaited_titles`, one document per title: `_id` (`movie:603`,
`show:95396`), `media_type`, `tmdb_id`, `first_listed_at`, `listed_at` (the last list job that named it), `due_at`
and `selected_at` (the last time the queue took it). It has no index and needs none at this size.

**The list job** reads each awaited title once, with one statement per member table, and stores the result:

- A new title is due at once, and from then on at that time every day.
- A title that is still listed keeps its due time.
- A title that is no longer listed is removed by the first run more than 3 days after the last list that named
  it. Until then it is rechecked like a listed title.
- A read that returns no title removes nothing.
- A read that fails changes nothing. The queue keeps working from the stored list, and the next hour's run
  stores the list again.
- More than 10,000 titles (`MAX_TITLES`) fail the job and leave the stored list. Each title is one request a day,
  so a list that long is a budget decision for the owner.

**Why every hour.** How often a title is rechecked does not depend on the list job: that stays once a day.
The list job decides how soon a title a member just added is first rechecked, and how long a failed run goes
unrepaired. With one run a day both were up to a day. With one run an hour a new title is rechecked within
the hour, and a failed run costs the titles added in that hour one more hour. A run takes about 2 seconds, so
24 runs a day cost about a second of Crate time (see the numbers below) and no TMDB request.

**The queue** takes the titles with `due_at` in the past, longest due first, at most 10 per run, and sets each due
again 24 hours (`CYCLE`) after the time it was due. A title therefore keeps its time of day. A recheck more than
24 hours late counts from the time it ran. The titles are reserved like every title of the batch (`selected_at`,
`is_selected`), so the 30-day queue doesn't fetch them a second time, and after a run that dies the regular queue
fetches them 10 minutes later.

- A title that TMDB deleted, or that has no details document, is left out.
- A title on a list that was not stored for 3 days is left alone, so a list job that stays off or broken stops
  costing requests.
- If the list can't be read, the run prints a warning and fetches its regular batch.
- A fetch that fails is not retried before the next day.

## The numbers behind one day

Measured on 2026-10-12 with read-only queries on production Crate and GETs on the Windmill API.

**The list**

| | |
|---|---:|
| Members with a country and a saved service | 271 |
| Of them with at least one awaited title | 114 |
| Awaited titles | 1,107 (690 movies, 417 shows) |
| Member and title pairs | 1,614 (1,613 Want to See, 1 Watching, 0 On hold) |
| Title and country pairs, in 24 countries | 1,386 |
| Titles on none of the services of at least one waiting member | 635 (57%) |

The list job's two statements took 34 ms and 10 ms, about a second a day for 24 runs.

**Requests per day**

| | Requests per day |
|---|---:|
| Added by a 1-day cycle | 1,107 |
| Added by a 2-day cycle | 554 |
| Saved, because the 30-day queue no longer fetches these titles | 37 |
| Details flow today (the catalog was fetched between 2026-09-25 and 2026-10-01, so only new titles are due) | about 2,000, estimated from 144 sampled runs |
| Details flow in steady state, from 2026-10-21 (1.3 million titles every 30 days) | about 43,000 |
| Episode flow | about 13,000 |
| What the details flow can carry (50 titles every 15 s) | 288,000 |
| TMDB's documented limit, about 40 requests per second | about 3.4 million |

A 1-day cycle adds 2.6% to the details flow's steady state and uses 0.03% of TMDB's limit. The peak rate doesn't
change, because awaited titles take slots of the batch and the batch stays at 50. The whole list takes 111 runs,
about 28 minutes.

One day and not two, because both are small and one day halves the wait. Less than a day gains nothing while the
publication runs every 6 hours. How often TMDB itself refreshes its offers was not verified.

**Why not narrow the list to titles that are on none of their owner's services.** It would save 472 requests a day.
It would need the member's services parsed and joined with `streaming_availability` in the list job, with the
duplicate service ids (9, 10 and 119; 2 and 350) handled the way the webapp does. And the daily recheck of a title
that is on a service is what notices it leaving, which keeps "on my services" right for the same members.

**Why the details queue and not the priority path.** `f/priority/crawl_all` ran 1,033 crawls in 24 hours, at a
median of 59 s each. Each crawl fetches the details, Metacritic, Rotten Tomatoes, every country's watch page and
the fingerprint, and publishes all of it. Another 1,107 titles a day would double that load for one useful request
per title. Its cooldown of 7 days is one constant, shared with the backlog monitoring.

**Why no web scrape.** The API answer names the services per country and offer type, and the publication writes a
`streaming_availability` row from it alone, with TMDB's link. That row is what "newly available" reads. The scrape
adds the service's own link, the price and the quality; the webapp falls back to TMDB's link until it has them. The
scrape keeps its own rhythm of 7 days per country. Scraping the 1,386 title and country pairs daily would be 3% of
the scrape's 43,200 pages a day, but it would have to bypass the 7-day freshness rule, and it was not built.

## When a recheck reaches Crate

`f/sync/copy/tmdb_streaming` runs at 02:00, 08:00, 14:00 and 20:00 (Europe/Berlin) and publishes every title whose
details were fetched since one hour before its last completed run started. None of the 66 runs since 2026-09-28
failed (2 were skipped); they took a median of 8 minutes and at most 27.

A title's time of day is the time of the list job run that first named it, and it keeps that time.

- **The titles in the first list** are all due at the time of the run that filled the empty list. Filled at
  07:00, they are rechecked between 07:00 and about 07:30 and published by the 08:00 run. An offer that TMDB
  lists is then in Crate at the latest about 25.5 hours later: up to 24 hours until the title's recheck, up to
  an hour until the publication, and the run.
- **A title a member adds later** is first rechecked by the next hourly run, the same day, and every day at
  that hour from then on. A title due in the hour before a publication run (01:00, 07:00, 13:00, 19:00) is
  published within the hour. Any other waits for the next publication run, at most 6 hours: a title first seen
  at 15:00 is rechecked at 15:00 every day and published at 20:00. For such a title an offer that TMDB lists
  is in Crate at the latest about 30.5 hours later.

`streaming_availability.created_at` is the time of the publication. A failed publication run costs 6 hours,
since the next run reads from the same point. That is enough for news within days, so the recheck does not
publish on its own.

## Putting it live

1. **Merge.** The "Push Windmill workspace" action deploys the scripts. This changes `next` of the details flow at
   once: every run now reads the list, which doesn't exist yet, finds nothing and fetches its regular batch.
   `f/tmdb_api/awaited_titles` is pushed with it; should `next` arrive first, its runs fail until the module is
   there, seconds later.
2. **Check the details flow** in Windmill: the runs after the push succeed as before.
3. **Create the schedule** (schedules are not in the repository), once an hour on the hour. `no_flow_overlap`
   as on the other scheduled jobs; a run can't reach the next one anyway, since the script's timeout is 2 minutes.
   ```sh
   curl -sS -X POST "$WMILL_URL/api/w/goodwatch/schedules/create" \
     -H "Authorization: Bearer $WMILL_TOKEN" -H "Content-Type: application/json" \
     -d '{"path": "f/tmdb_api/tmdb_fetch_details_from_api/awaited",
          "script_path": "f/tmdb_api/tmdb_fetch_details_from_api/awaited",
          "is_flow": false, "schedule": "0 0 * * * *", "timezone": "Europe/Berlin",
          "args": {}, "enabled": true, "no_flow_overlap": true}'
   ```
   In the Windmill UI: Schedules, New schedule, the script above, cron `0 0 * * * *`, timezone Europe/Berlin, no
   arguments. `$WMILL_URL` is `http://10.0.0.10:9000` on the private network.
4. **Choose the hour of the first list.** The run that fills an empty list makes every title in it due at that
   hour for good (see [When a recheck reaches Crate](#when-a-recheck-reaches-crate)). To get 07:00, create the
   schedule with the cron `0 0 7 * * *` instead, wait for its first run, and then make it hourly. The update
   replaces the schedule's settings, so it names all of them:
   ```sh
   curl -sS -X POST "$WMILL_URL/api/w/goodwatch/schedules/update/f/tmdb_api/tmdb_fetch_details_from_api/awaited" \
     -H "Authorization: Bearer $WMILL_TOKEN" -H "Content-Type: application/json" \
     -d '{"schedule": "0 0 * * * *", "timezone": "Europe/Berlin", "args": {}, "no_flow_overlap": true,
          "cron_version": "v2"}'
   ```
   Production was set up this way: the schedule was created on 2026-10-12 with the 07:00 cron.

No Mongo index, no Crate change and no new Windmill variable are needed. `f/monitoring/check` observes the
schedule like every enabled schedule. It reports a run that did not start 30 minutes after it was due, and a run
that is still running after 15 minutes (`RUNTIME_HOURS`; the script's timeout is 2 minutes).

## How to see that it works

- **The list job's result** is `{"listed": …, "added": …, "removed": …}`. The run that fills the empty list
  lists and adds about 1,100. Every later run lists about as many and adds the titles first seen in that hour,
  mostly none.
- **The list**:
  ```js
  db.tmdb_awaited_titles.countDocuments({})                           // about 1,100
  db.tmdb_awaited_titles.countDocuments({due_at: {$lte: new Date()}}) // 0, except in the half hour after the first list's hour
  db.tmdb_awaited_titles.find().sort({selected_at: 1}).limit(1)       // the oldest recheck: less than a day ago
  ```
- **The details flow**: in the half hour after the first list's hour, step `a` returns 10 ids per run. While the
  catalog is fresh (until 2026-10-21) it returns none at most other times of the day.
- **Crate**, after `f/sync/copy/tmdb_details` ran (04:00 and 16:00): the age of the awaited movies' details. The
  median was 16.7 days on 2026-10-12 and must be under 2 days from the second day on.
  ```sql
  SELECT count(*), percentile(CAST(current_timestamp AS BIGINT) - CAST(m.tmdb_details_updated_at AS BIGINT), 0.5) / 86400000.0 AS median_days
  FROM movie m WHERE m.tmdb_id IN (
    SELECT DISTINCT a.tmdb_id FROM user_wishlist a
    JOIN user_setting c ON c.user_id = a.user_id AND c.key = 'country_default' AND c.value <> ''
    JOIN user_setting s ON s.user_id = a.user_id AND s.key = 'streaming_providers_default' AND s.value <> ''
    WHERE a.media_type = 'movie');
  ```

## How to turn it off

- **Disable the schedule.** Rechecks continue from the stored list for 3 days and then stop.
  ```sh
  curl -sS -X POST "$WMILL_URL/api/w/goodwatch/schedules/setenabled/f/tmdb_api/tmdb_fetch_details_from_api/awaited" \
    -H "Authorization: Bearer $WMILL_TOKEN" -H "Content-Type: application/json" -d '{"enabled": false}'
  ```
- **At once:** also empty the list, `db.tmdb_awaited_titles.deleteMany({})`. The next list job fills it again and
  every title is due at that hour, so turn it on again as in step 4 of [Putting it live](#putting-it-live).
- **For good:** revert the commit. `next` then no longer reads the list, and the collection can be dropped.

## Tests

```sh
cd goodwatch-flows
python -m unittest tests.test_awaited_titles tests.test_details_queue_awaited tests.test_monitor_check
```

They need the flow dependencies plus `mongomock`, and use no network, Mongo or Crate. The member tables are SQLite
tables behind the connector's `select`, so the statements themselves run. SQLite is not Crate: Crate 5.10 rejected
a `UNION ALL` of the two member tables under the settings joins ("Cannot cast value `show` to type `integer`"),
which is why there is one statement per table. The job's statements were run once against production Crate and
returned the 1,107 titles above.

## Not built

- A scrape of the member's country when an offer arrives, for the service's own link.
- Publication right after the recheck.
- A retry of a failed fetch before the next day.
- The list narrowed to titles that are on none of their owner's services.
- One hour of the day for every title: a title added later is rechecked within the hour and keeps that hour,
  which can be up to 6 hours before a publication run.

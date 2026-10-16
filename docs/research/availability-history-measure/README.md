# Availability measurement for #678

Read-only measurement behind [availability-history.md](../availability-history.md). It sends only GET requests to
the TMDB API, with the local development key from `goodwatch-webapp/.env`. It writes nothing to GoodWatch.

It runs on the owner's machine from `~/.local/share/goodwatch-availability-measure/` (scripts in `bin/`, data in
`data/`, logs in `logs/`). The files here are a copy for review.

## What runs

| Script | When (UTC) | What it reads | Requests |
|---|---|---|---:|
| `poll.py` | Every 30 minutes | The service's offers for the event titles due in the last 5 or next 3 days, once fresh and once cached, and the full Netflix US movie and show lists, fresh | About 600 a run, 29,000 a day |
| `daily.py` | 20:00 | The 60 panel lists of #624, each sorted by title and by date, fresh, then one per-title check for every title that appeared or vanished since the day before | About 17,000 a day |
| `events.py` | Once, by hand | Matches `netflix_us_schedule.tsv` to TMDB ids and finds the originals that premiere from 2026-10-01 to 2026-11-15 | About 600 |
| `summarize.py` | By hand | Nothing from the network. Prints the tables | 0 |
| `retro.py` | Once, on 2026-10-16 | The state of every event title, and its history in the panel reads of #624 | About 450 |

"Fresh" adds an unknown query parameter (`cb`) so that CloudFront misses its cache. "Cached" is the plain URL that
GoodWatch's own fetches use.

## Crontab lines

```
CRON_TZ=UTC
*/30 * * * * cd ~/.local/share/goodwatch-availability-measure/bin && /usr/bin/python3 poll.py >> ../logs/poll.log 2>&1
0 20 * * * cd ~/.local/share/goodwatch-availability-measure/bin && /usr/bin/python3 daily.py >> ../logs/daily.log 2>&1
```

Both scripts stop doing anything after 2026-11-06 (`END_DATE` in `common.py`). To stop earlier, delete the lines
with `crontab -e`.

## Read the results

```
python3 ~/.local/share/goodwatch-availability-measure/bin/summarize.py
```

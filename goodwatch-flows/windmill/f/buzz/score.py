"""Daily volume-gated Wikipedia lift, promoted from the #543 prototype.

Require the scored day and every prior calendar day of the 28-day baseline.
Unknown observations never become zero. A flat baseline has no diagnostic z.
"""
import datetime as dt
import statistics

FORMULA_VERSION = 'wikipedia-lift-28d-v1'


def rank_day(titles: list[dict], pageviews: dict[str, dict], day: dt.date) -> list[dict]:
    rows = []
    for title in titles:
        series = pageviews.get(title['title_key'], {})
        values = [series.get((day - dt.timedelta(days=i)).isoformat()) for i in range(28, 0, -1)]
        today = series.get(day.isoformat())
        if today is None or any(v is None for v in values):
            continue
        mean, sd = statistics.mean(values), statistics.pstdev(values)
        rows.append(dict(title_key=title['title_key'], day=day.isoformat(),
                         score=today / max(mean, 1), views=today, mean28=mean, sd28=sd,
                         z=(today - mean) / sd if sd else None,
                         eligible=today >= 1000 and today - mean >= 500, rank=None,
                         curve=[{'day': (day - dt.timedelta(days=i)).isoformat(),
                                 'views': series.get((day - dt.timedelta(days=i)).isoformat())}
                                for i in range(13, -1, -1)], card=dict(title), reasons=[]))
    rows.sort(key=lambda row: (-row['score'], -row['views'], row['title_key']))
    for rank, row in enumerate((r for r in rows if r['eligible']), 1):
        row['rank'] = rank
    return rows

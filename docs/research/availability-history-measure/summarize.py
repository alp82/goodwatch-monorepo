# Turn the collected measurement into the tables of docs/research/availability-history.md.
# Usage: python3 summarize.py   (prints Markdown-friendly text)
import collections
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from common import DATA, read_jsonl_gz


def t(s):
    return datetime.datetime.fromisoformat(s)


def timeline(records):
    """(media, id, fresh) -> list of (at, offers after that poll)."""
    state, out = {}, collections.defaultdict(list)
    for r in sorted(records, key=lambda r: r["at"]):
        k = (r["media"], r["id"], r["fresh"])
        cur = set(state.get(k, set()))
        cur |= set(r["added"])
        cur -= set(r["removed"])
        state[k] = cur
        out[k].append((r["at"], frozenset(cur), r["first"]))
    return out


def present(offers, region, providers):
    pids = {str(p) for p in providers}
    return any(o.split(":")[1] in pids and (region is None or o.split(":")[0] == region) for o in offers)


def main():
    events = json.load(open(os.path.join(DATA, "events.json")))
    polls = read_jsonl_gz("poll_events.jsonl.gz")
    runs = read_jsonl_gz("poll_runs.jsonl.gz")
    sentinel = read_jsonl_gz("sentinel.jsonl.gz")
    tl = timeline(polls)
    print(f"## Polls: {len(runs)} runs, {runs[0]['at'] if runs else '-'} to {runs[-1]['at'] if runs else '-'}")
    print(f"Requests {sum(r['requests'] for r in runs[-1:])} in the last run; refused (429) in total: "
          f"{sum(r['refused'] for r in runs)}; failed: {sum(r['failed'] for r in runs)}")

    print("\n## When TMDB changes offers (fresh reads, UTC): changes per day and hour")
    hours = collections.defaultdict(collections.Counter)
    for r in polls:
        if r["fresh"] and not r["first"]:
            hours[r["at"][:10]][r["at"][11:13]] += 1
    # A sentinel change counts only when total_results moved; otherwise it's a paging miss or its return.
    last_total = {}
    for r in sorted(sentinel, key=lambda r: r["at"]):
        if not r["first"] and r["total"] != last_total.get(r["media"]):
            hours[r["at"][:10]][r["at"][11:13]] += abs(r["total"] - last_total[r["media"]])
        last_total[r["media"]] = r["total"]
    for day in sorted(hours):
        print(day, " ".join(f"{h}h:{n}" for h, n in sorted(hours[day].items())))

    print("\n## Event titles: first fresh poll that shows the change, against the announced day")
    rows = []
    for e in events:
        k = (e["media"], e["id"], True)
        if k not in tl:
            continue
        seq = tl[k]
        want = e["kind"] in ("arrive", "premiere")
        if seq[0][2] and present(seq[0][1], e["region"], e["providers"]) == want:
            # Already in the wanted state when first polled: only usable if polled before the day.
            if seq[0][0][:10] >= e["date"]:
                rows.append((e, None, "already at first poll"))
                continue
        hit = next((at for at, offers, _ in seq if present(offers, e["region"], e["providers"]) == want), None)
        if hit is None:
            rows.append((e, None, "not yet"))
            continue
        lag = (t(hit).date() - datetime.date.fromisoformat(e["date"])).days
        cached = tl.get((e["media"], e["id"], False), [])
        chit = next((at for at, offers, _ in cached if at >= hit and present(offers, e["region"], e["providers"]) == want), None)
        rows.append((e, hit, f"day {lag:+d}" + (f", cached copy {round((t(chit) - t(hit)).total_seconds() / 3600, 1)} h later" if chit else "")))
    lags = collections.Counter()
    for e, hit, note in sorted(rows, key=lambda r: r[0]["date"]):
        print(e["date"], e["kind"], e["media"], e["service"], e["title"][:40], "|", hit or "-", "|", note)
        if note.startswith("day"):
            lags[(e["kind"], note.split(",")[0])] += 1
    print("\nLag counts:", dict(lags))

    print("\n## Daily panel reads")
    for f in sorted(os.listdir(DATA)):
        if not f.startswith("daily-report-"):
            continue
        r = json.load(open(os.path.join(DATA, f)))
        ch = r.get("changes", [])
        inc = [l for l in r["lists"] if not l["complete"]]
        by = collections.Counter((c["kind"], c["real"]) for c in ch)
        print(f"{r['day']} started {r['started'][11:16]} requests {r['requests']} refused {r['refused']} | "
              f"incomplete lists {len(inc)}/{len(r['lists'])}, missed by title sort {sum(l['missing_title_sort'] for l in r['lists'])}, "
              f"by date sort {sum(l['missing_date_sort'] for l in r['lists'])} | appeared real {by[('appeared', True)]} "
              f"false {by[('appeared', False)]} | vanished real {by[('vanished', True)]} false {by[('vanished', False)]} | "
              f"returns {len(r['returns'])}")


if __name__ == "__main__":
    main()

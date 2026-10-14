#!/usr/bin/env python3
"""Render an offline, self-contained evidence report, not an application UI.

Run after score.py: python review.py. All tables are static HTML; no server,
JavaScript, external stylesheet, runtime fetch, production service or cache.
"""
from collections import Counter
import datetime as dt
import html
import json
from statistics import mean

from collect import ROOT, DATA, save


def escaped(value):
    return html.escape(str(value), quote=True)


def number(value, digits=2):
    return "missing" if value is None else f"{value:,.{digits}f}"


def applicable(events, key, day):
    return [e for e in events if key in e["keys"] and e["review_from"] <= day <= e["review_through"]]


def group(events, key, day):
    annotations = applicable(events, key, day)
    if not annotations:
        return "unverified"
    if any(e["category"] == "death" for e in annotations):
        return "death"
    if any(e["relationship"] == "direct" and e["category"] != "anniversary" and e["event_date"] <= day for e in annotations):
        return "direct event"
    if any(e["category"] == "anniversary" for e in annotations):
        return "anniversary"
    return "context / anticipation / inferred"


def evidence_cell(events, row, day):
    annotations = applicable(events, row["key"], day)
    if not annotations:
        return '<span class="unknown">No dated event verified.</span> The article counts establish attention only.'
    parts = []
    for e in annotations:
        phase = "scheduled / anticipation" if e["event_date"] > day else e["relationship"]
        parts.append(f'<a href="#{e["id"]}">{e["id"]}</a> · {escaped(e["category"])} · {e["event_date"]} · {escaped(phase)}<br>{escaped(e["text"])} <a href="{escaped(e["url"])}">Source</a>')
    return "<hr>".join(parts)


def run():
    score = json.loads((ROOT / "scores.json").read_text())
    summary = json.loads((ROOT / "summary.json").read_text())
    events = json.loads((ROOT / "evidence.json").read_text())["events"]
    days = summary["review_days"]
    variants = score["variants"]
    stats = {}
    union = set()
    for variant in variants:
        perday = {}
        for day in days:
            rows = score["daily"][day]
            bykey = {r["key"]: r for r in rows["metrics"]}
            keys = rows["top20"][variant]
            union.update(keys)
            perday[day] = {"rows": len(keys), "annotations": dict(Counter(group(events, k, day) for k in keys)), "under_1000_views": sum(bykey[k]["wiki"]["value"] < 1000 for k in keys), "mean_views": mean(bykey[k]["wiki"]["value"] for k in keys) if keys else None}
        stats[variant] = perday
    floor_sensitivity = {}
    for floor in (0, 500, 1000, 2500):
        floor_sensitivity[str(floor)] = {}
        for day in days:
            rows = [r for r in score["daily"][day]["metrics"] if r["wiki"]["z"] is not None and r["wiki"]["value"] >= floor and (floor == 0 or r["wiki"]["delta"] >= 500)]
            rows.sort(key=lambda r: (-r["wiki"]["z"], -r["wiki"]["value"], r["key"]))
            floor_sensitivity[str(floor)][day] = {"top20": [r["key"] for r in rows[:20]], "groups": dict(Counter(group(events, r["key"], day) for r in rows[:20])), "eligible": len(rows)}
    save(ROOT / "evaluation.json", {"method": "Annotation coverage, not precision/recall: unknown does not mean false; post-hoc selected titles and sparse editorial labels bias this diagnostic.", "variants": stats, "floor_sensitivity": floor_sensitivity, "unique_review_titles": len(union)})

    parts = ['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GoodWatch buzz score — #543 evidence review</title>', '''<style>
body{font:15px/1.45 system-ui,sans-serif;margin:24px;color:#17212b;background:#fff}a{color:#17579a}h1,h2,h3{line-height:1.2}table{border-collapse:collapse;width:100%;font-size:13px;margin:16px 0 28px}th,td{padding:9px;border:1px solid #ccd3da;vertical-align:top;text-align:left}th{background:#edf2f6}td.n{white-space:nowrap;font-variant-numeric:tabular-nums}.note{background:#f2f5f7;padding:16px;border-left:4px solid #54718d}.unknown{color:#6a4a00}summary{cursor:pointer;padding:10px;font-weight:650;background:#f2f5f7}details{margin:12px 0}small{color:#53616e}nav a{margin-right:18px}hr{border:0;border-top:1px solid #ddd}code{background:#edf2f6;padding:2px 4px}@media print{details{display:block}summary{background:#fff}table{page-break-inside:auto}tr{page-break-inside:avoid}}</style>''',
        '<h1>Does the buzz score find what was actually talked about?</h1>',
        '<p>Throwaway logic/data spike for GitHub #543. Compare six UTC days against dated releases, trailers and news. This measures article attention, not social mentions, sentiment or viewing recommendations.</p>',
        f'<p>{summary["catalog"]} catalog titles ({summary["kinds"]["movie"]} movies, {summary["kinds"]["tv"]} shows); {summary["enwiki"]} unambiguous English Wikipedia sitelinks; {summary["all_60_days"]} complete 60-day histories. Scores cover September 23–October 13, 2026. Tables below cover October 8–13.</p>',
        '<div class="note"><b>Recommended starting rule for sustained current attention:</b> rank by <code>views / max(μ28, 1)</code>, with <code>views ≥ 1,000</code> and <code>views − μ28 ≥ 500</code>. For a “hot” badge also require lift ≥ 2; do not fill 20 slots with weak signals. Retain z-score as a burst diagnostic. Keep TMDB and Netflix as dated supporting reasons until prospective trending snapshots can validate a blend. Thresholds are provisional.</div>',
        '<p><b>Clock limits:</b> TMDB daily export popularity is a historical proxy, not trending. The trending table deliberately reuses the October 14 snapshot on earlier days: HINDSIGHT ONLY, excluded from the recommendation. Its 100 raw rows per type contain 98 movie / 91 show unique IDs; the first observed position wins. Netflix uses the latest available TSV week with assumed Tuesday publication (week-ending Sunday + 2 days), never the scored week before publication; the downloaded file ends October 4. Wikipedia is last-complete-day data. No current partial UTC day is scored.</p>',
        '<p><b>Reading the evidence:</b> “direct” means a dated event for that work, not proven pageview causation. Deaths, anniversaries, franchise context, anticipation and inferences are labeled. “No dated event verified” is an explicit research gap, not evidence nothing happened. Evidence was checked October 14; later reporting can explain an earlier event and never enters the numeric score.</p>',
        '<nav>' + ' '.join(f'<a href="#day-{d}">{d}</a>' for d in days) + '<a href="#evidence">Evidence index</a><a href="#coverage">Coverage & limits</a></nav>',
        '<h2>Annotation coverage across six days</h2><p>Counts over 120 ranked slots per variant, with repeats across days. This is a diagnostic on a partial, post-hoc annotation set, not an accuracy benchmark.</p>',
        '<table><tr><th>Variant</th><th>Direct event</th><th>Death</th><th>Anniversary</th><th>Context / inferred</th><th>Unverified</th><th>&lt;1,000 views</th></tr>']
    for variant, title in variants.items():
        counts = Counter()
        for s in stats[variant].values():
            counts.update(s["annotations"])
        low = sum(s["under_1000_views"] for s in stats[variant].values())
        parts.append('<tr><td>' + escaped(title) + '</td>' + ''.join(f'<td>{counts[g]}</td>' for g in ("direct event", "death", "anniversary", "context / anticipation / inferred", "unverified")) + f'<td>{low}</td></tr>')
    parts.append('</table>')
    for day in days:
        daily = score["daily"][day]
        bykey = {r["key"]: r for r in daily["metrics"]}
        parts.append(f'<h2 id="day-{day}">{day}</h2><p>{len(bykey)} titles with a complete preceding 28-day article baseline. Netflix week available in capture: {daily["netflix_week_as_published"]}. Each variant below has its own top 20; the floor may yield fewer titles.</p>')
        # All rows exist in the HTML: disclosure controls only reduce scrolling.
        for variant in ["floor_lift"] + [v for v in variants if v != "floor_lift"]:
            parts.append(f'<details open><summary>{escaped(variants[variant])}</summary>')
            if "hindsight" in variant:
                parts.append('<p class="note">Uses future October 14 trending ranks. Sensitivity demonstration only; unsuitable for historical validation.</p>')
            parts.append('<table><tr><th>#</th><th>Title / identity</th><th>Variant score</th><th>Article views</th><th>Previous 28 days: mean / SD</th><th>Raw z / lift</th><th>TMDB export: popularity / z*</th><th>Netflix weekly rank</th><th>Dated evidence / what happened</th></tr>')
            for rank, key in enumerate(daily["top20"][variant], start=1):
                row = bykey[key]
                wiki = row["wiki"]
                pop = row["tmdb"]
                nf = '<br>'.join(f'{escaped(r["show_title"])} · {escaped(r["season_title"])}<br>#{r["weekly_rank"]} · week {r["week"]} · assumed published {r["available_from"]}' for r in row["netflix"]) or 'Absent from this week’s matched Top 10 (not zero viewing)'
                tmdb = f'{number(pop["value"])} / {number(row["tmdb_z"])}' if pop else 'Missing complete TMDB baseline'
                if "hindsight" in variant:
                    tmdb += '<br>Oct 14 trending: ' + (f'#{row["trending_hindsight"]["rank"]}' if row["trending_hindsight"] else 'not in captured first 100 rows of type')
                parts.append(f'<tr><td>{rank}</td><td><a href="{escaped(row["article_url"])}">{escaped(row["title"])}</a><br><small>{row["kind"]} · {key}</small></td><td class="n">{number(row["scores"][variant])}</td><td class="n">{wiki["value"]:,}</td><td class="n">{number(wiki["mean"],1)} / {number(wiki["sd"],1)}</td><td class="n">{number(wiki["z"])} / {number(wiki["lift"])}×</td><td>{tmdb}</td><td>{nf}</td><td>{evidence_cell(events,row,day)}</td></tr>')
            parts.append('</table></details>')
    parts.append('<h2 id="evidence">Dated evidence index</h2>')
    for e in events:
        parts.append(f'<p id="{e["id"]}"><b>{e["id"]} — {escaped(", ".join(e["titles"]))}</b> · event {e["event_date"]} · {escaped(e["category"])} · {escaped(e["relationship"])}<br>{escaped(e["text"])}<br><a href="{escaped(e["url"])}">{escaped(e["source"])}</a> · source publication {escaped(e["published"])} · checked {e["checked"]}</p>')
    parts.append('<h2 id="coverage">Coverage & limits</h2><p>Fixed cohort selected using current catalog TMDB popularity, with no presentability/adult filter; survivorship and show-heavy selection bias remain. Missing dates are never filled with zero. Ambiguous Wikidata article matches are excluded. English reading traffic undersamples non-English audiences. Redirect traffic is not consolidated. Netflix matching is exact normalized title plus movie/show category and unique only within this cohort; it is provisional. Only 5 titles matched recent Netflix TSV history, and only The Gentlemen and Raw matched its latest week.</p><p>TMDB export dates are morning snapshots, not full UTC-day event counts. Wikipedia and TMDB were collected later; historical values can be revised. Netflix replay assumes Tuesday availability and has no archived publication vintages. The formula weights and floors are hypotheses, not learned parameters. No production write, cache access, app server, deployment or publication was performed.</p><p>* TMDB z uses denominator max(SD28, 0.05 × mean28, 0.1). Pageviews+TMDB uses 75% capped positive article z + 25% capped positive TMDB z. Adding Netflix holds the 75% / 25% base fixed and adds a bonus of 0.1 × (11 − best category/season rank), so any rank change is attributable to Netflix. Capping is 0–10. Lift is views / max(mean28, 1). Trending hindsight uses 80% capped positive article z + 20% of 10 × (101 − rank)/100, ranked separately for movies/shows. These blends are deliberately simple sensitivity comparisons.</p></html>')
    (ROOT / "review.html").write_text("\n".join(parts))
    print(f"review.html: {len(days)*len(variants)} tables; {len(union)} unique titles")
    print(json.dumps({v:dict(sum((Counter(s['annotations']) for s in dayscores.values()),Counter())) for v,dayscores in stats.items()},indent=2))


if __name__ == "__main__":
    run()

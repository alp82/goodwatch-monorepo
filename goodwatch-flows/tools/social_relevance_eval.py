#!/usr/bin/env python3
"""Offline evaluation of all P001–P632; labels never enter the production judge."""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'windmill'))
from f.social.common import SOURCES, stamp
from f.social.relevance import judge_links

FIXTURE = ROOT / 'tests/fixtures/social/relevance-2026-10-15.json'


def editorial_inputs(data):
    """The frozen audit measured relevance, not playability. Assume availability
    only inside this offline editorial regression; never claim these are checks.
    Production has no such default and drops missing observations.
    """
    return [p | {'youtube_playability': {'video_id': p['source_id'], 'method': 'watch',
             'checked_at': data['at'], 'status': 'playable', 'reason': 'offline_editorial_assumption',
             'countries': {'DE': True, 'US': True, 'GB': True}}}
            if p['source'] == 'youtube' else p for p in data['links']]


def evaluate(data):
    decisions = judge_links(editorial_inputs(data), data['catalog'], at=stamp(data['at']))
    labels = {(v['media_type'], v['media_tmdb_id'], v['post_id']): v for v in data['verdicts']}
    judged = []
    for post, decision in zip(data['links'], decisions):
        label = labels[post['media_type'], post['media_tmdb_id'], post['post_id']]
        judged.append({'audit_id': label['audit_id'], 'title': data['catalog'][f"{post['media_type']}:{post['media_tmdb_id']}"]['title'],
                       'key': f"{post['media_type']}:{post['media_tmdb_id']}", 'source': post['source'],
                       'text': post['text'], 'url': post['url'], 'relevant': label['relevant'],
                       'audit_reason': label['reason'], **decision})

    def stats(rows):
        keep = [r for r in rows if r['status'] == 'keep']
        tp = sum(r['relevant'] for r in keep)
        relevant = sum(r['relevant'] for r in rows)
        tn = sum(not r['relevant'] and r['status'] == 'drop' for r in rows)
        return dict(total=len(rows), keep=len(keep), drop=len(rows)-len(keep), relevant=relevant,
                    kept_relevant=tp, kept_not_relevant=len(keep)-tp, relevant_lost=relevant-tp,
                    precision=tp/len(keep) if keep else None, recall=tp/relevant if relevant else None,
                    agreement=(tp+tn)/len(rows) if rows else None)

    top = {t['key'] for t in data['top20']}
    nonempty = {r['key'] for r in judged if r['status'] == 'keep'}
    false_drops = defaultdict(list)
    for row in judged:
        if row['status'] == 'drop' and row['relevant']:
            causes = tuple(sorted({'duplicate' if r.startswith('duplicate_of:') else r for r in row['reasons']
                                   if not r.startswith(('metrics:', 'playability:'))}))
            false_drops[causes].append(row)
    return {'playability': 'Assumed only for offline editorial regression; not measured', 'at': stamp(data['at']).isoformat(), 'overall': stats(judged),
            'sources': {s: stats([r for r in judged if r['source'] == s]) for s in SOURCES},
            'top20': stats([r for r in judged if r['key'] in top]),
            'top20_sources': {s: stats([r for r in judged if r['source'] == s and r['key'] in top]) for s in SOURCES},
            'top20_empty': [t for t in data['top20'] if t['key'] not in nonempty],
            'worst_remaining': sorted([r for r in judged if r['status'] == 'keep' and not r['relevant']],
                                      key=lambda r: (bool(re.search(r'(?i)same|repeat|redundant|already (?:represented|retained|covered)', r['audit_reason'])),
                                                     -r['score'], r['audit_id']))[:10],
            'relevant_lost': [r for r in judged if r['status'] == 'drop' and r['relevant']],
            'false_drop_causes': [{'causes': list(causes), 'count': len(rows),
                                   'audit_ids': [r['audit_id'] for r in rows],
                                   'sources': {s: sum(r['source'] == s for r in rows) for s in SOURCES}}
                                  for causes, rows in sorted(false_drops.items(), key=lambda pair: (-len(pair[1]), pair[0]))],
            'judgements': judged}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fixture', type=Path, default=FIXTURE)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    report = evaluate(json.loads(args.fixture.read_text()))
    if args.output:
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ('playability', 'overall', 'sources', 'top20', 'top20_empty', 'false_drop_causes')}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

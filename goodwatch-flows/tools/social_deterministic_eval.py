"""Score f/social/deterministic against the hand-labelled #544/#556 evidence, offline.

Usage: python3 tools/social_deterministic_eval.py CACHE.json POSTS.json
CACHE.json holds {"catalog", "people", "official"} for the evidence posts, fetched read-only
through a Windmill preview job that runs DeterministicMatcher.lookup/people/official.
"""
import json, sys, collections
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'goodwatch-flows' / 'windmill'))
from f.social.deterministic import DeterministicMatcher, mentions
cache = json.load(open(sys.argv[1]))
posts = json.load(open(sys.argv[2]))
labels = collections.defaultdict(dict)
for s in ['youtube', 'rss', 'bluesky']:
    for l in json.load(open(ROOT / f'docs/implementation/talked-about-now/evidence/social-{s}-review-2026-10-14.json'))['links']:
        labels[l['post_id']][l['media_type'] + ':' + str(l['media_tmdb_id'])] = (l['manual_verdict'], l['title_identity']['title'])
people = {k: set(v) for k, v in cache['people'].items()}
official = {k: set(v) for k, v in cache['official'].items()}
m = DeterministicMatcher(None)
stats = collections.defaultdict(collections.Counter)
unl = []
for p in posts:
    if len(official.get(p['source_id'], ())) == 1:
        out = [{'key': next(iter(official[p['source_id']])), 'reason': 'official'}]
    else:
        out = m.decide(p, mentions(p), cache['catalog'], people, official.get(p['source_id'], set()))
    lab = labels[p['post_id']]
    got = {o['key']: o for o in out}
    s = stats[p['source']]
    for k, (v, t) in lab.items():
        s['llm_' + v] += 1
        if v == 'right':
            s['right_found' if k in got else 'right_missed'] += 1
    for k, o in got.items():
        v = lab.get(k, ('unlabelled',))[0]
        s['out_' + v] += 1
        if v != 'right':
            unl.append((p['source'], v, k, o['reason'], p['text'][:140].replace('\n', ' ')))
for src, s in stats.items():
    print(src, dict(s))
for u in unl: print(u)

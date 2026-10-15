#!/usr/bin/env python3
"""Re-screen stored social content; dry-run by default, --apply unpublishes rejects.

Only social-owned tables are mutated. Never fetch promoted outbound URLs.
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from dotenv import dotenv_values
from f.social import bluesky, quality
from f.social.common import SOURCES, now
from f.social.store import Crate, Store


def counts(posts, links):
    sources = {p['post_id']: p['source'] for p in posts}
    return {s: {'posts': sum(p['source'] == s for p in posts),
                'links': sum(sources.get(l['post_id']) == s for l in links)} for s in SOURCES}


def run(settings, *, apply=False, output):
    db, at = Crate(settings), now().isoformat()
    store = Store(db)
    posts = db.select('SELECT * FROM doc.social_post WHERE deleted_at IS NULL ORDER BY post_id LIMIT 10001')
    if len(posts) > 10000:
        raise RuntimeError('More than 10000 posts: paginate before applying a complete gate audit')
    links = db.select('SELECT * FROM doc.social_title_link ORDER BY post_id LIMIT 100001')
    if len(links) > 100000:
        raise RuntimeError('Link audit limit exceeded')
    # Stored evidence supports RSS/Mastodon rescreening. Legacy Mastodon rows
    # without link metadata fail closed; subsequent trend collection can validate.
    try:
        prior = db.select('SELECT post_id,content_hash,evidence FROM doc.social_content_quality LIMIT 10001')
    except RuntimeError as exc:
        if 'Unknown relation' not in str(exc):
            raise
        prior = []
    by_id = {p['post_id']: p for p in prior}
    for p in posts:
        old = by_id.get(p['post_id'])
        if old and old['content_hash'] == p['content_hash']:
            p['quality_evidence'] = json.loads(old['evidence'] or '{}')
    errors = bluesky.hydrate_quality([p for p in posts if p['source'] == 'bluesky'])
    decisions = quality.evaluate_batch(posts)
    predicted = [l for l in links if decisions.get(l['post_id'], {}).get('status') == 'pass']
    evidence = {'at': at, 'version': quality.VERSION, 'applied': apply, 'before': counts(posts, links),
                'predicted_after': counts(posts, predicted), 'hydration_errors': errors,
                'post_decisions': dict(Counter(p['source'] + ':' + decisions[p['post_id']]['status'] for p in posts)),
                'reasons': dict(Counter(r for v in decisions.values() for r in v['reasons']))}
    linked = {l['post_id'] for l in links}
    rejected = [p for p in posts if p['post_id'] in linked and decisions[p['post_id']]['status'] == 'reject']
    # Thirty diverse examples from previously published rows, not a padded sample.
    samples, selected = [], set()
    for reason, limit in [('stream_promotion', 10), ('automated_frame_post', 4), ('high_post_rate', 4),
                          ('repetitive_author', 3), ('no_substantive_text', 3), ('link_shortener', 3), ('unapproved_link_domain', 30)]:
        candidates = [p for p in rejected if reason in decisions[p['post_id']]['reasons'] and p['post_id'] not in selected]
        for p in candidates[:min(limit, 30-len(samples))]:
            selected.add(p['post_id'])
            # Do not publish piracy destination URLs as clickable links in evidence.
            text = quality.URL.sub('[outbound link]', p['text']).replace('|', '/').replace('\n', ' ')
            samples.append({'post_id': p['post_id'], 'source': p['source'], 'url': p['url'],
                            'author': p['author'], 'text': ' '.join(text.split()[:24])[:220], 'reasons': decisions[p['post_id']]['reasons'],
                            'title_keys': sorted({l['media_type'] + ':' + str(l['media_tmdb_id']) for l in links if l['post_id'] == p['post_id']})})
    evidence['rejected_examples'] = samples
    evidence['rejected_published_posts'] = len(rejected)
    # Save a reviewable prediction before beginning reversible production writes.
    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n')
    if apply:
        store.initialize()
        # Preserve source opt-out privacy: purge instead of retaining gate evidence.
        opted_authors = {p['author_id'] for p in posts if p.get('quality_evidence', {}).get('opted_out')}
        for author in opted_authors:
            store.remove_author('bluesky', author)
        for start in range(0, len(posts), 100):
            store.screen(posts[start:start+100])
            print(json.dumps({'screened': min(start+100, len(posts)), 'total': len(posts)}), flush=True)
        store.refresh()
        after = db.select('SELECT * FROM doc.social_title_link LIMIT 100001')
        invalid = db.select('''SELECT COUNT(*) AS count FROM doc.social_title_link l
            JOIN doc.social_post p ON p.post_id=l.post_id
            LEFT JOIN doc.social_content_quality q ON q.post_id=p.post_id AND q.content_hash=p.content_hash
                AND q.version=? AND q.status='pass'
            WHERE q.post_id IS NULL''', [quality.VERSION])[0]['count']
        evidence.update(after=counts(posts, after), nonpassing_links_remaining=invalid, finished_at=now().isoformat())
        destination.write_text(json.dumps(evidence, indent=2, ensure_ascii=False) + '\n')
        if invalid:
            raise RuntimeError('Nonpassing links remain; inspect audit before proceeding')
    print(json.dumps({k: v for k, v in evidence.items() if k != 'rejected_examples'}, indent=2), flush=True)
    return evidence


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    run(dotenv_values(args.env_file), apply=args.apply, output=args.output)

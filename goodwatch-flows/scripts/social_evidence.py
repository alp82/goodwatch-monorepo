#!/usr/bin/env python3
"""Read production social tables and export a deterministic manual-review sample."""
import argparse
import json
import random
from pathlib import Path
import sys
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.social.common import now, SOURCES
from f.social.store import Crate
from f.social.quality import VERSION as QUALITY_VERSION


def export(settings, per_source=50):
    db = Crate(settings)
    # The same report/deletion/content-version filters used by the title reader.
    links = db.select('''SELECT p.source,p.post_id,p.source_id,p.url,p.author,p.published_at,p.text,p.context,
        l.media_type,l.media_tmdb_id,l.lane,l.confidence,l.reason,l.duplicate_group
        FROM doc.social_title_link l JOIN doc.social_post p ON p.post_id=l.post_id
        JOIN doc.social_content_quality q ON q.post_id=p.post_id AND q.content_hash=p.content_hash
          AND q.version=? AND q.status='pass'
        LEFT JOIN doc.social_link_report r ON r.media_type=l.media_type AND r.media_tmdb_id=l.media_tmdb_id
          AND r.post_id=l.post_id AND r.status IN ('open','confirmed')
        WHERE p.deleted_at IS NULL AND l.hidden_at IS NULL AND r.report_id IS NULL AND l.content_hash=p.content_hash
          AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ORDER BY p.published_at DESC,p.post_id DESC LIMIT 100000''', [QUALITY_VERSION])
    # Review the actual displayed representative, not repeated uploads.
    unique = {}
    for link in links:
        unique.setdefault((link['media_type'], link['media_tmdb_id'], link['duplicate_group']), link)
    selected, coverage = [], {}
    rng = random.Random(5562026)
    for source in SOURCES:
        pool = sorted([p for p in unique.values() if p['source'] == source], key=lambda p: (p['post_id'], p['media_type'], p['media_tmdb_id']))
        coverage[source] = {'available': len(pool), 'sampled': min(per_source, len(pool)), 'shortfall': max(per_source - len(pool), 0)}
        for item in rng.sample(pool, min(per_source, len(pool))):
            item['manual_verdict'] = None
            item['manual_note'] = None
            selected.append(item)
    for kind, table in (('movie', 'movie'), ('tv', 'show')):
        identifiers = sorted({p['media_tmdb_id'] for p in selected if p['media_type'] == kind})
        titles = {row['tmdb_id']: row for row in db.select(
            f'SELECT tmdb_id,title,original_title,release_year,substr(synopsis,1,900) AS synopsis FROM {table} WHERE tmdb_id=ANY(?)',
            [identifiers])} if identifiers else {}
        for item in selected:
            if item['media_type'] == kind:
                item['title_identity'] = titles.get(item['media_tmdb_id'])
    return {'captured_at': now().isoformat(), 'seed': 5562026, 'coverage': coverage, 'links': selected,
            'review_method': 'Unreviewed export. A human/agent must read foreground and catalog metadata; matcher reason is not a verdict.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--per-source', type=int, default=50)
    args = parser.parse_args()
    result = export(dict(dotenv_values(args.env_file)), args.per_source)
    Path(args.output).write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(result['coverage'], indent=2))


if __name__ == '__main__':
    main()

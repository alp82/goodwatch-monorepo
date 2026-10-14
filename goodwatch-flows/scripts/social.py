#!/usr/bin/env python3
"""Run social discovery locally. Only new social tables are writable; no Valkey imports."""
import argparse
import json
import os
from pathlib import Path
import sys
from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.social.ingest import run
from f.social.maintenance import run as maintain
from f.social.store import Crate, Store


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['ingest', 'maintenance', 'counts', 'read'])
    parser.add_argument('--env-file', required=True)
    parser.add_argument('--source', default='all')
    parser.add_argument('--days', type=int, default=3)
    parser.add_argument('--pages', type=int, default=2)
    parser.add_argument('--max-posts', type=int, default=400)
    parser.add_argument('--no-vector', action='store_true')
    parser.add_argument('--title', default='movie:438631')
    parser.add_argument('--output')
    args = parser.parse_args()
    settings = dict(dotenv_values(args.env_file)) | dict(os.environ)
    if args.command == 'ingest':
        result = run(settings, source=args.source, days=args.days, pages=args.pages,
                     max_posts=args.max_posts, vector_enabled=not args.no_vector)
    elif args.command == 'maintenance':
        result = maintain(settings, limit=args.max_posts, source=args.source)
    else:
        db = Crate(settings)
        if args.command == 'counts':
            result = {'posts': db.select('SELECT source,count(*) AS posts,count(deleted_at) AS deleted FROM doc.social_post GROUP BY source'),
                      'links': db.select('SELECT p.source,count(*) AS links,count(DISTINCT l.media_tmdb_id) AS titles FROM doc.social_title_link l JOIN doc.social_post p ON l.post_id=p.post_id GROUP BY p.source'),
                      'runs': db.select('SELECT source,status,count(*) AS runs,sum(processed) AS processed,sum(published) AS published FROM doc.social_ingest_run GROUP BY source,status')}
        else:
            kind, identifier = args.title.split(':')
            result = Store(db).read_title(kind, int(identifier))
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(text + '\n')
    print(text)
    if args.command == 'ingest' and any(row['status'] == 'failed' for row in result['sources']):
        raise SystemExit(2)


if __name__ == '__main__':
    main()

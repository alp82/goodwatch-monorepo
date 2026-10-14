#!/usr/bin/env python3
"""Bounded read-only source export. Explicit movie:ID/show:ID list, no catalog scan."""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.media_language.prose_jobs import revision


def sources_for_row(kind, row):
    identity = f"{kind}:{row['tmdb_id']}"
    sources = []
    text = row.get('essence_text')
    if isinstance(text, str) and text.strip():
        sources.append({'source_id': identity + ':essence_text', 'source_revision': revision(text), 'text': text, 'kind': 'model'})
    for tag in row.get('essence_tags') or []:
        if isinstance(tag, str) and tag.strip():
            sources.append({'source_id': identity + ':essence_tag:' + revision(tag),
                            'source_revision': revision(tag), 'text': tag, 'kind': 'model'})
    return sources


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--titles', required=True, help='movie:603,show:1396; at most 100 titles')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    titles = list(dict.fromkeys(args.titles.split(',')))
    if not 1 <= len(titles) <= 100:
        parser.error('1–100 named titles required')
    groups = {'movie': [], 'show': []}
    for title in titles:
        kind, identifier = title.split(':')
        if kind not in groups or not identifier.isdigit() or int(identifier) <= 0:
            parser.error('Use movie:ID or show:ID')
        groups[kind].append(int(identifier))
    from f.db.cratedb import CrateConnector
    connector = CrateConnector()
    try:
        sources = []
        for kind, ids in groups.items():
            if ids:
                for row in connector.select(f'SELECT tmdb_id, essence_text, essence_tags FROM {kind} WHERE tmdb_id = ANY(?)', (ids,)):
                    sources += sources_for_row(kind, row)
        args.output.write_text(json.dumps(sources, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'titles': len(titles), 'sources': len(sources), 'output': str(args.output)}))
    finally:
        connector.disconnect()


if __name__ == '__main__':
    main()

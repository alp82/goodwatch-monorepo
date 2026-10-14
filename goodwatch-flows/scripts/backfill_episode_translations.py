#!/usr/bin/env python3
"""Read-only by default. Explicit title IDs are the priority list; never scans the catalog."""
import argparse
import json
import os
from pathlib import Path
import sys
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.media_language.episode_translations import Bounds, ingest_titles


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--titles', required=True, help='Comma-separated TMDB show IDs, highest priority first')
    parser.add_argument('--max-titles', type=int, default=2)
    parser.add_argument('--max-seasons', type=int, default=10)
    parser.add_argument('--max-episodes', type=int, default=100)
    parser.add_argument('--max-requests', type=int, default=250)
    parser.add_argument('--requests-per-second', type=float, default=2)
    parser.add_argument('--fixture', type=Path, help='Offline JSON path-to-response fixture; dry-run only')
    parser.add_argument('--apply', action='store_true', help='Publish translations to the configured Windmill Crate resource')
    args = parser.parse_args()
    token = os.environ.get('TMDB_ACCESS_TOKEN')
    key = os.environ.get('TMDB_API_KEY')
    if args.fixture and args.apply:
        parser.error('--fixture cannot publish')
    fixture = json.loads(args.fixture.read_text()) if args.fixture else None
    if fixture is None and not token and not key:
        parser.error('Set TMDB_ACCESS_TOKEN or TMDB_API_KEY locally; no secrets are printed')

    def get(path):
        if fixture is not None:
            return fixture[path]
        from urllib.parse import urlencode
        url = 'https://api.themoviedb.org/3/' + path
        headers = {'Accept': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        else:
            url += '?' + urlencode({'api_key': key})
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
            return json.load(response)

    connector = None
    try:
        if args.apply:
            from f.db.cratedb import CrateConnector
            connector = CrateConnector()
        result = ingest_titles([int(i) for i in args.titles.split(',')], get, connector,
                               dry_run=not args.apply,
                               bounds=Bounds(args.max_titles, args.max_seasons, args.max_episodes,
                                             args.max_requests, args.requests_per_second))
        print(json.dumps(result, indent=2))
    finally:
        if connector:
            connector.disconnect()


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""One-off population of source pages referenced by the global trope inventory.

Reuses the existing worker's lock, durable six-second pace, source cache, block
state, write journal and transient-failure supervisor. No scheduled crawl.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / 'windmill'), str(FLOWS / 'scripts')]
from f.tvtropes_catalog.catalog import canonical_url
from f.tvtropes_catalog.descriptions import extract_description
from import_trope_catalog import Crate, settings
from populate_trope_catalog import (DEFAULT_LOCK, DEFAULT_PACE, DEFAULT_STATE, atomic_json, append_json,
                                     read_journal, run, until_complete, utcnow)


def inventory_urls(paths):
    """Known bare Main references only. Never derive a slug from a label."""
    urls = set()
    for path in paths:
        rows = json.loads(Path(path).read_text())
        if isinstance(rows, dict):
            rows = rows.get('records', rows.get('entries'))
        if not isinstance(rows, list):
            raise ValueError('Inventory must contain a record array')
        for row in rows:
            try:
                value = row.get('url')
                # The global URL audit proved this exact historic concatenation
                # error. Repair only that literal prefix, then validate normally.
                prefix = 'https://tvtropes.org'
                if isinstance(value, str) and value.startswith(prefix + prefix + '/pmwiki/pmwiki.php/Main/'):
                    value = value[len(prefix):]
                url = canonical_url(value)
            except ValueError:
                continue
            if url:
                urls.add(url)
    return sorted(urls)


class PageCatalog:
    """URI identity and verified page/reference writes behind the worker's catalog seam."""
    def __init__(self, inventories):
        self.inventories = list(map(Path, inventories))

    def prepare(self, db, output, *, refresh=False):
        if refresh:
            raise ValueError('Use a new page run directory for a changed global inventory')
        output = Path(output)
        self.output = output
        output.mkdir(parents=True, exist_ok=True)
        # A crash after a write began requires read-only inspection, even when
        # the ready source record is replayable. Never infer a failed write.
        attempts = {}
        for event in read_journal(output / 'database-events.jsonl'):
            identity = event.get('document_sha256')
            if event.get('phase') == 'before_write':
                attempts[identity] = True
            elif event.get('phase') == 'complete':
                attempts[identity] = False
        if any(attempts.values()):
            raise ValueError('Unverified page write attempt: inspect receipts and stored documents before resuming')
        path, manifest_path = output / 'queue.json', output / 'queue-manifest.json'
        inventory = [{'path': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                     for p in self.inventories]
        if path.exists():
            manifest = json.loads(manifest_path.read_text())
            if (manifest.get('sha256') != hashlib.sha256(path.read_bytes()).hexdigest()
                    or manifest.get('inventories') != inventory):
                raise ValueError('Saved page queue or inventory changed; preserve it and use a new run directory')
            return json.loads(path.read_text())
        # `name` is the stable journal identity, not a claim about the page title.
        entries = [{'name': url, 'url': url} for url in inventory_urls(self.inventories)]
        atomic_json(path, entries)
        atomic_json(manifest_path, {'created_at': utcnow().isoformat(), 'entries': len(entries),
                                   'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                                   'inventories': inventory, 'scope': 'global known Main reference URLs'})
        return entries

    @staticmethod
    def present(db, urls):
        if not urls:
            return set()
        marks = ','.join('?' for _ in urls)
        rows = db.select(
            'SELECT r.reference_url FROM trope_catalog_reference r '
            'JOIN trope_catalog_page p ON r.canonical_url = p.url '
            f'WHERE p.description IS NOT NULL AND r.reference_url IN ({marks}) LIMIT {len(urls)}', tuple(urls))
        return {row['reference_url'] for row in rows}

    def contains(self, db, entry):
        return entry['url'] in self.present(db, [entry['url']])

    def reconcile(self, db, entries, latest, outcome):
        present = set()
        for start in range(0, len(entries), 400):
            present.update(self.present(db, [row['url'] for row in entries[start:start + 400]]))
        for entry in entries:
            previous = latest.get(entry['name'], {}).get('status')
            if entry['url'] in present:
                if previous not in ('stored', 'already_present'):
                    outcome(entry, 'already_present', reconciled=True)
            elif previous in ('stored', 'already_present'):
                outcome(entry, 'queued', error='referenced_page_missing_in_catalog')

    @staticmethod
    def restore(document):
        from f.tvtropes_catalog.pages import normalize_document
        return normalize_document(document)

    def record(self, entry, result, evidence, page):
        if not evidence.get('sha256') or evidence.get('started_at') is None:
            raise ValueError('Missing actual HTTP capture provenance')
        url = result['canonical_url']
        provenance = {'source_hash': evidence['sha256'], 'fetched_at': evidence['started_at']}
        return self.restore({
            'pages': [{'url': url, 'title': result['heading'], 'description': result['description'], **provenance}],
            'references': [{'reference_url': reference, 'canonical_url': url, **provenance}
                           for reference in sorted({entry['url'], url})],
        })

    def write(self, db, records):
        from f.tvtropes_catalog.pages import import_document
        for document in records:
            digest = hashlib.sha256(json.dumps(document, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            def receipt(event):
                append_json(self.output / 'database-events.jsonl',
                            {'document_sha256': digest, 'at': utcnow().isoformat(), **event})
            import_document(db, document, apply=True, on_event=receipt)


def linked_description(html, name, final_url, *, requested_url=None):
    return extract_description(html, name, final_url, requested_url=requested_url, linked=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inventory', action='append', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--saved', action='append', default=[], type=Path)
    parser.add_argument('--state', default=DEFAULT_STATE, type=Path)
    parser.add_argument('--until-complete', action='store_true')
    parser.add_argument('--max-requests', default=200, type=int)
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--retry-review', action='store_true')
    args = parser.parse_args()
    # Dependency failures must precede every source request, including an
    # otherwise uncached URI whose first parse would discover a missing parser.
    from bs4 import BeautifulSoup
    BeautifulSoup('', 'html5lib')
    options = dict(catalog=PageCatalog(args.inventory), extractor=linked_description,
                   saved=args.saved, state_path=args.state, lock_path=DEFAULT_LOCK,
                   pace_path=DEFAULT_PACE, retry_review=args.retry_review)
    if args.until_complete:
        result = until_complete(args.output, db_factory=lambda: Crate(settings()), **options)
    else:
        result = run(Crate(settings()), args.output, max_requests=args.max_requests,
                     all_requests=args.all, **options)
    if result.get('phase') != 'complete':
        raise SystemExit(2)


if __name__ == '__main__':
    main()

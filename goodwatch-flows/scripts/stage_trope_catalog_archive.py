#!/usr/bin/env python3
"""Verify a pinned local archive and stage missing catalog descriptions. Never writes to CrateDB or fetches pages."""
import argparse
import gzip
import hashlib
from html.parser import HTMLParser
from itertools import zip_longest
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import tempfile

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / 'windmill'), str(FLOWS / 'scripts')]
from bs4 import BeautifulSoup
from f.tvtropes_catalog.catalog import canonical_url, normalize_archive, normalize_record
from f.tvtropes_catalog.descriptions import extract_archive_description
from import_trope_catalog import Crate, settings
from populate_trope_catalog import missing_entries


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode('utf-8')


def atomic_write(path, data):
    path = Path(path)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.' + path.name, delete=False) as handle:
        temporary = Path(handle.name)
        try:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    os.replace(temporary, path)


def verified_manifest(directory, progress):
    manifest = json.loads((directory / 'manifest.json').read_text())
    if (manifest.get('whole_file_verified') is not True or manifest.get('records_usable') is not True
            or manifest.get('original_tvtropes_capture_time') is not None
            or manifest.get('provenance') != 'published_third_party_archive_not_original_http_capture'):
        raise ValueError('Archive manifest must declare usable verified records and unknown original capture time')
    file_name = manifest.get('file')
    if not isinstance(file_name, str) or any(p in ('', '.', '..') for p in file_name.split('/')):
        raise ValueError('Invalid archive file path')
    expected_url = f"https://huggingface.co/datasets/{manifest.get('repository')}/resolve/{manifest.get('revision')}/{file_name}"
    if manifest.get('immutable_public_url') != expected_url:
        raise ValueError('Archive URL does not pin the declared repository, revision and file')
    # Reuse the importer's strict public provider/revision/hash/timestamp validation.
    provenance = normalize_archive({
        'provider': 'huggingface', 'dataset': manifest.get('repository'), 'revision': manifest.get('revision'),
        'provider_url': expected_url, 'file_sha256': manifest.get('sha256'),
        'record_sha256': '0' * 64, 'article_sha256': '0' * 64,
        'payload_kind': 'article_html_fragment', 'retrieved_at': manifest.get('retrieved_at'),
    })
    path = directory / PurePosixPath(file_name).name
    size = manifest.get('size_bytes')
    if type(size) is not int or size <= 0 or path.stat().st_size != size:
        raise ValueError('Original archive file size mismatch')
    digest, read = hashlib.sha256(), 0
    with path.open('rb') as handle:
        while block := handle.read(8 * 1024 * 1024):
            digest.update(block)
            read += len(block)
            if read % (128 * 1024 * 1024) == 0:
                progress({'phase': 'verify_file', 'bytes': read, 'total_bytes': size})
    if digest.hexdigest() != manifest['sha256']:
        raise ValueError('Original archive file SHA256 mismatch')
    progress({'phase': 'verified_file', 'bytes': read})
    return manifest, provenance, path


class _MetadataComplete(Exception):
    pass


class _MetadataFallback(Exception):
    pass


class _CurrentURLParser(HTMLParser):
    """Read only a plain metadata paragraph; browser repair remains the fallback's responsibility."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.collecting = False
        self.suppressed = None
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if self.suppressed:
            return
        if tag in {'script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext'}:
            if self.collecting:
                raise _MetadataFallback()
            self.suppressed = tag
            return
        if self.collecting:
            raise _MetadataFallback()  # Nested markup can require HTML5 paragraph repair.
        identifiers = [value for key, value in attrs if key == 'id']
        if 'current_url' in identifiers:
            if tag != 'p' or identifiers != ['current_url']:
                raise _MetadataFallback()
            self.collecting = True

    def handle_startendtag(self, tag, attrs):
        if self.suppressed:
            return
        if self.collecting or any(key == 'id' and value == 'current_url' for key, value in attrs):
            raise _MetadataFallback()

    def handle_endtag(self, tag):
        if self.suppressed:
            if tag == self.suppressed:
                self.suppressed = None
            return
        if self.collecting:
            if tag != 'p':
                raise _MetadataFallback()
            raise _MetadataComplete()

    def handle_data(self, data):
        if self.collecting:
            self.parts.append(data)

    def handle_comment(self, data):
        if self.collecting:
            # Soup treats comments as separate nodes when stripping text runs.
            raise _MetadataFallback()


def _soup_candidate_urls(html):
    urls = set()
    for node in BeautifulSoup(html, 'html5lib').select('#current_url'):
        try:
            value = canonical_url(node.get_text(strip=True))
        except ValueError:
            continue
        if value:
            urls.add(value.casefold())
    return urls


def _observed_candidate_urls(html, *, chunk_size=4096):
    parser = _CurrentURLParser()
    try:
        for start in range(0, len(html), chunk_size):
            parser.feed(html[start:start + chunk_size])
        parser.close()
    except _MetadataComplete:
        try:
            value = canonical_url(''.join(parser.parts).strip())
        except ValueError:
            return _soup_candidate_urls(html)
        return {value.casefold()} if value else _soup_candidate_urls(html)
    except (_MetadataFallback, AssertionError):
        pass
    return _soup_candidate_urls(html)


def candidate_urls(record):
    """Selection only: the extractor subsequently proves every source identity."""
    urls = _observed_candidate_urls(record['article'])
    if record.get('ns') == 'Main' and isinstance(record.get('id'), str) and re.fullmatch(r'[A-Za-z0-9_]+', record['id']):
        urls.add(('https://tvtropes.org/pmwiki/pmwiki.php/Main/' + record['id']).casefold())
    return urls


def stage_archive(directory, catalog, output, *, progress=lambda item: None, extractor=extract_archive_description):
    directory, output = Path(directory), Path(output)
    # Missing parser dependencies fail before reading a multi-gigabyte source.
    BeautifulSoup('', 'html5lib')
    if any((output / name).exists() for name in ('records.json', 'report.json', 'review.json')):
        raise ValueError('Choose a fresh staging output directory')
    manifest, provenance, original_path = verified_manifest(directory, progress)
    by_url, catalog_count, invalid_catalog = {}, 0, 0
    names = set()
    for row in catalog:
        catalog_count += 1
        if row['name'] in names:
            raise ValueError('Duplicate exact catalog name')
        names.add(row['name'])
        try:
            url = canonical_url(row.get('url'))
        except ValueError:
            url = None
        if not url:
            invalid_catalog += 1
            continue
        by_url.setdefault(url.casefold(), []).append({'name': row['name'], 'url': url})
    accepted, review, conflicts = {}, [], {}
    count = unmatched = rejected = duplicates = 0
    prior_end = 0
    with original_path.open('rb') as original, gzip.open(directory / 'Main.raw-records.jsonl.gz', 'rb') as raw, gzip.open(directory / 'Main.ledger.jsonl.gz', 'rb') as ledger_file:
        for number, pair in enumerate(zip_longest(raw, ledger_file), 1):
            rawline, ledgerline = pair
            if rawline is None or ledgerline is None:
                raise ValueError('Archive record/ledger count mismatch')
            record, ledger = json.loads(rawline), json.loads(ledgerline)
            offset, length = ledger.get('source_byte_offset'), ledger.get('source_line_bytes')
            if (type(offset) is not int or type(length) is not int or offset < prior_end or length != len(rawline)
                    or offset < 0 or length <= 0 or offset + length > manifest['size_bytes']):
                raise ValueError(f'Invalid source byte locator at record {number}')
            prior_end = offset + length
            original.seek(offset)
            if original.read(length) != rawline:
                raise ValueError(f'Original source byte slice mismatch at record {number}')
            if offset:
                original.seek(offset - 1)
                if original.read(1) != b'\n':
                    raise ValueError('Source locator does not start at a JSONL boundary')
            if not rawline.endswith(b'\n') and offset + length != manifest['size_bytes']:
                raise ValueError('Source locator does not end at a JSONL boundary')
            if hashlib.sha256(rawline).hexdigest() != ledger.get('raw_record_sha256'):
                raise ValueError(f'Raw record SHA256 mismatch at record {number}')
            if (not isinstance(record, dict) or record.get('ns') != 'Main' or not isinstance(record.get('article'), str)
                    or record.get('ns') != ledger.get('ns') or record.get('id') != ledger.get('id')
                    or ledger.get('corpus_revision') != manifest['revision']
                    or ledger.get('corpus_file_sha256') != manifest['sha256']
                    or ledger.get('main_record_number') != number
                    or ledger.get('original_tvtropes_capture_time') is not None):
                raise ValueError(f'Record identity/provenance ledger mismatch at record {number}')
            if hashlib.sha256(record['article'].encode('utf-8')).hexdigest() != ledger.get('article_utf8_sha256'):
                raise ValueError(f'Article UTF8 SHA256 mismatch at record {number}')
            count += 1
            archive = {**provenance, 'record_sha256': ledger['raw_record_sha256'],
                       'article_sha256': ledger['article_utf8_sha256'], 'byte_offset': offset, 'byte_length': length}
            targets = {row['name']: row for url in candidate_urls(record) for row in by_url.get(url, [])}
            if not targets:
                unmatched += 1
            for name, target in sorted(targets.items()):
                result = extractor(record, name, target['url'])
                if result.get('error') or not result.get('description'):
                    rejected += 1
                    review.append({'name': name, 'record_id': record['id'], 'source_archive': archive,
                                   'error': result.get('error') or 'Empty description'})
                    continue
                try:
                    row = normalize_record({'name': name, 'url': result['canonical_url'], 'description': result['description'],
                                            'source_hash': None, 'fetched_at': None, 'source_archive': archive})
                except ValueError as error:
                    rejected += 1
                    review.append({'name': name, 'record_id': record['id'], 'source_archive': archive,
                                   'error': 'Import validation: ' + str(error)})
                    continue
                if name in conflicts:
                    conflicts[name].append(row)
                elif name in accepted:
                    if accepted[name]['description'] == row['description'] and accepted[name]['url'] == row['url']:
                        duplicates += 1  # First source byte position deterministically supplies equivalent evidence.
                    else:
                        conflicts[name] = [accepted.pop(name), row]
                else:
                    accepted[name] = row
            if number % 25 == 0:
                progress({'phase': 'parse', 'records': count, 'accepted': len(accepted), 'rejected': rejected})
    if type(manifest.get('main_records')) is not int or count != manifest['main_records']:
        raise ValueError('Verified Main record count disagrees with manifest')
    records = [accepted[name] for name in sorted(accepted)]
    for name, candidates in sorted(conflicts.items()):
        review.append({'name': name, 'error': 'Conflicting verified source descriptions or canonical URLs', 'candidates': candidates})
    data = encoded(records)
    report = {'phase': 'staged', 'input_records': count, 'catalog_missing': catalog_count,
              'catalog_invalid_or_missing_url': invalid_catalog, 'accepted': len(records), 'rejected': rejected,
              'unmatched_source_records': unmatched, 'conflict_names': len(conflicts),
              'conflict_candidates': sum(map(len, conflicts.values())), 'identical_duplicates': duplicates,
              'records_sha256': hashlib.sha256(data).hexdigest(), 'source_file_sha256': manifest['sha256'],
              'source_revision': manifest['revision'], 'original_tvtropes_capture_time': None}
    output.mkdir(parents=True, exist_ok=True)
    atomic_write(output / 'review.json', encoded(review))
    atomic_write(output / 'records.json', data)
    atomic_write(output / 'report.json', encoded(report))  # Completion seal, written last.
    progress(report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('chunk_directory', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    # Only indexed SELECTs against general metadata; no schema initialization or write API is used.
    catalog = list(missing_entries(Crate(settings())))
    report = stage_archive(args.chunk_directory, catalog, args.output,
                           progress=lambda item: print(json.dumps(item), flush=True))
    return report


if __name__ == '__main__':
    main()

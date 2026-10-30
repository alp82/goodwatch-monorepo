#!/usr/bin/env python3
"""Stage URL-wide description documents; apply only an intact reviewed staging directory."""
import argparse
from collections import Counter
from copy import deepcopy
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import hashlib
import importlib
import json
from pathlib import Path
import random
import re
import sys
import threading
import time
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, HTTPRedirectHandler, build_opener

FLOWS = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(FLOWS / 'windmill'), str(FLOWS / 'scripts')]
from import_trope_catalog import Crate, settings
from stage_trope_catalog_archive import atomic_write, encoded, verified_record
from f.tvtropes_catalog.catalog import FIELDS, canonical_url, import_records, normalize_archive, normalize_record
from f.tvtropes_catalog.description_docs import serialize_description_doc, utf16_length, validate_description_doc, wiki_link
from f.tvtropes_catalog.descriptions import extract_archive_description, _identity

BOILERPLATE = re.compile(r"^(warning:.*spoiler|examples of this trope (may )?contain|this trope (is|may be) (inherently )?(a )?spoiler|due to the nature of this trope)", re.I)
FILES = ('changes.jsonl', 'report.json', 'samples.md')
PROVENANCE = ('source', 'source_hash', 'fetched_at', 'source_archive')
HEADING_START = re.compile(r'^(Or|And|But|However|Well|So|Also|Here|These|This|Some|Examples)\b', re.I)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def words(text):
    """Prototype WORD regexp, using Unicode categories rather than ASCII approximations."""
    i = 0
    while i < len(text):
        if unicodedata.category(text[i])[0] not in 'LN':
            i += 1
            continue
        start = i
        i += 1
        while i < len(text) and (unicodedata.category(text[i])[0] in 'LN' or text[i] in "'’.-"):
            i += 1
        if i < len(text) and text[i] in '!?':
            i += 1
        yield start, i, text[start:i]


class NameLinks:
    def __init__(self, names):
        self.names = names
        self.lower = {n.lower(): u for n, u in names.items()}

    def links(self, text, self_url, used):
        tokens, out = list(words(text)), []
        i = 0
        while i < len(tokens):
            start, _, word = tokens[i]
            if unicodedata.category(word[0]) != 'Lu' and unicodedata.category(word[0])[0] != 'N':
                i += 1
                continue
            before = text[:start].rstrip()
            opens = not before or before[-1] in '.!?:"“('
            for j in range(min(len(tokens) - 1, i + 9), i - 1, -1):
                span = text[start:tokens[j][1]].rstrip('.,')
                if re.search(r'[.!?;:]\s', span) or (j == i and (opens or utf16_length(span) < 4)):
                    continue
                url = self.names.get(span) or (self.lower.get(span.lower()) if j > i else None)
                if not url and span.endswith('s'):
                    url = self.names.get(span[:-1])
                if not url and span.endswith("'s"):
                    span = span[:-2]  # Prototype shortens the linked possessive only in this branch.
                    url = self.names.get(span)
                if not url or url == self_url:
                    continue
                if j == i:
                    slug = _identity(url.rsplit('/', 1)[-1])
                    if slug not in {_identity(span), _identity(span[:-1]) if span.endswith('s') else ''}:
                        continue
                if url not in used:
                    used.add(url)
                    out.append([utf16_length(text[:start]), utf16_length(text[:start + len(span)]), url])
                i = j
                break
            i += 1
        return out


def plain_document(raw, matcher, self_url):
    paras = [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'\n\s*\n', raw)]
    paras = [p for p in paras if p and not BOILERPLATE.search(p)]
    blocks, used, i = [], set(), 0

    def block(text, **extra):
        result = {'text': text, **extra}
        links = matcher.links(text, self_url, used)
        if links:
            result['links'] = links
        return result

    while i < len(paras):
        p = paras[i]
        if p.endswith(':'):
            j = i + 1
            while (j < len(paras) and utf16_length(paras[j]) <= 320 and not paras[j].endswith(':')
                   and not re.match(r'^see also\b', paras[j], re.I)):
                j += 1
            if j - i - 1 >= 2:
                blocks.append(block(p, kind='p'))
                blocks.append({'kind': 'list', 'items': [block(t, depth=0) for t in paras[i + 1:j]]})
                i = j
                continue
            if (utf16_length(p) < 60 and len(list(words(p))) <= 6
                    and p[0].isupper() and not HEADING_START.match(p)):
                blocks.append(block(p[:-1], kind='heading'))
                i += 1
                continue
        blocks.append(block(p, kind='p'))
        i += 1
    return validate_description_doc({'v': 1, 'source': 'plain', 'blocks': blocks})


class FatalArchiveError(RuntimeError):
    pass


class ArchiveRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parts = urlsplit(newurl)
        host = parts.hostname or ''
        if (parts.scheme != 'https' or parts.username or parts.password
                or not (host == 'huggingface.co' or host.endswith('.huggingface.co')
                        or host == 'hf.co' or host.endswith('.hf.co'))):
            raise FatalArchiveError('Archive redirect outside Hugging Face infrastructure refused')
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def archive_open(request, **kwargs):
    return build_opener(ArchiveRedirects()).open(request, **kwargs)


def merge_ranges(archives, gap=256 * 1024, max_bytes=32 * 1024 * 1024):
    ranges = sorted(set((a['provider_url'], a['byte_offset'], a['byte_offset'] + a['byte_length']) for a in archives))
    merged = []
    for url, start, end in ranges:
        if (merged and merged[-1][0] == url and start - merged[-1][2] < gap
                and max(end, merged[-1][2]) - merged[-1][1] <= max_bytes):
            old = merged[-1]
            merged[-1] = (url, old[1], max(old[2], end))
        else:
            merged.append((url, start, end))
    return merged


class ArchiveCache:
    def __init__(self, directory, *, concurrency=2, gap=256 * 1024, pace=0.25, retries=5,
                 opener=archive_open, sleep=time.sleep):
        if concurrency < 1 or gap < 0 or pace < 0 or retries < 0:
            raise ValueError('Invalid archive fetch configuration')
        self.directory = Path(directory).expanduser()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.concurrency, self.gap, self.pace, self.retries = concurrency, gap, pace, retries
        self.opener, self.sleep = opener, sleep
        self.ranges, self.errors = [], {}
        self.lock, self.stop = threading.Lock(), threading.Event()
        try:
            self.progress = json.loads((self.directory / 'progress.json').read_text())
        except (OSError, ValueError):
            self.progress = {}

    def paths(self, item):
        key = sha(encoded(item))
        return self.directory / (key + '.bin'), self.directory / (key + '.json')

    def cached(self, item):
        data_path, meta_path = self.paths(item)
        try:
            meta = json.loads(meta_path.read_text())
            data = data_path.read_bytes()
            if meta == {'range': list(item), 'sha256': sha(data)} and len(data) == item[2] - item[1]:
                return data
        except (OSError, ValueError):
            pass
        return None

    def fetch(self, item):
        if self.stop.is_set():
            return
        data = self.cached(item)
        if data is None:
            url, start, end = item
            for attempt in range(self.retries + 1):
                if self.stop.is_set():
                    return
                delay = min(60, 2 ** attempt)
                try:
                    self.sleep(self.pace)
                    # Never follow redirects to a different service (including TV Tropes).
                    request = Request(url, headers={'Range': f'bytes={start}-{end - 1}', 'Accept-Encoding': 'identity'})
                    with self.opener(request, timeout=90) as response:
                        content_range = response.headers.get('Content-Range', '')
                        if (response.status != 206 or not re.fullmatch(rf'bytes {start}-{end - 1}/\d+', content_range)):
                            raise ValueError('Server did not honor the exact byte range')
                        data = response.read(end - start + 1)
                        if len(data) != end - start:
                            raise ValueError('Archive range length mismatch')
                    data_path, meta_path = self.paths(item)
                    atomic_write(data_path, data)
                    atomic_write(meta_path, encoded({'range': list(item), 'sha256': sha(data)}))
                    break
                except HTTPError as error:
                    error.close()
                    if error.code in (401, 403, 404):
                        self.stop.set()
                        raise FatalArchiveError(f'Archive HTTP {error.code}; stopped. Check archive access/revision and rerun using the cache.') from None
                    if error.code != 429 and not 500 <= error.code <= 599:
                        raise ValueError(f'Archive HTTP {error.code}') from None
                    retry_after = error.headers.get('Retry-After')
                    if retry_after:
                        try:
                            delay = max(0, float(retry_after))
                        except ValueError:
                            try:
                                delay = max(0, (parsedate_to_datetime(retry_after) - datetime.now(timezone.utc)).total_seconds())
                            except (TypeError, ValueError):
                                pass
                    if attempt == self.retries:
                        raise ValueError('Archive retry limit reached') from None
                except (URLError, TimeoutError, OSError):
                    if attempt == self.retries:
                        raise ValueError('Archive transport retry limit reached') from None
                else:
                    break
                self.sleep(delay)
        with self.lock:
            self.progress[sha(encoded(item))] = {'range': list(item), 'complete': True}
            atomic_write(self.directory / 'progress.json', encoded(self.progress))

    def prepare(self, archives):
        self.ranges = merge_ranges(archives, self.gap)
        def worker(item):
            try:
                self.fetch(item)
            except FatalArchiveError:
                self.stop.set()
                raise
            except ValueError as error:
                self.errors[item] = str(error)
        with ThreadPoolExecutor(max_workers=self.concurrency) as pool:
            list(pool.map(worker, self.ranges))

    def record(self, archive):
        for item in self.ranges:
            url, start, end = item
            if url == archive['provider_url'] and start <= archive['byte_offset'] and end >= archive['byte_offset'] + archive['byte_length']:
                if item in self.errors:
                    raise ValueError(self.errors[item])
                # Read only the requested slice, rather than repeatedly loading a merged range.
                with self.paths(item)[0].open('rb') as handle:
                    handle.seek(archive['byte_offset'] - start)
                    raw = handle.read(archive['byte_length'])
                return verified_record(raw, archive['record_sha256'], archive['article_sha256'])
        raise ValueError('Archive locator not prepared')


def read_catalog(db, page_size=1000):
    # SELECT * works both before and after the additive description_doc migration.
    rows, after = [], None
    while True:
        batch = db.select('SELECT * FROM trope_catalog' + (' WHERE name > ?' if after is not None else '')
                          + ' ORDER BY name LIMIT ?', (after, page_size) if after is not None else (page_size,))
        rows.extend(batch)
        if len(batch) < page_size:
            return rows
        after = batch[-1]['name']


def build_changes(rows, cache, extractor=extract_archive_description):
    names, groups, archives, invalid, skipped = {}, {}, [], {}, []
    for row in sorted(rows, key=lambda r: r['name']):
        try:
            url = canonical_url(row.get('url'))
        except ValueError:
            url = None
        if url and wiki_link(url):
            names[row['name']] = url
        if not row.get('description'):
            continue
        if not url:
            skipped.append({'name': row['name'], 'reason': 'Invalid or missing URL'})
            continue
        groups.setdefault(url, []).append(row)
        if row.get('source_archive'):
            try:
                archive = normalize_archive(row['source_archive'])
                if 'byte_offset' not in archive or archive['payload_kind'] != 'article_html_fragment':
                    raise ValueError('Missing locator or unsupported archive payload kind')
                archives.append(archive)
            except ValueError as error:
                invalid[row['name']] = str(error)
    cache.prepare(archives)
    matcher, changes = NameLinks(names), []
    for url, group in sorted(groups.items()):
        notes, candidates, evidence = [], [], None
        differing = len({r['description'] for r in group}) > 1
        if differing:
            notes.append('url_group_differing_texts')
        for row in group:
            if row['name'] in invalid:
                notes.append(row['name'] + ': ' + invalid[row['name']])
                continue
            if not row.get('source_archive'):
                continue
            try:
                archive = normalize_archive(row['source_archive'])
                record = cache.record(archive)
                result = extractor(record, row['name'], url)
                if result.get('error') or not result.get('description'):
                    result = extractor(record, row['name'], url, linked=True)
                    if not result.get('error') and result.get('description'):
                        notes.append('archive_linked_mode')
                if result.get('error') or not result.get('description') or result.get('canonical_url') != url:
                    raise ValueError('Archive extraction rejected: ' + (result.get('error') or 'empty description or URL mismatch'))
                validate_description_doc(result['description_doc'])
                candidates.append((row, result['description'], result['description_doc'], archive))
            except (ValueError, KeyError) as error:
                notes.append(row['name'] + ': ' + str(error))
        stored = min(group, key=lambda r: (-len(r['description']), r['name']))
        best = min(candidates, key=lambda c: (-len(c[1]), c[0]['name'])) if candidates else None
        if best and len(best[1]) >= len(stored['description']):
            selected, text, doc, evidence = best
        else:
            selected, text = stored, stored['description']
            try:
                doc = plain_document(text, matcher, url)
            except ValueError as error:
                skipped.extend({'name': r['name'], 'reason': str(error), 'notes': notes} for r in group)
                continue
        doc = deepcopy(doc)
        for block in text_blocks(doc):
            if 'links' in block:
                block['links'] = [link for link in block['links'] if link[2] != url]
                if not block['links']:
                    del block['links']
        serialized = serialize_description_doc(doc, text)
        for row in group:
            row_notes = list(notes)
            if sha(row['description'].encode()) != row.get('description_hash'):
                row_notes.append('stored_description_hash_mismatch')
            if row['description'] != text:
                row_notes.append('description_text_changed')
            if row.get('description_doc') == serialized and row['description'] == text and row.get('description_hash') == sha(text.encode()):
                continue
            assert_no_shortening(row['description'], text, row['name'])
            provenance = {}
            if row['description'] != text and row['name'] != selected['name']:
                provenance = {k: selected.get(k) for k in PROVENANCE}
                if evidence is not None:
                    provenance.update(source_archive=evidence, source_hash=None, fetched_at=None)
            try:
                normalized = normalize_record({**row, **provenance, 'description': text, 'description_doc': doc})
                if normalized['url'] != row['url']:
                    raise ValueError('Noncanonical stored URL; refusing to change it')
            except ValueError as error:
                skipped.append({'name': row['name'], 'reason': str(error)})
                continue
            changes.append({'name': row['name'], 'url': row['url'], 'old_description_hash': row.get('description_hash'),
                            'new_description': text, 'new_description_hash': normalized['description_hash'],
                            'new_document': doc, 'source': doc['source'], 'notes': row_notes,
                            'selected_archive': evidence, 'selected_name': selected['name'],
                            'new_provenance': {k: normalized[k] for k in provenance}})
    return changes, skipped


def assert_no_shortening(stored, selected, name):
    """Fail the plan on lost prose; only removal of whole boilerplate paragraphs is allowed."""
    if len(selected) >= len(stored):
        return
    def paragraphs(text):
        return [re.sub(r'\s+', ' ', p).strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    old = paragraphs(stored)
    kept = [p for p in old if not BOILERPLATE.search(p)]
    if kept == old or paragraphs(selected) != kept:
        raise ValueError(f'{name}: plan would shorten stored description')


def text_blocks(doc):
    for block in doc['blocks']:
        yield from block['items'] if block['kind'] == 'list' else [block]


def sample_markdown(changes, seed=82, count=30):
    rng = random.Random(seed)
    shuffled = rng.sample(changes, len(changes))
    selected, covered = [], set()
    def tags(row):
        result = {row['source']}
        result.update(n for n in row['notes'] if n in ('url_group_differing_texts', 'description_text_changed', 'archive_linked_mode'))
        notes = ' '.join(row['notes']).lower()
        if 'sha256 mismatch' in notes or 'stored_description_hash_mismatch' in notes:
            result.add('hash_mismatch')
        if 'extraction rejected' in notes:
            result.add('extraction_failure')
        if any(s in notes for s in ('http', 'retry limit', 'byte range')):
            result.add('fetch_failure')
        result.update(b['kind'] for b in row['new_document']['blocks'])
        return result
    for row in shuffled:
        new = tags(row) - covered
        if new:
            selected.append(row)
            covered.update(new)
    selected.extend(r for r in shuffled if r not in selected and len(selected) < count)
    lines = ['# Description document review', f'Seed: {seed}. Review all changes and report before apply.', '']
    for row in selected:
        blocks = list(text_blocks(row['new_document']))
        lines.extend([f"## {row['name']} ({row['source']})", row['url'], '', 'Notes: ' + '; '.join(row['notes']), '',
                      'Opening: ' + blocks[0]['text'][:1000], '', 'Links:'])
        for block in blocks:
            raw = block['text'].encode('utf-16-le')
            for start, end, url in block.get('links', []):
                lines.append(f"- [{raw[start * 2:end * 2].decode('utf-16-le')}]({url})")
        lines.append('')
    return '\n'.join(lines) + '\n'


def plan(db, cache, directory, *, seed=82):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    if any(directory.iterdir()):
        raise ValueError('Choose an empty staging directory; cache resumes independently')
    rows = read_catalog(db)
    changes, skipped = build_changes(rows, cache)
    originals = {r['name']: r for r in rows}
    for change in changes:
        assert_no_shortening(originals[change['name']]['description'], change['new_description'], change['name'])
    data = b''.join(json.dumps(r, ensure_ascii=False, sort_keys=True).encode() + b'\n' for r in changes)
    links = [sum(len(b.get('links', [])) for b in text_blocks(r['new_document'])) for r in changes]
    report = {'version': 1, 'input_rows': len(rows), 'described_rows': sum(bool(r.get('description')) for r in rows),
              'changes': len(changes), 'sources': dict(Counter(r['source'] for r in changes)),
              'description_text_changes': sum('description_text_changed' in r['notes'] for r in changes),
              'hash_mismatch_rows': sum(any('sha256 mismatch' in n.lower() or 'stored_description_hash_mismatch' in n for n in r['notes']) for r in changes),
              'skipped': skipped, 'links_per_row': links, 'total_links': sum(links), 'jsonl_bytes': len(data),
              'document_bytes': sum(len(serialize_description_doc(r['new_document'], r['new_description']).encode()) for r in changes),
              'seed': seed}
    atomic_write(directory / FILES[0], data)
    atomic_write(directory / FILES[1], encoded(report))
    atomic_write(directory / FILES[2], sample_markdown(changes, seed).encode())
    manifest = {'version': 1, 'complete': True, 'files': {f: sha((directory / f).read_bytes()) for f in FILES}}
    atomic_write(directory / 'manifest.json', encoded(manifest))  # Completion seal, always last.
    return report


def load_staging(directory):
    directory = Path(directory)
    try:
        manifest = json.loads((directory / 'manifest.json').read_text())
        if manifest.get('version') != 1 or manifest.get('complete') is not True or set(manifest['files']) != set(FILES):
            raise ValueError('Invalid staging manifest')
        payloads = {file: (directory / file).read_bytes() for file in FILES}
        for file in FILES:
            if sha(payloads[file]) != manifest['files'][file]:
                raise ValueError('Staging manifest hash mismatch: ' + file)
        rows = [json.loads(line) for line in payloads[FILES[0]].splitlines()]
        report = json.loads(payloads[FILES[1]])
        if report['changes'] != len(rows) or len({r['name'] for r in rows}) != len(rows):
            raise ValueError('Staging row count or unique names mismatch')
        for row in rows:
            validate_description_doc(row['new_document'])
            if not isinstance(row['new_provenance'], dict) or set(row['new_provenance']) not in (set(), set(PROVENANCE)):
                raise ValueError('Invalid staged provenance; regenerate the plan')
            if sha(row['new_description'].encode()) != row['new_description_hash'] or row['source'] != row['new_document']['source']:
                raise ValueError('Invalid staged description hash/source')
        return rows, sha(encoded(manifest))
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as error:
        raise ValueError('Incomplete or invalid staging directory') from error


def initialize_column(db):
    initializer = importlib.import_module('f.sync.init.cratedb')
    columns = db.select('SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=? AND table_name=?', ('doc', 'trope_catalog'))
    actual = {r['column_name']: r['data_type'] for r in columns}
    if not actual:
        raise ValueError('Catalog table missing; refusing to initialize unrelated tables')
    writes = []
    def change(sql):
        db.run(sql)
        writes.append(sql)
    spec = initializer.SCHEMAS['trope_catalog']
    initializer.add_missing_columns('trope_catalog', {'columns': {'description_doc': spec['columns']['description_doc']}, 'timestamps': False}, actual, change)
    return writes


def apply(db, directory, *, batch_size=200):
    if not 1 <= batch_size <= 1000:
        raise ValueError('batch_size must be between 1 and 1000')
    rows, manifest_hash = load_staging(directory)  # Before any DB access or migration.
    report = {'manifest_sha256': manifest_hash, 'input': len(rows), 'written': 0, 'unchanged': 0, 'stale': 0,
              'stale_names': [], 'schema_changes': initialize_column(db), 'batches': 0}
    for start in range(0, len(rows), batch_size):
        batch = rows[start:start + batch_size]
        marks = ','.join('?' for _ in batch)
        current = {r['name']: r for r in db.select(f"SELECT {','.join(FIELDS)} FROM trope_catalog WHERE name IN ({marks})", tuple(r['name'] for r in batch))}
        incoming, expected = [], {}
        for row in batch:
            old = current.get(row['name'])
            doc = serialize_description_doc(row['new_document'], row['new_description'])
            if old and all(old.get(k) == v for k, v in [('url', row['url']), ('description', row['new_description']), ('description_hash', row['new_description_hash']), ('description_doc', doc), *row['new_provenance'].items()]):
                report['unchanged'] += 1
            elif not old or old.get('description_hash') != row['old_description_hash'] or old.get('url') != row['url']:
                report['stale'] += 1
                report['stale_names'].append(row['name'])
            else:
                incoming.append(normalize_record({**old, **row['new_provenance'], 'description': row['new_description'], 'description_doc': doc}))
                expected[row['name']] = row['old_description_hash']
        if incoming:
            result = import_records(db, incoming, apply=True, replace_descriptions=True, batch_size=batch_size, expected_hashes=expected)
            report['written'] += result['written']
            report['stale'] += result['stale']
            report['stale_names'].extend(result['stale_names'])
        report['batches'] += 1
        atomic_write(Path(directory) / 'apply-progress.json', encoded(report))
    atomic_write(Path(directory) / 'apply-report.json', encoded(report))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    planning = commands.add_parser('plan')
    planning.add_argument('--staging', type=Path, required=True)
    planning.add_argument('--cache', type=Path, default=Path('~/.cache/trope-doc/archive-cache'))
    planning.add_argument('--concurrency', type=int, default=2)
    planning.add_argument('--range-gap', type=int, default=256 * 1024)
    planning.add_argument('--pace', type=float, default=0.25)
    planning.add_argument('--seed', type=int, default=82)
    applying = commands.add_parser('apply', help='Run only after the owner approves staged samples')
    applying.add_argument('--staging', type=Path, required=True)
    applying.add_argument('--batch-size', type=int, default=200)
    args = parser.parse_args()
    if args.command == 'apply':
        load_staging(args.staging)  # Refuse before credentials too.
    db = Crate(settings())
    if args.command == 'plan':
        report = plan(db, ArchiveCache(args.cache, concurrency=args.concurrency, gap=args.range_gap, pace=args.pace), args.staging, seed=args.seed)
    else:
        report = apply(db, args.staging, batch_size=args.batch_size)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

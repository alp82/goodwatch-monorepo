"""Crate persistence, restricted to writes in the social-owned tables."""
import json
import re
from urllib.parse import urlsplit
from f.social.common import VERSION, digest, norm, now
from f.social.schema import SOCIAL_SCHEMAS
from f.social import quality


def duplicate_group(post):
    if post['source'] != 'youtube' or not re.search(r'\bofficial\s+(?:trailer|teaser)\b|\b(?:trailer|teaser)\s*(?:\d+)?\s*(?:[|–-]|$)', post['text'], re.I):
        return post['post_id']
    # Separate trailer/teaser, numbered cuts and language labels; drop distributor suffixes.
    text = post['text'].split('|')[0]
    kind = 'teaser' if re.search(r'\bteaser\b', post['text'], re.I) else 'trailer'
    number = re.search(r'\b(?:trailer|teaser)\s*(\d+)\b', post['text'], re.I)
    language = re.search(r'\b(english|german|deutsch|hindi|tamil|telugu|portugu[eê]s|brasil|dublado|legendado|espa[nñ]ol)\b', post['text'], re.I)
    title = re.split(r'(?i)\s*[-–:]?\s*(?:official\s+)?(?:trailer|teaser)\b', text)[0]
    return digest('youtube:' + norm(title) + ':' + kind + ':' + (number[1] if number else '1') + ':' + (norm(language[0]) if language else 'unspecified'))


class Crate:
    def __init__(self, settings):
        self.settings = settings

    def execute(self, sql, args=None):
        import requests
        if ';' in sql:
            raise ValueError('One SQL statement only')
        if not sql.lstrip().upper().startswith('SELECT '):
            match = re.match(r'^(?:INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE IF NOT EXISTS|REFRESH TABLE)\s+(?:doc\.)?([a-z_]+)(?=\s|\(|$)', sql, re.I)
            if not match or match[1] not in SOCIAL_SCHEMAS:
                raise ValueError('Writes restricted to social-owned tables')
        hosts = self.settings['CRATE_HOSTS'].split(',')
        last_error = None
        for host in hosts:
            host = host.strip()
            if not host.startswith(('http://', 'https://')):
                host = 'http://' + host
            if urlsplit(host).port is None:
                host += ':' + str(self.settings.get('CRATE_PORT', 4200))
            try:
                response = requests.post(host.rstrip('/') + '/_sql',
                    auth=(self.settings['CRATE_USER'], self.settings['CRATE_PASS']),
                    json={'stmt': sql, 'args': args or []}, timeout=(3, 180))
                body = response.json()
                if response.status_code >= 400 or body.get('error'):
                    # No credential-bearing connection URLs in error output.
                    raise RuntimeError('Crate: ' + str(body.get('error', {}).get('message', response.status_code)))
                return [dict(zip(body['cols'], row)) for row in body.get('rows', [])]
            except requests.ConnectionError as exc:
                last_error = type(exc).__name__
        raise RuntimeError('Crate hosts unreachable: ' + str(last_error))

    def select(self, sql, args=None):
        if not sql.lstrip().upper().startswith('SELECT '):
            raise ValueError('Catalog access is SELECT-only')
        return self.execute(sql, args)


class Store:
    def __init__(self, crate):
        self.db = crate

    def initialize(self):
        for table, spec in SOCIAL_SCHEMAS.items():
            cols = [f'{name} {kind}' for name, kind in spec['columns'].items()]
            cols.append('PRIMARY KEY (' + ','.join(spec['primary_key']) + ')')
            self.db.execute(f"CREATE TABLE IF NOT EXISTS doc.{table} ({','.join(cols)}) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='0-1')")

    def refresh(self, *tables):
        for table in tables or tuple(SOCIAL_SCHEMAS):
            if table not in SOCIAL_SCHEMAS:
                raise ValueError('Unknown social table')
            self.db.execute('REFRESH TABLE doc.' + table)

    def save_posts(self, posts):
        if not posts:
            return
        prior = {r['post_id']: r for r in self.db.select(
            'SELECT * FROM doc.social_content_quality WHERE post_id=ANY(?)', [[p['post_id'] for p in posts]])}
        changed = [p['post_id'] for p in posts if p['post_id'] in prior and (
            prior[p['post_id']]['content_hash'] != p['content_hash'] or
            prior[p['post_id']]['version'] != quality.VERSION or
            json.loads(prior[p['post_id']]['evidence'] or '{}') != (p.get('quality_evidence') or {}))]
        if changed:
            # Invalidate before saving changed link/profile evidence, even when the
            # visible text and content hash are unchanged. Readers fail closed.
            self.db.execute("UPDATE doc.social_content_quality SET status='reject',reasons='[\"revalidation_pending\"]' WHERE post_id=ANY(?)", [changed])
            self.refresh('social_content_quality')
        at = now().isoformat()
        for p in posts:
            cols = ['post_id', 'source', 'source_id', 'url', 'author_id', 'author', 'published_at',
                    'text', 'context', 'provenance', 'content_hash']
            mutable = ['url', 'author_id', 'author', 'text', 'context', 'provenance', 'content_hash']
            updates = ','.join(f'{c}=CASE WHEN deleted_at IS NULL THEN excluded.{c} ELSE {c} END' for c in mutable)
            self.db.execute(f"INSERT INTO doc.social_post ({','.join(cols)},discovered_at,last_seen_at,checked_at) VALUES ({','.join('?' for _ in cols)},?,?,?) ON CONFLICT (post_id) DO UPDATE SET {updates},last_seen_at=excluded.last_seen_at",
                            [p[c] for c in cols] + [at, at, at])
        self.refresh('social_post')
        self.screen(posts, previous=prior)

    def screen(self, posts, *, previous=None):
        """Persist current decisions and unpublish rejects, including author patterns."""
        if not posts:
            return {}
        if previous is None:
            previous = {r['post_id']: r for r in self.db.select(
                'SELECT post_id,status FROM doc.social_content_quality WHERE post_id=ANY(?)', [[p['post_id'] for p in posts]])}
        active = {r['post_id'] for r in self.db.select(
            'SELECT post_id FROM doc.social_post WHERE post_id=ANY(?) AND deleted_at IS NULL',
            [[p['post_id'] for p in posts]])}
        posts = [p for p in posts if p['post_id'] in active]
        authors = sorted({p['author_id'] for p in posts if p['source'] in ('bluesky', 'mastodon') and p.get('author_id')})
        corpus = self.db.select('''SELECT p.*,q.evidence FROM doc.social_post p
            LEFT JOIN doc.social_content_quality q ON q.post_id=p.post_id AND q.content_hash=p.content_hash
            WHERE p.deleted_at IS NULL AND p.source IN ('bluesky','mastodon') AND p.author_id=ANY(?)
            ORDER BY p.published_at DESC LIMIT 10001''', [authors]) if authors else []
        bad_profiles = {(p['source'], p.get('author_id')): (p.get('quality_evidence') or {}).get('profile')
            for p in posts if set(quality.evaluate(p)['reasons']) & {'new_account', 'high_post_rate', 'no_profile', 'declared_bot'}}
        for p in corpus:
            p['quality_evidence'] = json.loads(p.pop('evidence') or '{}')
            profile = bad_profiles.get((p['source'], p.get('author_id')))
            if profile:
                p['quality_evidence']['profile'] = profile
        if len(corpus) > 10000:
            for p in posts:
                if p['source'] in ('bluesky', 'mastodon'):
                    p.setdefault('quality_evidence', {})['incomplete_author_corpus'] = True
        merged = {p['post_id']: p for p in corpus}
        merged.update({p['post_id']: p for p in posts})
        decisions = quality.evaluate_batch(list(merged.values()))
        # Repetition discovered in this batch also revokes older links by the author.
        target_ids = {p['post_id'] for p in posts}
        for p in merged.values():
            verdict = decisions[p['post_id']]
            if p['post_id'] not in target_ids and not (set(verdict['reasons']) & {'repetitive_author', 'new_account', 'high_post_rate', 'no_profile', 'declared_bot'}):
                continue
            evidence = dict(p.get('quality_evidence') or {})
            if 'repetitive_author' in verdict['reasons']:
                evidence['repetitive_author'] = True
            self.db.execute('''INSERT INTO doc.social_content_quality
                (post_id,content_hash,version,status,reasons,evidence,checked_at) VALUES (?,?,?,?,?,?,?)
                ON CONFLICT (post_id) DO UPDATE SET content_hash=excluded.content_hash,version=excluded.version,
                status=excluded.status,reasons=excluded.reasons,evidence=excluded.evidence,checked_at=excluded.checked_at''',
                [p['post_id'], p['content_hash'], quality.VERSION, verdict['status'], json.dumps(verdict['reasons']),
                 json.dumps(evidence, ensure_ascii=False), now().isoformat()])
            if verdict['status'] == 'pass' and previous.get(p['post_id'], {}).get('status') == 'reject':
                self.db.execute('UPDATE doc.social_post SET processed_hash=NULL WHERE post_id=? AND content_hash=?', [p['post_id'], p['content_hash']])
            if verdict['status'] != 'pass':
                self.db.execute('DELETE FROM doc.social_title_link WHERE post_id=?', [p['post_id']])
        self.refresh('social_content_quality', 'social_title_link')
        return decisions

    def pending(self, source, limit=400, disabled_lanes=()):
        return self.db.select("""SELECT p.* FROM doc.social_post p JOIN doc.social_content_quality q
            ON q.post_id=p.post_id AND q.content_hash=p.content_hash AND q.version=? AND q.status='pass'
            WHERE p.source=? AND p.deleted_at IS NULL AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
            AND (p.processed_hash IS NULL OR p.processed_hash <> p.content_hash OR p.matcher_version <> ?)
            ORDER BY p.published_at DESC,p.post_id LIMIT ?""", [quality.VERSION, source, VERSION, limit])

    def publish(self, post, links):
        rows = self.db.select('''SELECT q.* FROM doc.social_content_quality q JOIN doc.social_post p
            ON p.post_id=q.post_id AND p.content_hash=q.content_hash AND p.deleted_at IS NULL
            WHERE q.post_id=? AND q.content_hash=? AND q.version=? AND q.status='pass' ''',
            [post['post_id'], post['content_hash'], quality.VERSION])
        allowed = bool(rows) and quality.evaluate(dict(post, quality_evidence=json.loads(rows[0]['evidence'] or '{}')))['status'] == 'pass'
        if not allowed:
            links = []
        at = now().isoformat()
        for link in links:
            kind, identifier = link['key'].split(':')
            cols = ['media_type', 'media_tmdb_id', 'post_id', 'lane', 'confidence', 'confidence_basis', 'reason',
                    'matcher_version', 'content_hash', 'duplicate_group', 'created_at']
            values = [kind, int(identifier), post['post_id'], link['lane'], link['confidence'], link['confidence_basis'],
                      link['reason'], VERSION, post['content_hash'], duplicate_group(post), at]
            # Hidden fields and original created_at are never overwritten by ingestion.
            update = ','.join(f'{c}=excluded.{c}' for c in cols[3:-1])
            self.db.execute(f"INSERT INTO doc.social_title_link ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)}) ON CONFLICT (media_type,media_tmdb_id,post_id) DO UPDATE SET {update}", values)
        keys = [l['key'] for l in links]
        self.db.execute("DELETE FROM doc.social_title_link WHERE post_id=? AND NOT ((media_type || ':' || CAST(media_tmdb_id AS TEXT))=ANY(?))", [post['post_id'], keys])
        self.db.execute('UPDATE doc.social_post SET processed_hash=?,matcher_version=? WHERE post_id=? AND deleted_at IS NULL AND content_hash=?',
                        [post['content_hash'], VERSION, post['post_id'], post['content_hash']])

    def read_title(self, media_type, tmdb_id, *, limit=50, disabled_lanes=(), before=None):
        if media_type not in ('movie', 'tv') or type(tmdb_id) is not int or tmdb_id <= 0:
            raise ValueError('Invalid title identity')
        # Window before cursor filtering ensures older duplicate uploads cannot reappear on later pages.
        cursor = ''
        args = [quality.VERSION, media_type, tmdb_id, list(disabled_lanes)]
        if before:
            cursor = ' AND (published_at < ? OR (published_at = ? AND post_id < ?))'
            args += [before[0], before[0], before[1]]
        args.append(min(max(limit, 1), 100))
        return self.db.select('''SELECT * FROM (
          SELECT p.post_id,p.source,p.source_id,p.url,p.author,p.published_at,p.text,l.lane,l.confidence,
            l.confidence_basis,l.duplicate_group,
            ROW_NUMBER() OVER (PARTITION BY l.duplicate_group ORDER BY p.published_at DESC,p.post_id DESC) AS duplicate_rank
          FROM doc.social_title_link l JOIN doc.social_post p ON p.post_id=l.post_id
          JOIN doc.social_content_quality q ON q.post_id=p.post_id AND q.content_hash=p.content_hash
            AND q.version=? AND q.status='pass'
          LEFT JOIN doc.social_link_report r ON r.media_type=l.media_type AND r.media_tmdb_id=l.media_tmdb_id
            AND r.post_id=l.post_id AND r.status IN ('open','confirmed')
          WHERE l.media_type=? AND l.media_tmdb_id=? AND l.hidden_at IS NULL AND p.deleted_at IS NULL
            AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
            AND l.content_hash=p.content_hash AND NOT (l.lane=ANY(?)) AND r.report_id IS NULL
        ) visible WHERE duplicate_rank=1''' + cursor + ' ORDER BY published_at DESC,post_id DESC LIMIT ?', args)

    def report(self, media_type, tmdb_id, post_id, reason=''):
        if media_type not in ('movie', 'tv') or type(tmdb_id) is not int or tmdb_id <= 0 or not re.fullmatch('[a-f0-9]{64}', post_id):
            raise ValueError('Invalid report identity')
        rows = self.db.select('SELECT post_id FROM doc.social_title_link WHERE media_type=? AND media_tmdb_id=? AND post_id=?', [media_type, tmdb_id, post_id])
        if not rows:
            raise ValueError('Unknown title link')
        report_id = digest(f'{media_type}:{tmdb_id}:{post_id}')
        self.db.execute("INSERT INTO doc.social_link_report (report_id,media_type,media_tmdb_id,post_id,reason,status,created_at) VALUES (?,?,?,?,?,'open',?) ON CONFLICT (report_id) DO UPDATE SET status='open',reason=excluded.reason", [report_id, media_type, tmdb_id, post_id, str(reason)[:500], now().isoformat()])
        self.refresh('social_link_report')
        return {'report_id': report_id, 'hidden': True}

    def remove(self, post_id, reason):
        self.db.execute('UPDATE doc.social_post SET deleted_at=?,deletion_reason=?,text=NULL,context=NULL,author=NULL,author_id=NULL,source_id=NULL,url=NULL,provenance=NULL,checked_at=? WHERE post_id=?',
                        [now().isoformat(), reason, now().isoformat(), post_id])
        self.db.execute('DELETE FROM doc.social_title_link WHERE post_id=?', [post_id])
        self.db.execute('DELETE FROM doc.social_content_quality WHERE post_id=?', [post_id])
        self.refresh('social_post', 'social_title_link', 'social_content_quality')

    def remove_author(self, source, author_id):
        if source != 'bluesky' or not author_id:
            raise ValueError('Expected a Bluesky author identity')
        rows = self.db.select('SELECT post_id FROM doc.social_post WHERE source=? AND author_id=? AND deleted_at IS NULL', [source, author_id])
        for row in rows:
            self.remove(row['post_id'], 'author_opt_out')
        return [row['post_id'] for row in rows]

    def run_record(self, run_id, **record):
        row = {'run_id': run_id, **record, 'matcher_version': VERSION}
        cols = list(row)
        self.db.execute(f"INSERT INTO doc.social_ingest_run ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)}) ON CONFLICT (run_id) DO UPDATE SET " + ','.join(f'{c}=excluded.{c}' for c in cols if c != 'run_id'), list(row.values()))

    def retain(self):
        # Remove dependent rows first. Tombstones live thirty days from their deletion.
        self.db.execute("DELETE FROM doc.social_title_link WHERE post_id IN (SELECT post_id FROM doc.social_post WHERE published_at < CURRENT_TIMESTAMP - INTERVAL '30 days')")
        self.db.execute("DELETE FROM doc.social_content_quality WHERE post_id IN (SELECT post_id FROM doc.social_post WHERE deleted_at IS NOT NULL OR published_at < CURRENT_TIMESTAMP - INTERVAL '30 days')")
        self.db.execute("DELETE FROM doc.social_post WHERE (deleted_at IS NULL AND published_at < CURRENT_TIMESTAMP - INTERVAL '30 days') OR deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days'")
        self.db.execute("DELETE FROM doc.social_link_report WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '180 days'")
        self.db.execute("DELETE FROM doc.social_ingest_run WHERE started_at < CURRENT_TIMESTAMP - INTERVAL '90 days'")
        self.refresh()


def main():
    return {'library': True}

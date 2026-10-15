# extra_requirements:
# wmill==1.817.0
# requests==2.34.2
"""Preview by default. Apply can write only doc.social_relevance, never links/cache."""
import json
from collections import Counter
from f.social import bluesky, quality, youtube_playability
from f.social.common import SOURCES, now, stamp
from f.social.relevance import VERSION, judge_links
from f.social.schema import SOCIAL_SCHEMAS
from f.social.settings import load
from f.social.store import Crate

MAX_LINKS = 100000


class RelevanceCrate(Crate):
    """Fail closed independently of the broader existing ingestion write client."""
    def __init__(self, settings, *, apply=False):
        super().__init__(settings)
        self.apply = apply

    def execute(self, sql, args=None):
        if not sql.lstrip().upper().startswith('SELECT '):
            allowed = ('CREATE TABLE IF NOT EXISTS doc.social_relevance (',
                       'INSERT INTO doc.social_relevance (', 'REFRESH TABLE doc.social_relevance')
            if not self.apply or not any(sql.startswith(p) for p in allowed):
                raise ValueError('Rejudge writes only doc.social_relevance in apply mode')
        return super().execute(sql, args)


def read_links(db):
    rows = db.select('''SELECT l.media_type,l.media_tmdb_id,l.reason,l.lane,l.duplicate_group,p.*,q.evidence
        FROM doc.social_title_link l JOIN doc.social_post p ON p.post_id=l.post_id
        JOIN doc.social_content_quality q ON q.post_id=p.post_id AND q.content_hash=p.content_hash
          AND q.version=? AND q.status='pass'
        LEFT JOIN doc.social_link_report r ON r.media_type=l.media_type AND r.media_tmdb_id=l.media_tmdb_id
          AND r.post_id=l.post_id AND r.status IN ('open','confirmed')
        WHERE l.hidden_at IS NULL AND p.deleted_at IS NULL AND l.content_hash=p.content_hash
          AND r.report_id IS NULL AND p.published_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ORDER BY l.media_type,l.media_tmdb_id,p.post_id LIMIT ?''', [quality.VERSION, MAX_LINKS + 1])
    if len(rows) > MAX_LINKS:
        raise ValueError('Relevance corpus cap exceeded; refusing a partial duplicate judgement')
    for row in rows:
        row['quality_evidence'] = json.loads(row.pop('evidence') or '{}')
    return rows


def read_catalog(db, links):
    catalog = {}
    for kind, table in (('movie', 'movie'), ('tv', 'show')):
        all_ids = sorted({p['media_tmdb_id'] for p in links if p['media_type'] == kind})
        for offset in range(0, len(all_ids), 400):
            ids = all_ids[offset:offset + 400]
            for row in db.select(f'SELECT tmdb_id,title,original_title,release_year FROM {table} WHERE tmdb_id=ANY(?)', [ids]):
                catalog[f"{kind}:{row['tmdb_id']}"] = row | {'aliases': []}
            aliases = db.select('SELECT media_type,media_tmdb_id,title FROM alternative_title WHERE media_type=? AND media_tmdb_id=ANY(?) LIMIT 100001',
                                ['show' if kind == 'tv' else 'movie', ids])
            if len(aliases) > 100000:
                raise ValueError('Alias cap exceeded')
            for alias in aliases:
                key = f"{kind}:{alias['media_tmdb_id']}"
                if key in catalog:
                    catalog[key]['aliases'].append(alias['title'])
    return catalog


def previous_evidence(db):
    exists = db.select("SELECT table_name FROM information_schema.tables WHERE table_schema='doc' AND table_name='social_relevance'")
    if not exists:
        return {}, {}
    out, playability = {}, {}
    rows = db.select('SELECT post_id,content_hash,reasons FROM doc.social_relevance WHERE version=? LIMIT ?', [VERSION, MAX_LINKS + 1])
    if len(rows) > MAX_LINKS:
        raise ValueError('Stored relevance cap exceeded')
    for row in rows:
        for reason in row['reasons'] or []:
            if reason.startswith('metrics:'):
                out[row['post_id'], row['content_hash']] = json.loads(reason[len('metrics:'):])
            elif reason.startswith('playability:'):
                playability[row['post_id'], row['content_hash']] = json.loads(reason[len('playability:'):])
    return out, playability


def save(db, decisions):
    spec = SOCIAL_SCHEMAS['social_relevance']
    cols = list(spec['columns'])
    definitions = [f'{c} {t}' for c, t in spec['columns'].items()]
    definitions.append('PRIMARY KEY (' + ','.join(spec['primary_key']) + ')')
    db.execute('CREATE TABLE IF NOT EXISTS doc.social_relevance (' + ','.join(definitions) +
               ") CLUSTERED INTO 1 SHARDS WITH (number_of_replicas='0-1')")
    # A delayed preview/apply cannot replace a more recently judged decision.
    update = ','.join(f'{c}=CASE WHEN judged_at <= excluded.judged_at THEN excluded.{c} ELSE {c} END'
                      for c in cols if c not in spec['primary_key'])
    sql = f"INSERT INTO doc.social_relevance ({','.join(cols)}) VALUES ({','.join('?' for _ in cols)}) ON CONFLICT (media_type,media_tmdb_id,post_id) DO UPDATE SET {update}"
    for decision in decisions:
        db.execute(sql, [decision[c] for c in cols])
    db.execute('REFRESH TABLE doc.social_relevance')


def run(db, *, apply=False, at=None, hydrate=True, fresh_posts=(), force_playability=False):
    at = stamp(at) if at is not None else now()
    links = read_links(db)
    catalog = read_catalog(db, links)
    prior, prior_playability = previous_evidence(db)
    fresh = {p['post_id']: p for p in fresh_posts}
    for row in links:
        p = fresh.get(row['post_id']) or {}
        row['relevance_evidence'] = (p.get('relevance_evidence') if p.get('content_hash') == row['content_hash'] else None) or prior.get(
            (row['post_id'], row['content_hash']), {})
    errors = []
    if hydrate:
        social = {p['post_id']: p for p in links if p['source'] == 'bluesky'}
        errors = bluesky.hydrate_quality(list(social.values())) if social else []
        for row in links:
            if row['source'] == 'bluesky':
                hydrated = social[row['post_id']]
                row['relevance_evidence'] = hydrated['relevance_evidence']
                evidence = hydrated['quality_evidence']
                row['revalidation_failed'] = (not evidence.get('links_complete') or
                    not evidence.get('profile') or evidence.get('opted_out') or evidence.get('source_content_changed'))
    # Always check YouTube, including ingestion's hydrate=False path. That flag
    # controls only the existing Bluesky API refresh. Never bypass playability.
    playability = youtube_playability.hydrate(links, settings=getattr(db, 'settings', {}),
        prior=prior_playability, at=at, force=force_playability)
    decisions = judge_links(links, catalog, at=at)
    if apply:
        save(db, decisions)
    counts = {source: {status: sum(p['source'] == source and v['status'] == status for p, v in zip(links, decisions))
                       for status in ('keep', 'drop')} for source in SOURCES}
    return {'version': VERSION, 'apply': apply, 'judged_at': at.isoformat(), 'judged': len(decisions),
            'counts': counts, 'hydration_errors': errors, 'youtube_playability': playability,
            'reasons': dict(Counter(r for v in decisions for r in v['reasons'] if not r.startswith(('metrics:', 'duplicate_of:', 'playability:')))),
            'decisions': decisions}


def main(apply: bool = False, force_playability: bool = False):
    result = run(RelevanceCrate(load(), apply=apply), apply=apply, force_playability=force_playability)
    # Full rows are available in the table / local CLI output. Keep job results bounded.
    return {k: v for k, v in result.items() if k != 'decisions'}

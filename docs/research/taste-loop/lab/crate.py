"""Read-only access to production for the taste research loop.

`sql` runs one statement against Crate and refuses anything that is not a read: the statement must start with
`select`, `with` or `show`, must be a single statement, and must not contain a writing keyword anywhere.
`qdrant_points` reads vectors by id. Nothing in this module can write.

Credentials come from the webapp's `.env` in the main checkout; the worktree has none.
"""
import re

import requests

ENV_PATH = '/home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env'
READ_STARTS = ('select', 'with', 'show')
WRITE_WORDS = re.compile(
    r'\b(insert|update|delete|drop|alter|create|copy|refresh|optimize|grant|revoke|deny|kill|restore|reset|set|'
    r'truncate|begin|commit|analyze|discard|declare|close|fetch)\b', re.I)
STRING = re.compile(r"'(?:[^']|'')*'")


class NotARead(Exception):
    pass


def _env():
    env = {}
    for line in open(ENV_PATH):
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k] = v.strip().strip('"').strip("'")
    return env


ENV = _env()
_CRATE = f"http://{ENV['CRATE_HOSTS'].split(',')[0]}:{ENV['CRATE_PORT']}/_sql"
_AUTH = (ENV['CRATE_USER'], ENV['CRATE_PASS'])
_S = requests.Session()


def check_read_only(stmt):
    """Raise NotARead unless the statement is one plain read."""
    bare = STRING.sub("''", stmt).strip()
    if not bare.lower().startswith(READ_STARTS):
        raise NotARead('only select, with and show are allowed')
    if ';' in bare or '--' in bare or '/*' in bare:
        raise NotARead('one statement, no comments')
    hit = WRITE_WORDS.search(bare)
    if hit:
        raise NotARead(f'writing keyword in statement: {hit.group(0)}')


def sql(stmt, args=None):
    """Run one read and return a list of dicts."""
    check_read_only(stmt)
    r = _S.post(_CRATE, json={'stmt': stmt, 'args': args or []}, auth=_AUTH, timeout=180)
    if r.status_code != 200:
        raise RuntimeError(r.text[:500])
    d = r.json()
    return [dict(zip(d['cols'], row)) for row in d['rows']]


def pages(table, cols, where, args, order, page=5000):
    """The rows of an ordered query, one page at a time, read by keyset on the ordering columns.

    `order` is a list of selected column names that together are unique per row. Each page asks for the rows after
    the last row of the page before, so the result does not depend on the page size.
    """
    last = None
    names = ', '.join(order)
    while True:
        w, a = ([f'({where})'] if where else []), list(args)
        if last is not None:
            # (c1, c2, ...) > (v1, v2, ...), written out
            alts = []
            for i in range(len(order)):
                alts.append('(' + ' and '.join([f'{order[j]} = ?' for j in range(i)] + [f'{order[i]} > ?']) + ')')
                a += [last[order[j]] for j in range(i + 1)]
            w.append('(' + ' or '.join(alts) + ')')
        rows = sql(f"select {cols} from {table}{' where ' + ' and '.join(w) if w else ''} order by {names} "
                   f"limit {int(page)}", a)
        if rows:
            yield rows
        if len(rows) < page:
            return
        last = rows[-1]


def paged(table, cols, where, args, order, page=5000):
    """Every row of an ordered, paged query."""
    return [r for rows in pages(table, cols, where, args, order, page) for r in rows]


def qdrant_points(collection, ids, vectors):
    """Named vectors for the given point ids. A read: POST /points is Qdrant's retrieve call."""
    base = ENV['QDRANT_URL'].replace(':6334', ':6333')
    r = _S.post(f'{base}/collections/{collection}/points', headers={'api-key': ENV.get('QDRANT_API_KEY', '')},
                json={'ids': ids, 'with_vector': vectors, 'with_payload': False}, timeout=120)
    r.raise_for_status()
    return r.json()['result']


def point_id(media_type, tmdb_id):
    return (1_000_000_000_000 if media_type == 'movie' else 2_000_000_000_000) + int(tmdb_id)

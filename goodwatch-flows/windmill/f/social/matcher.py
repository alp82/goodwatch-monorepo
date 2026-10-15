"""Production round-two chain: extraction -> retrieval -> identity rejection gate."""
import json
import math
import time
from threading import Lock
from f.social.common import norm
from f.social.rules import EXTRACT_PROMPT, GATE_PROMPT, MODEL, foreground

LANES = ('official_video_id', 'foreground_exact', 'alt_title_context', 'foreground_fuzzy', 'vector_context')


def confident(value, minimum):
    return type(value) in (int, float) and math.isfinite(value) and minimum <= value <= 1


class OpenRouter:
    def __init__(self, key):
        self.key = key
        self.cost = 0.0
        self.requests = 0
        self.usage_lock = Lock()

    def __call__(self, prompt, items):
        import requests
        if not self.key:
            raise RuntimeError('missing_openrouter_key')
        field = 'entities' if prompt == EXTRACT_PROMPT else 'links'
        for attempt in range(3):
            response = requests.post('https://openrouter.ai/api/v1/chat/completions',
                headers={'Authorization': 'Bearer ' + self.key},
                json={'model': MODEL, 'messages': [{'role': 'system', 'content': prompt},
                      {'role': 'user', 'content': json.dumps({'items': items}, ensure_ascii=False)}],
                      'temperature': 0, 'max_tokens': 5000, 'response_format': {'type': 'json_object'}}, timeout=150)
            with self.usage_lock:
                self.requests += 1
            if response.status_code in (429, 502, 503, 504):
                if attempt == 2:
                    raise RuntimeError('OpenRouter transient failures; retry next flow run')
                time.sleep(attempt + 1)
                continue
            response.raise_for_status()
            body = response.json()
            with self.usage_lock:
                self.cost += float((body.get('usage') or {}).get('cost') or 0)
            try:
                result = json.loads(body['choices'][0]['message']['content'])['items']
                if (len(result) == len(items) and {r['id'] for r in result} == {r['id'] for r in items}
                    and all(isinstance(r[field], list) and all(isinstance(x, dict) for x in r[field]) for r in result)):
                    return result
            except (KeyError, ValueError, TypeError, IndexError):
                pass
        if len(items) > 1:
            return [row for item in items for row in self(prompt, [item])]
        raise RuntimeError('invalid_model_response_ids_or_shape')


class Matcher:
    def __init__(self, select, *, llm, vector=None):
        self.select, self.llm, self.vector = select, llm, vector

    def match(self, posts):
        output = {p['post_id']: [] for p in posts}
        pending = []
        yt = [p['source_id'] for p in posts if p['source'] == 'youtube']
        official = {}
        if yt:
            for row in self.select("SELECT media_type,media_tmdb_id,site_key FROM media_video WHERE site='YouTube' AND official=true AND site_key=ANY(?)", [yt]):
                kind = 'tv' if row['media_type'] in ('tv', 'show') else 'movie'
                official.setdefault(row['site_key'], set()).add(kind + ':' + str(row['media_tmdb_id']))
        for p in posts:
            keys = official.get(p['source_id'], set()) if p['source'] == 'youtube' else set()
            if len(keys) == 1:
                output[p['post_id']] = [{'key': next(iter(keys)), 'lane': 'official_video_id', 'confidence': .995,
                                        'confidence_basis': 'rule_score_not_calibrated',
                                        'reason': 'Allowlisted channel and unique official catalog video ID'}]
            else:
                pending.append(p)
        if not pending:
            return output
        extraction = self.llm(EXTRACT_PROMPT, [{'id': p['post_id'], 'source': p['source'], 'author': p['author'],
                                              'foreground': foreground(p)} for p in pending])
        extracted = {r['id']: r.get('entities', [])[:3] for r in extraction}
        proposals, payload = {}, []
        for p in pending:
            entries = []
            text = norm(' '.join(foreground(p).values()))
            for idx, entity in enumerate(extracted.get(p['post_id'], [])):
                mention, evidence = norm(str(entity.get('mention') or '')), norm(str(entity.get('evidence') or ''))
                if not mention or not evidence or mention not in text or evidence not in text or not confident(entity.get('confidence'), .90):
                    continue
                hits = self.retrieve(entity, p)
                if hits:
                    proposals[(p['post_id'], idx)] = hits
                    entries.append({'entity_index': idx, 'extracted': entity, 'candidates': hits})
            if entries:
                payload.append({'id': p['post_id'], 'source': p['source'], 'published_at': p['published_at'],
                                'foreground': foreground(p), 'entities': entries})
        if not payload:
            return output
        for result in self.llm(GATE_PROMPT, payload):
            links = {}
            for link in result.get('links', []):
                if type(link.get('entity_index')) is not int or not confident(link.get('confidence'), .97):
                    continue
                candidates = proposals.get((result['id'], link['entity_index']), [])
                hit = next((c for c in candidates if c['key'] == link.get('key')), None)
                if hit is None:
                    continue
                if sum(c.get('name_score') == 100 for c in candidates) > 1 and link.get('context_disambiguated') is not True:
                    continue
                links[hit['key']] = {'key': hit['key'], 'lane': hit['retrieval'], 'confidence': link['confidence'],
                                    'confidence_basis': 'llm_self_report_not_calibrated', 'reason': str(link.get('reason') or '')[:1000]}
            output[result['id']] = list(links.values())
        return output

    def retrieve(self, entity, item):
        from rapidfuzz.fuzz import ratio
        names = [n.lower() for n in [entity.get('mention'), entity.get('canonical_title'), *(entity.get('aliases') or [])]
                 if isinstance(n, str) and n][:8]
        hits = {}
        if not names:
            return []
        # These production columns are FULLTEXT. Use their index to retrieve a
        # bounded superset, then verify exact names in Python. lower(column)
        # disables that index and scans the entire catalog for every entity.
        exact = ' OR '.join('MATCH((title,original_title), ?) USING phrase' for _ in names)
        normalized = {norm(n) for n in names}
        for kind, table in (('movie', 'movie'), ('tv', 'show')):
            rows = self.select(f'SELECT tmdb_id,title,original_title,release_year,popularity FROM {table} WHERE ({exact}) LIMIT 3000', names)
            for row in rows:
                if not normalized.intersection({norm(row['title']), norm(row['original_title'] or '')}):
                    continue
                key = kind + ':' + str(row['tmdb_id'])
                hits[key] = row | {'key': key, 'media_type': kind, 'retrieval': 'foreground_exact', 'name_score': 100}
        alias_query = ' OR '.join('MATCH(title, ?) USING phrase' for _ in names)
        aliases = self.select(f'SELECT media_type,media_tmdb_id,title FROM alternative_title WHERE ({alias_query}) LIMIT 3000', names)
        for row in aliases:
            if norm(row['title']) not in normalized:
                continue
            kind = 'tv' if row['media_type'] in ('tv', 'show') else 'movie'
            key = kind + ':' + str(row['media_tmdb_id'])
            hits.setdefault(key, {'key': key, 'tmdb_id': row['media_tmdb_id'], 'media_type': kind,
                                   'title': row['title'], 'release_year': None, 'retrieval': 'alt_title_context', 'name_score': 100})
            hits[key].setdefault('alternative_titles', []).append(row['title'])
        if len(hits) < 2:
            # Indexed typo-tolerant retrieval replaces the prototype's local
            # SQLite first-token scan; the frozen >=88 full-name cutoff remains.
            fuzzy_query = ' OR '.join("MATCH((title,original_title), ?) USING best_fields WITH (fuzziness=1,operator='and')" for _ in names)
            for kind, table in (('movie', 'movie'), ('tv', 'show')):
                for row in self.select(f'SELECT tmdb_id,title,original_title,release_year,popularity FROM {table} WHERE ({fuzzy_query}) LIMIT 3000', names):
                    score = max(ratio(norm(n), norm(t or '')) for n in names for t in (row['title'], row['original_title']))
                    key = kind + ':' + str(row['tmdb_id'])
                    if score >= 88:
                        hits.setdefault(key, row | {'key': key, 'media_type': kind, 'retrieval': 'foreground_fuzzy', 'name_score': score})
        def rank(row):
            score = row.get('name_score', 0) + (20 if row['media_type'] == entity.get('type') else 0)
            year = entity.get('year')
            if str(year).isdigit() and row.get('release_year') and abs(int(year) - row['release_year']) <= 1:
                score += 20
            return score, row.get('popularity') or 0
        candidates = sorted(hits.values(), key=rank, reverse=True)[:18]
        if not candidates and self.vector:
            candidates = self.vector(entity['mention'] + ' ' + json.dumps(entity) + ' ' + ' '.join(foreground(item).values())[:650])
        return self.enrich(candidates)

    def enrich(self, candidates):
        details = {}
        for kind, table in (('movie', 'movie'), ('tv', 'show')):
            ids = [c['tmdb_id'] for c in candidates if c['media_type'] == kind]
            if not ids:
                continue
            for row in self.select(f'SELECT tmdb_id,title,original_title,release_year,substr(synopsis,1,900) AS synopsis FROM {table} WHERE tmdb_id=ANY(?)', [ids]):
                key = kind + ':' + str(row['tmdb_id'])
                details[key] = row | {'key': key, 'directors': [], 'creators': [], 'writers': [], 'cast': []}
            media = 'show' if kind == 'tv' else 'movie'
            crew = self.select("SELECT media_tmdb_id,person_tmdb_id,job FROM person_worked_on WHERE media_type=? AND media_tmdb_id=ANY(?) AND job IN ('Director','Creator','Writer')", [media, ids])
            cast = self.select('SELECT media_tmdb_id,person_tmdb_id FROM person_appeared_in WHERE media_type=? AND media_tmdb_id=ANY(?) AND order_default < 8', [media, ids])
            people = sorted({c['person_tmdb_id'] for c in crew + cast})
            names = {p['tmdb_id']: p['name'] for p in self.select('SELECT tmdb_id,name FROM person WHERE tmdb_id=ANY(?)', [people])} if people else {}
            for credit in crew + cast:
                key = kind + ':' + str(credit['media_tmdb_id'])
                field = {'Director': 'directors', 'Creator': 'creators', 'Writer': 'writers'}.get(credit.get('job'), 'cast')
                if key in details and credit['person_tmdb_id'] in names:
                    details[key][field].append(names[credit['person_tmdb_id']])
        for row in details.values():
            for field, limit in (('directors', 12), ('creators', 8), ('writers', 8), ('cast', 8)):
                row[field] = list(dict.fromkeys(row[field]))[:limit]
        return [c | details[c['key']] for c in candidates if c['key'] in details]


def main():
    return {'library': True}

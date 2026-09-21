"""PROTOTYPE. Read-only retrieval on the approved 50k scratch snapshot/table.

configure(env_path) once, then retrieve_candidates(plan, sample). Mood-only
requests scan fingerprint scores in memory; this is explicitly NOT Qdrant.
Strategies change ranking only, holding candidate retrieval fixed for comparison.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from functools import lru_cache
import math
import re
import time

import experiment
from dotenv import dotenv_values

STRATEGIES = ('facets', 'balanced', 'lexical', 'fingerprint', 'centrality', 'recall')
_CACHE = None


def configure(env_path):
    env = dotenv_values(env_path)
    experiment.URL = f"http://{env['CRATE_HOSTS'].split(',')[0]}:{env.get('CRATE_PORT', '4200')}/_sql"
    experiment.AUTH = (env.get('CRATE_USER', ''), env.get('CRATE_PASS', ''))


def _normal(text):
    return ' '.join(re.findall(r'\w+', (text or '').lower()))


def _index(sample):
    global _CACHE
    if _CACHE is not None and _CACHE[0] is sample:
        return _CACHE[1]
    result = {}
    for row in sample:
        strong = row.get('strong_evidence') or ''
        result[f"{row['media_type']}:{row['tmdb_id']}"] = (
            row, _normal(strong), _normal(row.get('text_evidence') or '\n'.join(
                row.get(k) or '' for k in ('essence_text', 'synopsis'))),
            {_normal(x) for x in strong.splitlines() if x.strip()})
    _CACHE = (sample, result)
    return result


def _terms(facet):
    return list(dict.fromkeys(_normal(t) for t in facet.get('terms', []) if _normal(t)))[:12]


def _phrase(term, text):
    return (' ' + term + ' ') in (' ' + text + ' ')


def _evidence(facet, entry):
    _, strong, text, tags = entry
    return [{'term': term, 'source': 'exact_tag' if term in tags else 'strong_phrase' if _phrase(term, strong) else 'text_phrase'}
            for term in _terms(facet) if term in tags or _phrase(term, strong) or _phrase(term, text)]



def _inflected_tokens(text):
    # Narrow plural normalization only: do not collapse semantically distinct
    # stems (university/universe) or accept arbitrary document-wide token ANDs.
    def singular(word):
        if len(word) > 4 and word.endswith('ies'):
            return word[:-3] + 'y'
        if len(word) > 4 and word.endswith(('ches', 'shes', 'xes', 'zes')):
            return word[:-2]
        if len(word) > 3 and word.endswith('s') and not word.endswith(('ss', 'us', 'is')):
            return word[:-1]
        return word
    return [singular(w) for w in _normal(text).split()]


@lru_cache(maxsize=60000)
def _inflection_normal(text):
    return ' '.join(_inflected_tokens(text))


def _precise_phrase(term, text):
    query = _inflection_normal(term)
    document = _inflection_normal(text)
    return bool(query) and (' ' + query + ' ') in (' ' + document + ' ')


def _central_evidence(facet, row):
    evidence = []
    fields = [('essence_text', 1.), ('synopsis', .9), ('essence_tags', .8), ('keywords', .45), ('trope_names', .25)]
    for position, term in enumerate(_terms(facet)):
        # Planner contract v7: first term is canonical; later terms are precise
        # equivalences. Alias evidence stays eligible but gets a modest discount.
        priority = 1. if position == 0 else .86
        for field, weight in fields:
            values = row.get(field) or []
            if isinstance(values, str):
                values = [values]
            if any(_precise_phrase(term, value) for value in values):
                evidence.append({'term': term, 'source': field, 'canonical': position == 0,
                                 'strength': priority * weight, 'match': 'ordered_phrase_with_plural_normalization'})
    strength = max((e['strength'] for e in evidence), default=0)
    # Corroboration across synopsis/essence and curated essence tags is more
    # informative than repeated occurrences in a very large trope list.
    prose = any(e['source'] in ('essence_text', 'synopsis') for e in evidence)
    tags = any(e['source'] == 'essence_tags' for e in evidence)
    if prose and tags:
        strength = min(1., strength + .05)
    return strength, evidence

def _fingerprint(row, preferences):
    scores = row.get('fingerprint_scores') or {}
    numerator = denominator = 0
    observed = []
    for pref in preferences:
        strength = max(0, min(1, float(pref.get('strength', 1))))
        if not strength:
            continue
        key = pref['key']
        raw = scores.get(key)
        # Missing dimensions are neutral, never a perfect match for avoidance.
        fitness = .5 if raw is None else max(0, min(1, float(raw) / 10))
        if pref.get('direction') == 'avoid':
            fitness = 1 - fitness
        numerator += fitness * strength
        denominator += strength
        observed.append({'key': key, 'value': raw, 'fitness': fitness, 'strength': strength, 'direction': pref.get('direction', 'want')})
    return numerator / denominator if denominator else .5, observed


def _hygiene(entry):
    row, strong, text, tags = entry
    reasons = []
    # Require explicit content evidence; a title merely containing "Ride" or
    # an ordinary released series with a pilot is not an artifact.
    combined = strong + ' ' + text
    for marker in ('theme park attraction', 'theme park ride', 'simulator ride', 'amusement park ride',
                   'unaired pilot', 'unreleased pilot', 'unsold pilot'):
        if _phrase(marker, combined):
            reasons.append(marker)
    # A standalone pilot record plus explicit rejection/non-release evidence.
    # The bare tag "pilot" also describes normal aviation films and is insufficient.
    if (_phrase('tv pilot', combined) or _phrase('pilot version', combined)) and any(
            _phrase(marker, combined) for marker in ('rejected by', 'failed to become a series',
                                                    'not released', 'did not released', 'never aired', 'never broadcast')):
        reasons.append('pilot_with_explicit_non_release_or_rejection')
    return reasons




def candidate_format(row):
    """Same evidence-derived classification for retrieval and imported sources."""
    strong = _normal(row.get('strong_evidence') or '')
    documentary = any(_phrase(t, strong) for t in ('documentary', 'docuseries', 'documentary series', 'documentary film'))
    fictional = any(_phrase(t, strong) for t in ('fictional narrative', 'fictional story', 'scripted series', 'scripted drama', 'scripted comedy')) and not documentary
    return {'documentary': documentary, 'fiction': fictional, 'unknown': not (documentary or fictional)}

def candidate_hygiene(row):
    """Shared evidence-only artifact reasons for candidates from ANY source."""
    return _hygiene((row, _normal(row.get('strong_evidence') or ''),
                     _normal(row.get('text_evidence') or '\n'.join(row.get(k) or '' for k in ('essence_text', 'synopsis'))), set()))

def warm_sample_index(sample):
    """Initialize once before timing requests; return measured initialization ms."""
    started = time.perf_counter()
    _index(sample)
    return (time.perf_counter() - started) * 1000


def retrieve_candidates(plan, sample, limit=60, strategy='facets', env_path=None, retrieval_context=None):
    """Return ranked full evidence rows, scores, true timing and retrieval diagnostics.

    `facets` favors weakest-facet relevance; `balanced` gives fingerprint fitness
    more weight; `lexical` minimizes mood influence; `fingerprint` ranks the SAME
    lexically eligible pool primarily by mood. Required facet failure never gets
    silently relaxed. Pass no facets for sample-only fingerprint retrieval.
    """
    started = time.perf_counter()
    if strategy not in STRATEGIES:
        raise ValueError(f'Unknown strategy {strategy!r}; expected {STRATEGIES}')
    if env_path:
        configure(env_path)
    index = _index(sample)
    index_ms = (time.perf_counter() - started) * 1000
    facets = plan.get('facets') or []
    mood_key = json.dumps([plan, limit], sort_keys=True) if not facets and retrieval_context is not None else None
    if mood_key is not None and mood_key in retrieval_context.get('mood_rankings', {}):
        previous = retrieval_context['mood_rankings'][mood_key]
        return {**previous, 'wall_ms': (time.perf_counter() - started) * 1000,
                'diagnostics': {**previous['diagnostics'], 'strategy': strategy, 'index_ms': index_ms,
                                'mood_rank_reused': True, 'original_mood_wall_ms': previous['wall_ms']}}
    if len(facets) > 8 or any(not _terms(f) for f in facets):
        raise ValueError('Expected at most 8 nonempty semantic facets')
    media = plan.get('media_type')
    if media not in (None, 'movie', 'show'):
        raise ValueError('media_type must be movie, show or null')
    query_logs = []
    hits = {}
    cap = 1200

    def facet_query(pair):
        i, facet = pair
        clauses, args = [], []
        for term in _terms(facet):
            words = term.split()
            clauses.append('(' + ' AND '.join('match((strong_evidence 3.0, text_evidence), ?)' for _ in words) + ')')
            args.extend(words)
        predicate = ' OR '.join(clauses)
        scope = 'media_type=? AND ' if media else ''
        if media:
            args.insert(0, media)
        statement = f'SELECT media_type,tmdb_id,_score FROM {experiment.TABLE} WHERE {scope}({predicate}) ORDER BY _score DESC,media_type,tmdb_id LIMIT {cap}'
        cache_key = (statement, tuple(args))
        query_cache = retrieval_context.setdefault('queries', {}) if retrieval_context is not None else {}
        if cache_key in query_cache:
            original = query_cache[cache_key]
            result = {**original, 'wall_ms': 0, 'server_ms': 0, 'reused': True, 'original_query_wall_ms': original['wall_ms']}
        else:
            result = experiment.sql(statement, args)
            query_cache[cache_key] = result
        return i, result

    if facets:
        if not hasattr(experiment, 'URL'):
            raise ValueError('Call configure(env_path) before lexical retrieval')
        with ThreadPoolExecutor(max_workers=4) as pool:
            for i, result in pool.map(facet_query, enumerate(facets)):
                rows = result['rows']
                best = max((r['_score'] for r in rows), default=1) or 1
                for r in rows:
                    key = f"{r['media_type']}:{r['tmdb_id']}"
                    if key in index:
                        hits.setdefault(key, {})[i] = {'raw': r['_score'], 'normalized': r['_score'] / best}
                query_logs.append({'facet': facets[i]['name'], 'rows': len(rows), 'cap': cap, 'possibly_truncated': len(rows) == cap,
                                   'wall_ms': result['wall_ms'], 'server_ms': result['server_ms'], 'reused': result.get('reused', False),
                                   'original_query_wall_ms': result.get('original_query_wall_ms')})
        keys = hits.keys()
    else:
        keys = index.keys()
    candidates = []
    excluded = {'required_facet': 0, 'media_type': 0, 'format': 0, 'artifact': 0, 'avoid': 0, 'duplicate': 0}
    for key in keys:
        entry = index[key]
        row, strong, text, tags = entry
        if media and row['media_type'] != media:
            excluded['media_type'] += 1
            continue
        if _hygiene(entry):
            excluded['artifact'] += 1
            continue
        classification = candidate_format(row)
        documentary, fictional = classification['documentary'], classification['fiction']
        if (plan.get('format') == 'fiction' and documentary) or (plan.get('format') == 'documentary' and fictional):
            excluded['format'] += 1
            continue
        avoided = [{'name': f['name'], 'evidence': _evidence(f, entry)} for f in plan.get('avoid', [])]
        avoided = [a for a in avoided if a['evidence']]
        # Mentioning an avoided concept does not establish its presence: retain
        # candidates for evidence reranking and apply only a bounded soft penalty.
        evidence, strengths = [], []
        missing = False
        missing_required = []
        for i, facet in enumerate(facets):
            exact = _evidence(facet, entry)
            hit = hits.get(key, {}).get(i)
            central_strength, central_evidence = _central_evidence(facet, row) if strategy == 'centrality' else (0, [])
            matched = bool(central_evidence) if strategy == 'centrality' else bool(hit or exact)
            if facet.get('importance') == 'required' and not matched:
                missing = True
                missing_required.append(facet['name'])
            exact_strength = max(({'exact_tag': 1., 'strong_phrase': .85, 'text_phrase': .65}[e['source']] for e in exact), default=0)
            strength = central_strength if strategy == 'centrality' else max(exact_strength, .25 + .65 * hit['normalized'] if hit else 0)
            strengths.append(strength)
            evidence.append({'name': facet['name'], 'importance': facet.get('importance'), 'matched': matched,
                             'lexical_score': hit['raw'] if hit else 0, 'strength': strength, 'evidence': exact,
                             'english_analyzer_match': bool(hit), 'centrality_evidence': central_evidence,
                             'canonical_term': _terms(facet)[0] if _terms(facet) else None})
        if missing and strategy != 'recall':
            excluded['required_facet'] += 1
            continue
        mean = sum(strengths) / len(strengths) if strengths else 0
        required = [strengths[i] for i, f in enumerate(facets) if f.get('importance') == 'required']
        minimum = min(required or strengths) if strengths else 0
        lexical = .6 * mean + .4 * minimum
        fitness, fingerprint_evidence = _fingerprint(row, plan.get('fingerprint_preferences') or [])
        popularity = min(1., math.log1p(max(0, row.get('votes') or 0)) / math.log1p(100000))
        if not facets:
            score = .95 * fitness + .05 * popularity
        else:
            weights = {'facets': (.78, .18, .04), 'balanced': (.6, .36, .04), 'lexical': (.94, .02, .04), 'fingerprint': (.25, .71, .04), 'centrality': (.84, .12, .04), 'recall': (.78, .18, .04)}[strategy]
            score = sum(w * value for w, value in zip(weights, (lexical, fitness, popularity)))
        score -= min(.3, .1 * len(avoided))
        if missing_required:
            score -= .25 * len(missing_required)
        if plan.get('format') == 'documentary' and documentary:
            score += .04
        candidates.append({**row, 'key': key, 'year': row.get('release_year'), 'score': score,
                           'missing_required': missing_required, 'recall_fallback': bool(missing_required),
                           'lexical_score': lexical, 'facet_minimum': minimum, 'facet_coverage': sum(s > 0 for s in strengths) / len(strengths) if strengths else 1,
                           'fingerprint_fitness': fitness, 'popularity_score': popularity, 'facet_evidence': evidence,
                           'fingerprint_evidence': fingerprint_evidence, 'avoid_evidence': avoided,
                           'format_evidence': 'documentary_strong_evidence' if documentary else 'fiction_strong_evidence' if fictional else 'unknown',
                           'format_unknown': bool(plan.get('format') and not (documentary or fictional)),
                           'hygiene_evidence': _hygiene(entry)})
    candidates.sort(key=lambda r: (-r['score'], -r['votes'], r['key']))
    fully_eligible_count = sum(not r['missing_required'] for r in candidates)
    partial_fallback_used = strategy == 'recall' and fully_eligible_count < 24
    if strategy == 'recall':
        complete = [r for r in candidates if not r['missing_required']]
        candidates = complete + ([r for r in candidates if r['missing_required']] if partial_fallback_used else [])
    # Collapse same-title same-year duplicates across media, preserving distinct
    # sequels and remakes. No franchise cap or guessed series grouping.
    unique, seen = [], set()
    for row in candidates:
        identity = (_normal(row['title']), row['year'])
        if identity in seen:
            excluded['duplicate'] += 1
            continue
        seen.add(identity)
        unique.append(row)
    result = {'candidates': unique[:max(0, limit)], 'wall_ms': (time.perf_counter() - started) * 1000,
            'diagnostics': {'strategy': strategy, 'retrieval': 'crate_english_facets' if facets else 'sample_only_in_memory_fingerprint_NOT_QDRANT',
                            'sample_size': len(sample), 'index_ms': index_ms, 'pool_size': len(hits) if facets else len(sample), 'eligible_count': len(unique),
                            'fully_eligible_count': fully_eligible_count, 'partial_fallback_used': partial_fallback_used,
                            'query_count': sum(not q.get('reused') for q in query_logs), 'reused_query_count': sum(bool(q.get('reused')) for q in query_logs), 'queries': query_logs, 'excluded': excluded,
                            'format_filter': 'strong_evidence_derived_not_authoritative' if plan.get('format') else None,
                            'required_facet_policy': 'ordered phrase or plural variant in original source fields' if strategy == 'centrality' else 'English analyzer match or exact phrase',
                            'avoid_policy': 'mentions receive bounded soft penalty; no hard exclusion',
                            'fingerprint_calibration': 'scores fixed 0..10 -> 0..1; preference-weighted mean; missing=.5',
                            'server_sum_ms': sum(q['server_ms'] for q in query_logs)}}
    if mood_key is not None:
        retrieval_context.setdefault('mood_rankings', {})[mood_key] = result
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env')
    parser.add_argument('--plan', required=True)
    parser.add_argument('--sample', default=str(experiment.PRIVATE / 'sample.json'))
    parser.add_argument('--strategy', choices=STRATEGIES, default='facets')
    parser.add_argument('--limit', type=int, default=60)
    parser.add_argument('--output', required=True)
    options = parser.parse_args()
    with open(options.plan) as handle:
        plan = json.load(handle)
    with open(options.sample) as handle:
        sample = json.load(handle)
    result = retrieve_candidates(plan, sample, options.limit, options.strategy, options.env)
    with open(options.output, 'w') as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
    print(json.dumps({'wall_ms': result['wall_ms'], 'diagnostics': result['diagnostics'],
                      'top10': [{'title': r['title'], 'score': r['score']} for r in result['candidates'][:10]]}, indent=2))

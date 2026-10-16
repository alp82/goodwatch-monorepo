"""History-only descriptions, deterministic triples, and pre-call shortcut checks.

Keys, times, source tokens and answers remain in private structures. A payload contains
only the frozen description and the three displayed lists.
"""
import hashlib
import itertools
import math
import statistics
from collections import Counter

SEED = 20261013
LABELS = 'ABC'


def digest(value):
    import json
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def order(purpose, *parts):
    return hashlib.sha256('|'.join(map(str, (SEED, 'T5', purpose, *parts))).encode()).hexdigest()


def split(rows):
    rows = sorted(rows, key=lambda r: (r['created_at'], r['position'], r['title_key']))
    k = original = math.floor(.7 * len(rows))
    while 0 < k < len(rows) and rows[k]['created_at'] - rows[k - 1]['created_at'] < 2000:
        k -= 1
    cutoff = rows[k]['created_at'] if k < len(rows) else math.inf
    early = [r for r in rows[:k] if r.get('updated_at') is not None and r['updated_at'] < cutoff]
    # Match the pack: five rows in an inclusive two-second window, rather than
    # a chain of short gaps (the boundary convention is deliberately separate).
    bulk = set()
    for i in range(max(0, len(rows) - 4)):
        if rows[i + 4]['created_at'] - rows[i]['created_at'] <= 2000:
            bulk.update(range(i, i + 5))
    later = [r for i, r in enumerate(rows) if i >= k and i not in bulk and not r.get('in_bulk', False)]
    return {'early': early, 'later': later, 'moved': original - k, 'n': len(rows), 'cutoff': cutoff}


def forbidden(named, titles):
    """Alias closure before AND after franchise closure, including transitive aliases."""
    blocked = set(named)
    while True:
        previous = set(blocked)
        series = {t.get('movie_series_id') for t in titles if t['key'] in blocked and
                  t['media_type'] == 'movie' and t.get('movie_series_id') is not None}
        for t in titles:
            aliases = set(t.get('aliases', [])) | {t['key']}
            if aliases & blocked or (t['media_type'] == 'movie' and t.get('movie_series_id') in series):
                blocked.update(aliases)
        if blocked == previous:
            return blocked


# Amendment A1 (October 16, 2026, before any reader call): later lists hold movies only. On the real cases a
# reader matching the lists' show share to the named titles' show share picked right 43.4% of the time, and no
# rematch on show share removed it; matching movies against shows is not the words of a Side.
LIST_MEDIA = 'movie'


def remaining(rows, blocked, facts):
    unique = {}
    for r in rows:
        fact = facts.get(r['title_key'], {})
        if LIST_MEDIA and fact.get('media_type') != LIST_MEDIA:
            continue
        if r['title_key'] not in blocked and fact.get('title'):
            unique.setdefault(r['title_key'], r)
    return list(unique.values())


def _sample(rows, anchor, source, pair):
    chosen = sorted(rows, key=lambda r: (order('sample', anchor, source, pair, r['title_key']), r['title_key']))[:15]
    return sorted(chosen, key=lambda r: (order('rows', anchor, source, pair, r['title_key']), r['title_key']))


def _display(rows, facts):
    return [{'title': facts[r['title_key']]['title'], 'year': facts[r['title_key']].get('year'),
             'type': facts[r['title_key']]['media_type'], 'rating': r['score']} for r in rows]


def build(population, titles, descriptions, rematch=False):
    """At most four distinct pairs; reuse distractors, never owner or tier B."""
    facts = {t['key']: t for t in titles}
    splits = {m['token']: split(m['ratings']) for m in population if m.get('tier', 'A') == 'A'
              and not m.get('owner', False) and len(m['ratings']) >= 40}
    splits = {k: s for k, s in splits.items() if s['early'] and len(remaining(s['later'], set(), facts)) >= 15}
    cases, excluded, reuse, gaps, removal = [], Counter(), Counter(), [], []
    empty = sum(descriptions[k]['empty'] for k in splits)
    for anchor, s in sorted(splits.items()):
        desc = descriptions[anchor]
        if desc['empty']:
            excluded['empty_s'] += 1
            continue
        blocked = forbidden(desc['named_titles'], titles)
        lists = {k: remaining(v['later'], blocked, facts) for k, v in splits.items()}
        removal.append(len(s['later']) - len(lists[anchor]))
        if len(lists[anchor]) < 15:
            excluded['anchor_list_short'] += 1
            continue
        mu = statistics.mean(r['score'] for r in s['early'])
        means = {k: statistics.mean(r['score'] for r in v['early']) for k, v in splits.items()}
        eligible = [k for k in splits if k != anchor and len(lists[k]) >= 15 and abs(means[k] - mu) <= .5]
        pairs = []
        for pair in itertools.combinations(sorted(eligible), 2):
            pair_id = '|'.join(pair)
            samples = {k: _sample(lists[k], anchor, k, pair_id) for k in (anchor, *pair)}
            display_means = {k: statistics.mean(r['score'] for r in v) for k, v in samples.items()}
            shows = {k: statistics.mean(facts[r['title_key']]['media_type'] == 'show' for r in v) for k,v in samples.items()}
            if rematch and (max(display_means.values()) - min(display_means.values()) > .2 + 1e-12 or
                            max(shows.values()) - min(shows.values()) > .2 + 1e-12):
                continue
            cost = sum(abs(means[k] - mu) / .5 for k in pair)
            if rematch:
                cost = max(display_means.values()) - min(display_means.values()) + max(shows.values()) - min(shows.values())
            ranked = sorted(samples, key=lambda k: (display_means[k], order('rank_tie', anchor, pair_id, k)))
            pairs.append((cost, order('match', anchor, pair_id), pair, samples, ranked.index(anchor)))
        pairs.sort()
        if rematch and pairs:
            # An anchor must support every rank; never fall back to whichever rank
            # happens to be available. Four triples differ in rank counts by at most one.
            bins = {rank: [p for p in pairs if p[4] == rank] for rank in range(3)}
            if not all(bins.values()):
                excluded['unbalanced_ranks'] += 1
                pairs = []
            else:
                offset = int(order('rank_offset', anchor), 16) % 3
                selected = []
                for i in range(4):
                    bucket = bins[(offset + i) % 3]
                    if bucket:
                        selected.append(bucket.pop(0))
                pairs = selected
        if not pairs:
            excluded['no_pair'] += 1
        label_offset = int(order('label_offset', anchor), 16) % 3
        for i, (_, _, pair, samples, rank) in enumerate(pairs[:4]):
            pair_id = '|'.join(pair)
            sources = sorted(pair, key=lambda k: order('display', anchor, pair_id, k))
            sources.insert((label_offset + i) % 3, anchor)
            payload = {'description': desc['text'], 'lists': {label: _display(samples[k], facts) for label, k in zip(LABELS, sources)}}
            key = digest(payload)
            cases.append({'id': key, 'member': anchor, 'answer': LABELS[sources.index(anchor)], 'payload': payload,
                          'numbers_only': desc['numbers_only'], 'printed_mean': desc['printed_mean'],
                          'sources': sources, 'selected_keys': {k: [r['title_key'] for r in samples[k]] for k in sources},
                          'early_size': len(s['early']), 'show_share': shows_for(samples[anchor], facts),
                          'named_show_share': named_shows(desc['named_titles'], facts),
                          'displayed_mean_rank': rank,
                          'edited_labels': sum(r.get('edited', False) for rows in samples.values() for r in rows)})
            reuse.update(pair)
            gaps.extend(abs(means[k] - mu) for k in pair)
    return cases, {'structural_members': len(splits), 'empty': empty, 'empty_share': empty / len(splits) if splits else None,
                   'primary_members': len({c['member'] for c in cases}), 'triples': len(cases), 'excluded': dict(excluded),
                   'boundary_moves': sum(s['moved'] > 0 for s in splits.values()), 'rematched': rematch,
                   'maximum_distractor_reuse': max(reuse.values(), default=0),
                   'mean_early_match_gap': statistics.mean(gaps) if gaps else None, 'title_removal_losses': sum(removal)}


def control_payload(case, kind):
    descriptions = {'s': case['payload']['description'], 'numbers': case['numbers_only'], 'none': ''}
    return {'description': descriptions[kind], 'lists': case['payload']['lists']}


def named_shows(keys, facts):
    """Show share of the titles the description names: what a reader can infer about movies against shows."""
    known = [facts[k]['media_type'] == 'show' for k in keys if k in facts]
    return statistics.mean(known) if known else None


def shows_for(rows, facts):
    return statistics.mean(facts[r['title_key']]['media_type'] == 'show' for r in rows)


def baselines(cases):
    """Deterministic ties by case digest; all figures first averaged within member."""
    from collections import defaultdict
    outcomes = defaultdict(lambda: defaultdict(list))
    for c in cases:
        means = {k: statistics.mean(r['rating'] for r in rows) for k, rows in c['payload']['lists'].items()}
        median = sorted(means.values())[1]
        choices = {'middle_mean': {k: abs(v - median) for k, v in means.items()},
                   'closest_printed_mean': {k: abs(v - c['printed_mean']) for k, v in means.items()}}
        if c.get('named_show_share') is not None:
            # Added before any reader call on October 16, 2026: the list whose show share is closest to the named
            # titles' show share. Matching movies against shows is not the words of a Side.
            choices['media_type'] = {k: abs(statistics.mean(r['type'] == 'show' for r in rows) - c['named_show_share'])
                                     for k, rows in c['payload']['lists'].items()}
        for label in LABELS:
            choices['position_' + label] = {k: int(k != label) for k in LABELS}
        for name, costs in choices.items():
            choice = min(LABELS, key=lambda k: (costs[k], order('baseline_tie', c['id'], name, k)))
            outcomes[name][c['member']].append(int(choice == c['answer']))
    result = {name: statistics.mean(statistics.mean(v) for v in members.values()) for name, members in outcomes.items()}
    # With single-type lists (LIST_MEDIA) the media-type baseline ties on every list: reported, never a stop.
    stops = ('middle_mean', 'closest_printed_mean') + (() if LIST_MEDIA else ('media_type',))
    return {'accuracy': result, 'stop': not cases or any(result.get(name, 0) > .4 for name in stops)}


def freeze(population, titles, descriptions):
    cases, coverage = build(population, titles, descriptions)
    first = baselines(cases)
    if first['stop']:
        cases, coverage = build(population, titles, descriptions, rematch=True)
    final = baselines(cases)
    return {'cases': cases, 'coverage': coverage, 'initial_baselines': first, 'baselines': final,
            'ready': not final['stop'], 'cases_digest': digest(cases)}

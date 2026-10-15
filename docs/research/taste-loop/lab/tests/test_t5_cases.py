"""Split, title closure, fixed list sampling, shortcut detection and controls."""
import copy
import json
from collections import Counter

import pytest
from t5.cases import build, split, forbidden, freeze, baselines, control_payload, digest
from t5.synthetic import pack
from t5.sides import describe


@pytest.fixture(scope='module')
def made():
    p = pack()
    d = {m['token']: describe(split(m['ratings'])['early'], p['titles']) for m in p['population']}
    return p, d


def test_t5_split_bulk_and_edits():
    rows = pack(1)['population'][0]['ratings']
    # floor .7*80 = 56, a contiguous batch 53..59 must stay to the right.
    for i in range(53, 60):
        rows[i]['created_at'] = 630000 + (i - 53) * 100
        rows[i]['updated_at'] = rows[i]['created_at']
    rows[0]['updated_at'] = 9999999
    rows[1]['updated_at'] = None
    s = split(rows)
    assert s['moved'] == 3
    assert rows[0] not in s['early'] and rows[1] not in s['early']
    assert not any(r in s['early'] for r in rows[53:60])
    assert not any(r in s['later'] for r in rows[53:60])
    assert len(s['later']) == 20


def test_t5_alias_and_franchise_closure():
    titles = [{'key': 1, 'media_type': 'movie', 'movie_series_id': 8, 'aliases': [2]},
              {'key': 2, 'media_type': 'movie', 'movie_series_id': 9, 'aliases': [3]},
              {'key': 3, 'media_type': 'movie', 'movie_series_id': 10},
              {'key': 4, 'media_type': 'movie', 'movie_series_id': 8},
              {'key': 5, 'media_type': 'movie', 'movie_series_id': 10},
              {'key': 6, 'media_type': 'show', 'movie_series_id': 8},
              {'key': 7, 'media_type': 'movie', 'movie_series_id': None}]
    assert forbidden([1], titles) == {1,2,3,4,5}
    assert forbidden([7], titles) == {7}


def test_t5_cases_private_and_identical_controls(made):
    p, descriptions = made
    cases, coverage = build(p['population'], p['titles'], descriptions)
    assert coverage['primary_members'] == 18 and coverage['triples'] == 72
    for c in cases:
        payload = c['payload']
        assert set(payload) == {'description', 'lists'}
        serialized = json.dumps(payload)
        assert not any(m['token'] in serialized for m in p['population'])
        assert all(word not in serialized for word in ('created_at', 'updated_at', 'answer', 'title_key', 'member'))
        assert len(c['sources']) == len(set(c['sources'])) == 3
        for label, rows in payload['lists'].items():
            assert len(rows) == len({r['title'] for r in rows}) == 15
            assert all(set(r) == {'title','year','type','rating'} for r in rows)
        for control in ('s', 'numbers', 'none'):
            assert control_payload(c, control)['lists'] == payload['lists']
        assert control_payload(c, 'none')['description'] == ''
    rebuilt = freeze(p['population'], p['titles'], descriptions)
    assert rebuilt == freeze(list(reversed(p['population'])), list(reversed(p['titles'])), descriptions)


def test_t5_removal_empty_and_matching_failure(made):
    source, original = made
    p, d = copy.deepcopy(source), copy.deepcopy(original)
    anchor = p['population'][0]['token']
    named = d[anchor]['named_titles'][0]
    by_key = {t['key']: t for t in p['titles']}
    by_key[named]['movie_series_id'] = 909
    sibling = p['population'][0]['ratings'][60]['title_key']
    by_key[sibling]['movie_series_id'] = 909
    alias = p['population'][1]['ratings'][60]['title_key']
    by_key[sibling]['aliases'] = [alias]
    d[p['population'][2]['token']]['empty'] = True
    cases, coverage = build(p['population'], p['titles'], d)
    assert coverage['empty'] == 1 and all(c['member'] != p['population'][2]['token'] for c in cases)
    for c in cases:
        if c['member'] == anchor:
            assert not {named,sibling,alias} & {k for keys in c['selected_keys'].values() for k in keys}
    for m in p['population'][1:]:
        for r in m['ratings'][:56]:
            r['score'] = 1
    cases, coverage = build(p['population'], p['titles'], d)
    assert not any(c['member'] == anchor for c in cases)
    assert coverage['excluded']['no_pair'] >= 1


def test_t5_mean_leak_caught_and_rematch_path(made):
    p, d = made
    # Construct an intentionally leaking set: anchor always has middle mean.
    leaking = []
    for i in range(20):
        lists = {label: [{'rating': rating}] * 15 for label, rating in zip('ABC', (4,6,8))}
        leaking.append({'id': str(i), 'member': str(i), 'answer': 'B', 'printed_mean': 6,
                        'payload': {'lists': lists}})
    assert baselines(leaking)['accuracy']['middle_mean'] == 1
    assert baselines(leaking)['stop']
    # A small synthetic subset still follows the fixed switch, without position vetoes.
    small = pack(9)
    descriptions = {k:v for k,v in d.items() if k in {m['token'] for m in small['population']}}
    out = freeze(small['population'], small['titles'], descriptions)
    assert out['coverage']['rematched'] == out['initial_baselines']['stop']
    if out['baselines']['stop']:
        assert not out['ready']
    rematched, _ = build(p['population'], p['titles'], d, rematch=True)
    for c in rematched:
        means = [sum(r['rating'] for r in rows)/15 for rows in c['payload']['lists'].values()]
        assert max(means) - min(means) <= .4000001


def test_t5_no_count_caliper(made):
    p, d = copy.deepcopy(made)
    # Only the first member has 80 ratings; other histories have many more rows,
    # but identical history means, so they must remain eligible distractors.
    first = p['population'][0]['token']
    for m in p['population'][1:]:
        original = list(m['ratings'])
        m['ratings'] = [dict(r, position=j*80+i, created_at=100000+(j*80+i)*10000,
                             updated_at=100000+(j*80+i)*10000) for j in range(3) for i,r in enumerate(original)]
    cases, _ = build(p['population'], p['titles'], d)
    assert any(c['member'] == first for c in cases)


def test_t5_middle_mean_leaking_pack_forces_rematch_and_stop(made):
    p = pack(3)
    d = {m['token']: describe(split(m['ratings'])['early'], p['titles']) for m in p['population']}
    # Only the middle-mean person has a description; the others can be distractors.
    for i, member in enumerate(p['population']):
        if i:
            d[member['token']]['empty'] = True
        for row in member['ratings'][56:]:
            row['score'] = (6, 4, 8)[i]
    frozen = freeze(p['population'], p['titles'], d)
    assert frozen['initial_baselines']['accuracy']['middle_mean'] == 1
    assert frozen['coverage']['rematched'] and not frozen['ready']
    assert frozen['coverage']['primary_members'] == 0


def test_t5_bulk_window_is_not_a_chain_of_single_second_writes():
    rows = pack(1)['population'][0]['ratings']
    for i in range(56,66):
        rows[i]['created_at'] = rows[i]['updated_at'] = 660000+(i-56)*1000
    s=split(rows)
    assert s['moved'] == 0 and len(s['later']) == 24


def test_t5_anchor_centred_leak_is_cured_by_balanced_rank_rematch():
    p = pack(30)
    descriptions = {m['token']: {'text': 'invented', 'empty': False, 'named_titles': [],
                                 'numbers_only': '9', 'printed_mean': 9} for m in p['population']}
    # Early and displayed means correlate perfectly. Nearest-to-anchor pairs put
    # the anchor in the middle even though no description carries identity.
    for i, member in enumerate(p['population']):
        for row in member['ratings']:
            row['score'] = 5.7 + .02 * i
    out = freeze(p['population'], p['titles'], descriptions)
    assert out['initial_baselines']['accuracy']['middle_mean'] > .4
    assert out['coverage']['rematched'] and out['ready']
    assert out['coverage']['primary_members'] >= 20
    assert out['baselines']['accuracy']['middle_mean'] <= .4
    assert out['baselines']['accuracy']['closest_printed_mean'] <= .4
    for member in {c['member'] for c in out['cases']}:
        ranks = Counter(c['displayed_mean_rank'] for c in out['cases'] if c['member'] == member)
        assert set(ranks) == {0, 1, 2} and max(ranks.values()) - min(ranks.values()) <= 1
    for c in out['cases']:
        means = [sum(r['rating'] for r in rows) / 15 for rows in c['payload']['lists'].values()]
        assert max(means) - min(means) <= .2 + 1e-12


def test_t5_answer_labels_balanced_by_construction(made):
    p, descriptions = made
    for rematch in (False, True):
        cases, _ = build(p['population'], p['titles'], descriptions, rematch=rematch)
        assert cases
        for member in {c['member'] for c in cases}:
            answers = [c['answer'] for c in cases if c['member'] == member]
            counts = [answers.count(label) for label in 'ABC']
            assert max(counts) - min(counts) <= 1
            assert len(answers) >= 3


def test_t5_position_baselines_reported_without_stopping():
    cases = []
    for i, answer in enumerate('AAABBBCCC'):
        # Every answer is A, but mean baselines each win only 1/3 of cases.
        means = {'A': 4, 'B': 6, 'C': 8}
        means[answer], means['B'] = means['B'], means[answer]
        cases.append({'id': str(i), 'member': str(i), 'answer': 'A', 'printed_mean': 6,
                      'payload': {'lists': {k: [{'rating': v}] * 15 for k, v in means.items()}}})
    out = baselines(cases)
    assert out['accuracy']['position_A'] == 1
    assert out['accuracy']['middle_mean'] == 1 / 3
    assert not out['stop']


def test_t5_matching_cost_ignores_count(made, monkeypatch):
    from t5 import cases as module
    p, descriptions = made
    before, _ = build(p['population'], p['titles'], descriptions)
    original = module.split
    def changed_count(rows):
        value = original(rows)
        value['n'] *= 1 + rows[0]['title_key'] % 17
        return value
    monkeypatch.setattr(module, 'split', changed_count)
    after, _ = build(p['population'], p['titles'], descriptions)
    assert before == after


def test_t5_edited_labels_include_distractor_lists(made):
    p, descriptions = copy.deepcopy(made)
    for member in p['population'][1:]:
        for row in member['ratings'][56:]:
            row['edited'] = True
    cases, _ = build(p['population'], p['titles'], descriptions)
    assert all(c['edited_labels'] >= 30 for c in cases if c['member'] == p['population'][0]['token'])

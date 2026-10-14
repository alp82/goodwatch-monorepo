"""Item 006 regressions; made-up arrays and files only."""
import copy
import json
from pathlib import Path

import numpy as np
import pytest

import run
import score
import table
from common import harness_sha256, sha256_file
from test_stats_score import t2a_answers, t2a_table


def test_edits_after_freezing_cannot_change_later_batches(tmp_path, monkeypatch):
    candidate, reference = tmp_path / 'candidate.py', tmp_path / 'reference.py'
    candidate.write_text('version = 1\n')
    reference.write_text('reference = 1\n')
    record = lambda p: {'path': str(p), 'sha256': sha256_file(p)}
    line = {'predictor': record(candidate), 'refs': [record(reference)], 'harness_sha256': harness_sha256()}
    folder = tmp_path / 'run'
    folder.mkdir()
    frozen = run.freeze_files(str(folder), line, str(candidate), [str(reference)])
    seen = []

    def worker(predictor, sha, vids, *args):
        seen.append(Path(predictor).read_text())
        assert sha256_file(predictor) == line['predictor']['sha256']
        candidate.write_text('version = 2\n')
        reference.write_text('reference = 2\n')
        for vid in vids:
            args[-1](vid, {'peak_mb': 1, 'attempts': [], 'answer': {}})
        return dict.fromkeys(run.FULL_SANDBOX, True)

    monkeypatch.setattr(run, '_worker', worker)
    monkeypatch.setattr(score, 'check_answer', lambda *_: {'rank': np.array([0.5]), 'score': None, 'p_low': None})
    monkeypatch.setattr(run.views, 'n_targets', lambda _: 1)
    index = [{'vid': str(i), 'kind': 'main'} for i in range(2)]
    run.run_predictor(frozen[str(candidate)], index, {'0': {}, '1': {}}, str(folder), '',
                      str(tmp_path / 'log'), reduce=lambda *args: {'score': None, 'p_low': None}, batch=1)
    assert seen == ['version = 1\n', 'version = 1\n']
    assert Path(frozen[str(reference)]).read_text() == 'reference = 1\n'


def test_freeze_refuses_a_hash_that_is_not_the_copied_bytes(tmp_path):
    source = tmp_path / 'candidate.py'
    source.write_text('version = 2\n')
    with pytest.raises(run.Refused, match='changed while freezing'):
        run.freeze_files(str(tmp_path), {'predictor': {'path': str(source), 'sha256': '0' * 64},
                                        'refs': []}, str(source), [])


@pytest.mark.parametrize('key', ['harness_sha256', 'predictor', 'refs', 'pack', 'pack_sha256',
                               'titles_sha256', 'options', 'views'])
def test_resume_refuses_each_changed_identity_field(tmp_path, key):
    identity = dict.fromkeys(['harness_sha256', 'predictor', 'refs', 'pack', 'pack_sha256',
                             'titles_sha256', 'options', 'views'], 'original')
    pending = tmp_path / 'pending.json'
    pending.write_text(json.dumps(identity))
    run.check_resume(str(pending), identity)
    changed = copy.deepcopy(identity)
    changed[key] = 'changed'
    with pytest.raises(run.Refused, match=key):
        run.check_resume(str(pending), changed)


def test_same_sample_drops_titles_and_members_before_all_three_comparisons():
    member = np.repeat([0, 1, 2], 12)
    y = np.tile([9] * 6 + [4] * 6, 3)
    t = t2a_table(member, y, view=member)
    p = t2a_answers(np.where(y >= 8, 0.9, 0.1), 3)
    p['pct_popular'] = np.where(y >= 8, 0.8, 0.2)
    p['pct_both'] = np.where(y >= 8, 0.7, 0.3)
    p['pct_both'][[0, 12, 13, 24]] = np.nan
    r = t2a_answers(np.full(len(y), 0.5), 3)
    r['pct_both'][~np.isfinite(p['pct_both'])] = np.nan
    check = score.t2a_retained_check(t, {'r': r, 'p': p}, 'r', 0, np.array([True] * 3), 100, 1)
    assert check['counts']['others']['high'] == {'titles': 9, 'members': 1}
    assert check['counts']['others']['low'] == {'titles': 12, 'members': 2}
    assert check['counts']['others']['separation_members'] == 1
    assert check['counts']['owner']['high'] == {'titles': 5, 'members': 1}
    for kind, expected in [('plain', 0.8), ('popular', 0.6), ('both', 0.4)]:
        assert check['vs_b2']['p'][kind]['n'] == 1
        assert check['vs_b2']['p'][kind]['diff'] == pytest.approx(expected)
    assert check['main_small_members']['p']['n'] == 2
    assert table.both_counts(check, 'others') == ('high: 9 titles / 1 members; mid: 0 titles / 0 members; '
                                                'low: 12 titles / 2 members; separation: 1 members')
    assert table.t2b_both('0.500', {'n_targets': 12, 'both_under_min': 3, 'pct_both': {'n': 2}}) == \
        '0.500 (9 targets / 2 members; both_under_min: 3)'


def test_t2b_owner_counts_one_member_rather_than_retained_titles():
    owner = {'n_targets': 80, 'both_under_min': 10, 'sittings': 12,
             'pct_both': {'value': 0.6, 'n': 70}}
    assert table.t2b_both('0.600', owner) == '0.600 (70 targets / 1 members; both_under_min: 10)'


def test_supplemental_rows_cannot_change_existing_figures():
    base = {'run_id': 'old', 'mode': 'ladder', 'status': 'ok', 'task': 'T2a', 'tier': 'A',
            'options': {'members': 'all', 'others': 'all', 'shuffle_seed': None, 'plant': None},
            'predictor': {'path': table.PATH['B2'], 'sha256': 'predictor'}, 'pack_sha256': 'pack',
            'titles_sha256': 'titles', 'harness_sha256': 'old', 'views': {'digest': 'views'},
            'measures': {'others': {'separation': {'value': 0.2}}}}
    extra = copy.deepcopy(base)
    extra['options']['retained_check'] = True
    extra['harness_sha256'] = 'new'
    extra['refs'] = []
    extra['retained_check'] = {'raw': {table.PATH['B2']: {'others': {'separation': {'value': 0.3}}}}}
    with pytest.raises(table.Mixed, match='supplemental B2 others separation differs'):
        table.build_t2a([base, extra])


def test_missing_popularity_matches_are_left_out_of_every_same_sample_column():
    member = np.repeat([0, 1, 2], 12)
    y = np.tile([9] * 6 + [4] * 6, 3)
    t = t2a_table(member, y, view=member)
    p, r = t2a_answers(np.where(y >= 8, 0.9, 0.1), 3), t2a_answers(np.full(len(y), 0.5), 3)
    p['pct_popular'][[12, 13]] = r['pct_popular'][[12, 13]] = np.nan
    check = score.t2a_retained_check(t, {'r': r, 'p': p}, 'r', 0, np.array([True] * 3), 100, 1)
    assert check['counts']['others']['separation_members'] == 2
    assert check['comparison_counts']['others']['separation_members'] == 1
    assert all(check['vs_b2']['p'][kind]['n'] == 1 for kind in ('plain', 'popular', 'both'))

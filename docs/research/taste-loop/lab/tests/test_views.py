import os

import numpy as np

import views


def build(pack, tmp_path, **kw):
    out = str(tmp_path / 'run')
    index, keys, digest = views.build_t1(pack, out, **kw)
    views.export_titles(pack, os.path.join(out, 'titles.npz'))
    return out, index, keys, digest


def test_a_view_holds_nothing_of_the_hidden_ratings(pack, tmp_path):
    out, index, keys, _ = build(pack, tmp_path)
    titles = views.load_titles(os.path.join(out, 'titles.npz'))
    r = pack.ratings
    title_row = pack.title_index(r['title_key'])
    mains = [v for v in index if v['kind'] == 'main']
    assert len(mains) > 50
    for v in mains:
        folder = os.path.join(out, 'views', v['vid'])
        assert sorted(os.listdir(folder)) == ['others.bin', 'view.bin']
        view = views.load_view(folder, titles)
        u = v['member']
        mine = np.flatnonzero(r['member'] == u)
        targets = view['targets']['title']
        assert list(view['targets']) == ['title']                      # no rating, no time, no order
        assert (np.diff(titles['key'][targets]) > 0).all()             # sorted by title key, not by entry order
        t_at = np.array([mine[title_row[mine] == t][0] for t in targets])
        cutoff = r['created_at'][t_at].min()
        me = view['me']['ratings']
        assert not set(me['title'].tolist()) & set(targets.tolist())
        assert (me['created_at'] < cutoff).all()
        c, first = len(me['title']), int(r['position'][t_at].min())
        assert (me['position'] == np.arange(c)).all()                  # everything before the block, nothing after
        assert c <= first and r['in_bulk'][mine][c:first].all()        # only bulk rows between history and targets
        for table in ('want_to_see', 'skip', 'not_interested'):
            assert (view['me'][table]['created_at'] < cutoff).all()
        assert not r['in_bulk'][t_at].any()                            # bulk writes are never targets
        for table in view['others'].values():
            assert u not in set(table['member'].tolist())              # leave one member out
        assert (keys[v['vid']]['score'] == r['score'][t_at]).all()
        # no array in the view files equals the answers
        if len(targets) >= 6:
            for name in ('view.bin', 'others.bin'):
                for k, a in views.load_arrays(os.path.join(folder, name)).items():
                    assert not (a.shape == targets.shape and a.dtype.kind in 'iu'
                                and (a == keys[v['vid']]['score']).all()), (name, k)
    # nothing under the run folder but views, the others files and the title file
    assert sorted(os.listdir(out)) == ['others', 'titles.npz', 'views']


def test_every_tier_b_member_is_absent_from_others(pack, tmp_path):
    out, index, keys, _ = build(pack, tmp_path)
    titles = views.load_titles(os.path.join(out, 'titles.npz'))
    view = views.load_view(os.path.join(out, 'views', index[0]['vid']), titles)
    tier = pack.members['tier']
    for table in view['others'].values():
        assert (tier[table['member']] == 0).all()
    assert 'touched' not in titles and 'emb_row' not in titles


def test_calibration_views_hide_one_fold_of_the_history(pack, tmp_path):
    out, index, keys, _ = build(pack, tmp_path)
    titles = views.load_titles(os.path.join(out, 'titles.npz'))
    main = next(v for v in index if v['kind'] == 'main' and v['block'] == 20)
    cals = [v for v in index if v['parent'] == main['vid']]
    assert len(cals) == views.FOLDS
    full = views.load_view(os.path.join(out, 'views', main['vid']), titles)
    history = set(full['me']['ratings']['title'].tolist())
    seen = []
    for c in cals:
        view = views.load_view(os.path.join(out, 'views', c['vid']), titles)
        fold = set(view['targets']['title'].tolist())
        assert fold <= history
        assert set(view['me']['ratings']['title'].tolist()) == history - fold
        assert len(keys[c['vid']]['score']) == len(fold)
        seen += sorted(fold)
    assert sorted(seen) == sorted(history)                             # every history title is hidden exactly once
    small = next(v for v in index if v['kind'] == 'main' and v['block'] == 5)
    assert not [v for v in index if v['parent'] == small['vid']]       # under 10 ratings: no calibration views


def test_views_are_the_same_on_a_second_build(pack, tmp_path):
    a = views.build_t1(pack, str(tmp_path / 'a'))
    b = views.build_t1(pack, str(tmp_path / 'b'), write=False)
    assert a[2] == b[2] and [v['vid'] for v in a[0]] == [v['vid'] for v in b[0]]


def test_shuffled_labels_keep_each_member_s_ratings(pack):
    r = pack.ratings
    s = views.shuffled_scores(r, 7)
    assert (s != r['score']).mean() > 0.5
    for u in np.unique(r['member']):
        assert sorted(s[r['member'] == u]) == sorted(r['score'][r['member'] == u])
    a = views.build_t1(pack, '', write=False)
    b = views.build_t1(pack, '', write=False, shuffle_seed=7)
    assert a[2] != b[2]


def test_others_modes(pack, tmp_path):
    titles_path = str(tmp_path / 'titles.npz')
    views.export_titles(pack, titles_path)
    titles = views.load_titles(titles_path)
    u = int(np.flatnonzero(~pack.members['is_owner'] & (pack.members['tier'] == 0)
                           & (np.bincount(pack.ratings['member'], minlength=len(pack.members['tier'])) >= 12))[0])
    out = str(tmp_path / 'no-owner')
    index, _, _ = views.build_t1(pack, out, members=[u], others_mode='no-owner')
    view = views.load_view(os.path.join(out, 'views', index[0]['vid']), titles)
    assert pack.owner not in set(view['others']['ratings']['member'].tolist())
    out = str(tmp_path / 'before')
    index, _, _ = views.build_t1(pack, out, members=[u], others_mode='before')
    for v in index:
        view = views.load_view(os.path.join(out, 'views', v['vid']), titles)
        cutoff = pack.ratings['created_at'][pack.ratings['member'] == u][len(view['me']['ratings']['title'])] \
            if v['kind'] == 'main' else np.inf
        assert (view['others']['ratings']['created_at'] < cutoff).all()


def test_gate_members_are_predicted_from_tier_a(pack, world, tmp_path):
    import pickle
    gate = pickle.load(open(os.path.join(os.path.dirname(os.path.dirname(world['pack_dir'])), 'gate', 'synth',
                                         'gate.pkl'), 'rb'))['ratings']
    out = str(tmp_path / 'gate')
    index, keys, _ = views.build_t1(pack, out, own=gate)
    titles_path = str(tmp_path / 'titles.npz')
    views.export_titles(pack, titles_path)
    titles = views.load_titles(titles_path)
    tier = pack.members['tier']
    assert index and all(tier[v['member']] == 1 for v in index)
    view = views.load_view(os.path.join(out, 'views', index[0]['vid']), titles)
    others = view['others']['ratings']['member']
    assert (tier[others] == 0).all() and len(np.unique(others)) == len(np.unique(pack.ratings['member']))

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
        first = int(r['position'][t_at].min())
        c = int(me['position'].max()) + 1 if len(me['position']) else 0
        # everything before the block except ratings edited at or after its first rating, and nothing after
        early = mine[:c]
        kept = early[r['updated_at'][early] < cutoff]
        assert (me['position'] == r['position'][kept]).all() and (me['score'] == r['score'][kept]).all()
        assert (r['updated_at'][mine[me['position']]] < cutoff).all()
        # between the history and the targets: only bulk rows, or rows edited later
        assert c <= first and (r['in_bulk'][mine][c:first] | (r['updated_at'][mine][c:first] >= cutoff)).all()
        assert (keys[v['vid']]['history_score'] == me['score']).all()
        assert (keys[v['vid']]['edited'] == r['edited'][t_at]).all()
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
        if v['kind'] == 'main':                                        # and nothing that was edited since
            shown = set(zip(view['others']['ratings']['member'].tolist(), view['others']['ratings']['title'].tolist()))
            r, row = pack.ratings, pack.title_index(pack.ratings['title_key'])
            late = (r['member'] != u) & (r['created_at'] < cutoff) & (r['updated_at'] >= cutoff)
            assert late.any() and not shown & set(zip(r['member'][late].tolist(), row[late].tolist()))


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


def test_history_edited_after_the_cutoff_is_left_out_and_edited_targets_are_flagged(pack, tmp_path):
    out, index, keys, _ = build(pack, tmp_path)
    titles = views.load_titles(os.path.join(out, 'titles.npz'))
    r = pack.ratings
    row = pack.title_index(r['title_key'])
    assert r['edited'].sum() > 20                                      # the made-up pack has ratings edited later
    left_out = flagged = 0
    for v in [v for v in index if v['kind'] == 'main']:
        view = views.load_view(os.path.join(out, 'views', v['vid']), titles)
        mine = np.flatnonzero(r['member'] == v['member'])
        c = int(r['position'][mine][np.isin(row[mine], view['targets']['title'])].min())
        cutoff = r['created_at'][mine][c]
        edited_history = set(row[mine][:c][r['updated_at'][mine][:c] >= cutoff].tolist())
        assert not edited_history & set(view['me']['ratings']['title'].tolist())
        left_out += len(edited_history)
        flagged += int(keys[v['vid']]['edited'].sum())
        for c_view in [x for x in index if x['parent'] == v['vid']]:   # nor is it a calibration title
            cal = views.load_view(os.path.join(out, 'views', c_view['vid']), titles)
            assert not edited_history & (set(cal['targets']['title'].tolist())
                                         | set(cal['me']['ratings']['title'].tolist()))
    assert left_out > 10 and flagged > 10


def test_a_bulk_write_after_a_block_start_is_neither_target_nor_history_of_that_block(pack, tmp_path):
    """The rule the real pack never exercises (all its bulk writes lie before the first block): a member types 12
    ratings, writes 10 in one moment, then types on. Through build_t1, on the made-up pack."""
    import copy
    counts = np.bincount(pack.ratings['member'], minlength=len(pack.members['tier']))
    u = int(np.flatnonzero((counts >= 45) & ~pack.members['is_owner'])[0])
    made = copy.copy(pack)
    r = {c: v.copy() for c, v in pack.ratings.items()}
    at = np.flatnonzero(r['member'] == u)
    n = len(at)
    t = 1_700_000_000_000 + 5000 * np.arange(n)
    t[12:22] = t[12]                                                   # ratings 12 to 21 written in one moment
    t[22:] = t[12] + 5000 * np.arange(1, n - 21)
    r['created_at'][at], r['updated_at'][at] = t, t
    r['in_bulk'][at] = (np.arange(n) >= 12) & (np.arange(n) < 22)
    r['provenance'][at] = r['in_bulk'][at].astype(np.uint8)
    r['edited'][at] = False
    made.ratings = r
    cuts = dict((b, c) for c, b in views.t1_cuts(t, r['in_bulk'][at]))
    assert cuts[10] == 10 and cuts[20] == 22                           # the bulk write starts after block 10 does
    out = str(tmp_path / 'bulk')
    index, keys, _ = views.build_t1(made, out, members=[u])
    views.export_titles(made, os.path.join(out, 'titles.npz'))
    titles = views.load_titles(os.path.join(out, 'titles.npz'))
    row = made.title_index(r['title_key'][at])
    bulk_titles = set(row[12:22].tolist())
    main = {v['block']: v for v in index if v['kind'] == 'main'}
    ten = views.load_view(os.path.join(out, 'views', main[10]['vid']), titles)
    assert sorted(ten['targets']['title'].tolist()) == sorted(row[10:12].tolist())       # the two typed ratings
    assert set(ten['me']['ratings']['title'].tolist()) == set(row[:10].tolist())        # the bulk write is not history
    assert sorted(keys[main[10]['vid']]['score'].tolist()) == sorted(r['score'][at][10:12].tolist())
    twenty = views.load_view(os.path.join(out, 'views', main[20]['vid']), titles)
    assert set(twenty['me']['ratings']['title'].tolist()) == set(row[:22].tolist())     # history of the next block
    assert twenty['me']['ratings']['in_bulk'].sum() == 10
    for v in index:                                                    # never a target, in any view
        view = views.load_view(os.path.join(out, 'views', v['vid']), titles)
        if v['kind'] == 'main':
            assert not bulk_titles & set(view['targets']['title'].tolist())
    assert sum(len(keys[v['vid']]['score']) for v in index if v['kind'] == 'main') == n - 5 - 10

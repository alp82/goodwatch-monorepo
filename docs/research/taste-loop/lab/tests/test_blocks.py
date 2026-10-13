import numpy as np

import views


def times(gaps):
    return np.cumsum(np.r_[0, gaps]).astype(np.int64)


def test_plain_member_is_cut_at_the_nominal_boundaries():
    t = times([5000] * 29)
    cuts = views.t1_cuts(t, np.zeros(30, bool))
    assert cuts == [(5, 5), (10, 10), (20, 20)]
    blocks = views.t1_blocks(t, np.zeros(30, bool))
    assert [(c, e) for c, e, _, _ in blocks] == [(5, 10), (10, 20), (20, 30)]
    assert sum(len(tg) for *_, tg in blocks) == 25


def test_a_cut_never_splits_ratings_written_within_two_seconds():
    gaps = [5000] * 29
    gaps[3], gaps[4], gaps[5] = 500, 500, 500          # ratings 3, 4, 5, 6 form one group
    cuts = views.t1_cuts(times(gaps), np.zeros(30, bool))
    assert cuts[0] == (7, 5)                           # 5 is inside the group; 3 is below 5, so the cut moves to 7


def test_tie_goes_to_the_later_place():
    gaps = [5000] * 39
    for i in (8, 9, 10):                               # ratings 8..11 form one group: cuts 9, 10, 11 are not allowed
        gaps[i] = 100
    cuts = dict((b, c) for c, b in views.t1_cuts(times(gaps), np.zeros(40, bool)))
    assert cuts[10] == 12                              # 8 and 12 are equally near; the later one


def test_bulk_writes_are_history_and_never_targets():
    gaps = [5000] * 49
    for i in range(12, 21):
        gaps[i] = 0                                    # ratings 12..21 written in the same moment
    t = times(gaps)
    bulk = np.zeros(50, bool)
    bulk[12:22] = True
    blocks = views.t1_blocks(t, bulk)
    for c, e, _, targets in blocks:
        assert not bulk[targets].any()
        assert not (12 < c < 22)
    cuts = dict((b, c) for c, b in views.t1_cuts(t, bulk))
    assert cuts[20] == 22                              # 20 is inside the bulk write; 22 is nearer than 12


def test_two_boundaries_that_land_on_one_place_make_one_block():
    gaps = [100] * 30 + [5000] * 30                    # the first 31 ratings are one group
    gaps[2] = 5000                                     # a place below 5 is never used
    cuts = views.t1_cuts(times(gaps), np.zeros(61, bool))
    assert [c for c, _ in cuts] == [31, 40]
    assert cuts[0][1] == 5


def test_six_ratings_give_one_target():
    blocks = views.t1_blocks(times([5000] * 5), np.zeros(6, bool))
    assert [(c, e, len(tg)) for c, e, _, tg in blocks] == [(5, 6, 1)]

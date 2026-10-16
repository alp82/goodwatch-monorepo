"""The owner's #674 pass rule: Astra's share interval above chance and above numbers only (Q67), controls as a
shortcut guard."""
from t5.score import astra_share_rule, _clear


def summary(lo):
    return {'share': {'value': lo + .1, 'lo': lo, 'hi': lo + .2}}


def primary(s, numbers=.1, none=.1, permuted=.1, haiku=.0, gap_lo=.05):
    astra = {'s': summary(s), 'numbers': summary(numbers), 'none': summary(none), 'permuted': summary(permuted),
             's_minus_numbers': {'diff': gap_lo + .1, 'lo': gap_lo, 'hi': gap_lo + .2}}
    weak = {k: summary(haiku) for k in ('s', 'numbers', 'none', 'permuted')}
    return {'members': 11, 'readers': {'astra': astra, 'haiku': weak}}


def test_t5_astra_clear_passes_whatever_haiku_does():
    assert astra_share_rule(primary(.40, haiku=0.0))['pass']


def test_t5_lower_bound_must_be_strictly_above_chance():
    assert not _clear(summary(1 / 3))
    assert not astra_share_rule(primary(1 / 3))['pass']
    assert astra_share_rule(primary(1 / 3 + 1e-6))['pass']


def test_t5_a_clear_control_blocks_the_pass_as_a_shortcut():
    out = astra_share_rule(primary(.6, numbers=.35))
    assert not out['pass'] and out['shortcut_controls'] == ['numbers']


def test_t5_no_members_never_passes():
    p = primary(.6)
    p['members'] = 0
    assert not astra_share_rule(p)['pass']


def test_t5_s_must_also_beat_numbers_only():
    assert not astra_share_rule(primary(.6, gap_lo=0.0))['pass']
    assert not astra_share_rule(primary(.6, gap_lo=-.05))['pass']
    out = astra_share_rule(primary(.6, gap_lo=1e-6))
    assert out['pass'] and out['astra_beats_numbers']


def test_t5_beating_numbers_without_clearing_chance_fails():
    out = astra_share_rule(primary(.30, gap_lo=.2))
    assert out['astra_beats_numbers'] and not out['pass']

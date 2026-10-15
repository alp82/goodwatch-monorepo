"""Statement-list corrections on invented catalogs/history only; no reader calls."""
import copy
import hashlib
import os
from pathlib import Path
import subprocess
import sys

import numpy as np
import pytest

from t5.statements import Catalog, render
from t5.statements import artifact, feats, franchise, lib, trust
from t5.statements.data import AUD, CRAFT, CRIT, encoded, from_pack
from t5.statements.render import trust_lines


@pytest.fixture(scope='module')
def catalog():
    rng = np.random.default_rng(713)
    n = 360
    keys = np.arange(10001, 10001+n, dtype=np.int64)
    fp_keys = tuple(f'attribute_{j}' for j in range(66)) + CRAFT
    centers = rng.uniform(1, 9, (6, 74))
    fp = np.clip(centers[np.arange(n) % 6] + rng.normal(0, .4, (n, 74)), 0, 10)
    fp[0, 0] = 255
    infos = {}
    for i, key in enumerate(keys):
        q = 30 + i % 61
        info = dict(title=f'Invented title {i}', aliases=[f'Made-up alias {i}'], media_type='movie',
                    release_year=1970+i % 55, release_date=f'{1970+i % 55}-01-01',
                    movie_series_id=None, production_method='Animation' if i % 3 == 0 else 'Live action',
                    is_anime=False, original_language_code='en' if i % 3 else 'fr',
                    keywords=[f'tag{(i+j*j) % 45}' for j in range(6)],
                    tropes=[f'trope{i % 23}', f'trope{(i+9) % 23}'], essence_tags=[f'feeling {i % 19}'],
                    context_is_comfort_watch=bool(i % 2))
        info.update({name: q for name in AUD})
        info.update({name: q+((i % 7)-3)*2 for name in CRIT})
        infos[int(key)] = info
    pool = np.ones(n, bool)
    pool[-12:] = False
    has_fp = np.ones(n, bool)
    has_fp[-1] = False
    return Catalog(keys, fp, fp_keys, pool, has_fp, infos)


@pytest.fixture(scope='module')
def model(catalog):
    return artifact.fit(catalog)


@pytest.fixture(scope='module')
def features(catalog, model):
    return feats.build(catalog, model)


def quality_ratings(features):
    return np.clip(2 + .75*features.quality + .12*np.sin(features.catalog.keys), 1, 10)


def test_franchise_evidence_distinguishes_every_unknown(catalog):
    c = copy.deepcopy(catalog)
    # Title numbers and a sequel keyword must never manufacture evidence.
    c.info[10001].update(title='Standalone 2', keywords=['sequel'])
    c.info[10002].update(movie_series_id=7, release_date='2000-01-01')
    c.info[10003].update(movie_series_id=7, release_date='2001-01-01')
    c.complete_series[7] = [10002, 10003]
    # An apparent original whose earlier entry is absent is not a certified first.
    c.info[10004].update(movie_series_id=8, release_date='2005-01-01')
    c.complete_series[8] = [99999, 10004]
    c.info[10005].update(movie_series_id=9, release_date='2000-01-01')
    c.info[10006].update(movie_series_id=9, release_date='2000-01-01')
    c.complete_series[9] = [10005, 10006]
    c.info[10007].update(movie_series_id=10, release_date=None)
    c.info[10008].update(movie_series_id=10, release_date='2000-01-01')
    c.info[10009].update(movie_series_id=7, media_type='show')
    values, states = franchise.classify(c)
    assert states[:9] == ('missing_membership', 'first_confirmed', 'later',
                          'earliest_observed_incomplete', 'tied_date', 'tied_date',
                          'missing_date', 'incomplete_order', 'not_movie')
    assert values[1:3].tolist() == [0, 1]
    assert np.isnan(values[[0, 3, 4, 5, 6, 7, 8]]).all()
    # A strictly earlier known entry establishes later even with incomplete membership.
    c.complete_series.clear()
    values, states = franchise.classify(c)
    assert np.isnan(values[1]) and values[2] == 1
    assert states[1] == 'earliest_observed_incomplete'
    assert franchise.LABEL == 'a later movie in a franchise'


def test_kinds_and_text_fit_only_pool_with_frozen_recipe(catalog, model):
    assert model['recipe']['k'] == 6 and model['recipe']['n_init'] == 10
    assert model['recipe']['random_state'] == 0 and model['recipe']['text_seed'] == 20261013
    assert np.asarray(model['centers']).shape == (6, 66)
    assert np.asarray(model['components']).shape[0] == 16
    assert model['fp_keys'] == list(catalog.fp_keys[:66])
    assert model['pool_keys'] == catalog.keys[catalog.pool].tolist()
    assert len(model['memberships']) == 348
    assert all(len(k) == 3 for k in model['exemplars'])
    assert set(sum(model['exemplars'], [])).issubset(model['pool_keys'])
    c = copy.deepcopy(catalog)
    c.fingerprint[~c.pool] = 10000
    for key in c.keys[~c.pool]:
        c.info[int(key)]['keywords'] = ['NEVER IN POOL']
        c.info[int(key)]['title'] = 'UNSEEN NAME'
    other = artifact.fit(c)
    for field in ('centers', 'memberships', 'mean', 'sd', 'kind_names', 'exemplars',
                  'components', 'idf', 'vocabulary', 'theme_names', 'text_mean', 'text_sd'):
        assert other[field] == model[field], field
    assert 'never in pool' not in ' '.join(other['vocabulary'])
    labels, axes = artifact.transform(catalog, model)
    assert labels[catalog.pool].tolist() == model['memberships']
    assert axes.shape == (len(catalog.keys), 16) and np.isfinite(axes).all()
    # Missing-as-pool-mean differs deliberately from S's missing-as-zero.
    assert model['mean'][0] == pytest.approx(np.nanmean(catalog.fingerprint[catalog.pool, 0]))
    assert model['mean'][0] > 0


def test_artifact_is_identical_on_rerun_private_and_refuses_changed_hash(catalog, model, tmp_path):
    again = artifact.fit(catalog)
    assert encoded(again) == encoded(model)
    path, sha = artifact.save(model, tmp_path / 'data')
    assert path.parent.name == sha
    assert os.stat(path).st_mode & 0o777 == 0o600
    assert os.stat(path.parent).st_mode & 0o777 == 0o700
    assert os.stat(path.parent.parent).st_mode & 0o777 == 0o700
    assert artifact.save(again, tmp_path / 'data') == (path, sha)
    assert artifact.load(path, sha, catalog) == model
    with pytest.raises(ValueError, match='hash changed'):
        artifact.load(path, '0'*64, catalog)
    path.write_bytes(path.read_bytes() + b' ')
    with pytest.raises(ValueError, match='hash changed'):
        artifact.load(path, sha, catalog)
    with pytest.raises(ValueError, match='artifact changed'):
        artifact.save(model, tmp_path / 'data')
    with pytest.raises(ValueError, match='outside the repository'):
        artifact.save(model, Path(artifact.__file__).parent / 'forbidden-artifacts')


def test_reordered_catalog_joins_by_title_key(catalog, model):
    permutation = np.random.default_rng(6).permutation(len(catalog.keys))
    c = Catalog(catalog.keys[permutation], catalog.fingerprint[permutation], catalog.fp_keys,
                catalog.in_pool[permutation], catalog.has_fingerprint[permutation], catalog.info)
    assert c.identity() == catalog.identity()
    assert artifact.fit(c) == model
    changed = copy.deepcopy(c)
    changed.fingerprint[0, 1] += .1
    with pytest.raises(ValueError, match='catalog hash changed'):
        artifact.transform(changed, model)


def test_franchises_stay_in_five_deterministic_folds(catalog):
    c = copy.deepcopy(catalog)
    for key in c.keys[:10]:
        c.info[int(key)]['movie_series_id'] = 123
    assignment = trust.folds(c, c.keys)
    assert set(assignment) == set(range(5))
    assert len(set(assignment[:10])) == 1
    assert assignment.tolist() == trust.folds(c, c.keys).tolist()
    order = np.arange(len(c.keys))[::-1]
    assert assignment[order].tolist() == trust.folds(c, c.keys[order]).tolist()


def test_held_out_rating_and_entire_fold_never_change_own_prediction(features):
    keys = features.catalog.keys[:250]
    y = quality_ratings(features)[:250]
    first = trust.cross_fit(features, keys, y)
    assert first.table is not None
    changed = y.copy()
    held_out = first.folds == first.folds[13]
    changed[held_out] = 10 - y[held_out] / 2
    second = trust.cross_fit(features, keys, changed)
    np.testing.assert_array_equal(first.predictions[held_out], second.predictions[held_out])
    # Check every fold against a fresh full-pipeline refit, including the usual rating.
    for fold in range(5):
        train, test = first.folds != fold, first.folds == fold
        refit = lib.fit(features, features.catalog.rows(keys[train]), y[train])
        np.testing.assert_array_equal(first.predictions[test], refit.predict(features.catalog.rows(keys[test])))
    assert any(s.family == 'quality' for s in lib.fit(features, np.arange(250), y).statements)


def test_crossfit_fallback_is_training_median_and_suppressed(features):
    keys = features.catalog.keys[:35]
    y = quality_ratings(features)[:35]
    checked = trust.cross_fit(features, keys, y)
    for fold in range(5):
        assert (checked.predictions[checked.folds == fold] == np.median(y[checked.folds != fold])).all()
    assert checked.table is None and len(checked.fallback_folds) == 5
    p = lib.fit(features, np.arange(35), y)
    assert p.fallback and p.usual == np.median(y)


def test_single_franchise_cannot_train_on_its_own_labels(catalog, model):
    c = copy.deepcopy(catalog)
    for key in c.keys[:40]:
        c.info[int(key)]['movie_series_id'] = 888
    changed_model = dict(model, catalog_sha256=c.identity())
    f = feats.build(c, changed_model)
    checked = trust.cross_fit(f, c.keys[:40], np.full(40, 7))
    assert checked.table is None and np.isnan(checked.predictions).all()


def test_bands_have_counts_tie_breaks_and_one_in_248_never_rounds_to_zero():
    keys = np.arange(744)[::-1]
    predictions = np.repeat([3., 6., 9.], 248)
    y = np.full(744, 8.)
    y[500] = 5
    table, reason = trust.bands(keys, y, predictions)
    assert reason is None and [r['n'] for r in table] == [248]*3
    assert len(set(sum([r['title_keys'] for r in table], []))) == 744
    assert table[0]['title_keys'] == sorted(keys[:248].tolist())
    top = table[2]
    assert top['low_count'] == 1 and top['low_fraction'] == 1/248
    assert top['wilson'][0] > 0 and top['wilson'][1] > 1/248
    text = '\n'.join(trust_lines(table))
    assert '1/248 (0.4%; Wilson 95% interval' in text
    assert 'safe' not in text and len(trust_lines(table)) == 4
    for n in (0, 12, 29):
        assert trust.bands(np.arange(n), np.ones(n)*7, np.arange(n))[0] is None
    assert trust.bands(np.arange(30), np.ones(30)*7, np.ones(30)*6)[0] is None
    assert trust.bands(np.arange(30), np.ones(30)*7, np.linspace(6, 6.14, 30))[0] is None
    table, _ = trust.bands(np.arange(31), np.ones(31)*7, np.arange(31))
    assert [r['n'] for r in table] == [11, 10, 10]


def test_cutoffs_support_selection_limits_and_kind_stratum(catalog, model, features):
    y = quality_ratings(features)
    for n in (39, 40, 79, 80, 160):
        profile = lib.fit(features, np.arange(n), y[:n])
        assert bool(profile.statements) == (n >= 40)
        if n < 80:
            assert all(s.family == 'quality' and s.key == 'public quality' for s in profile.statements)
        for s in profile.statements:
            effect, lo, hi = s.effect()
            assert abs(effect) >= .15 and lo*hi > 0
            assert min(s.n_high, s.n_low) >= 8
        assert sum(s.family == 'facts' for s in profile.statements) <= 4
        assert sum(s.family == 'themes' for s in profile.statements) <= 2
    for n in (159, 160):
        d = render(catalog, model, catalog.keys[:n], y[:n])
        assert d.diagnostics['kinds_160_plus'] == (n >= 160)


def test_quality_gate_counts_observed_public_scores(catalog, model):
    c = copy.deepcopy(catalog)
    for key in c.keys[:45]:
        for field in AUD + CRIT:
            c.info[int(key)][field] = None
    f = feats.build(c, dict(model, catalog_sha256=c.identity()))
    p = lib.fit(f, np.arange(80), quality_ratings(feats.build(catalog, model))[:80])
    assert not any(s.family == 'quality' for s in p.statements)


def test_unknown_franchise_is_excluded_from_contrast_and_missing_contribution(features):
    f = copy.deepcopy(features)
    f.facts[:] = np.nan
    f.facts[:20, 0], f.facts[20:40, 0] = 1, 0
    f.quality[:], f.gap[:] = np.nan, np.nan
    f.kinds[:] = 0
    f.themes[:] = 0
    y = np.full(100, 6.)
    y[:20], y[20:40] = 9, 3
    p = lib.fit(f, np.arange(100), y)
    s = next(s for s in p.statements if s.family == 'facts')
    assert s.key == franchise.LABEL and (s.n_high, s.n_low) == (20, 20)
    assert s.contrib(np.arange(40, 100)).tolist() == [0]*60
    f.facts[27:, 0] = np.nan
    p = lib.fit(f, np.arange(100), y)
    assert not any(s.family == 'facts' for s in p.statements)


def test_full_selection_pipeline_refits_facts_and_themes_inside_each_fold(features):
    f = copy.deepcopy(features)
    rng = np.random.default_rng(25)
    f.quality[:], f.gap[:] = np.nan, np.nan
    f.kinds[:] = 0
    f.facts = rng.integers(0, 2, f.facts.shape).astype(float)
    f.themes = rng.normal(size=f.themes.shape)
    f.theme_thirds = np.quantile(f.themes[f.catalog.pool], [1/3, 2/3], axis=0)
    f.theme_scale = np.full(16, 2.2)
    y = np.clip(3 + .45*f.facts[:, :8].sum(1) + .4*f.themes[:, :3].sum(1), 1, 10)
    keys, y = f.catalog.keys[:340], y[:340]
    p = lib.fit(f, np.arange(340), y)
    assert sum(s.family == 'facts' for s in p.statements) == 4
    assert sum(s.family == 'themes' for s in p.statements) == 2
    first = trust.cross_fit(f, keys, y)
    changed = y.copy()
    held_out = first.folds == 2
    changed[held_out] = rng.uniform(1, 10, held_out.sum())
    second = trust.cross_fit(f, keys, changed)
    np.testing.assert_array_equal(first.predictions[held_out], second.predictions[held_out])


def test_audience_critic_gate_and_lean_shrinkage(features):
    f = copy.deepcopy(features)
    rng = np.random.default_rng(41)
    f.quality = rng.uniform(3, 8, len(f.catalog.keys))
    f.gap = rng.uniform(-1.5, 1.5, len(f.catalog.keys))
    y = np.clip(1 + .7*f.quality + .8*f.gap + rng.normal(0, .05, len(f.quality)), 1, 10)
    assert not any(s.key == 'audiences over critics' for s in lib.fit(f, np.arange(79), y[:79]).statements)
    p = lib.fit(f, np.arange(80), y[:80])
    assert {s.key for s in p.statements if s.family == 'quality'} == {'public quality', 'audiences over critics'}
    lean = next(s for s in p.statements if s.key == 'audiences over critics')
    assert 0 < lean.b < .81
    f.gap[:1] = np.nan
    assert not any(s.key == 'audiences over critics' for s in lib.fit(f, np.arange(80), y[:80]).statements)


def test_render_registry_early_examples_and_pool_exemplars(catalog, model, features):
    # Planted kind preferences make registry coverage of generic pool exemplars observable.
    y = 3 + features.kinds.astype(float) + .03*np.sin(catalog.keys)
    d = render(catalog, model, catalog.keys[:300], y[:300])
    assert any(s.family == 'kinds' for s in d.profile.statements)
    assert d.named_titles and d.named_title_keys == tuple(sorted(set(d.named_title_keys)))
    assert all(t['aliases'] for t in d.named_titles)
    for t in d.named_titles:
        assert t['title'] in d.text
        if 'early example' in t['sources']:
            assert t['title_key'] in catalog.keys[:300]
    assert any('pool kind exemplar' in t['sources'] for t in d.named_titles)
    assert 'safe' not in d.text.lower() and 'no preference' not in d.text.lower()
    assert d.text == render(catalog, model, catalog.keys[:300][::-1], y[:300][::-1]).text


def test_empty_sparse_and_fingerprint_loss_are_explicit(catalog, model):
    d = render(catalog, model, catalog.keys[-1:], [7])
    assert d.profile is None and d.named_titles == () and d.diagnostics['fingerprint_losses'] == 1
    d = render(catalog, model, catalog.keys[:12], [7]*12)
    assert 'not enough evidence yet' in d.text.lower()
    assert 'median fallback' in d.text and d.cross_fit.table is None
    assert d.profile.statements == []
    with pytest.raises(ValueError, match='distinct'):
        render(catalog, model, [10001, 10001], [7, 8])
    with pytest.raises(ValueError, match='absent'):
        render(catalog, model, [999999], [7])


def test_pack_interface_never_reads_member_tables(catalog):
    class TitleOnlyPack:
        titles = dict(key=catalog.keys, fingerprint=catalog.fingerprint, fingerprint_keys=catalog.fp_keys,
                      in_pool=catalog.in_pool, has_fingerprint=catalog.has_fingerprint)

        def info(self, i):
            return catalog.info[int(catalog.keys[i])]

        def __getattr__(self, name):
            raise AssertionError('unexpected pack access: ' + name)
    assert from_pack(TitleOnlyPack()).identity() == catalog.identity()


def test_cli_help_does_not_load_pack_and_source_has_no_old_cache_dependency():
    env = dict(os.environ, PYTHONPATH=str(Path(__file__).resolve().parents[1]))
    done = subprocess.run([sys.executable, '-B', '-m', 't5.statements', '--help'], capture_output=True,
                          text=True, env=env, timeout=30)
    assert done.returncode == 0 and 'fit-kinds' in done.stdout
    for path in Path(artifact.__file__).parent.glob('*.py'):
        source = path.read_text()
        assert 'text_feats.npz' not in source and 'kinds6.npz' not in source


def test_cli_fits_a_made_up_pack_and_refuses_changed_inputs(catalog, tmp_path):
    import json
    import pickle
    from datetime import date
    from pack import Pack, TABLES, sha256
    folder = tmp_path / 'data' / 'packs' / 'invented'
    folder.mkdir(parents=True)
    infos = [catalog.info[int(k)] for k in catalog.keys]
    numeric = {name: np.asarray([x[name] for x in infos], dtype=float) for name in AUD+CRIT+('release_year',)}
    numeric['movie_series_id'] = np.full(len(infos), -1, dtype=np.int64)
    for name in ('is_anime', 'context_is_comfort_watch'):
        numeric[name] = np.array([x[name] for x in infos], dtype=np.int8)
    titles = dict(key=catalog.keys, fingerprint=catalog.fingerprint, fingerprint_keys=catalog.fp_keys,
                  in_pool=catalog.in_pool, has_fingerprint=catalog.has_fingerprint,
                  media_types=['movie'], media_type=np.zeros(len(infos), dtype=int), tmdb_id=catalog.keys,
                  release_date=np.array([(date.fromisoformat(x['release_date'])-date(1970, 1, 1)).days * 86400000 for x in infos]),
                  num=numeric, text={name: [x.get(name) for x in infos] for name in
                                     ('title', 'aliases', 'genres', 'original_language_code', 'production_method')})
    details = dict(cols={name: [x.get(name) for x in infos] for name in ('keywords', 'tropes', 'essence_tags')},
                   cast=[[] for _ in infos], crew=[[] for _ in infos], seasons=[[] for _ in infos])
    core = dict(until='invented', members={}, tier_b=[], tier_names=['A', 'B'], provenance_names=[], strata=[],
                **{name: {} for name in TABLES})
    for name, value in (('pack.pkl', core), ('titles.pkl', titles), ('titles_detail.pkl', details)):
        (folder / name).write_bytes(pickle.dumps(value))
    hashes = {name: sha256(folder / name) for name in ('pack.pkl', 'titles.pkl', 'titles_detail.pkl')}
    (folder / 'MANIFEST.json').write_text(json.dumps(dict(until='invented', files_sha256=hashes)))
    env = dict(os.environ, PYTHONPATH=str(Path(__file__).resolve().parents[1]))
    command = [sys.executable, '-B', '-m', 't5.statements', 'fit-kinds', '--pack', str(folder),
               '--data-root', str(tmp_path/'data'), '--pack-sha256', hashes['pack.pkl']]
    done = subprocess.run(command, capture_output=True, text=True, env=env, timeout=60)
    assert done.returncode == 0, done.stderr
    path = Path(done.stdout.splitlines()[0].split(': ', 1)[1])
    digest = done.stdout.splitlines()[1].split(': ', 1)[1]
    c = from_pack(Pack(folder))
    frozen = artifact.load(path, digest, c)
    assert frozen['pool_keys'] == c.keys[c.pool].tolist()
    d = render(c, frozen, c.keys[:60], [7]*60)
    assert d.diagnostics['usable_history'] == 60
    (folder / 'titles.pkl').write_bytes((folder/'titles.pkl').read_bytes()+b'changed')
    done = subprocess.run(command, capture_output=True, text=True, env=env, timeout=60)
    assert done.returncode != 0 and 'title file hash changed' in done.stderr


def test_copied_source_provenance_hashes():
    import json
    folder = Path(artifact.__file__).parent
    repo = next(p for p in folder.parents if (p / '.git').exists())
    provenance = json.loads((folder / 'SOURCE.json').read_text())
    for source in provenance['sources']:
        assert hashlib.sha256((repo / source['path']).read_bytes()).hexdigest() == source['sha256']

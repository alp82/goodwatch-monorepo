"""Item 016: invented inputs only; no members, readers, or external services."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

import numpy as np
import pytest

from t5 import pin_live, run
from t5.cases import build, forbidden as old_forbidden
from t5.live import sides
from t5.live.removal import forbidden
from t5.storage import private_root
from t5.synthetic import pack


def bun(script, payload):
    result = subprocess.run(['bun', '--tsconfig-override', str(sides.HERE / 'tsconfig.json'), str(script)],
                            input=json.dumps(payload), text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def test_t5_live_direct_production_parity_and_fallback():
    p = pack(1)
    p['titles'][0]['fingerprint'][2] = 255
    p['titles'][1]['hasPoster'] = False
    early = p['population'][0]['ratings']
    out = sides.describe(early, p['titles'])
    matrix = np.array([t['fingerprint'] for t in p['titles']], float)
    matrix[matrix == 255] = 0
    mean, sd = matrix.mean(0), matrix.std(0)
    sd[sd == 0] = 1
    direct = bun(sides.HERE / 'parity_check.ts', {'early': early, 'titles': p['titles'],
                 'stats': {'mean': mean.tolist(), 'sd': sd.tolist()}})
    assert out['raw_view'] == direct['view']
    assert out['view']['status'] == 'ready'
    assert np.allclose(out['normalization']['mean'], mean)
    assert np.allclose(out['normalization']['sd'], sd)
    assert 'identity fallback' in out['normalization']['personal_order']
    assert all(p['titles'][1]['key'] not in s['here'] for s in out['view']['sides'])


def test_t5_live_template_fields_order_registry_and_numbers(tmp_path):
    # Test the serialization separately from clustering so every displayed field is exercised.
    script = tmp_path / 'template.ts'
    script.write_text(f"import {{template, displayView}} from {json.dumps(str(sides.HERE / 'adapter.ts'))}\n"
                      "const c=JSON.parse(await Bun.stdin.text()); console.log(JSON.stringify("
                      "template(displayView(c.view,c.titles),c.titles,new Map(c.scores))))\n")
    view = {'headline': {'first': 'a', 'second': 'b'}, 'sides': [
        {'id': 'a', 'name': 'Warm stories', 'here': [1, 2, 3, 4, 5, 6], 'count': 91,
         'average': 8.7, 'share': .623, 'attributes': [{'label': 'Warmth'}, {'label': 'Wonder'}],
         'moods': ['feelgood', 'worlds'], 'edges': [], 'moreOfThis': []},
        {'id': 'b', 'name': 'Tense mysteries', 'here': [7], 'attributes': [{'label': 'Tension'}],
         'moods': [], 'edges': [], 'moreOfThis': []}]}
    titles = [{'key': k, 'title': title} for k, title in enumerate(
        ['Galaxy: One', 'Galaxy: Two', 'Missing', '1984', 'Other', 'Beyond', 'Mystery'], 1)]
    # No display title: the page leaves that example out, then takes four after pruning.
    titles[2]['title'] = None
    out = bun(script, {'view': view, 'titles': titles, 'scores': [[k, 6 + k % 4] for k in range(1, 8)]})
    assert out['text'].splitlines() == [
        'You love warm stories, and just as much tense mysteries.',
        "What you rate highly, grouped by what it shares, and close to each, what you've barely tried.",
        'Warm stories', 'Tense mysteries', 'Fits your taste', 'Warm stories',
        'Galaxy: One', '7', '1984', '6', 'Other', '7', 'Beyond', '8',
        "Nothing you've barely tried is close to warm stories yet.", 'Warmth', 'Wonder',
        'Open Feel-good + Other worlds in Watch next', 'More of this', 'Nothing more to suggest here yet.',
        'Fits your taste', 'Tense mysteries', 'Mystery', '9',
        "Nothing you've barely tried is close to tense mysteries yet.", 'Tension',
        'More of this', 'Nothing more to suggest here yet.']
    assert out['named_titles'] == [1, 4, 5, 6, 7]
    assert out['printed_mean'] == 7.4
    # The brief asks for every displayed number, including a title's digits, and nothing hidden.
    assert re.findall(r'\d+(?:\.\d+)?', out['numbers_only']) == ['7', '1984', '6', '7', '8', '9']
    assert not re.search(r'[^\d\s.]', out['numbers_only'])
    assert len(out['numbers_only'].split('\n')) == len(out['text'].split('\n'))
    assert all(x not in out['text'] for x in ['Galaxy: Two', 'Missing', '91', '8.7', '62.3', 'mean rating'])


def test_t5_live_empty_and_missing_fingerprint():
    p = pack(1)
    p['titles'][0]['fingerprint'] = None
    out = sides.describe(p['population'][0]['ratings'][:4], p['titles'])
    assert out['empty'] and out['losses'] == 1
    assert out['text'] == out['numbers_only'] == '' and out['named_titles'] == []


def test_t5_live_namesake_alias_series_closure():
    titles = [
        {'key': 1, 'media_type': 'show', 'title': 'Ｍoon—World', 'aliases': [2]},
        {'key': 2, 'media_type': 'show', 'title': 'The alias'},
        {'key': 3, 'media_type': 'movie', 'title': 'moon world', 'movie_series_id': 8},
        {'key': 4, 'media_type': 'movie', 'title': 'Different sequel', 'movie_series_id': 8, 'aliases': [5]},
        {'key': 5, 'media_type': 'show', 'title': 'Another alias'},
        {'key': 6, 'media_type': 'movie', 'title': 'ANOTHER ALIAS', 'movie_series_id': 9},
        {'key': 7, 'media_type': 'movie', 'title': 'Last sequel', 'movie_series_id': 9},
        {'key': 8, 'media_type': 'movie', 'title': 'Moon world remade'},
        {'key': 9, 'media_type': 'show', 'title': 'moon world'}]
    assert forbidden([1], titles) == set(range(1, 8))
    assert old_forbidden([1], titles) == {1, 2}


def test_t5_live_namesakes_removed_from_all_three_lists_only_in_live():
    p = pack(9)
    named = p['titles'][0]['key']
    p['titles'][0]['title'] = 'Namesake'
    p['titles'][0]['media_type'] = 'show'
    residuals = set()
    for m in p['population']:
        key = m['ratings'][60]['title_key']
        next(t for t in p['titles'] if t['key'] == key)['title'] = 'namesake'
        residuals.add(key)
    desc = {m['token']: {'text': 'Namesake', 'empty': False, 'named_titles': [named],
                        'printed_mean': 8, 'numbers_only': ''} for m in p['population']}
    live, coverage = build(p['population'], p['titles'], desc, sides='live')
    old, _ = build(p['population'], p['titles'], desc)
    assert live and coverage['primary_members'] == 9
    assert all(not residuals.intersection(k for keys in c['selected_keys'].values() for k in keys) for c in live)
    assert any(residuals.intersection(k for keys in c['selected_keys'].values() for k in keys) for c in old)


def test_t5_6082cadc_exact_synthetic_content_digests_and_default(tmp_path):
    expected = {
        'cases_digest': 'cf1dff7e16c5d98c610c3ffd6c862efcfcaf117e499f98f8bde6603e681c0a80',
        'input_digest': '8f62e2f426c18dd66fd53123e39968722c2e13693a893cedf552809e618b2d28',
        'descriptions_digest': '40c517f82a22cadd252ccf4d5864833faee565410b1610801394d5c146b2f039',
        'prompt_digest': '8fb4b8a4977357e3618b53b7d320f92eecb3c12aa1c90c455fea39680eaf87ca'}
    result = subprocess.run([sys.executable, '-m', 't5.run', '--synthetic', '--sides', '6082cadc',
                             '--output', str(tmp_path / 'explicit'), 'build'], cwd=run.LAB,
                            capture_output=True, text=True, check=True)
    frozen = json.loads((tmp_path / 'explicit/frozen.json').read_text())
    assert {k: frozen[k] for k in expected} == expected
    default = run.build(private_root(tmp_path / 'default', True), True)
    assert frozen == default


def test_t5_live_source_digest_covers_selected_pin_and_page(tmp_path, monkeypatch):
    import shutil
    target = tmp_path / 't5'
    shutil.copytree(run.HERE, target)
    monkeypatch.setattr(run, 'HERE', target)
    monkeypatch.setattr(run, 'LAB', tmp_path)
    for name in ('stats.py', 'pack.py'):
        (tmp_path / name).write_text('# synthetic dependency')
    old, live = run.source_digest(), run.source_digest('live')
    page = target / 'live/page/ui/taste/tabs/SidesOfYou.tsx'
    page.write_text(page.read_text() + '\n// synthetic change\n')
    assert run.source_digest() == old and run.source_digest('live') != live
    current = run.source_digest('live')
    legacy = target / 'prod/server/taste-portrait/sides.server.ts'
    legacy.write_text(legacy.read_text() + '\n// synthetic legacy change\n')
    assert run.source_digest() != old and run.source_digest('live') == current
    pinned = target / 'live/prod/server/taste-portrait/sides.server.ts'
    pinned.write_text(pinned.read_text() + '\n// synthetic change\n')
    assert run.source_digest('live') != current
    monkeypatch.setattr(sides, 'HERE', target / 'live')
    with pytest.raises(ValueError, match='changed pinned'):
        sides.check_source()


def test_t5_live_pin_is_byte_identical_and_repin_deterministic(tmp_path):
    commit = sides.check_source()['commit']
    manifest = pin_live.pin(commit, destination=tmp_path / 'live')
    for name, entry in manifest['files'].items():
        raw = pin_live.git(pin_live.HERE, 'show', f"{commit}:{entry['path']}")
        assert (tmp_path / 'live' / name).read_bytes() == raw
        assert hashlib.sha256(raw).hexdigest() == entry['sha256']
    before = (tmp_path / 'live/prod-manifest.json').read_bytes()
    assert pin_live.pin(commit, destination=tmp_path / 'live') == manifest
    assert (tmp_path / 'live/prod-manifest.json').read_bytes() == before
    assert 'prod/server/taste-portrait/families.server.ts' in manifest['files']
    assert 'prod/domain/moods.ts' in manifest['files']


@pytest.mark.parametrize('commit', ['no-such-t5-commit', 'HEAD-dirty', '--all'])
def test_t5_live_pin_rejects_missing_or_dirty_revision(tmp_path, commit):
    with pytest.raises(ValueError):
        pin_live.pin(commit, destination=tmp_path / 'unused')
    assert not (tmp_path / 'unused').exists()


def test_t5_live_pin_refuses_dirty_production_before_writing(tmp_path, monkeypatch):
    real_git = pin_live.git
    def git(repo, *args):
        if args[0] == 'status':
            return b' M goodwatch-webapp/app/server/taste-portrait/words.server.ts\n'
        return real_git(repo, *args)
    monkeypatch.setattr(pin_live, 'git', git)
    with pytest.raises(ValueError, match='dirty production'):
        pin_live.pin('origin/main', destination=tmp_path / 'unused')
    assert not (tmp_path / 'unused').exists()


def test_t5_live_cannot_use_item_015_registration(monkeypatch, tmp_path):
    # A live run reads only item 016's PREREG.md; item 015's registered digests never unlock it.
    old = run.PREREG.read_text()
    monkeypatch.setattr(run, 'PREREG_LIVE', tmp_path / 'missing.md')
    digest = old.split('`source_digest`: `')[1].split('`')[0]
    cases = old.split('`cases_digest`: `')[1].split('`')[0]
    with pytest.raises(ValueError, match='does not register'):
        run.registered({'sides': 'live', 'source_digest': digest, 'cases_digest': cases})


def test_t5_live_cli_build_freezes_selected_version_and_rejects_wrong_replay(tmp_path):
    root = tmp_path / 'live-run'
    command = [sys.executable, '-m', 't5.run', '--synthetic', '--output', str(root)]
    subprocess.run([*command, '--sides', 'live', 'build'], cwd=run.LAB,
                   capture_output=True, text=True, check=True)
    frozen = run.checked(root, True)
    assert frozen['sides'] == 'live' and frozen['sides_commit'] == sides.check_source()['commit']
    assert frozen['coverage']['structural_members'] == 18
    manifest = json.loads((root / 'source-manifest.json').read_text())
    assert 't5/live/adapter.ts' in manifest and 't5/adapter.ts' not in manifest
    assert 't5/live/page/ui/taste/tabs/SidesOfYou.tsx' in manifest
    replay = subprocess.run([*command, '--sides', '6082cadc', 'verify'], cwd=run.LAB,
                            capture_output=True, text=True)
    assert replay.returncode and '--sides differs from the frozen run' in replay.stderr


def test_t5_live_matching_one_triple_per_rank(tmp_path):
    from collections import defaultdict
    root = tmp_path / 'live-ranks'
    subprocess.run([sys.executable, '-m', 't5.run', '--synthetic', '--output', str(root), '--sides', 'live', 'build'],
                   cwd=run.LAB, capture_output=True, text=True, check=True)
    frozen = run.checked(root, True)
    ranks = defaultdict(list)
    for c in frozen['cases']:
        ranks[c['member']].append(c['displayed_mean_rank'])
    assert ranks and all(sorted(r) == [0, 1, 2] for r in ranks.values())


def test_t5_live_franchise_prefix_matches_production():
    from t5.live.removal import franchise_of
    titles = ['The Matrix Reloaded', 'The Matrix', 'Toy Story 2', 'Toy Story', 'Rocky IV', 'Mission: Impossible',
              'Harry Potter and the Chamber of Secrets', 'Kill Bill: Vol. 2', 'Dune Part Two', 'A Quiet Place - Day One',
              'An American Tail', 'Up', 'Alien 3', 'the the', '', 'Ocean’s Eleven']
    here = Path(run.LAB) / 't5' / 'live'
    done = subprocess.run(['bun', '--tsconfig-override', str(here / 'tsconfig.json'), str(here / 'franchise_check.ts')],
                          input=json.dumps(titles), capture_output=True, text=True, check=True, cwd=here)
    assert [franchise_of(t) for t in titles] == json.loads(done.stdout)


def test_t5_live_removal_blocks_franchise_prefix_movies():
    from t5.live.removal import forbidden
    titles = [{'key': 1, 'title': 'Toy Story 2', 'media_type': 'movie'},
              {'key': 2, 'title': 'Toy Story', 'media_type': 'movie'},
              {'key': 3, 'title': 'Toy Story: Hawaiian Vacation', 'media_type': 'movie'},
              {'key': 4, 'title': 'Story Time', 'media_type': 'movie'}]
    assert {2, 3} <= forbidden({1}, titles) and 4 not in forbidden({1}, titles)


def test_t5_live_noun_only_control():
    from t5.cases import nouns_only, live_nouns, controls_for, control_payload
    nouns = live_nouns()
    assert {'comedies', 'thrillers', 'war stories', 'stories'} <= set(nouns)
    view = {'sides': [{'name': 'Situational, witty comedies'}, {'name': 'Grim, tense war stories'},
                      {'name': 'Warm stories'}]}
    assert nouns_only(view, nouns) == 'comedies\nwar stories\nstories'
    case = {'payload': {'description': 'x', 'lists': {}}, 'numbers_only': '', 'nouns_only': 'comedies'}
    assert controls_for([case]) == ('s', 'numbers', 'none', 'noun')
    assert control_payload(case, 'noun')['description'] == 'comedies'
    old = {'payload': {'description': 'x', 'lists': {}}, 'numbers_only': ''}
    assert controls_for([old]) == ('s', 'numbers', 'none')


def test_t5_live_synthetic_pipeline_scores_and_replays(tmp_path):
    root = tmp_path / 'live-all'
    done = subprocess.run([sys.executable, '-m', 't5.run', '--synthetic', '--sides', 'live', '--output', str(root), 'all'],
                          cwd=run.LAB, capture_output=True, text=True, timeout=600)
    assert done.returncode == 0, done.stdout + done.stderr
    aggregate = json.loads((root / 'aggregate.json').read_text())
    assert aggregate['rule'] == 'astra_share' and 's_minus_noun' in aggregate['readers']['astra']


def test_t5_live_fixed_copy_matches_the_pinned_page():
    """Every fixed line the adapter writes must still be on the pinned page, so a copy change in the pin
    (for example Q71, "In your taste" to "Fits your taste") fails here until the adapter follows it."""
    here = Path(sides.__file__).resolve().parent
    page = (here / 'page/ui/taste/tabs/SidesOfYou.tsx').read_text()
    adapter = (here / 'adapter.ts').read_text()
    fixed = {'Fits your taste': '>Fits your taste<', 'More of this': '>More of this<',
             'Nothing more to suggest here yet.': '"Nothing more to suggest here yet."',
             "What you rate highly, grouped by what it shares, and close to each,":
                 'What you rate highly, grouped by what it shares, and close to each,',
             "Nothing you've barely tried is close to": "Nothing you've barely tried is close to",
             'in Watch next': 'Open {names} in Watch next'}
    for line, on_page in fixed.items():
        assert line in adapter, line
        assert on_page in page, f'pinned page no longer has: {on_page}'

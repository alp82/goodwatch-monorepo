"""Contract boundary checks using synthetic fixtures only; no film scoring or network."""
import copy
import hashlib
import tempfile
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator
from validate import HERE, coverage, export_vector, load, loads, ordered_vector, validate, validate_pair


class ContractChecks(unittest.TestCase):
    def setUp(self):
        self.sim = load(HERE / 'examples/similarity.synthetic.json')
        self.meta = load(HERE / 'examples/metadata.synthetic.json')

    def test_schemas_are_valid(self):
        for path in HERE.glob('*.schema.json'):
            Draft202012Validator.check_schema(load(path))

    def test_synthetic_pair(self):
        self.assertEqual(validate_pair(self.sim, self.meta), [])

    def test_exact_historical_axes_and_rubrics(self):
        old = load(HERE.parent / 'draft-3/mapping.json')
        new = load(HERE / 'mapping.json')
        self.assertEqual(new['ordered_fields'], old['ordered_fields'])
        before = load(HERE.parent / 'draft-3/definition.json')
        after = load(HERE / 'definition.json')
        self.assertEqual(before['scoring_contract']['rubrics'], after['scoring_contract']['rubrics'])
        for field in new['ordered_fields']:
            g, k = field.split('.')
            self.assertEqual(before['attribute_groups'][g][k], after['attribute_groups'][g][k])

    def test_all_previous_numeric_fields_retained(self):
        before = load(HERE.parent / 'draft-3/mapping.json')['fields']
        after = {r['field']: r for r in load(HERE / 'mapping.json')['fields']}
        for row in before:
            self.assertEqual(row, after[row['field']])
        self.assertEqual(set(after) - {r['field'] for r in before}, {'characters.demonstrated_competence'})

    def test_historical_files_unchanged(self):
        # The draft.3 receipt was created before this successor; verify every sealed artifact.
        previous = HERE.parent / 'draft-3'
        for name, expected in load(previous / 'verification.json')['files'].items():
            self.assertEqual(hashlib.sha256((previous / name).read_bytes()).hexdigest(), expected, name)

    def test_projection_obeys_mapping_not_response_order(self):
        expected = []
        for i, field in enumerate(load(HERE / 'mapping.json')['ordered_fields']):
            g, k = field.split('.')
            self.sim['scores'][g][k] = i % 11
            expected.append(i % 11)
        self.sim['scores'] = dict(reversed(list(self.sim['scores'].items())))
        self.assertEqual(ordered_vector(self.sim), expected)
        self.assertEqual(len(expected), 274)

    def test_unknown_vector_intake_cannot_export(self):
        self.sim['scores']['experience']['tranquility'] = None
        self.assertFalse(validate(self.sim, response=True))
        self.assertTrue(validate(self.sim))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'vector.json'
            with self.assertRaises(ValueError):
                export_vector(self.sim, path)
            self.assertFalse(path.exists())

    def test_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'vector.json'
            path.write_text('preserve')
            with self.assertRaises(FileExistsError):
                export_vector(self.sim, path)
            self.assertEqual(path.read_text(), 'preserve')

    def test_missing_and_extra_vector_keys(self):
        del self.sim['scores']['experience']['tranquility']
        self.assertTrue(validate(self.sim))
        self.sim['scores']['experience']['tranquility'] = 0
        self.sim['scores']['experience']['invented'] = 0
        self.assertTrue(validate(self.sim))

    def test_strict_numeric_values(self):
        for value in [True, False, 1.0, '1', -1, 11]:
            with self.subTest(value=value):
                self.sim['scores']['experience']['tranquility'] = value
                self.assertTrue(validate(self.sim))
                self.meta['attribute_groups']['characters']['demonstrated_competence'] = value
                self.assertTrue(validate(self.meta))

    def test_invalid_json(self):
        for value in ['{"a":1,"a":2}', '{"a":NaN}', '{"a":Infinity}', '{"a":-Infinity}']:
            with self.assertRaises(ValueError):
                loads(value)

    def test_missing_metadata_key_not_implicit_zero(self):
        del self.meta['attribute_groups']['characters']['demonstrated_competence']
        self.assertTrue(validate(self.meta))

    def test_unknown_metadata_preserved(self):
        original = copy.deepcopy(self.meta)
        self.assertFalse(validate(self.meta))
        self.assertEqual(self.meta, original)

    def test_coverage_separates_unknown_and_inapplicable(self):
        stats = coverage(self.meta)
        self.assertEqual(stats['not_applicable_scores'], 8)
        self.assertEqual(stats['unknown_scores'], 318)
        self.assertIsNone(stats['fraction_at_most_one_of_assessed'])

    def test_show_traits_on_movie_rejected(self):
        self.meta['attribute_groups']['series']['episodic_independence'] = 0
        self.assertTrue(validate(self.meta))
        self.meta['attribute_groups']['series']['episodic_independence'] = None
        self.meta['facets']['series']['case_resolution_pattern'] = 'mostly_within_episode'
        self.assertTrue(validate(self.meta))

    def test_show_requires_scope(self):
        self.meta['title']['media_type'] = 'show'
        self.meta['scope']['kind'] = 'whole_show'
        self.assertTrue(validate(self.meta))
        self.meta['scope']['covered_seasons'] = [1, 2]
        self.meta['attribute_groups']['series']['episodic_independence'] = 8
        self.meta['facets']['series']['case_resolution_pattern'] = 'mostly_within_episode'
        self.assertFalse(validate(self.meta))

    def test_movie_cannot_have_episode_scope(self):
        self.meta['scope']['episode_number'] = 1
        self.assertTrue(validate(self.meta))

    def test_invalid_date(self):
        self.sim['scope']['as_of'] = '2026-02-31'
        self.assertTrue(validate(self.sim))

    def test_exact_controller_binding(self):
        expected = {'title': copy.deepcopy(self.sim['title']), 'scope': copy.deepcopy(self.sim['scope'])}
        self.assertFalse(validate(self.sim, expected_identity=expected))
        self.sim['title']['name'] = 'A different adaptation'
        self.assertTrue(validate(self.sim, expected_identity=expected))

    def test_pair_scope_mismatch(self):
        self.meta['scope']['edition_id'] = 'different-cut'
        self.assertTrue(validate_pair(self.sim, self.meta))

    def test_present_with_zero_centrality_allowed(self):
        self.meta['content_presence']['settings.courtroom'] = 'present'
        self.meta['attribute_groups']['settings']['courtroom'] = 0
        self.assertFalse(validate(self.meta))

    def test_absent_with_positive_metadata_rejected(self):
        self.meta['content_presence']['settings.courtroom'] = 'absent'
        self.meta['attribute_groups']['settings']['courtroom'] = 2
        self.assertTrue(validate(self.meta))

    def test_cross_part_contradiction_rejected(self):
        self.meta['content_presence']['world.virtual_reality'] = 'absent'
        self.sim['scores']['world']['virtual_reality'] = 2
        self.assertTrue(validate_pair(self.sim, self.meta))

    def test_unknown_presence_is_not_absence(self):
        self.meta['content_presence']['world.virtual_reality'] = 'unknown'
        self.sim['scores']['world']['virtual_reality'] = 2
        self.assertFalse(validate_pair(self.sim, self.meta))

    def test_death_present_can_be_offscreen_nonviolent(self):
        self.meta['advisories']['death'] = {'presence': 'present', 'depiction_modes': ['off_screen', 'verbal_reference'],
                                           'intensity': 2, 'frequency': 1, 'explicitness': 0}
        self.meta['advisories']['violence'] = {'presence': 'absent', 'depiction_modes': [],
                                              'intensity': 0, 'frequency': 0, 'explicitness': 0}
        self.assertFalse(validate(self.meta))

    def test_advisory_unknown_cannot_hide_a_positive(self):
        self.meta['advisories']['death']['frequency'] = 2
        self.assertTrue(validate(self.meta))

    def test_absence_cannot_have_depiction(self):
        self.meta['advisories']['death']['presence'] = 'absent'
        self.meta['advisories']['death']['depiction_modes'] = ['implied']
        self.assertTrue(validate(self.meta))

    def test_present_advisory_can_have_unknown_detail(self):
        self.meta['advisories']['death']['presence'] = 'present'
        self.assertFalse(validate(self.meta))
        self.meta['advisories']['death']['depiction_modes'] = []
        self.assertTrue(validate(self.meta))

    def test_fixed_tags_reject_inventions_and_duplicates(self):
        self.meta['facets']['cultural']['movements_and_traditions'] = ['my_invented_movement']
        self.assertTrue(validate(self.meta))
        self.meta['facets']['cultural']['movements_and_traditions'] = ['slow_cinema', 'slow_cinema']
        self.assertTrue(validate(self.meta))

    def test_chronology_and_retelling_are_independent(self):
        self.meta['facets']['storytelling']['chronology'] = 'mixed_timelines'
        self.meta['facets']['storytelling']['retelling_structure'] = 'same_events_complementary'
        self.assertFalse(validate(self.meta))

    def test_jump_scare_consistency(self):
        p = self.meta['facets']['presentation']
        p['jump_scares'] = 'absent'
        p['jump_scare_modalities'] = ['audio']
        self.assertTrue(validate(self.meta))
        p['jump_scare_modalities'] = []
        self.assertFalse(validate(self.meta))

    def test_credit_function_consistency(self):
        self.meta['facets']['format_facts']['post_credits_scene_present'] = False
        self.meta['facets']['ending']['post_credits_function'] = 'reopens_threat_or_mystery'
        self.assertTrue(validate(self.meta))

    def test_graph_and_prose_not_a_matching_contract(self):
        self.meta['entities'] = []
        self.assertTrue(validate(self.meta))
        del self.meta['entities']
        self.meta['distinctive_prose'] = 'An invented description cannot replace fields.'
        self.assertTrue(validate(self.meta))

    def test_field_catalog_paths_resolve_in_examples(self):
        rows = load(HERE / 'field-catalog.json')['fields']
        self.assertEqual(len({r['id'] for r in rows}), len(rows))
        for row in rows:
            value = self.sim if row['part'] == 'similarity' else self.meta
            for key in row['pointer'].split('/')[1:]:
                value = value[key]
            self.assertIn('value_schema', row)
            self.assertTrue(Draft202012Validator(row['value_schema']).is_valid(value), row['id'])

    def test_generation_definitions_are_separate(self):
        sim = load(HERE / 'similarity.definition.json')
        meta = load(HERE / 'metadata.definition.json')
        self.assertEqual(len(sim['attributes']), 274)
        self.assertEqual(len(meta['attributes']), 326)
        self.assertFalse(set(sim['attributes']) & set(meta['attributes']))
        self.assertNotIn('facets', sim)
        self.assertEqual(len(meta['advisory_topics']), 22)

    def test_manifest_hashes(self):
        manifest = load(HERE / 'manifest.json')
        for name, expected in manifest['output_hashes'].items():
            self.assertEqual(hashlib.sha256((HERE / name).read_bytes()).hexdigest(), expected, name)
        for name, expected in manifest['source_hashes'].items():
            self.assertEqual(hashlib.sha256((HERE.parent / 'draft-3' / name).read_bytes()).hexdigest(), expected, name)


if __name__ == '__main__':
    unittest.main(verbosity=2)

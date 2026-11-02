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
        self.sim = load(HERE / 'examples/vector.synthetic.json')
        self.meta = load(HERE / 'examples/attributes.synthetic.json')

    def test_schemas_are_valid(self):
        for path in HERE.glob('*.schema.json'):
            Draft202012Validator.check_schema(load(path))

    def test_synthetic_pair(self):
        self.assertEqual(validate_pair(self.sim, self.meta), [])

    def test_exact_historical_axes_and_rubrics(self):
        old = load(HERE.parent / 'draft-5/mapping.json')
        new = load(HERE / 'mapping.json')
        self.assertEqual(new['ordered_fields'], old['ordered_fields'])
        before = load(HERE.parent / 'draft-5/definition.json')
        after = load(HERE / 'definition.json')
        self.assertEqual(before['scoring_contract']['rubrics'], after['scoring_contract']['rubrics'])
        for field in new['ordered_fields']:
            g, k = field.split('.')
            self.assertEqual(before['attribute_groups'][g][k], after['attribute_groups'][g][k])

    def test_all_previous_numeric_fields_retained(self):
        before = load(HERE.parent / 'draft-5/mapping.json')['fields']
        after = {r['field']: r for r in load(HERE / 'mapping.json')['fields']}
        for row in before:
            expected = {**row, 'destination': {'fingerprint': 'vector', 'content_metadata': 'content_attributes', 'series_metadata': 'series_attributes'}.get(row['destination'], row['destination'])}
            self.assertEqual(expected, after[row['field']])
        self.assertEqual(set(after) - {r['field'] for r in before}, {
            'viewing_demands.memory_load', 'viewing_demands.inference_load', 'viewing_demands.information_rate',
            'viewing_affordances.interruption_recovery', 'performance.dance_prominence'})
        old = load(HERE.parent / 'draft-5/definition.json')
        new = load(HERE / 'definition.json')
        for g, fields in old['attribute_groups'].items():
            for k, spec in fields.items():
                self.assertEqual(spec, new['attribute_groups'][g][k])
        for f, spec in old['facets'].items():
            self.assertEqual(spec, new['facets'][f])

    def test_historical_files_unchanged(self):
        # The draft.5 receipt was created before this successor; verify every sealed artifact.
        previous = HERE.parent / 'draft-5'
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

    def test_missing_attributes_key_not_implicit_zero(self):
        del self.meta['attribute_groups']['characters']['demonstrated_competence']
        self.assertTrue(validate(self.meta))

    def test_unknown_attributes_preserved(self):
        original = copy.deepcopy(self.meta)
        self.assertFalse(validate(self.meta))
        self.assertEqual(self.meta, original)

    def test_coverage_separates_unknown_and_inapplicable(self):
        stats = coverage(self.meta)
        self.assertEqual(stats['not_applicable_scores'], 8)
        self.assertEqual(stats['unknown_scores'], 323)
        self.assertIsNone(stats['fraction_at_most_one_of_assessed'])

    def test_show_traits_on_movie_rejected(self):
        self.meta['attribute_groups']['series']['episodic_independence'] = 0
        self.assertTrue(validate(self.meta))
        self.meta['attribute_groups']['series']['episodic_independence'] = None
        self.meta['facets']['series']['case_resolution_pattern'] = ['within_episode']
        self.assertTrue(validate(self.meta))

    def test_show_requires_scope(self):
        self.meta['title']['media_type'] = 'show'
        self.meta['scope']['kind'] = 'whole_show'
        self.assertTrue(validate(self.meta))
        self.meta['scope']['covered_seasons'] = [1, 2]
        self.meta['attribute_groups']['series']['episodic_independence'] = 8
        self.meta['facets']['series']['case_resolution_pattern'] = ['within_episode']
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

    def test_absent_with_positive_attributes_rejected(self):
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
        self.meta['facets']['storytelling']['chronology'] = ['interleaved_timelines']
        self.meta['facets']['storytelling']['retelling_structure'] = ['same_events_complementary']
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
        self.meta['facets']['ending']['post_credits_function'] = ['reopens_threat_or_mystery']
        self.assertTrue(validate(self.meta))

    def test_multiselect_overlapping_facets(self):
        f = self.meta['facets']
        f['storytelling']['chronology'] = ['chronological', 'reverse_chronological']
        f['storytelling']['retelling_structure'] = ['same_events_complementary', 'same_events_conflicting']
        f['format_facts']['production_method'] = ['live_action', 'animation']
        f['format_facts']['color_process'] = ['color', 'black_and_white']
        f['format_facts']['narrative_mode'] = ['fiction', 'nonfiction']
        f['format_facts']['post_credits_scene_present'] = True
        f['ending']['post_credits_function'] = ['comic_tag', 'introduces_next_story']
        self.assertFalse(validate(self.meta))

    def test_old_scalar_and_combined_categories_rejected(self):
        f = self.meta['facets']['format_facts']
        for value in ['live_action', ['mixed_media'], ['live_action', 'live_action']]:
            f['production_method'] = value
            self.assertTrue(validate(self.meta), value)

    def test_empty_and_unknown_multiselect_are_distinct(self):
        f = self.meta['facets']['storytelling']
        for value in [None, []]:
            f['retelling_structure'] = value
            self.assertFalse(validate(self.meta))
            self.assertEqual(f['retelling_structure'], value)
        f['retelling_structure'] = ['none']
        self.assertTrue(validate(self.meta))

    def test_facet_cardinalities(self):
        facets = load(HERE / 'definition.json')['facets']
        types = [spec['value_schema'].get('type') for spec in facets.values()]
        self.assertEqual(types.count('array'), 31)
        self.assertEqual(types.count('boolean'), 6)
        self.assertEqual(types.count(None), 3)
        for spec in facets.values():
            shape = spec['value_schema']
            if shape.get('type') == 'array':
                self.assertTrue(shape['uniqueItems'])
                self.assertFalse({'none', 'mixed', 'mixed_media', 'hybrid', 'multiple_functions'} & set(shape['items']['enum']))
            elif 'enum' in shape:
                self.assertEqual(shape['enum'], ['present', 'absent', 'unknown'])

    def test_presence_and_boolean_not_multiselect(self):
        f = self.meta['facets']
        f['presentation']['jump_scares'] = ['present', 'absent']
        self.assertTrue(validate(self.meta))
        f['presentation']['jump_scares'] = 'unknown'
        f['format_facts']['anime_tradition'] = [True, False]
        self.assertTrue(validate(self.meta))

    def test_overlapping_show_structures(self):
        self.meta['title']['media_type'] = 'show'
        self.meta['scope']['kind'] = 'whole_show'
        self.meta['scope']['covered_seasons'] = [1, 2]
        f = self.meta['facets']
        f['series']['case_resolution_pattern'] = ['within_episode', 'season_or_series_arc']
        f['series']['character_continuity'] = ['episodic_reset', 'cumulative_development']
        f['format_facts']['series_structure'] = ['limited', 'episodic', 'serialized']
        self.assertFalse(validate(self.meta))

    def test_readable_full_references_cover_every_leaf(self):
        catalog = load(HERE / 'field-catalog.json')['fields']
        for part, count in [('vector', 274), ('attributes', 652)]:
            doc = load(HERE / (part + '.readable.json'))
            self.assertEqual(len(doc), count)
            rows = [r for r in catalog if r['part'] == part]
            self.assertEqual(list(doc), [r['id'] for r in rows])
            for row in rows:
                self.assertIsInstance(doc[row['id']], str)
                self.assertIn(row['definition'], doc[row['id']])
            markdown = (HERE / (part + '.readable.md')).read_text()
            self.assertIn((HERE / (part + '.readable.json')).read_text(), markdown)

    def test_new_scores_are_attributes_only(self):
        mapping = load(HERE / 'mapping.json')
        additions = load(HERE / 'migration.json')['numeric_additions']
        self.assertEqual(len(additions), 5)
        for field in additions:
            self.assertNotIn(field, mapping['ordered_fields'])
            row = next(r for r in mapping['fields'] if r['field'] == field)
            self.assertIsNone(row['vector_index'])
            self.assertEqual(row['destination'], 'content_attributes' if field.startswith('performance.') else 'viewing_context')
            g, k = field.split('.')
            for value in [None, 0, 10]:
                self.meta['attribute_groups'][g][k] = value
                self.assertFalse(validate(self.meta))
            for value in [-1, 11, True, 1.5]:
                self.meta['attribute_groups'][g][k] = value
                self.assertTrue(validate(self.meta))
            self.meta['attribute_groups'][g][k] = None
            del self.meta['attribute_groups'][g][k]
            self.assertTrue(validate(self.meta))
            self.meta['attribute_groups'][g][k] = None

    def test_dance_prominence_is_not_narrative_centrality(self):
        self.meta['content_presence']['activities.dancing'] = 'present'
        self.meta['attribute_groups']['activities']['dancing'] = 0
        self.meta['attribute_groups']['performance']['dance_prominence'] = 5
        self.meta['facets']['performance']['dance_styles'] = ['ballet', 'contemporary']
        self.meta['facets']['performance']['dance_contexts'] = ['training_rehearsal', 'stage_performance']
        self.assertFalse(validate_pair(self.sim, self.meta))

    def test_absent_dancing_rejects_new_positive_claims(self):
        self.meta['content_presence']['activities.dancing'] = 'absent'
        self.meta['attribute_groups']['performance']['dance_prominence'] = 2
        self.assertTrue(validate(self.meta))
        self.meta['attribute_groups']['performance']['dance_prominence'] = None
        for key, value in [('dance_styles', 'tap'), ('dance_contexts', 'social')]:
            self.meta['facets']['performance'][key] = [value]
            self.assertTrue(validate(self.meta))
            self.meta['facets']['performance'][key] = []
        self.assertFalse(validate(self.meta))

    def test_dance_facets_preserve_unknown_empty_and_overlaps(self):
        f = self.meta['facets']['performance']
        for key, choices in [('dance_styles', ['street_hip_hop', 'breaking']),
                             ('dance_contexts', ['competition', 'stage_performance'])]:
            for value in [None, [], choices]:
                f[key] = value
                self.assertFalse(validate(self.meta))
                self.assertEqual(f[key], value)
            for value in [choices[0], [choices[0], choices[0]], ['invented']]:
                f[key] = value
                self.assertTrue(validate(self.meta))
            f[key] = None

    def test_demands_and_recovery_can_differ(self):
        d = self.meta['attribute_groups']['viewing_demands']
        d['attention'], d['memory_load'], d['inference_load'], d['information_rate'] = 8, 2, 9, 3
        self.meta['attribute_groups']['viewing_affordances']['interruption_recovery'] = 7
        self.assertFalse(validate(self.meta))

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
            value = self.sim if row['part'] == 'vector' else self.meta
            for key in row['pointer'].split('/')[1:]:
                value = value[key]
            self.assertIn('value_schema', row)
            self.assertTrue(Draft202012Validator(row['value_schema']).is_valid(value), row['id'])

    def test_generation_definitions_are_separate(self):
        sim = load(HERE / 'vector.definition.json')
        meta = load(HERE / 'attributes.definition.json')
        self.assertEqual(len(sim['attributes']), 274)
        self.assertEqual(len(meta['attributes']), 331)
        self.assertFalse(set(sim['attributes']) & set(meta['attributes']))
        self.assertNotIn('facets', sim)
        self.assertEqual(len(meta['advisory_topics']), 22)

    def test_manifest_hashes(self):
        manifest = load(HERE / 'manifest.json')
        for name, expected in manifest['output_hashes'].items():
            self.assertEqual(hashlib.sha256((HERE / name).read_bytes()).hexdigest(), expected, name)
        for name, expected in manifest['source_hashes'].items():
            self.assertEqual(hashlib.sha256((HERE.parent / 'draft-5' / name).read_bytes()).hexdigest(), expected, name)


if __name__ == '__main__':
    unittest.main(verbosity=2)

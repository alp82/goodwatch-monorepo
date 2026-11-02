"""Focused contract checks for generation/projection; no network or predictions."""
import copy
import json
from pathlib import Path
from jsonschema import Draft202012Validator
from validate_generation import assess, parse

HERE = Path(__file__).resolve().parent
m = json.loads((HERE / 'generation/manifest.json').read_text())
definition = json.loads((HERE.parent / 'definition.json').read_text())
all_fields = {f'{g}.{k}' for g, attrs in definition['attribute_groups'].items() for k in attrs}
selected = set(m['ordered_similarity_fields'])
metadata = json.loads((HERE / 'generation/metadata.definition.json').read_text())
other = {f'{g}.{k}' for g, attrs in metadata['attribute_groups'].items() for k in attrs}
assert len(selected) == 258 and len(other) == 296
assert not selected & other and selected | other == all_fields
assert len(metadata['content_presence_definitions']) == 146
for path in (HERE / 'generation').glob('*.schema.json'):
    Draft202012Validator.check_schema(json.loads(path.read_text()))
doc = {'format_version': m['similarity_version'], 'title': 'Synthetic test', 'year': 2000, 'attribute_groups': {}}
for field in m['ordered_similarity_fields']:
    g, k = field.split('.')
    doc['attribute_groups'].setdefault(g, {})[k] = 0
result = assess(doc, title='Synthetic test', year=2000)
assert result['numeric_complete'] and result['zero_count'] == 258
assert result['vector']['scores'] == [0] * 258
patterned = copy.deepcopy(doc)
for index, field in enumerate(m['ordered_similarity_fields']):
    group, key = field.split('.')
    patterned['attribute_groups'][group][key] = index % 11
assert assess(patterned, title='Synthetic test', year=2000)['vector']['scores'] == [i % 11 for i in range(258)]
for lane in ['similarity', 'metadata']:
    generated = json.loads((HERE / f'generation/{lane}.definition.json').read_text())
    for group, attrs in generated['attribute_groups'].items():
        for key, spec in attrs.items():
            for name, value in spec.items():
                assert value == definition['attribute_groups'][group][key][name]
    for name, rubric in generated['rubrics'].items():
        assert rubric == definition['scoring_contract']['rubrics'][name]
g, k = m['ordered_similarity_fields'][0].split('.')
for bad in [None, True, 0.5, 0.0, -1, 11, '0']:
    changed = copy.deepcopy(doc)
    changed['attribute_groups'][g][k] = bad
    checked = assess(changed, title='Synthetic test', year=2000)
    assert checked['vector'] is None and not checked['numeric_complete'], repr(bad)
changed = copy.deepcopy(doc)
del changed['attribute_groups'][g][k]
assert not assess(changed, title='Synthetic test', year=2000)['schema_valid']
changed = copy.deepcopy(doc)
changed['content_presence'] = {}
assert not assess(changed, title='Synthetic test', year=2000)['schema_valid']
assert assess(doc, title='Wrong identity', year=2000)['vector'] is None
for malformed in ['{"a":0,"a":1}', '{"a":NaN}']:
    try:
        parse(malformed)
    except ValueError:
        pass
    else:
        raise AssertionError('Ambiguous JSON accepted')
print('PASS: partition, schemas, complete zero vector, null/invalid/missing/extra/identity guards, duplicate keys and non-finite JSON.')

"""Inherit the frozen draft.8 facets and apply the bounded essence-audit changes."""
import copy
import json
from pathlib import Path

from essence_changes import ALIASES as NEW_ALIASES, ENUM_ADDITIONS, FACET_ADDITIONS, FACET_DEFINITION_SUFFIXES

PREVIOUS = Path(__file__).resolve().parent.parent / 'draft-8'
FIELDS = copy.deepcopy(json.loads((PREVIOUS / 'definition.json').read_text())['facets'])
ALIASES = {row['id']: row['aliases'] for row in json.loads((PREVIOUS / 'field-catalog.json').read_text())['fields'] if row['aliases']}
ALIASES.update(NEW_ALIASES)

for field, values in ENUM_ADDITIONS.items():
    existing = FIELDS[field]['value_schema']['items']['enum']
    assert not set(existing) & set(values)
    existing.extend(values)
for field, suffix in FACET_DEFINITION_SUFFIXES.items():
    FIELDS[field]['definition'] += suffix
for field, spec in FACET_ADDITIONS.items():
    assert field not in FIELDS
    FIELDS[field] = {
        'definition': spec['definition'],
        'value_schema': {'type': 'array', 'items': {'enum': spec['values']}, 'uniqueItems': True},
        'applicability': 'all', 'spoiler_sensitive': True,
    }

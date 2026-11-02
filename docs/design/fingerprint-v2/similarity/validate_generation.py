"""Validate a similarity response and export ordered scores only when complete.

This validates the data contract, not factual quality or retrieval suitability.
"""
import argparse
import hashlib
import json
from pathlib import Path
from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError(f"Invalid JSON constant: {value}")


def parse(text):
    return json.loads(text, object_pairs_hook=unique_object, parse_constant=reject_constant)


def assess(document, *, title, year):
    manifest = parse((HERE / 'generation/manifest.json').read_text())
    schema_path = HERE / 'generation/similarity.schema.json'
    if hashlib.sha256(schema_path.read_bytes()).hexdigest() != manifest['files']['similarity.schema.json']['sha256']:
        raise ValueError('Generation schema hash mismatch')
    errors = [error.message for error in Draft202012Validator(parse(schema_path.read_text())).iter_errors(document)]
    if not isinstance(document, dict):
        return {'schema_valid': False, 'errors': errors, 'vector': None}
    if document.get('title') != title or document.get('year') != year:
        errors.append('Exact expected title/year mismatch')
    numeric, zeros, missing, values = 0, 0, [], []
    groups = document.get('attribute_groups')
    groups = groups if isinstance(groups, dict) else {}
    for field in manifest['ordered_similarity_fields']:
        group, key = field.split('.')
        source = groups.get(group)
        value = source.get(key) if isinstance(source, dict) else None
        if type(value) is int and 0 <= value <= 10:
            numeric += 1
            zeros += value == 0
        else:
            missing.append(field)
            if value is not None and not errors:
                errors.append(f'Non-integer score: {field}')
        values.append(value)
    vector = None
    if not errors and not missing:
        mapping = parse((HERE / 'mapping.json').read_text())
        if hashlib.sha256((HERE / 'mapping.json').read_bytes()).hexdigest() != manifest['mapping_sha256']:
            raise ValueError('Projection mapping hash mismatch')
        vector = {'format_version': manifest['similarity_version'], 'projection_version': mapping['version'],
                  'title': title, 'year': year, 'scores': values}
        Draft202012Validator(parse((HERE / 'generation/vector.schema.json').read_text())).validate(vector)
    return {'schema_valid': not errors, 'errors': errors, 'numeric_count': numeric,
            'zero_count': zeros, 'positive_count': numeric - zeros,
            'unavailable_fields': missing, 'numeric_complete': numeric == 258 and not errors,
            'quality_accepted': False, 'vector': vector}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('response', type=Path)
    parser.add_argument('--title', required=True)
    parser.add_argument('--year', required=True, type=int)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = assess(parse(args.response.read_text()), title=args.title, year=args.year)
    # Exclusive output preserves previous predictions and assessments.
    with args.output.open('x') as out:
        json.dump(result, out, ensure_ascii=False, indent=2)
        out.write('\n')

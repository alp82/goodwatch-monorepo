"""Offline contract validation and ordered export. Does not judge film knowledge."""
import argparse
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker, validators

HERE = Path(__file__).resolve().parent


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f'duplicate JSON key: {key}')
        result[key] = value
    return result


def reject_constant(value):
    raise ValueError(f'non-JSON number: {value}')


def loads(text):
    return json.loads(text, object_pairs_hook=unique_object, parse_constant=reject_constant)


def load(path):
    return loads(Path(path).read_text())


StrictValidator = validators.extend(Draft202012Validator, type_checker=Draft202012Validator.TYPE_CHECKER.redefine(
    'integer', lambda checker, value: type(value) is int))


def scores(document):
    return {f'{g}.{k}': v for g, attrs in document.get(
        'scores' if document.get('part') == 'vector' else 'attribute_groups', {}).items() for k, v in attrs.items()}


def validate(document, *, response=False, expected_identity=None):
    part = document.get('part') if isinstance(document, dict) else None
    if part not in ['vector', 'attributes']:
        return ['part must be vector or attributes']
    filename = 'vector.response.schema.json' if part == 'vector' and response else part + '.schema.json'
    errors = [f'/{"/".join(map(str, e.absolute_path))}: {e.message}' for e in
              StrictValidator(load(HERE / filename), format_checker=FormatChecker()).iter_errors(document)]
    if errors:
        return errors
    title, scope = document['title'], document['scope']
    if expected_identity is not None:
        for key in ['title', 'scope']:
            if document[key] != expected_identity[key]:
                errors.append(f'{key}: differs from controller-supplied identity/scope')
    movie = title['media_type'] == 'movie'
    if movie != (scope['kind'] == 'movie'):
        errors.append('title media_type and scope.kind disagree')
    if movie and any(scope[k] is not None for k in ['season_number', 'episode_number', 'covered_seasons', 'covered_episode_ids']):
        errors.append('movie scope cannot carry season/episode fields')
    if scope['kind'] == 'whole_show' and scope['covered_seasons'] is None:
        errors.append('whole_show requires covered_seasons')
    if scope['kind'] in ['season', 'episode'] and scope['season_number'] is None:
        errors.append('season/episode scope requires season_number')
    if scope['kind'] == 'episode' and scope['episode_number'] is None:
        errors.append('episode scope requires episode_number')
    if scope['kind'] != 'episode' and scope['episode_number'] is not None:
        errors.append('episode_number is only valid for episode scope')
    if scope['kind'] == 'whole_show' and scope['season_number'] is not None:
        errors.append('whole_show uses covered_seasons, not one season_number')
    if scope['season_number'] is not None and scope['covered_seasons'] is not None and scope['season_number'] not in scope['covered_seasons']:
        errors.append('season_number must be included in covered_seasons')

    if part == 'attributes':
        registry = load(HERE / 'definition.json')
        for field, value in scores(document).items():
            g, k = field.split('.')
            if movie and registry['attribute_groups'][g][k]['applicability'] == 'show' and value is not None:
                errors.append(f'{field}: show-only score must be null for a movie')
        for field, spec in registry['facets'].items():
            g, k = field.split('.')
            if movie and spec['applicability'] == 'show' and document['facets'][g][k] is not None:
                errors.append(f'{field}: show-only facet must be null for a movie')
        for field, state in document['content_presence'].items():
            if state == 'absent' and (scores(document).get(field) or 0) > 0:
                errors.append(f'{field}: absent presence conflicts with positive score')
        if document['content_presence']['activities.dancing'] == 'absent':
            if (document['attribute_groups']['performance']['dance_prominence'] or 0) > 0:
                errors.append('dancing absent conflicts with positive dance prominence')
            for key in ['dance_styles', 'dance_contexts']:
                if document['facets']['performance'][key]:
                    errors.append(f'dancing absent conflicts with performance.{key}')
        for topic, advisory in document['advisories'].items():
            mode, state = advisory['depiction_modes'], advisory['presence']
            values = [advisory[k] for k in ['intensity', 'frequency', 'explicitness']]
            if state == 'unknown' and (mode is not None or any(v is not None for v in values)):
                errors.append(f'advisories.{topic}: unknown presence requires unknown details')
            if state == 'absent' and (mode != [] or any(v not in [0, None] for v in values)):
                errors.append(f'advisories.{topic}: absence conflicts with depiction/details')
            if state == 'present' and mode == []:
                errors.append(f'advisories.{topic}: present needs known modes or null, not an empty list')
            if state == 'present' and advisory['frequency'] == 0:
                errors.append(f'advisories.{topic}: present cannot have zero frequency')
        presentation = document['facets']['presentation']
        jump, modes = presentation['jump_scares'], presentation['jump_scare_modalities']
        if jump == 'absent' and modes != []:
            errors.append('absent jump scares require empty modalities')
        if jump == 'unknown' and modes is not None:
            errors.append('unknown jump scares require unknown modalities')
        if jump == 'present' and modes == []:
            errors.append('present jump scares require modalities or null')
        frequency = document['attribute_groups']['presentation']['jump_scare_frequency']
        if jump == 'unknown' and frequency is not None:
            errors.append('unknown jump scares require unknown frequency')
        if jump == 'absent' and frequency not in [None, 0]:
            errors.append('absent jump scares cannot have positive frequency')
        if jump == 'present' and frequency == 0:
            errors.append('present jump scares cannot have zero frequency')
        context = document['facets']['world_context']
        calendar = context['calendar_systems']
        if (context['earliest_substantial_year'] is not None or context['latest_substantial_year'] is not None
                or context['depicted_decades'] or context['predominant_decades']):
            if not calendar or 'real_world_ce_bce' not in calendar:
                errors.append('numbered year/decade facts require established real_world_ce_bce correspondence')
        for all_key, main_key in [('eras', 'predominant_eras'), ('depicted_decades', 'predominant_decades')]:
            all_values, main = context[all_key], context[main_key]
            if main and (all_values is None or not set(main).issubset(all_values)):
                errors.append(f'{main_key} must be included in {all_key}')
        first, last = context['earliest_substantial_year'], context['latest_substantial_year']
        if first is not None and last is not None and first > last:
            errors.append('earliest substantial year exceeds latest substantial year')
        for decade in context['depicted_decades'] or []:
            start = int(decade[:-1])
            if (first is not None and start + 9 < first) or (last is not None and start > last):
                errors.append('depicted decade falls outside established substantial-year bounds')
        harm = document['advisories']['animal_harm']['presence']
        kinds = document['facets']['advisory_details']['animal_harm_types']
        if harm == 'unknown' and kinds is not None:
            errors.append('unknown animal harm requires unknown harm types')
        if harm == 'absent' and kinds != []:
            errors.append('absent animal harm requires empty harm types')
        if harm == 'present' and kinds == []:
            errors.append('present animal harm needs supported types or null')
        credits = document['facets']['format_facts']['post_credits_scene_present']
        function = document['facets']['ending']['post_credits_function']
        if credits is False and function not in [None, []]:
            errors.append('post-credits function conflicts with scene absence')
        if credits is True and function == []:
            errors.append('empty post-credits functions conflict with scene presence')
    return errors


def validate_pair(vector, attributes, *, response=False, expected_identity=None):
    errors = validate(vector, response=response, expected_identity=expected_identity)
    errors += validate(attributes, expected_identity=expected_identity)
    # Do not let a semantic error in one part hide cross-part contradictions.
    filenames = ['vector.response.schema.json' if response else 'vector.schema.json', 'attributes.schema.json']
    if any(not StrictValidator(load(HERE / filename)).is_valid(doc)
           for filename, doc in zip(filenames, [vector, attributes])):
        return errors
    if vector['part'] != 'vector' or attributes['part'] != 'attributes':
        return ['pair needs one vector and one attributes document']
    for key in ['title', 'scope', 'format_version']:
        if vector[key] != attributes[key]:
            errors.append(f'pair {key} mismatch')
    for field, state in attributes['content_presence'].items():
        if state == 'absent' and (scores(vector).get(field) or 0) > 0:
            errors.append(f'{field}: attributes absence conflicts with vector positive score')
    return errors


def ordered_vector(document):
    errors = validate(document)
    if not isinstance(document, dict) or document.get('part') != 'vector':
        errors.append('vector export needs the vector part')
    if errors:
        raise ValueError('\n'.join(errors))
    values = scores(document)
    return [values[field] for field in load(HERE / 'mapping.json')['ordered_fields']]


def coverage(document):
    """Report observed values without treating movie-only NAs as knowledge gaps."""
    values = scores(document)
    mapping = {r['field']: r for r in load(HERE / 'mapping.json')['fields']}
    na = {field for field in values if document['title']['media_type'] == 'movie' and mapping[field]['applicability'] == 'show'}
    assessed = [v for v in values.values() if v is not None]
    return {'numeric_scores': len(assessed), 'unknown_scores': sum(v is None and f not in na for f, v in values.items()),
            'not_applicable_scores': len(na), 'zeros': assessed.count(0), 'ones': assessed.count(1),
            'fraction_at_most_one_of_assessed': sum(v <= 1 for v in assessed) / len(assessed) if assessed else None}


def export_vector(document, destination):
    vector = ordered_vector(document)
    result = {'format_version': document['format_version'], 'projection_version': document['projection_version'],
              'title': document['title'], 'scope': document['scope'], 'ordered_vector': vector}
    with Path(destination).open('x') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--response', action='store_true', help='Allow null vector scores for intake only')
    parser.add_argument('--attributes', type=Path, help='Check a matching attributes document as well')
    parser.add_argument('--expected-identity', type=Path, help='Controller JSON containing exact title and scope')
    parser.add_argument('--export-vector', type=Path)
    args = parser.parse_args()
    doc = load(args.input)
    identity = load(args.expected_identity) if args.expected_identity else None
    errors = validate_pair(doc, load(args.attributes), response=args.response, expected_identity=identity) if args.attributes else validate(
        doc, response=args.response, expected_identity=identity)
    if errors:
        print(json.dumps({'valid': False, 'errors': errors}, indent=2))
        raise SystemExit(1)
    if args.export_vector:
        export_vector(doc, args.export_vector)
    print(json.dumps({'valid': True, **coverage(doc), 'quality_assessed': False}))


if __name__ == '__main__':
    main()

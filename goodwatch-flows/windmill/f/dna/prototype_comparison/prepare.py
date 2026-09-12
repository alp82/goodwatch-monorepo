"""Throwaway offline comparison preparation. Never makes inference calls."""
import ast
import hashlib
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
BENCH = ROOT / 'docs/benchmarks/fingerprint'
OUT = BENCH / 'poc'
KEYS = json.loads((BENCH / 'score-keys.json').read_text())


def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def obj(properties):
    return dict(type='object', properties=properties, required=list(properties), additionalProperties=False)


def schema():
    # Read type annotations only; never import the production database module.
    tree = ast.parse((BENCH / 'models.py.snapshot').read_text())
    definitions = {}
    def convert(node):
        if isinstance(node, ast.Name):
            if node.id in ('str', 'int', 'bool'):
                return {'type': {'str': 'string', 'int': 'integer', 'bool': 'boolean'}[node.id]}
            return definitions[node.id]
        if isinstance(node, ast.Subscript):
            kind = node.value.id
            if kind == 'Literal':
                values = node.slice.elts if isinstance(node.slice, ast.Tuple) else [node.slice]
                return {'type': 'string', 'enum': [ast.literal_eval(v) for v in values]}
            if kind == 'Optional':
                return {'anyOf': [convert(node.slice), {'type': 'null'}]}
            if kind == 'list':
                return {'type': 'array', 'items': convert(node.slice)}
        raise ValueError(ast.dump(node))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(n, ast.Name) and n.id == 'ContentAdvisory' for n in node.targets):
            definitions['ContentAdvisory'] = convert(node.value)
        if isinstance(node, ast.ClassDef) and any(isinstance(b, ast.Name) and b.id == 'BaseModel' for b in node.bases):
            definitions[node.name] = obj({n.target.id: convert(n.annotation) for n in node.body if isinstance(n, ast.AnnAssign)})
    assert list(definitions['CoreScores']['properties']) == KEYS and len(KEYS) == 74
    for score in definitions['CoreScores']['properties'].values():
        score.update(minimum=0, maximum=10)
    definitions['MediaFingerprint']['properties']['highlight_keys'].update(
        minItems=4, maxItems=8, items={'type':'string', 'enum':KEYS})
    definitions['DNAAnalysis']['properties']['essence_tags'].update(minItems=8, maxItems=10)
    # Uniqueness and the anime conditional are local checks, outside the common
    # structured-output schema subset. Instructions still require both.
    return obj({'results': {'type':'array', 'minItems':1, 'maxItems':1,
                            'items':obj({'benchmark_id':{'type':'string'}, 'analysis':definitions['DNAAnalysis']})}})


def validate(data, benchmark_id, contract=None):
    from jsonschema import Draft202012Validator
    errors = [f'{list(e.absolute_path)}: {e.message}' for e in Draft202012Validator(contract or schema()).iter_errors(data)]
    if errors:
        return errors
    result = data['results'][0]
    if result['benchmark_id'] != benchmark_id:
        errors.append('benchmark_id does not match requested title')
    analysis = result['analysis']
    for key, value in analysis['fingerprint']['scores'].items():
        if type(value) is not int:
            errors.append(f'{key}: expected an integer JSON value, excluding booleans and decimals')
    for name, values in [('highlight_keys', analysis['fingerprint']['highlight_keys']), ('essence_tags', analysis['essence_tags'])]:
        if len(set(values)) != len(values):
            errors.append(f'{name}: duplicate values')
    if analysis['is_anime'] and analysis['production_info']['animation_style'] != 'Anime':
        errors.append('is_anime requires animation_style Anime')
    return errors


def reasoning(model):
    if model == 'google/gemini-2.5-flash':
        return {'max_tokens':0}  # Adapter compatibility remains an execution check.
    effort = {'google/gemini-3.6-flash':'minimal', 'z-ai/glm-5.3-flash':'low',
              'openai/gpt-5.6-luna':'none', 'meta/muse-spark-1.3-contributor':'minimal',
              'mistralai/mistral-small-2603':'none', 'x-ai/grok-4.6':'low'}
    return {'effort':effort[model]} if model in effort else {'enabled':False}


def main():
    for name, expected in json.loads((BENCH/'manifest.json').read_text())['sha256'].items():
        assert hashlib.sha256((BENCH/name).read_bytes()).hexdigest() == expected, name
    OUT.mkdir(exist_ok=True)
    contract = schema()
    dump(OUT/'schema.json', contract)
    original = (BENCH/'system-instructions.txt').read_text()
    # Keep all production definitions, rules, and the example analysis unchanged.
    # Only replace the array transport instructions and wrap the example.
    prompt = original.replace('process a JSON array of movie and show titles and return a strictly schema-compliant JSON array of `MediaAnalysis` objects, in the same order.',
        'process one identified movie or show and return a strictly schema-compliant object with one result: {"results":[{"benchmark_id":"<copied input ID>","analysis":<MediaAnalysis>}]}.'
    ).replace('ONLY the raw JSON array', 'ONLY the raw JSON object').replace(
        'a JSON array where each object strictly follows', 'a results envelope where the analysis object strictly follows')
    prompt = prompt.replace('`["Poor Things (2023)"]`', '`{"benchmark_id":"movie:792307","title":"Poor Things (2023)"}`')
    start = prompt.index('```json\n') + len('```json\n')
    end = prompt.index('\n```', start)
    example = json.loads(prompt[start:end])[0]
    prompt = prompt[:start] + json.dumps({'results':[{'benchmark_id':'movie:792307','analysis':example}]}, ensure_ascii=False, indent=2) + prompt[end:]
    prompt += '\n\nTransport version 1. Evaluation date: 2026-09-12. For series, consider material released by this date and the overall series identity. Copy benchmark_id exactly. Use null for an inapplicable animation_style; this represents the production optional field. Highlight keys must be unique. The following JSON schema defines the shared full-response transport contract:\n' + json.dumps(contract, ensure_ascii=False) + '\n'
    (OUT/'system-prompt.txt').write_text(prompt)
    titles = json.loads((BENCH/'titles.json').read_text())['titles']
    candidates = json.loads((OUT/'candidates.json').read_text())
    requests = []
    for i, candidate in enumerate(candidates):
        for title in titles:
            bid = f"{title['media_type']}:{title['tmdb_id']}"
            metadata = {k:title[k] for k in ['original_title','release_year','media_type','overview']}
            payload = {'model':candidate['model'], 'provider':{'only':[candidate['provider']], 'allow_fallbacks':False, 'require_parameters':True},
                'max_tokens':8192, 'stream':False, 'reasoning':reasoning(candidate['model']),
                'messages':[{'role':'system','content':prompt}, {'role':'user','content':json.dumps({'benchmark_id':bid, **metadata}, ensure_ascii=False)}]}
            payload['response_format'] = {'type':'json_object'} if candidate['output_mode'].startswith('JSON') else {
                'type':'json_schema','json_schema':{'name':'fingerprint_response','strict':True,'schema':contract}}
            requests.append({'candidate_index':i, 'benchmark_id':bid, 'pass':'first', 'payload':payload})
    random.Random(20260912).shuffle(requests)
    # Payloads are deterministic and reproducible; store one prompt plus order,
    # rather than committing 130 copies of the large common prompt.
    dump(OUT/'request-order.json', [{k:v for k,v in r.items() if k!='payload'} for r in requests])
    dump(OUT/'request-example.json', requests[0])
    dump(OUT/'prepared-manifest.json', {'status':'prepared-not-executed', 'seed':20260912,
        'evaluation_date':'2026-09-12', 'pairs':len(requests), 'actual_inference_cost_usd':0,
        'sha256':{n:hashlib.sha256((OUT/n).read_bytes()).hexdigest() for n in ['schema.json','system-prompt.txt','candidates.json','request-order.json','request-example.json']}})
    print(f'Prepared {len(requests)} pairs; verified frozen hashes and 74 schema keys. No API calls.')
    return requests


if __name__ == '__main__':
    main()

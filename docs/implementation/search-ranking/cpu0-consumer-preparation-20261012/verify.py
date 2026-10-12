"""Verify the public frozen source and retained evidence; never execute a benchmark."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
BASE = ROOT / 'goodwatch-qdrant/diagnostics'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

manifest = json.loads((HERE / 'v2-manifest.json').read_text())
for name, expected in manifest['files'].items():
    if name.startswith('code/'):
        path = BASE / 'pinning-prototype' / name.removeprefix('code/')
    elif name.startswith('clone-preparation/'):
        path = BASE / name
    else:
        raise ValueError('unexpected public source path')
    assert path.stat().st_size == expected['bytes'], name
    assert digest(path) == expected['sha256'], name
for version in ('v1', 'v2'):
    provenance = json.loads((HERE / f'{version}-opus-provenance.json').read_text())
    assert digest(HERE / f'{version}-manifest.json') == provenance['sourceManifestSha256']
    assert digest(HERE / f'{version}-opus-review.json') == provenance['resultSha256']
    validation = json.loads((HERE / f'{version}-validation-provenance.json').read_text())
    assert digest(HERE / f'{version}-validation.txt') == validation['validationSha256']
    assert digest(HERE / f'{version}-manifest.json') == validation['sourceManifestSha256']
    assert validation['exitCode'] == 0 and validation['failed'] == 0
assert digest(HERE / 'root-cpu0-consumer-v2-review-20261012.json') == 'f15da4fdea0c46db45bf47292e6036e7481dc209a68eace61d9e924350288e5e'
assert digest(HERE / 'root-cpu0-consumer-v2-acceptance-20261012.json') == 'd84da38e882a26502fcf0a3e2221e677fab57e6ff5077234b9b33089a253070a'
for name, expected in json.loads((HERE / 'evidence-bindings.json').read_text())['files'].items():
    assert digest(HERE / name) == expected, name
print(json.dumps({'sourceFilesVerified': len(manifest['files']), 'evidenceVerified': True, 'execution': False}))

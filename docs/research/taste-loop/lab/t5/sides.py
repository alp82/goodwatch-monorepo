"""Run the dependency-isolated pinned TS, passing early ratings through stdin only."""
import hashlib
import json
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent


def check_source():
    manifest = json.loads((HERE / 'prod-manifest.json').read_text())
    for name, entry in manifest['files'].items():
        if hashlib.sha256((HERE / name).read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError(f'changed pinned source: {name}')
    return manifest


def describe(early, titles):
    check_source()
    done = subprocess.run(['bun', '--tsconfig-override', str(HERE / 'tsconfig.json'), str(HERE / 'adapter.ts')],
                          input=json.dumps({'early': early, 'titles': titles}), text=True,
                          capture_output=True, timeout=120, check=True)
    return json.loads(done.stdout)

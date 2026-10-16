"""Pin live Sides from a clean, locally available commit. No fetch or working-copy reads.

From lab: python -m t5.pin_live origin/main
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
APP = 'goodwatch-webapp/app/'
ROOTS = ('server/taste-portrait/sides.server.ts', 'server/taste-portrait/view.ts',
         'server/taste/taste.server.ts')
STUBS = {'server/taste/index.server': 'stubs/taste.ts',
         'server/availability-index.server': 'stubs/availability.ts'}
PAGE = ('routes/taste._index.tsx', 'ui/taste/tabs/SidesOfYou.tsx', 'ui/taste/tabs/parts.tsx',
        'ui/taste/taste-groups-name.ts', 'server/taste-portrait/index.server.ts')
IMPORT = re.compile(r'\b(?:import|export)\s+(.*?)\s+from\s+[\'\"]([^\'\"]+)[\'\"]', re.S)


def git(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args], capture_output=True)
    if result.returncode:
        raise ValueError('git could not resolve/read the requested commit or dependency')
    return result.stdout


def pin(commit, *, repo=None, destination=None):
    repo = Path(repo) if repo else Path(git(HERE, 'rev-parse', '--show-toplevel').decode().strip())
    destination = Path(destination) if destination else HERE / 'live'
    # Revisions must name an existing commit, never a dirty working-copy pseudo-pin.
    if commit.startswith('-') or commit.endswith('-dirty'):
        raise ValueError('a clean, existing commit is required')
    resolved = git(repo, 'rev-parse', '--verify', f'{commit}^{{commit}}').decode().strip()
    if git(repo, 'status', '--porcelain', '--untracked-files=all', '--', APP).strip():
        raise ValueError('dirty production source; commit or discard those changes before pinning')
    tree = set(git(repo, 'ls-tree', '-r', '--name-only', resolved, '--', APP).decode().splitlines())
    files, omitted = {}, set()

    def visit(name):
        target = f'prod/{name}'
        if target in files:
            return
        raw = git(repo, 'show', f'{resolved}:{APP}{name}')
        files[target] = raw
        # Pure runtime imports form the executable closure. Type-only imports are erased by Bun;
        # following them into the snapshot/database facade would import I/O unnecessarily.
        for clause, spec in IMPORT.findall(raw.decode()):
            if clause.strip().startswith('type '):
                omitted.add(spec)
                continue
            if spec.startswith('~/'):
                base = spec[2:]
            elif spec.startswith('.'):
                from posixpath import normpath
                base = normpath(str(Path(name).parent / spec))
            else:
                raise ValueError(f'unclassified import in {name}: {spec}')
            if base in STUBS:
                continue
            match = next((base + suffix for suffix in ('', '.ts', '.tsx', '/index.ts')
                          if APP + base + suffix in tree), None)
            if match is None:
                raise ValueError(f'missing production dependency: {base}')
            visit(match)

    for name in ROOTS:
        visit(name)
    for name in PAGE:
        files[f'page/{name}'] = git(repo, 'show', f'{resolved}:{APP}{name}')
    manifest = {'commit': resolved, 'requested_commit': commit,
                'files': {name: {'path': APP + name.split('/', 1)[1],
                                 'sha256': hashlib.sha256(raw).hexdigest()}
                          for name, raw in sorted(files.items())},
                'stubbed_imports': STUBS, 'erased_type_imports': sorted(omitted)}
    destination.mkdir(parents=True, exist_ok=True)
    # Resolve and read the entire closure before replacing a previous pin.
    with tempfile.TemporaryDirectory(prefix='.pin-', dir=destination.parent) as tmp:
        stage = Path(tmp)
        for name, raw in files.items():
            path = stage / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
        for folder in ('prod', 'page'):
            if (destination / folder).exists():
                shutil.rmtree(destination / folder)
            shutil.move(str(stage / folder), destination / folder)
        (destination / 'prod-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('commit')
    args = parser.parse_args()
    manifest = pin(args.commit)
    print(json.dumps({'commit': manifest['commit'], 'files': len(manifest['files'])}))


if __name__ == '__main__':
    main()

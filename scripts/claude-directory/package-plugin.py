#!/usr/bin/env python3
"""Validate and export only the distributable plugin; performs no publication."""
import json
import re
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
plugin = root / 'plugins/goodwatch'
manifest = json.loads((plugin / '.claude-plugin/plugin.json').read_text())
assert re.fullmatch(r'[a-z][a-z0-9-]{0,63}', manifest['name'])
assert re.fullmatch(r'\d+\.\d+\.\d+', manifest['version'])
assert manifest['description'] and manifest['author']['name']
assert manifest['license'] == 'MIT'
icon = (plugin / manifest['icon']).resolve()
assert icon.is_relative_to(plugin.resolve()) and icon.is_file()
assert icon.name == 'goodwatch-white-512.png'
config = json.loads((plugin / '.mcp.json').read_text())
assert config == {'mcpServers': {'goodwatch': {
    'type': 'http', 'url': 'https://goodwatch.app/mcp'}}}
assert len((plugin / 'README.md').read_text().split()) >= 40
assert (plugin / 'LICENSE').is_file()
files = sorted(p for p in plugin.rglob('*') if p.is_file())
assert len(files) < 512
for path in plugin.rglob('*'):
    assert not path.is_symlink(), path
    assert path.name not in {'.env', '.DS_Store', '.git', 'node_modules'}, path
for path in files:
    assert path.stat().st_size < 256 * 1024, path
    if path.suffix == '.png':
        data = path.read_bytes()
        assert data.startswith(b'\x89PNG\r\n\x1a\n') and data.endswith(b'IEND\xaeB`\x82'), path
        continue
    content = path.read_text()
    assert not content.startswith('version https://git-lfs.github.com/spec/'), path
    assert not re.search(r'-----BEGIN .*PRIVATE KEY-----|Bearer [A-Za-z0-9_.-]{20,}', content), path
for path in plugin.glob('skills/*/SKILL.md'):
    content = path.read_text()
    assert content.startswith('---\n')
    front = content.split('---', 2)[1]
    assert f'name: {path.parent.name}\n' in front
    assert re.search(r'^description: .+', front, re.M)
assert len(list(plugin.glob('skills/*/SKILL.md'))) == 2
print(f'PASS: {len(files)} ordinary files; manifest, URL, paths, skills, license and size checks')
if len(sys.argv) > 1:
    destination = Path(sys.argv[1]).resolve()
    assert destination.suffix == '.zip'
    assert not destination.exists(), 'Refusing to overwrite an existing archive'
    with zipfile.ZipFile(destination, 'x', zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(plugin))
    print(f'Exported {destination} ({destination.stat().st_size} bytes); no upload performed')

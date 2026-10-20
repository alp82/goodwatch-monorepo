#!/usr/bin/env python3
"""Validate the allowlisted portable package and build a reproducible, secret-free ZIP.
Requires Python 3 and jsonschema. Does not upload or publish anything.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
from urllib.parse import urlsplit
import zipfile
import jsonschema

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / 'plugins/goodwatch-chatgpt'
EVIDENCE = ROOT / 'docs/chatgpt-plugin/evidence'
FILES = ['plugin.json', 'mcp.json', 'assets/logo.png']

def validate():
    for name in ['plugin', 'mcp']:
        data = json.loads((PACKAGE / f'{name}.json').read_text())
        schema = json.loads((EVIDENCE / f'{name}.schema.json').read_text())
        jsonschema.Draft202012Validator(schema).validate(data)
    manifest = json.loads((PACKAGE / 'plugin.json').read_text())
    config = json.loads((PACKAGE / 'mcp.json').read_text())
    assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', manifest['name'])
    assert re.fullmatch(r'\d+\.\d+\.\d+', manifest['version'])
    extension = manifest['extensions']['com.openai']
    assert not any(k in extension for k in ['apps', 'hooks'])
    assert set(config['mcpServers']) == {'goodwatch'}
    server = config['mcpServers']['goodwatch']
    assert server == {'type': 'streamable-http', 'url': 'https://goodwatch.app/mcp'}
    interface = extension['interface']
    for key, limit in [('displayName',30),('shortDescription',30),('longDescription',4000),('developerName',80)]:
        assert 0 < len(interface[key]) <= limit, key
    for key in ['websiteURL','supportURL','privacyPolicyURL','termsOfServiceURL']:
        u = urlsplit(interface[key])
        assert u.scheme == 'https' and u.hostname and not u.username and not u.password and len(interface[key]) <= 1024, key
    assert 0 < len(interface['defaultPrompt']) <= 3
    assert all(0 < len(p) <= 128 and '@' not in p for p in interface['defaultPrompt'])
    assert len(interface['capabilities']) <= 20 and all(len(x) <= 120 for x in interface['capabilities'])
    for key in ['logo','composerIcon']:
        relative = interface[key]
        assert relative.startswith('./') and '..' not in Path(relative).parts
        path = PACKAGE / relative
        assert not path.is_symlink() and path.resolve().is_relative_to(PACKAGE.resolve())
        image = path.read_bytes()
        assert len(image) <= 5 * 1024 * 1024 and image[:8] == b'\x89PNG\r\n\x1a\n'
        width, height = struct.unpack('>II', image[16:24])
        assert 48 <= width == height <= 4096
    cases = extension['review']['test_cases']
    assert len(cases['positive']) == 5 and len(cases['negative']) == 3
    contract_path = EVIDENCE / 'tools.json'
    if contract_path.exists():
        tools = {t['name'] for t in json.loads(contract_path.read_text())['tools']}
        for case in cases['positive']:
            assert all(t.strip() in tools for t in case['tools_triggered'].split(','))
    assert cases == json.loads((ROOT/'docs/chatgpt-plugin/review-cases.json').read_text())
    actual = sorted(str(p.relative_to(PACKAGE)) for p in PACKAGE.rglob('*') if p.is_file())
    assert actual == sorted(FILES), 'Unexpected package file; review allowlist before bundling'
    for name in FILES:
        p = PACKAGE/name
        assert not p.is_symlink()
        if p.suffix == '.json':
            text = p.read_text()
            assert not re.search(r'clientSecret|Bearer |PRIVATE KEY|password|api[_-]?key', text, re.I), name
    return manifest

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--zip', action='store_true')
    parser.add_argument('--submission', action='store_true', help='Fail until owner evidence and hosted checks are complete')
    args = parser.parse_args()
    manifest = validate()
    result = {'package_validation':'pass', 'schema_version':'Agent Plugins 1.0.0', 'files':FILES, 'positive_cases':5, 'negative_cases':3}
    target = ROOT / f'docs/chatgpt-plugin/goodwatch-{manifest["version"]}.zip'
    if args.zip:
        with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED) as z:
            for name in sorted(FILES):
                info = zipfile.ZipInfo(name, date_time=(2026,10,20,0,0,0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                z.writestr(info,(PACKAGE/name).read_bytes())
    if target.exists():
        with zipfile.ZipFile(target) as z:
            assert z.testzip() is None and sorted(z.namelist()) == sorted(FILES)
            for name in FILES:
                assert z.read(name) == (PACKAGE/name).read_bytes()
        result.update(zip=str(target.relative_to(ROOT)),sha256=hashlib.sha256(target.read_bytes()).hexdigest())
    readiness = json.loads((ROOT/'docs/chatgpt-plugin/readiness.json').read_text())
    blockers = [key for key, value in readiness['checks'].items() if value['status'] != 'pass' or not value.get('evidence')]
    review = manifest['extensions']['com.openai']['review']
    if not review.get('demo_recording_url', '').startswith('https://'):
        blockers.append('review.demo_recording_url missing')
    result['submission_readiness'] = 'blocked' if blockers else 'owner evidence recorded; explicit authorization still required'
    result['remaining_checks'] = blockers
    (EVIDENCE/'package-validation.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    if args.submission and blockers:
        raise SystemExit("Submission gate remains closed: " + ", ".join(blockers))

if __name__ == '__main__':
    main()

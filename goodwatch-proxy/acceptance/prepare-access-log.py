#!/usr/bin/env python3
"""Prepare a separate reviewed Compose candidate; never alter the original."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import yaml

COMMON_FLAGS = [
    '--accesslog=true',
    '--accesslog.format=json',
    '--accesslog.bufferingsize=0',
    '--accesslog.fields.defaultmode=drop',
    '--accesslog.fields.names.StartUTC=keep',
    '--accesslog.fields.names.RouterName=keep',
    '--accesslog.fields.names.RequestMethod=keep',
    '--accesslog.fields.names.DownstreamStatus=keep',
    '--accesslog.fields.headers.defaultmode=drop',
]

def flags(version):
    if version not in ('2.10.7', '3.6.25'):
        raise ValueError('Use one of the verified deployed versions')
    return COMMON_FLAGS + (['--accesslog.fields.queryparameters.defaultmode=drop'] if version == '3.6.25' else [])

def mapping_value(node, key):
    if not isinstance(node, yaml.MappingNode):
        raise ValueError('Expected block mapping')
    for k, value in node.value:
        if k.value == key:
            return value
    raise ValueError('Required Compose setting is absent')

def prepare(source, version):
    before = yaml.safe_load(source)
    command = before['services']['traefik']['command']
    if not isinstance(command, list) or not all(isinstance(v, str) for v in command):
        raise ValueError('Expected command string list')
    if any('accesslog' in v.lower() for v in command):
        raise ValueError('Existing access logging requires separate review')
    if any(str(key).lower().startswith('traefik_accesslog') for key in before['services']['traefik'].get('environment', {})):
        raise ValueError('Existing access logging environment requires separate review')
    tree = yaml.compose(source)
    node = mapping_value(mapping_value(mapping_value(tree, 'services'), 'traefik'), 'command')
    if not isinstance(node, yaml.SequenceNode) or node.flow_style or not node.value:
        raise ValueError('Expected nonempty block command sequence')
    lines = source.splitlines(keepends=True)
    indent = ' ' * (node.value[-1].start_mark.column - 2)
    newline = '\r\n' if '\r\n' in source else '\n'
    added = ''.join(indent + '- ' + value + newline for value in flags(version))
    # Insert after the final command element, leaving unrelated bytes/comments intact.
    at = node.value[-1].end_mark.line + 1
    if node.value[-1].end_mark.column == 0:
        at = node.value[-1].end_mark.line
    candidate = ''.join(lines[:at]) + added + ''.join(lines[at:])
    expected = copy.deepcopy(before)
    expected['services']['traefik']['command'] += flags(version)
    if yaml.safe_load(candidate) != expected:
        raise ValueError('Candidate would alter another setting')
    return candidate

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('version', choices=['2.10.7', '3.6.25'])
    parser.add_argument('source')
    parser.add_argument('candidate')
    parser.add_argument('--expected-sha256', required=True)
    args = parser.parse_args()
    source, target = Path(args.source), Path(args.candidate)
    if source.resolve() == target.resolve():
        raise ValueError('Candidate must differ from the live configuration')
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != args.expected_sha256:
        raise ValueError('Source changed; inspect it again before preparing')
    candidate = prepare(raw.decode('utf-8'), args.version).encode('utf-8')
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'wb') as stream:
        stream.write(candidate)
        stream.flush()
        os.fsync(stream.fileno())
    print(json.dumps({'prepared': True, 'added_arguments': len(flags(args.version)), 'source_sha256': args.expected_sha256, 'candidate_sha256': hashlib.sha256(candidate).hexdigest()}))

if __name__ == '__main__':
    try:
        main()
    except Exception:
        # Exceptions may contain private YAML content; emit a fixed message only.
        raise SystemExit('Preparation failed; original configuration was not modified')

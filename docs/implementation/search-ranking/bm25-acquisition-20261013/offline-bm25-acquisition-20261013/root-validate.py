import gzip
import hashlib
import json
import pathlib
import struct

HERE = pathlib.Path(__file__).resolve().parent
PREP = HERE.parent / 'offline-bm25-reader-20261013'
receipt = json.loads((HERE / 'actual-invocation.json').read_text())
assert receipt['sshDockerNodeExitCode'] == 0 and receipt['outerRefusal'] is None
assert receipt['privateStderr']['bytes'] == 0 and (HERE / 'actual.stderr').stat().st_size == 0
plan_bytes = (PREP / 'PLAN-v2.json').read_bytes()
assert hashlib.sha256(plan_bytes).hexdigest() == receipt['planSha256']
ids = json.loads(plan_bytes)['ids']
term_bytes = (HERE.parent / 'index-readonly-acquisition-20261013/verified-index/term_statistics.json.gz').read_bytes()
assert hashlib.sha256(term_bytes).hexdigest() == '579851bd4019016c8bd0c32705ef39e077c8b03e074ac83d344305f00164e8c0'
stats = json.loads(gzip.decompress(term_bytes))
known = set(stats['ids'])
assert stats['n'] == len(ids) == 42934 and len(known) == 650794
del stats
counts = {'valid': 0, 'missing': 0, 'invalid': 0, 'empty': 0}
missing = []
entries = 0
unknown_occurrences = unknown_rows = 0
unknown_sample = set()
hash_state = hashlib.sha256()
size = 0
before = after = terminal = None
row_count = 0
with (HERE / 'actual.ndjson').open('rb') as f:
    for i, line in enumerate(f):
        assert line.endswith(b'\n') and len(line) <= 16 * 1024 * 1024
        record = json.loads(line)
        kind = record['kind']
        if i == 0:
            assert kind == 'header' and record['expectedRows'] == 42934
            assert record['planSha256'] == receipt['planSha256'] and record['readerSha256'] == receipt['readerSha256']
            assert record['historicalSnapshotEqualityProven'] is False
        elif i == 1:
            assert kind == 'collection-before'
            before = record
        elif 2 <= i < 42936:
            assert kind == 'point' and record['row'] == row_count and record['id'] == ids[row_count]
            if record['valid']:
                assert record['presence'] == 'present' and record['reason'] is None
                indices, observed, f32 = record['indices'], record['observedValues'], record['float32Values']
                assert len(indices) == len(observed) == len(f32) <= 32768
                assert record['empty'] == (not indices)
                previous = -1
                any_unknown = False
                for term, decimal, reconstructed in zip(indices, observed, f32):
                    assert type(term) is int and previous < term <= 4294967295
                    previous = term
                    assert type(decimal) in (int, float) and 0 <= decimal <= 1
                    assert type(reconstructed) in (int, float)
                    expected = struct.unpack('<f', struct.pack('<f', decimal))[0]
                    assert expected == reconstructed and (decimal == 0 or expected > 0)
                    if term not in known:
                        unknown_occurrences += 1
                        any_unknown = True
                        if len(unknown_sample) < 16:
                            unknown_sample.add(term)
                unknown_rows += any_unknown
                entries += len(indices)
                counts['valid'] += 1
                counts['empty'] += not indices
            else:
                assert record['presence'] in ('point-missing', 'omitted', 'null', 'present')
                if record['presence'] in ('point-missing', 'omitted', 'null'):
                    counts['missing'] += 1
                    missing.append({'row': row_count, 'id': ids[row_count], 'presence': record['presence']})
                else:
                    counts['invalid'] += 1
                assert 'indices' not in record and 'observedValues' not in record and 'float32Values' not in record
            row_count += 1
        elif i == 42936:
            assert kind == 'collection-after'
            after = record
        elif i == 42937:
            assert kind == 'terminal' and record['complete'] is True and record['outputBytesBeforeTerminal'] == size
            terminal = record
        else:
            raise AssertionError('unexpected extra frame')
        hash_state.update(line)
        size += len(line)
assert row_count == 42934 and terminal and before and after
assert terminal['requests'] == 88 and terminal['pointRequests'] == 86 and terminal['rows'] == row_count
assert all(terminal[k] == v for k, v in counts.items()) and terminal['entries'] == entries <= 134217728
assert terminal['responseBytes'] <= 1073741824 and terminal['elapsedMs'] <= 600000 and size <= 2147483648
assert terminal['productionWrites'] == terminal['searchRequests'] == terminal['modelCalls'] == 0
assert terminal['historicalSnapshotEqualityProven'] is False
projection = ('collection', 'vector', 'modifier', 'pointsCount', 'status', 'shards', 'replication', 'configurationProjectionSha256')
assert {k: before[k] for k in projection} == {k: after[k] for k in projection}
assert before['collection'] == 'media_fingerprint_v1' and before['vector'] == 'terms_bm25f_v1' and before['modifier'] in (None, 'none')
assert size == receipt['output']['bytes'] and hash_state.hexdigest() == receipt['output']['sha256']
result = {'schema': 'independent-root-bm25-stream-validation.v1', 'valid': True,
          'frames': 42938, 'rows': row_count, 'counts': counts, 'entries': entries,
          'missing': missing, 'unknownTermOccurrences': unknown_occurrences,
          'rowsWithUnknownTerms': unknown_rows, 'unknownTermIdSample': sorted(unknown_sample),
          'binary32Checks': entries, 'physicalBytes': size, 'physicalSha256': hash_state.hexdigest(),
          'historicalSnapshotEqualityProven': False, 'productionLatencyMeasured': False}
with (HERE / 'root-validation.json').open('x') as out:
    json.dump(result, out, indent=2)
print(json.dumps(result, indent=2))

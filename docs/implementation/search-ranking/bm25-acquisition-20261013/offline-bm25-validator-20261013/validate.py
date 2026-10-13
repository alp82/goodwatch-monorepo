"""Independent streaming validator. No reader, app, SDK or host imports."""
import argparse
from datetime import datetime, timezone
import gzip
import hashlib
import json
import math
import struct
from pathlib import Path

PLAN_SHA = 'a7264d2519d7a68275c4600fc57c48eda93896c389cf6432efb6c087cefc3600'
READER_SHA = 'c42fad2c9d2cc9c7a2b707d261bdc1a54c8ef9b0ce72b2663a6c4fc165ae5774'
DRIVER_SHA = '81edd90eb4f51344269a1070a5f17fc7c2bcd3b4c14b50973b6a82999a3f8cad'
COLLECTION = 'media_fingerprint_v1'
VECTOR = 'terms_bm25f_v1'
MAX_LINE = 4 * 1024 * 1024
MAX_OUTPUT = 2 * 1024**3
MAX_UNKNOWN = 1024**3
SCHEMA = 'offline-bm25-readonly.v1'
WRAPPER_SHA = '520a99e83c0fba53453e6d3cb737f43151a936792f1b8049132f7498ad9c6e8e'
EXECUTED_SHA = 'f0770a2c84006ad6a87a4be0e016be7d80d4d132d07c371ec33bff317d05f98a'
CONTAINER = '9de6d8c048ccf99644cffe43066ca74193f82d345538263ffd281229be58a326'
COMMIT = '927d38b2cca815f02a0b1636ec06f63c24603396'


class Refusal(Exception):
    pass

def need(condition, reason):
    if not condition:
        raise Refusal(reason)

def exact(obj, keys, reason):
    need(type(obj) is dict and set(obj) == set(keys), reason)

def integer(x, minimum=0, maximum=9007199254740991):
    return type(x) is int and minimum <= x <= maximum

def number(x, minimum=0, maximum=float('inf')):
    return type(x) in (int, float) and math.isfinite(x) and minimum <= x <= maximum

def sha_file(path):
    h = hashlib.sha256(); n = 0
    with open(path, 'rb') as f:
        while data := f.read(1024 * 1024):
            h.update(data); n += len(data)
    return h.hexdigest(), n

def no_duplicates(pairs):
    out = {}
    for key, value in pairs:
        need(key not in out, 'json_duplicate_key')
        out[key] = value
    return out

def parse(data):
    try:
        return json.loads(data, object_pairs_hook=no_duplicates, parse_constant=lambda _: (_ for _ in ()).throw(Refusal('json_nonfinite')))
    except Refusal:
        raise
    except (ValueError, TypeError, UnicodeError):
        raise Refusal('json_malformed')

def utc_time(value):
    need(type(value) is str and (value.endswith('Z') or value.endswith('+00:00')), 'utc_time')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise Refusal('utc_time')
    need(parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0, 'utc_time')
    return parsed

def invocation_proof(invocation, stdout, stderr):
    keys = ['schema','wrapperSha256','readerSha256','driverSha256','executedSourceSha256','planSha256','planBytes','container','requiredCommit','nodeLifetimeMs','remoteTimeoutSeconds','transportTimeoutSeconds','requestsMax','outputBytesMax','stderrBytesMax','authorization','retries','started','finished','elapsedSeconds','sshDockerNodeExitCode','outerRefusal','output','privateStderr','terminalValidationPending']
    exact(invocation, keys, 'invocation_schema')
    need(invocation['schema'] == 'root-readonly-bm25-acquisition.v1', 'invocation_schema')
    need(type(invocation['sshDockerNodeExitCode']) is int and invocation['sshDockerNodeExitCode'] == 0 and invocation['outerRefusal'] is None, 'invocation_not_success')
    need(invocation['planSha256'] == PLAN_SHA and invocation['readerSha256'] == READER_SHA and invocation['driverSha256'] == DRIVER_SHA and invocation['wrapperSha256'] == WRAPPER_SHA and invocation['executedSourceSha256'] == EXECUTED_SHA, 'invocation_source_bindings')
    need(invocation['container']==CONTAINER and invocation['requiredCommit']==COMMIT and invocation['terminalValidationPending'] is True,'invocation_target')
    fixed={'planBytes':602788,'nodeLifetimeMs':620000,'remoteTimeoutSeconds':630,'transportTimeoutSeconds':650,'requestsMax':88,'outputBytesMax':MAX_OUTPUT,'stderrBytesMax':1048576,'retries':0}
    for k,v in fixed.items(): need(type(invocation[k]) is int and invocation[k]==v,'invocation_bounds')
    need(type(invocation['authorization']) is str and invocation['authorization']=='existing task scope: fixed public catalog vector retrieval; no production writes or searches','invocation_authorization')
    need(number(invocation['elapsedSeconds'],0,650) and utc_time(invocation['finished']) >= utc_time(invocation['started']),'invocation_time')
    for label, path in [('output',stdout),('privateStderr',stderr)]:
        record = invocation[label]
        exact(record, ['sha256','bytes'], 'invocation_file_schema')
        need(integer(record['bytes']) and type(record['sha256']) is str and len(record['sha256']) == 64, 'invocation_file_schema')
        actual_hash, actual_bytes = sha_file(path)
        need(record['sha256'] == actual_hash and record['bytes'] == actual_bytes, f'{label}_physical_binding')
        if label == 'privateStderr': need(actual_bytes == 0, 'stderr_nonempty')
    need(invocation['output']['bytes'] <= MAX_OUTPUT, 'physical_output_bound')

def point(row, expected_id, expected_row, known_terms):
    base = ['kind','row','id','presence','valid']
    need(type(row) is dict and row.get('kind') == 'point' and integer(row.get('id'),1) and row['id'] == expected_id and integer(row.get('row')) and row['row'] == expected_row, 'point_alignment')
    need(type(row.get('valid')) is bool, 'point_valid_type')
    presence = row.get('presence')
    if row['valid']:
        exact(row, base + ['empty','reason','indices','observedValues','float32Values'], 'valid_point_schema')
        need(presence == 'present' and row['reason'] is None and type(row['empty']) is bool, 'valid_point_presence')
        indices, observed, reconstructed = row['indices'], row['observedValues'], row['float32Values']
        need(type(indices) is list and type(observed) is list and type(reconstructed) is list and len(indices) == len(observed) == len(reconstructed) <= 32768, 'vector_arrays')
        need(row['empty'] == (len(indices) == 0), 'empty_flag')
        previous = -1; unknown = []
        for term, value, binary32 in zip(indices, observed, reconstructed):
            need(integer(term,0,4294967295) and term > previous, 'vector_indices'); previous = term
            need(number(value,0,1) and number(binary32,0,1), 'vector_value')
            try:
                expected = struct.unpack('<f',struct.pack('<f',value))[0]
            except (OverflowError, struct.error):
                raise Refusal('float32_range')
            need(value == 0 or expected > 0, 'float32_underflow')
            need(binary32 == expected, 'float32_reconstruction')
            if term not in known_terms:
                unknown.append(term)
        return 'valid', len(indices), unknown, row['empty']
    exact(row, base + ['reason'], 'invalid_point_schema')
    reasons = {'point-missing':'point_missing','omitted':'vector_omitted','null':'vector_null'}
    if presence in reasons:
        need(row['reason'] == reasons[presence], 'missing_reason')
        return 'missing', 0, [], False
    need(presence == 'present' and row['reason'] in ('vector_shape','vector_indices','vector_values','vector_float32_range'), 'invalid_reason')
    return 'invalid', 0, [], False

def observation(row, kind):
    exact(row,['kind','observedAt','collection','vector','modifier','pointsCount','status','shards','replication','configurationProjectionSha256'], 'observation_schema')
    need(row['kind'] == kind, 'observation_time'); utc_time(row['observedAt'])
    need(row['collection'] == COLLECTION and row['vector'] == VECTOR and row['modifier'] in (None,'none'), 'observation_vector')
    need(integer(row['pointsCount']) and type(row['status']) is str, 'observation_numeric')
    for key in ('shards','replication'):
        need(row[key] is None or integer(row[key],1), 'observation_numeric')
    projection = {k:row[k] for k in ['collection','vector','modifier','pointsCount','status','shards','replication']}
    # Reader's public projection hash uses insertion order, compact JSON; values are ASCII/numeric.
    digest = hashlib.sha256(json.dumps(projection,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
    need(digest == row['configurationProjectionSha256'], 'observation_projection_hash')
    return digest

def validate_stream(path, plan, known_terms, unknown_output):
    counts = {'rows':0,'valid':0,'missing':0,'invalid':0,'empty':0,'entries':0,'unknownTermEntries':0,'rowsWithUnknownTerms':0}
    h = hashlib.sha256(); bytes_read = 0; unknown_bytes = 0; unknown_hash = hashlib.sha256()
    header = None; before = None; after = None; terminal = None; line_no = 0
    with open(path,'rb') as f:
        while True:
            data = f.readline(MAX_LINE + 1)
            if not data:
                break
            line_no += 1
            need(len(data) <= MAX_LINE, 'line_bound')
            need(data.endswith(b'\n'), 'physical_newline_missing')
            prior_bytes = bytes_read; bytes_read += len(data)
            need(bytes_read <= MAX_OUTPUT, 'physical_output_bound'); h.update(data)
            row = parse(data)
            need(terminal is None, 'data_after_terminal')
            if line_no == 1:
                exact(row,['kind','schema','planSha256','readerSha256','collection','vector','expectedRows','float32Reconstruction','historicalSnapshotEqualityProven'], 'header_schema')
                need(row['kind']=='header' and row['schema']==SCHEMA and row['planSha256']==PLAN_SHA and row['readerSha256']==READER_SHA and row['collection']==COLLECTION and row['vector']==VECTOR and row['expectedRows']==42934 and type(row['expectedRows']) is int and row['float32Reconstruction']=='Math.fround(observedDecimal)' and row['historicalSnapshotEqualityProven'] is False,'header_binding'); header = row
            elif line_no == 2:
                before = observation(row,'collection-before')
            elif counts['rows'] < 42934:
                index = counts['rows']; classification,n,unknown,empty = point(row,plan['ids'][index],index,known_terms)
                counts['rows'] += 1; counts[classification] += 1; counts['entries'] += n; counts['empty'] += int(empty)
                need(counts['entries'] <= 134217728, 'total_entry_bound')
                if unknown:
                    # Row-local IDs preserve all unknown occurrences; do not accumulate an unbounded global set.
                    b = (json.dumps({'row':index,'id':row['id'],'unknownTermIds':unknown},separators=(',',':'))+'\n').encode()
                    unknown_bytes += len(b); need(unknown_bytes <= MAX_UNKNOWN, 'unknown_output_bound')
                    unknown_output.write(b); unknown_hash.update(b)
                    counts['unknownTermEntries'] += len(unknown); counts['rowsWithUnknownTerms'] += 1
            elif after is None:
                after = observation(row,'collection-after'); need(after == before,'observation_changed')
            else:
                exact(row,['kind','schema','complete','requests','pointRequests','rows','valid','missing','invalid','empty','entries','responseBytes','outputBytesBeforeTerminal','elapsedMs','productionWrites','searchRequests','modelCalls','historicalSnapshotEqualityProven'],'terminal_schema')
                need(row['kind']=='terminal' and row['schema']==SCHEMA and row['complete'] is True and row['historicalSnapshotEqualityProven'] is False,'terminal_not_success')
                for key in ['requests','pointRequests','rows','valid','missing','invalid','empty','entries','responseBytes','outputBytesBeforeTerminal','productionWrites','searchRequests','modelCalls']:
                    need(integer(row[key]),'terminal_numeric')
                need(row['requests']==88 and row['pointRequests']==86,'terminal_requests')
                for key in ('rows','valid','missing','invalid','empty','entries'):
                    need(row[key] == counts[key],'terminal_counts')
                need(row['productionWrites']==row['searchRequests']==row['modelCalls']==0,'terminal_operations')
                need(row['responseBytes'] <= 1024**3 and row['outputBytesBeforeTerminal']==prior_bytes and number(row['elapsedMs'],0,600000),'terminal_bounds')
                terminal = row
    need(header is not None and before is not None and after is not None and terminal is not None and counts['rows']==42934,'physical_eof_incomplete')
    unknown_output.flush()
    return {'schema':'offline-bm25-physical-validation.v1','validatedAcquisitionComplete':True,**counts,'stdoutSha256':h.hexdigest(),'stdoutBytes':bytes_read,'unknownSidecarSha256':unknown_hash.hexdigest(),'unknownSidecarBytes':unknown_bytes,'knownTermIdCount':len(known_terms),'collectionProjectionSha256':before,'terminal':terminal,'historicalSnapshotEqualityProven':False,'productionCandidateParityProven':False,'qualityPass':False}

def validate_inputs(plan_path,term_path):
    plan_bytes = Path(plan_path).read_bytes(); need(hashlib.sha256(plan_bytes).hexdigest()==PLAN_SHA,'plan_hash')
    plan = parse(plan_bytes)
    need(len(plan['ids'])==42934 and len(set(plan['ids']))==42934 and all(integer(x,1) for x in plan['ids']),'plan_ids')
    term_key = next((key for key in plan['inputs'] if key.endswith('/term_statistics.json.gz')),None)
    need(term_key is not None,'term_binding_missing'); actual_sha,actual_size=sha_file(term_path); expected=plan['inputs'][term_key]
    need(actual_sha==expected['sha256'] and actual_size==expected['bytes'],'term_file_binding')
    with gzip.open(term_path,'rb') as f:
        data = f.read(128*1024*1024+1)
    need(len(data)<=128*1024*1024,'term_document_bound'); t=parse(data)
    exact(t, ['n','terms','ids','df'], 'term_schema')
    need(type(t) is dict and type(t.get('n')) is int and t.get('n')==42934 and type(t.get('ids')) is list and len(t['ids'])==650794 and len(set(t['ids']))==650794 and all(integer(x,0,4294967295) for x in t['ids']),'term_ids')
    need(type(t.get('terms')) is list and type(t.get('df')) is list and len(t['terms'])==len(t['df'])==len(t['ids']),'term_columns')
    return plan,set(t['ids'])

def main():
    p=argparse.ArgumentParser();p.add_argument('--plan',required=True);p.add_argument('--term-statistics',required=True);p.add_argument('--stdout',required=True);p.add_argument('--stderr',required=True);p.add_argument('--invocation',required=True);p.add_argument('--wrapper',required=True);p.add_argument('--output',required=True);args=p.parse_args()
    out=Path(args.output);out.mkdir(mode=0o700,exist_ok=False)
    try:
        need(sha_file(args.wrapper)[0]==WRAPPER_SHA,'wrapper_file_binding')
        plan,known=validate_inputs(args.plan,args.term_statistics)
        invocation=parse(Path(args.invocation).read_bytes());invocation_proof(invocation,args.stdout,args.stderr)
        with open(out/'unknown-term-ids.ndjson','xb') as unknown:
            result=validate_stream(args.stdout,plan,known,unknown)
        need(result['stdoutSha256']==invocation['output']['sha256'] and result['stdoutBytes']==invocation['output']['bytes'],'stdout_changed_during_validation')
        (out/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
    except (Refusal,OSError,ValueError,KeyError,TypeError,StopIteration) as e:
        reason=str(e) if isinstance(e,Refusal) else 'validator_failure'
        (out/'refusal.json').write_text(json.dumps({'validatedAcquisitionComplete':False,'reason':reason,'outputConsumed':True})+'\n')
        raise SystemExit(1)

if __name__=='__main__':
    main()

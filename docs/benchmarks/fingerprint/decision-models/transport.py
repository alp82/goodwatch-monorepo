"""Bounded urllib diagnostics. Inert imports; no retries, credentials or dispatch authority.

Only successful POST/generation response bytes are deliberately retained privately.
HTTP error bodies are inspected in memory for allowlisted typed fields, never saved.
"""
from pathlib import Path
import errno
import hashlib
import json
import os
import queue
import re
import socket
import ssl
import threading
import time
import urllib.error
import urllib.request
import uuid

SUCCESS_LIMIT = 2_000_000
ERROR_LIMIT = 16_384
SOCKET_TIMEOUT = 120
OUTER_TIMEOUT = 120
NATIVE_ENDPOINTS = {
    'native/openrouter-systemone-map-v1':'https://openrouter.ai/api/v1/systemone',
    'native/openrouter-decisions-map-v1':'https://openrouter.ai/api/alpha/decisions',
    'native/direct-jev-choice-v1':'https://api.typesafe.ai/v1/systemone',
    'native/celeris-decisions-list-v1':'https://inference.celeris.ai/celeris-1-decision/v1/decisions',
    'native/systemone-map-v1':'https://api.bespokelabs.ai/v1/systemone',
}

PUBLIC_CATALOG_PATHS=frozenset('models/'+m+'/endpoints' for m in ('typesafe/jev-1.14','perplexity/pplx-decider-flash-v1.2','respan/span-02','microsoft/microsoft-decision-1','liquid/d1','nace-ai/drex-v2.0'))

ERROR_CODES = frozenset({
    'invalid_request', 'invalid_request_error', 'invalid_api_key',
    'authentication_error', 'insufficient_credits', 'payment_required',
    'rate_limit_exceeded', 'rate_limit_error', 'model_not_found',
    'no_available_endpoints', 'provider_error', 'invalid_parameter',
    'schema_validation_error', 'context_length_exceeded', 'server_error',
})
CORRELATION_HEADERS = ('x-request-id', 'x-openrouter-request-id',
                       'x-provider-request-id', 'cf-ray')
ID_PATTERN = re.compile(r'(?:[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}|(?:req|gen)-[0-9A-Za-z-]{1,124}|[0-9a-fA-F]{16,32}-[A-Z]{3})\Z')
CATEGORIES = frozenset({
    'http_rejection', 'socket_timeout', 'outer_timeout', 'dns_failure',
    'connect_refused', 'connect_unreachable', 'connection_reset',
    'tls_certificate_failure', 'tls_failure', 'urllib_failure',
    'transport_unknown', 'response_read_failure', 'response_oversized',
    'response_non_json', 'response_json_parse_failure',
    'response_encoding_failure', 'response_json_contract_failure',
    'response_json_shape_failure', 'local_request_encoding_failure',
    'local_request_construction_failure', 'local_evidence_failure',
    'local_contract_guard', 'generation_metadata_shape_failure',
    'response_credential_echo',
    'local_response_persistence_failure', 'local_output_json_parse_failure',
})


class TransportFailure(Exception):
    def __init__(self, note):
        # Constructed only from controlled fields in this module. No exception text.
        self.note = note
        super().__init__(note['category'])


def phase_for(method, path):
    if method == 'POST' and path in NATIVE_ENDPOINTS:return 'native_post'
    if method=='GET' and path in PUBLIC_CATALOG_PATHS:return 'catalog_get'
    endpoint = path.partition('?')[0]
    return {('POST', 'chat/completions'): 'chat_post',
            ('GET', 'generation'): 'generation_get',
            ('GET', 'models/qwen/qwen3.8-flash/endpoints'): 'catalog_get',
            ('GET', 'key'): 'key_get'}.get((method, endpoint), 'unclassified')


def safe_id(value, key):
    return value if isinstance(value, str) and len(value) <= 128 and not (key and key in value) and ID_PATTERN.fullmatch(value) else None


def code_value(value):
    if type(value) is int and 100 <= value <= 599:
        return value
    if isinstance(value, str) and value in ERROR_CODES:
        return value
    return None


def body_fields(obj, key):
    fields = {}
    correlations = {}
    if not isinstance(obj, dict):
        return fields
    error = obj.get('error')
    if isinstance(error, dict):
        code = code_value(error.get('code'))
        if code is not None and not (isinstance(code, str) and key and key in code):
            fields['provider_error_code'] = code
            fields['provider_error_code_origin'] = 'error.code'
        elif 'code' in error:
            fields['unrecognized_error_code_omitted'] = True
        metadata = error.get('metadata')
        if isinstance(metadata, dict):
            for name in ('request_id', 'generation_id'):
                value = safe_id(metadata.get(name), key)
                if value:
                    correlations['error.metadata.' + name] = value
                    fields[name] = value
                    fields[name + '_origin'] = 'error.metadata.' + name
    for name in ('request_id', 'id'):
        value = safe_id(obj.get(name), key)
        if value:
            correlations['response.' + name] = value
            target = 'generation_id' if name == 'id' and value.startswith('gen-') else 'request_id'
            fields[target] = value
            fields[target + '_origin'] = 'response.' + name
    if correlations:
        fields['body_correlations'] = correlations
    return fields


def headers_fields(headers, key):
    result = {}
    for name in CORRELATION_HEADERS:
        value = safe_id(headers.get(name), key) if headers else None
        if value:
            result[name] = value
    return {'correlation_headers': result} if result else {}


def classify(error):
    if isinstance(error, urllib.error.URLError):
        reason = error.reason
        return classify(reason) if isinstance(reason, BaseException) else 'urllib_failure'
    if isinstance(error, ssl.SSLCertVerificationError):
        return 'tls_certificate_failure'
    if isinstance(error, ssl.SSLError):
        return 'tls_failure'
    if isinstance(error, socket.gaierror):
        return 'dns_failure'
    if isinstance(error, TimeoutError):
        return 'socket_timeout'
    if isinstance(error, ConnectionRefusedError):
        return 'connect_refused'
    if isinstance(error, ConnectionResetError):
        return 'connection_reset'
    if isinstance(error, OSError) and error.errno in (errno.ENETUNREACH, errno.EHOSTUNREACH):
        return 'connect_unreachable'
    return 'transport_unknown'


def failure_note(error, phase):
    if isinstance(error, TransportFailure):
        return dict(error.note)
    # No str(error), args, repr, URLs, headers, environment or tracebacks.
    category = classify(error)
    return {'category': category, 'phase': phase, 'http_status': None,
            'automatic_retry': False, 'acceptance': 'unknown',
            'charge_status': 'unresolved', 'upstream_cancelled': False}


class PrivateEvidence:
    """Optional explicit custody. No raw errors/preflight/account bodies retained."""
    def __init__(self, root):
        self.root = Path(root)

    def save(self, token, note, raw=None):
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.root.is_symlink() or self.root.stat().st_mode & 0o077:
            raise OSError('private_evidence_permissions')
        if not re.fullmatch(r'[0-9a-f]{32}', token):
            raise ValueError('local_token_shape')
        def write(suffix, value):
            fd = os.open(self.root/(token+suffix), os.O_WRONLY|os.O_CREAT|os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as stream:
                stream.write(value); stream.flush(); os.fsync(stream.fileno())
        if raw is not None:
            write('.successful-response.private.bin', raw)
        suffix = '.http.json' if note['category'] == 'successful_http_response' else '.failure.json'
        write(suffix, json.dumps(note, separators=(',', ':')).encode()+b'\n')


def http(key, method, path, body=None, *, decoder=json.loads, sink=None,
         opener_factory=None, socket_timeout=SOCKET_TIMEOUT, outer_timeout=OUTER_TIMEOUT,public=False,retain_success_raw=True):
    """One urllib open. No fallback/retry. Outer timeout never cancels upstream.

    Test injection controls only opener/timeouts; production adapter uses defaults.
    Worker performs no file writes; late results after outer deadline are discarded.
    """
    phase = phase_for(method, path)
    token = uuid.uuid4().hex
    started = time.monotonic()
    note = {'phase': phase, 'http_status': None, 'automatic_retry': False,
            'acceptance': 'unknown', 'charge_status': 'unresolved',
            'upstream_cancelled': False, 'local_operation_id': token}
    def fail(category, **extra):
        result = dict(note, category=category, **extra)
        result['elapsed_ms'] = round((time.monotonic()-started)*1000)
        if sink:
            try: sink.save(token, result)
            except Exception:
                result['diagnostic_persistence_failed'] = True
        raise TransportFailure(result) from None
    if phase == 'unclassified' or (body is not None and not isinstance(body, bytes)):
        fail('local_request_encoding_failure', network_open_attempted=False)
    if public and (key is not None or method!='GET' or path not in PUBLIC_CATALOG_PATHS or body is not None):fail('local_contract_guard',network_open_attempted=False)
    try:
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs): return None
        factory = opener_factory or (lambda: urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect()))
        opener = factory()
        req = urllib.request.Request(NATIVE_ENDPOINTS.get(path,'https://openrouter.ai/api/v1/'+path),
              data=body, headers=({'Content-Type':'application/json'} if public else {'Authorization':'Bearer '+key,'Content-Type':'application/json'}), method=method)
    except Exception:
        fail('local_request_construction_failure', network_open_attempted=False)
    result = queue.Queue(maxsize=1)
    progress_lock = threading.Lock()
    progress = {'read_phase': 'awaiting_headers'}
    def publish_headers(status, headers):
        # In-memory only; lock never spans body/network/file I/O.
        with progress_lock:
            progress.update(http_status=status, read_phase='body_read')
            if 'correlation_headers' in headers:
                progress['correlation_headers'] = dict(headers['correlation_headers'])
    def worker():
        try:
            with opener.open(req, timeout=socket_timeout) as response:
                status = response.status
                headers = headers_fields(response.headers, key)
                publish_headers(status, headers)
                content_json = (response.headers.get('Content-Type', '').partition(';')[0].lower().strip() == 'application/json')
                try: raw = response.read(SUCCESS_LIMIT+1)
                except Exception as error:
                    result.put(('read_error', (error, status, headers)));return
                result.put(('ok', (raw, status, headers, content_json)))
        except urllib.error.HTTPError as error:
            status = error.code
            headers = headers_fields(error.headers, key)
            publish_headers(status, headers)
            try: raw = error.read(ERROR_LIMIT+1); state = 'bounded'
            except Exception: raw = b''; state = 'read_failure'
            finally:
                try: error.close()
                except Exception: pass  # Do not erase the already observed HTTP status.
            fields = {}
            if len(raw) > ERROR_LIMIT:
                state = 'oversized'
            elif state != 'read_failure':
                try: fields = body_fields(json.loads(raw), key); state = 'json'
                except (ValueError, UnicodeError): state = 'non_json'
            result.put(('http_error', (status, headers, state, fields)))
        except Exception as error:
            result.put(('error', error))
    threading.Thread(target=worker, daemon=True).start()
    try: kind, value = result.get(timeout=outer_timeout)
    except queue.Empty:
        with progress_lock:
            snapshot = dict(progress)
            if 'correlation_headers' in snapshot:
                snapshot['correlation_headers'] = dict(snapshot['correlation_headers'])
        note.update(snapshot)
        fail('outer_timeout', network_open_attempted=True)
    if kind == 'http_error':
        status, headers, state, fields = value
        note.update(http_status=status, **headers)
        fail('http_rejection', error_body_state=state, **fields)
    if kind == 'error': fail(classify(value), network_open_attempted=True)
    if kind == 'read_error':
        error, status, headers = value;note.update(http_status=status, **headers)
        category = classify(error)
        fail('response_read_failure' if category == 'transport_unknown' else category, response_body_state='read_failure')
    raw, status, headers, content_json = value
    note.update(http_status=status, **headers)
    if len(raw) > SUCCESS_LIMIT: fail('response_oversized', response_limit=SUCCESS_LIMIT)
    if not 200 <= status < 300: fail('http_rejection', error_body_state='unexpected_non2xx_response')
    # Deliberate private raw-success custody BEFORE JSON parsing/validation.
    # JSON may unicode-escape ASCII credential characters. Catch mixed literal/
    # escaped echoes as well; do not decode or retain an echoed credential.
    credential = re.compile(b''.join(b'(?:'+re.escape(c.encode())+b'|'+
                 re.escape(('\\u%04x' % ord(c)).encode())+b')' for c in key), re.IGNORECASE) if key else None
    redacted = bool(credential and credential.search(raw))
    retained = credential.sub(b'<REDACTED>', raw) if redacted else raw
    raw_note = dict(note, category='successful_http_response', raw_bytes=len(raw),
                    retained_bytes=len(retained), retained_sha256=hashlib.sha256(retained).hexdigest(),
                    credential_echo_redacted=redacted,
                    elapsed_ms=round((time.monotonic()-started)*1000))
    retain_raw = retain_success_raw and phase in ('chat_post','native_post','generation_get','catalog_get')
    if sink:
        try: sink.save(token, raw_note, retained if retain_raw else None)
        except Exception: fail('local_evidence_failure', successful_http_response_received=True)
    if redacted: fail('response_credential_echo')
    try: decoded = decoder(raw)
    except UnicodeError: fail('response_encoding_failure')
    except (ValueError, TypeError): fail('response_json_parse_failure' if content_json else 'response_non_json')
    except Exception: fail('response_json_contract_failure')
    if not isinstance(decoded, dict): fail('response_json_shape_failure')
    return decoded


def generation_fields(obj):
    """Shape-only extraction. Exact ID/model/usage/cost guards remain in accounting."""
    fields = ('id','model','provider_name','total_cost','native_tokens_prompt',
              'native_tokens_completion','native_tokens_reasoning','native_tokens_cached',
              'tokens_prompt','tokens_completion','latency','generation_time','finish_reason',
              'is_byok','cancelled','data_region','upstream_inference_cost','cache_discount','api_type','provider_responses','request_id','num_fetches','num_search_results','usage','created_at')
    if not isinstance(obj, dict) or not isinstance(obj.get('data'), dict):
        raise TransportFailure(dict(failure_note(Exception(), 'generation_get'),
                                    category='generation_metadata_shape_failure'))
    value={k:obj['data'][k] for k in fields if k in obj['data']}
    if isinstance(value.get('provider_responses'),list):value['provider_responses']=[{k:v for k,v in r.items() if k in ('endpoint_id','id','is_byok','latency','model_permaslug','provider_name','status','routed_service_tier')} if isinstance(r,dict) else None for r in value['provider_responses']]
    return value


def decode_message(content):
    try:
        if not isinstance(content, str): raise ValueError()
        return json.loads(content)
    except (ValueError, TypeError, UnicodeError):
        raise TransportFailure(dict(failure_note(Exception(), 'local_output_parse'),
                                    category='local_output_json_parse_failure')) from None

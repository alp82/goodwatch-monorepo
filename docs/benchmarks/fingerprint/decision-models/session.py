"""Durable one-attempt cursor. A halt never means an upstream request was canceled."""
import copy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import fcntl
import json
import os
from pathlib import Path
import re
import time
from core import digest, wire, unique_json, SCHEMA_HASH
from adapters import ADAPTERS, render
import transport


class Stop(Exception): pass


def money(v):
    try: d=Decimal(str(v))
    except InvalidOperation: raise Stop('money_shape') from None
    if not d.is_finite() or d<0:raise Stop('money_range')
    return d


def private_dir(p):
    p=Path(p);p.mkdir(mode=0o700,parents=True,exist_ok=True)
    if p.is_symlink() or p.stat().st_mode & 0o077: raise Stop('private_permissions')
    return p


def save(p,obj,exclusive=False):
    p=Path(p);data=wire(obj)+b'\n';flags=os.O_WRONLY|os.O_CREAT|(os.O_EXCL if exclusive else os.O_TRUNC)
    fd=os.open(p,flags|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())


def save_raw(p,data):
    fd=os.open(Path(p),os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as f:f.write(data);f.flush();os.fsync(f.fileno())


def atomic(p,obj):
    tmp=Path(str(p)+'.next');save(tmp,obj,exclusive=True);os.replace(tmp,p)
    fd=os.open(Path(p).parent,os.O_RDONLY);os.fsync(fd);os.close(fd)


def code_seals():
    root=Path(__file__).parent
    return {p.name:digest(p.read_bytes()) for p in sorted(root.iterdir()) if p.suffix in ('.py','.json','.md')}


def approved(manifest_path, approval_path, approval_sha, *, now=None):
    """Exact approval/code/input/price/cursor binding; no environment reads here."""
    p=Path(manifest_path);m=unique_json(p.read_bytes());a_raw=Path(approval_path).read_bytes()
    if digest(a_raw)!=approval_sha:raise Stop('approval_digest')
    a=unique_json(a_raw)
    if a.get('status')!='APPROVED' or a.get('purpose')!='v1_decision_benchmark':raise Stop('not_bench_approval')
    if a.get('manifest_sha256')!=digest(p.read_bytes()) or a.get('code_seals')!=code_seals():raise Stop('seal_changed')
    clock=now or datetime.now(timezone.utc)
    if clock>=datetime.fromisoformat(a['expires_at']):raise Stop('approval_expired')
    if len(m['cells'])+m['opening_accounting']['attempts']>m['cumulative_attempt_cap']:raise Stop('manifest_exceeds_initial_attempt_capacity')
    # Prior Q12/Q13 authorizations cannot pass this purpose/hash gate.
    if m['opening_accounting'].get('semantic_hold'):raise Stop('active_semantic_hold')
    pending=m['opening_accounting'].get('pending',{})
    if pending and (m['opening_accounting'].get('accounting_kind')!='retired_stage_carry' or a.get('carried_pending_exception')!=pending):raise Stop('explicit_new_human_pending_exception_required')
    if a.get('counting_scope_acknowledgment')!=m.get('counting_scope_proposal'):raise Stop('counting_scope_unapproved')
    if a.get('budget_usd')!=m['new_run_budget_usd'] or money(m['new_run_budget_usd'])<=0:raise Stop('budget_unapproved')
    if not a.get('human_authorization_record_sha256') or not a.get('root_release_sha256'):raise Stop('custody_missing')
    # These are externally reviewed receipt references, never worker-created authorization.
    for name in ('human_authorization_record','root_release'):
        ref=Path(a[name+'_path'])
        if digest(ref.read_bytes())!=a[name+'_sha256']:raise Stop('custody_digest')
        receipt=unique_json(ref.read_bytes())
        if receipt.get('status')!='APPROVED' or receipt.get('manifest_sha256')!=digest(p.read_bytes()):raise Stop('custody_scope')
        if receipt.get('counting_scope_acknowledgment')!=m.get('counting_scope_proposal'):raise Stop('custody_counting_scope')
        if name=='root_release' and (not a.get('runtime_path') or receipt.get('runtime_path')!=a['runtime_path']):raise Stop('custody_runtime_binding')
        if name=='human_authorization_record':
            if pending and receipt.get('carried_pending_exception')!=pending:raise Stop('human_pending_exception_missing')
            if receipt.get('route_input_exceptions',{})!=a.get('route_input_exceptions',{}):raise Stop('human_input_exception_binding')
    return m,a


def cell_candidate(candidate,cell):
    result=copy.deepcopy(candidate)
    if 'expected_keys' in cell:result['field_keys']=cell['expected_keys']
    if 'input_billing_ceiling_tokens' in cell:result['post_input_cap']=cell['input_billing_ceiling_tokens']
    return result


def validate_manifest(m):
    if m['version']!='v1-decision-bench-1' or m['schema_sha256']!=SCHEMA_HASH:raise Stop('manifest_version')
    if money(m['total_limit_usd'])>Decimal('5') or money(m['title_limit_usd'])>Decimal('3.50'):raise Stop('hard_allocation_ceiling')
    if m['new_retries']!=0 or m['cumulative_attempt_cap']>72:raise Stop('hard_attempt_scope')
    if m.get('reservation_policy')!='rolling-next-post-v1':raise Stop('reservation_policy')
    if len({c['id'] for c in m['cells']})!=len(m['cells']):raise Stop('duplicate_cell')
    if len({c['id'] for c in m['candidates']})!=len(m['candidates']):raise Stop('duplicate_candidate')
    for c in m['cells']:
        if not re.fullmatch('[A-Za-z0-9_-]{1,80}',c['id']):raise Stop('cell_id')
        t=m['titles'][c['title_index']];candidate=next(x for x in m['candidates'] if x['id']==c['candidate_id'])
        r=render(t,cell_candidate(candidate,c))
        if c.get('endpoint',r['endpoint'])!=r['endpoint']:raise Stop('endpoint_seal')
        if r['wire_sha256']!=c['request_sha256'] or r['input_sha256']!=c['input_sha256']:raise Stop('request_seal')
    return True


def next_bound_check(m,l):
    """Pure preflight: one explicit POST bound, no aggregate-grid reservation."""
    if l.get('bound_breaches'):raise Stop('accounting_bound_breach')
    if l['state']!='ready':raise Stop('paused_no_replay')
    if l['cursor']>=len(m['cells']):raise Stop('no_next_cell')
    if len(l['attempts'])+l['opening']['attempts']>=m['cumulative_attempt_cap']:raise Stop('attempt_limit')
    bound=money(m['cells'][l['cursor']]['full_cost_bound_usd'])
    if bound<=0:raise Stop('bound_missing')
    if money(l['new_run_known_usd'])+money(l['new_run_pending_usd'])+bound>money(m['new_run_budget_usd']):raise Stop('new_run_budget')
    exposure=money(l['cash_usd'])+sum(map(money,l['pending'].values()),Decimal(0))+bound
    if exposure>money(m['total_limit_usd']):raise Stop('global_budget')
    if exposure>money(m['title_limit_usd']):raise Stop('title_budget')
    return bound


class Session:
    def __init__(self, manifest_path, runtime):
        self.path=Path(manifest_path);self.m=unique_json(self.path.read_bytes());validate_manifest(self.m)
        self.root=private_dir(runtime)
        fd=os.open(self.root/'lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600);self.lock=os.fdopen(fd,'r+')
        try:fcntl.flock(self.lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except Exception:self.lock.close();raise
        self.ledger=self.root/'ledger.json'
        if not self.ledger.exists():
            opening=copy.deepcopy(self.m['opening_accounting'])
            save(self.ledger,{'manifest_sha256':digest(self.path.read_bytes()),'opening':opening,'cash_usd':opening['cash_usd'],'pending':opening['pending'],'attempts':[],'cursor':0,'state':'ready','new_run_known_usd':'0','new_run_pending_usd':'0','reservation_policy':'rolling-next-post-v1','new_stage_reservation_usd':'0','held_stage_usd':opening['held_stage_usd']},exclusive=True)
        self.l=unique_json(self.ledger.read_bytes())
        if self.l['manifest_sha256']!=digest(self.path.read_bytes()):
            self.lock.close();raise Stop('runtime_manifest_mismatch')

    def close(self):self.lock.close()

    def bind_authority(self, approval_sha, approval):
        """Called only after live approval_gate; fixtures label their binding synthetic.

        This persists custody references, never creates or verifies human approval.
        """
        value={'manifest_sha256':digest(self.path.read_bytes()),'runtime_path':str(self.root.resolve()),
               'approval_sha256':approval_sha,'human_authorization_record_sha256':approval.get('human_authorization_record_sha256'),
               'root_release_sha256':approval.get('root_release_sha256'),'carried_pending_exception':approval.get('carried_pending_exception'),
               'synthetic':approval.get('synthetic',False)}
        if approval.get('runtime_path')!=value['runtime_path'] or any(not isinstance(value[k],str) or not re.fullmatch('[0-9a-f]{64}',value[k]) for k in ('approval_sha256','human_authorization_record_sha256','root_release_sha256')):raise Stop('authority_binding_shape')
        path=self.root/'authority.json'
        if path.exists():
            if unique_json(path.read_bytes())!=value:raise Stop('consolidated_authority_changed')
        else:save(path,value,exclusive=True)


    def one(self, send, *, synthetic=False, carried_pending_exception=None,metadata_lookup=None,metadata_sleep=time.sleep):
        """Caller supplies approved transport; exactly one send site and zero retries."""
        wall_started=time.monotonic();l=self.l;m=self.m
        if l['state']!='ready':raise Stop('paused_no_replay')
        exact_carry=l['opening'].get('accounting_kind')=='retired_stage_carry' and l['pending']==l['opening']['pending'] and carried_pending_exception==l['opening']['pending']
        if not synthetic and ((l['pending'] and not exact_carry) or l['opening'].get('semantic_hold')):raise Stop('unresolved_hold')
        next_bound_check(m,l)
        cell=m['cells'][l['cursor']];cand=next(x for x in m['candidates'] if x['id']==cell['candidate_id']);title=m['titles'][cell['title_index']]
        cand=cell_candidate(cand,cell);req=render(title,cand);bound=money(cell['full_cost_bound_usd'])
        if bound<=0:raise Stop('bound_missing')
        if money(l['new_run_known_usd'])+money(l['new_run_pending_usd'])+bound>money(m['new_run_budget_usd']):raise Stop('new_run_budget')
        if money(l['cash_usd'])+sum(map(money,l['pending'].values()),Decimal(0))+bound>money(m['total_limit_usd']):raise Stop('global_budget')
        if money(l['cash_usd'])+sum(map(money,l['pending'].values()),Decimal(0))+bound>money(m['title_limit_usd']):raise Stop('title_budget')
        if not synthetic and l['opening'].get('accounting_kind')!='retired_stage_carry' and money(l['held_stage_usd'])>0 and money(l['cash_usd'])+sum(map(money,l['pending'].values()),Decimal(0))+bound>money(l['held_stage_usd']):raise Stop('retained_stage_ceiling')
        # Preserve the existing stage hold exactly once; never add it to spent cash.
        if m['new_run_budget_usd']!='0' and not synthetic and not m.get('allocation_disposition_reviewed'):raise Stop('allocation_not_reviewed')
        if req['wire_sha256']!=cell['request_sha256']:raise Stop('wire_changed')
        artifact=self.root/cell['id'];artifact.mkdir(mode=0o700) # exclusive replay barrier
        save_raw(artifact/'request.json',wire(req['body']))
        attempt={'reserved_at_utc':datetime.now(timezone.utc).isoformat(),'cell_id':cell['id'],'request_sha256':req['wire_sha256'],'full_bound_usd':str(bound),'status':'reserved_dispatch_possible','charge':'unknown','retry':False}
        l['attempts'].append(attempt);l['pending'][cell['id']]=str(bound);l['new_run_pending_usd']=str(money(l['new_run_pending_usd'])+bound);l['state']='paused_reserved'
        atomic(self.ledger,l) # crash from here retains liability; no blind duplicate
        start=time.monotonic()
        try: raw=send(req['body'],artifact,cand)
        except Exception as e:
            note=transport.failure_note(e,'benchmark_post');save(artifact/'diagnostic.json',note,exclusive=True)
            attempt['status']='paused_transport_or_local_unknown';l['state']=attempt['status'];atomic(self.ledger,l);return attempt
        request_seconds=time.monotonic()-start
        save(artifact/'response.json',raw,exclusive=True)
        parse_started=time.monotonic()
        try:
            evidence=list((artifact/'http').glob('*.successful-response.private.bin')) if (artifact/'http').exists() else []
            exact=evidence[0].read_bytes() if len(evidence)==1 else None
            custody={'source':'bounded HTTP receipt; request-associated route is not serving attestation','request_model':cand['model'],'request_provider':cand.get('provider')}
            receipts=list((artifact/'http').glob('*.http.json')) if (artifact/'http').exists() else []
            if len(receipts)==1:
                note=unique_json(receipts[0].read_bytes());custody.update(http_receipt_sha256=digest(receipts[0].read_bytes()),http_status=note.get('http_status'),correlation_headers=note.get('correlation_headers'),local_operation_id=note.get('local_operation_id'))
            if cand['adapter']=='openrouter':parsed=ADAPTERS[cand['adapter']].parse(raw,title,cand)
            else:parsed=ADAPTERS[cand['adapter']].parse(raw,title,cand,raw_response_bytes=exact,custody=custody)
        except Exception:
            save(artifact/'diagnostic.json',{'category':'local_adapter_parse','raw_response_retained':True,'charge':'unknown'},exclusive=True)
            attempt['status']='paused_local_parse_unknown';l['state']=attempt['status'];atomic(self.ledger,l);return attempt
        parsed['transport_seconds']=request_seconds
        parsed['stage_latency_seconds']={'request_wall':request_seconds,'local_parse':time.monotonic()-parse_started,'vector_wall_so_far':time.monotonic()-wall_started}
        parsed.update(candidate_id=cand['id'],cell_id=cell['id'],chunk_index=cell.get('chunk_index',0),chunk_count=cell.get('chunk_count',1),expected_fields=cell.get('expected_keys',__import__('core').KEYS))
        parsed['normalized_response_sha256']=digest((artifact/'response.json').read_bytes());parsed['transport_custody']='http/ bounded successful-response bytes and sanitized HTTP correlation receipt; no automatic metadata lookup'
        parsed['mapping']=cand['mapping'];parsed['input_sha256']=req['input_sha256'];parsed['request_sha256']=req['wire_sha256']
        # All raw predictions retained even on refusal/format/guard failure.
        guard=[]
        if cand.get('route_contract_id'):
            from route_runtime import metadata_join
            joined=metadata_join(raw,cand,bound,metadata_lookup,artifact,sleep=metadata_sleep,context={'manifest_sha256':digest(self.path.read_bytes()),'cell_id':cell['id'],'request_sha256':req['wire_sha256'],'exact_response_bytes_sha256':digest(exact) if exact is not None else None,'parsed_response_sha256':digest((artifact/'response.json').read_bytes())})
            parsed['native_generation_join']=joined;guard+=joined['binding_conflicts']
            cost=money(joined['reported_cost_usd']) if joined.get('reported_cost_usd') is not None else None
            if cost is None:guard.append('cost_unknown')
        else:
            if raw.get('model') not in cand['allowed_returned_models']:guard.append('model_identity')
            if cand['adapter']=='openrouter' or cand['adapter'].startswith('openrouter-'):
                if raw.get('provider') not in cand['allowed_returned_providers']:guard.append('provider_identity')
            usage=raw.get('usage')
            if not isinstance(usage,dict):usage={};guard.append('usage_missing')
            native=cand['adapter'].startswith('openrouter-') or cand['adapter'] in ('direct-jev-choice-v1','celeris-decisions-list-v1','systemone-map-v1')
            it=usage.get('input_tokens' if native else 'prompt_tokens');ot=usage.get('output_tokens' if native else 'completion_tokens');detail=usage.get('completion_tokens_details') or {};rt=detail.get('reasoning_tokens',0)
            # OpenRouter completion_tokens includes reasoning; never sum it twice.
            if type(it) is not int or it>cand['input_cap'] or it<0:guard.append('input_cap_or_missing')
            if type(ot) is not int or ot>cand['total_output_cap'] or ot<0 or type(rt) is not int or rt<0 or (type(ot) is int and rt>ot):guard.append('output_cap_or_accounting')
            try:
                cost=money(usage['cost'])
                if cost>bound:guard.append('cost_exceeds_bound')
            except (KeyError,Stop):cost=None;guard.append('cost_unknown')
        parsed['guard_errors']=guard;parsed['reported_cost_usd']=str(cost) if cost is not None else None;parsed['cost_status']='reported_unreconciled'
        parsed['canonical_acceptance']=False
        save(artifact/'parsed.json',parsed,exclusive=True)
        attempt['status']='paused_output_review' if parsed['format_valid'] and not guard else 'paused_invalid_or_guard'
        attempt['response_received_at_utc']=datetime.now(timezone.utc).isoformat();attempt['reported_cost_usd']=parsed['reported_cost_usd'];l['state']=attempt['status'];l['cursor']+=1
        # Successful response does not reconcile charge. Never release based solely on response.cost.
        atomic(self.ledger,l);return attempt


def live_one(manifest, runtime, approval, approval_sha, credential_env):
    """Not used by demo/tests. Catalog/approval/holds checked before credential resolution."""
    m,a=approved(manifest,approval,approval_sha);validate_manifest(m)
    if a.get('runtime_path')!=str(Path(runtime).resolve()):raise Stop('exclusive_runtime_binding')
    for c in m['candidates']:
        if not c.get('enabled') or c['adapter'] not in ('openrouter','openrouter-systemone-map-v1','openrouter-decisions-map-v1') or c.get('admission_status')!='REVIEWED':raise Stop('candidate_not_admitted')
        if c['input_cap']>16000 and a.get('route_input_exceptions',{}).get(c['id'])!=c['input_cap']:raise Stop('new_input_cap_exception_not_authorized')
        if c.get('total_output_cap',8192)>8192:raise Stop('output_cap_exception_not_authorized')
        if c.get('input_bound_proof_status')!='REVIEWED' or c['input_bound_tokens']>c['input_cap']:raise Stop('input_bound_not_admitted')
        if c['adapter']=='openrouter':
            if c.get('output_accounting')!='completion_includes_reasoning' or c['max_completion_tokens']>c['total_output_cap']:raise Stop('output_guard_not_admitted')
        else:
            if c.get('route_contract_id'):
                from route_runtime import validate_candidate,POLICY,CONTRACT
                validate_candidate(c)
                if m.get('native_metadata_policy')!=POLICY:raise Stop('native_metadata_policy_binding')
                proof=Path(c['native_guard_receipt_path'])
                if digest(proof.read_bytes())!=c['native_guard_receipt_sha256']:raise Stop('native_guard_receipt_digest')
                receipt=unique_json(proof.read_bytes());hashes=[x['request_sha256'] for x in m['cells'] if x['candidate_id']==c['id']]
                expected={'status':'ROOT_REVIEWED','request_hashes':hashes,'model':c['model'],'provider':c['provider'],'guard_mode':'documented-server-price-filter-v1','max_price':c['max_price'],'source_matrix_sha256':CONTRACT['source_matrix_sha256'],'source_schema_sha256':CONTRACT['source_schema_sha256'],'metadata_policy':POLICY,'input_bound_tokens':c['input_bound_tokens'],'output_observed_threshold':8192,'provider_enforced_output_cap':False,'native_work_profile':CONTRACT['routes'][[r['candidate_id'] for r in CONTRACT['routes']].index(c['id'])]['native_work']}
                if any(receipt.get(k)!=v for k,v in expected.items()):raise Stop('native_documentary_receipt_binding')
            else:
                if c.get('price_and_usage_admission')!='REVIEWED' or not c.get('native_priceguard_supported') or not isinstance(c.get('max_price'),dict):raise Stop('native_price_usage_not_admitted')
                proof=Path(c['native_guard_receipt_path'])
                if digest(proof.read_bytes())!=c['native_guard_receipt_sha256']:raise Stop('native_guard_receipt_digest')
                receipt=unique_json(proof.read_bytes());hashes=[cell['request_sha256'] for cell in m['cells'] if cell['candidate_id']==c['id']]
                if receipt.get('status')!='ROOT_REVIEWED' or receipt.get('request_hashes')!=hashes or receipt.get('model')!=c['model'] or receipt.get('provider')!=c['provider']:raise Stop('native_guard_receipt_binding')
                if receipt.get('input_bound_tokens')!=c['input_bound_tokens'] or receipt.get('output_bound_tokens')!=c['total_output_cap'] or not receipt.get('no_implicit_generation_search_fallback') or not receipt.get('price_guard_verified'):raise Stop('native_guard_incomplete')
    with_session=Session(manifest,runtime)
    try:
        if with_session.l['state']!='ready' or with_session.l['pending']!=m['opening_accounting']['pending']:raise Stop('runtime_hold')
        next_bound_check(m,with_session.l) # budget stop before credential/preflight
        def count_read(kind,cap):
            counts=with_session.l.setdefault('non_inference_read_attempts',{})
            if counts.get(kind,0)>=cap:raise Stop('non_inference_read_limit')
            counts[kind]=counts.get(kind,0)+1;atomic(with_session.ledger,with_session.l)
        if any(c.get('route_contract_id') for c in m['candidates']):
            from route_runtime import public_preflight
            path=private_dir(with_session.root/('preflight-'+str(with_session.l['cursor'])))
            def public_get(endpoint):
                count_read('public_endpoint_GETs',m['native_metadata_policy']['max_public_endpoint_GETs_for_screen'])
                return transport.http(None,'GET',endpoint,public=True,decoder=unique_json,sink=transport.PrivateEvidence(path/'http'))
            observations=public_preflight(public_get);save(path/'observations.json',observations,exclusive=True)
            approved(manifest,approval,approval_sha) # public preflight cannot bypass expiration/revocation
        key=os.environ.get(credential_env)
        if not key:raise Stop('credential_unavailable')
        # One documented read-only allowance check; never a paid compatibility probe.
        count_read('account_allowance_GETs',m.get('native_metadata_policy',{}).get('max_account_allowance_GETs_for_screen',len(m['cells'])))
        info=transport.http(key,'GET','key')['data']
        remaining=info.get('limit_remaining')
        next_bound=money(m['cells'][with_session.l['cursor']]['full_cost_bound_usd'])
        if remaining is None or money(remaining)<next_bound:raise Stop('allowance_insufficient_or_unknown')
        _,fresh=approved(manifest,approval,approval_sha) # repeated after preflight, before reservation/send
        with_session.bind_authority(approval_sha,fresh)
        def send(body,artifact,candidate):
            return transport.http(key,'POST','chat/completions' if candidate['adapter']=='openrouter' else 'native/'+candidate['adapter'],wire(body),decoder=unique_json,sink=transport.PrivateEvidence(artifact/'http'))
        def lookup(path,artifact,index):return transport.http(key,'GET',path,decoder=unique_json,sink=transport.PrivateEvidence(artifact/('metadata-http-'+str(index))),retain_success_raw=False)
        return with_session.one(send,carried_pending_exception=a.get('carried_pending_exception'),metadata_lookup=lookup)
    except Exception as error:
        if with_session.l['state']=='ready':
            with_session.l['state']='paused_preflight_or_authority_no_dispatch'
            with_session.l.setdefault('review_events',[]).append({'operation':'pre_dispatch_stop','diagnostic':transport.failure_note(error,'benchmark_preflight'),'reserved_attempts':len(with_session.l['attempts'])})
            atomic(with_session.ledger,with_session.l)
        raise
    finally:with_session.close()


def _custody_file(session, ref):
    """Read bounded, hash-declared immutable evidence confined to this runtime."""
    if not isinstance(ref,dict) or not isinstance(ref.get('path'),str):raise Stop('evidence_reference')
    relative=Path(ref['path'])
    if relative.is_absolute() or '..' in relative.parts:raise Stop('evidence_path')
    path=session.root/relative
    if any(p.is_symlink() for p in [path,*path.parents] if p!=session.root.parent):raise Stop('evidence_symlink')
    if not path.resolve().is_relative_to(session.root.resolve()) or not path.is_file() or path.stat().st_size>2000000:raise Stop('evidence_missing_or_oversized')
    raw=path.read_bytes()
    if digest(raw)!=ref.get('sha256'):raise Stop('evidence_digest')
    return path,raw


def _review_receipt(session,path,expected_sha,operation):
    p=Path(path)
    if not p.is_file() or p.stat().st_size>2000000:raise Stop('receipt_missing_or_oversized')
    raw=p.read_bytes();r=unique_json(raw)
    if digest(raw)!=expected_sha or r.get('status')!='ROOT_REVIEWED' or r.get('operation')!=operation:raise Stop('receipt_not_reviewed')
    authority=session.root/'authority.json'
    if not authority.exists() or r.get('authority_sha256')!=digest(authority.read_bytes()):raise Stop('consolidated_authority_binding')
    a=unique_json(authority.read_bytes())
    scope={'manifest_sha256':digest(session.path.read_bytes()),'runtime_path':str(session.root.resolve())}
    if any(r.get(k)!=v or a.get(k)!=v for k,v in scope.items()):raise Stop('receipt_scope')
    if not session.l['attempts'] or r.get('cell_id')!=session.l['attempts'][-1]['cell_id']:raise Stop('reconcile_cell')
    attempt=session.l['attempts'][-1]
    request=session.root/attempt['cell_id']/'request.json'
    if not request.is_file() or digest(request.read_bytes())!=attempt['request_sha256'] or r.get('request_sha256')!=attempt['request_sha256']:raise Stop('attempt_request_binding')
    return r,raw,a


def _retain_review_receipt(session,folder,sha,raw):
    root=private_dir(session.root/folder);p=root/(sha+'.json')
    if p.exists():
        if p.read_bytes()!=raw:raise Stop('receipt_archive_conflict')
    else:save_raw(p,raw)


def _charge_evidence(session,r):
    """Validate operator-reviewed final attribution, not provider billing truth.

    A wrapper binds actual immutable provider evidence and exact request/response or
    correlation custody. No schema-specific billing API or generation ID is invented.
    """
    e=r.get('evidence',{});cell=r['cell_id'];attempt=session.l['attempts'][-1]
    _,billing=_custody_file(session,e.get('billing'))
    _,attribution=_custody_file(session,e.get('attribution'));a=unique_json(attribution)
    if a.get('kind')!='reviewed_exact_charge_attribution' or a.get('status')!='FINAL_ATTRIBUTABLE':raise Stop('charge_not_final_attributable')
    for k in ('cell_id','request_sha256','manifest_sha256','runtime_path','cost_usd'):
        if a.get(k)!=r.get(k):raise Stop('charge_attribution_binding')
    if a.get('billing_evidence_sha256')!=digest(billing):raise Stop('billing_evidence_binding')
    artifact=session.root/cell
    if e.get('kind') in ('retained_transport_raw','retained_decoded_response'):
        response,raw=_custody_file(session,e.get('response'))
        if not response.resolve().is_relative_to(artifact.resolve()):raise Stop('response_attempt_binding')
        if e['kind']=='retained_transport_raw':
            if response.parent!=artifact/'http' or not response.name.endswith('.successful-response.private.bin'):raise Stop('transport_raw_path')
        elif response!=artifact/'response.json' or list((artifact/'http').glob('*.successful-response.private.bin')):raise Stop('decoded_response_custody')
        if a.get('response_sha256')!=digest(raw):raise Stop('response_billing_linkage')
    elif e.get('kind')=='attributable_no_response':
        if (artifact/'response.json').exists() or list((artifact/'http').glob('*.successful-response.private.bin')):raise Stop('no_response_evidence_inconsistent')
        path,raw=_custody_file(session,e.get('correlation_receipt'));note=unique_json(raw)
        if not path.resolve().is_relative_to(artifact.resolve()) or not (path==artifact/'diagnostic.json' or (path.parent==artifact/'http' and path.name.endswith('.failure.json'))):raise Stop('correlation_attempt_binding')
        corr=a.get('correlation',{});header=corr.get('header');value=corr.get('value')
        if header not in transport.CORRELATION_HEADERS or not value or note.get('correlation_headers',{}).get(header)!=value:raise Stop('charge_correlation_linkage')
        if a.get('correlation_receipt_sha256')!=digest(raw):raise Stop('correlation_receipt_binding')
    else:raise Stop('charge_evidence_kind')
    return e


def adopt_reconciliation(session, receipt_path, receipt_sha):
    """Settle an exact charge once; never disposition a review hold or resume.

    Repeating the identical applied settlement is a no-op. Changed/stale settlement
    and duplicate releases are rejected. Known over-bound charges are recorded in
    full, replace the reservation, and latch an unconditional accounting stop.
    """
    r,raw,_=_review_receipt(session,receipt_path,receipt_sha,'settle_charge');l=copy.deepcopy(session.l)
    attempt=l['attempts'][-1];cell=r['cell_id']
    if attempt.get('reconciliation_receipt_sha256')==receipt_sha:
        archive=session.root/'settlements'/(receipt_sha+'.json')
        if not archive.exists() or archive.read_bytes()!=raw:raise Stop('settlement_archive_missing')
        _charge_evidence(session,r)
        return {'status':'already_settled','state':l['state']}
    if attempt['charge']=='reconciled':raise Stop('already_settled_different_receipt')
    if r.get('ledger_sha256')!=digest(session.ledger.read_bytes()):raise Stop('stale_reconciliation')
    if cell not in l['pending'] or cell in l['opening']['pending']:raise Stop('not_child_liability')
    _charge_evidence(session,r)
    cost=money(r['cost_usd']);bound=money(l['pending'][cell]);breach=cost>bound
    l['cash_usd']=str(money(l['cash_usd'])+cost);l['new_run_known_usd']=str(money(l['new_run_known_usd'])+cost)
    l['new_run_pending_usd']=str(money(l['new_run_pending_usd'])-bound);del l['pending'][cell]
    attempt.update(charge='reconciled',cost_usd=str(cost),unused_reservation_released_usd=str(max(Decimal(0),bound-cost)),
                   bound_excess_usd=str(max(Decimal(0),cost-bound)),reconciliation_receipt_sha256=receipt_sha)
    # Original status/raw/errors and cursor are preserved for independent disposition.
    if breach:
        l.setdefault('bound_breaches',[]).append({'cell_id':cell,'bound_usd':str(bound),'actual_usd':str(cost),'receipt_sha256':receipt_sha})
        l['state']='stopped_accounting_bound_breach'
    else:l['state']='paused_settled_review'
    l.setdefault('review_events',[]).append({'operation':'settle_charge','receipt_sha256':receipt_sha,'previous_state':session.l['state']})
    _retain_review_receipt(session,'settlements',receipt_sha,raw);atomic(session.ledger,l);session.l=l
    return {'status':'settled_bound_breach' if breach else 'settled_hold','state':l['state']}


def dispose_review_hold(session,receipt_path,receipt_sha):
    """Review disposition under original consolidated authority, no per-cell approval.

    Cash/attempt history are untouched. Only the unchanged next unattempted cursor
    may open; terminal review ends cleanly. Independent failures need a separate
    attributable disposition; accounting bound breaches cannot be waived here.
    """
    r,raw,a=_review_receipt(session,receipt_path,receipt_sha,'dispose_review_hold');l=copy.deepcopy(session.l)
    if r.get('ledger_sha256')!=digest(session.ledger.read_bytes()):raise Stop('stale_disposition')
    if l.get('bound_breaches'):raise Stop('accounting_bound_breach')
    attempt=l['attempts'][-1];cell=attempt['cell_id']
    if attempt['charge']!='reconciled' or l['state']!='paused_settled_review':raise Stop('not_settled_review_hold')
    if l['pending']!=l['opening']['pending'] or l['opening'].get('semantic_hold'):raise Stop('unresolved_hold')
    if l['pending'] and a.get('carried_pending_exception')!=l['pending']:raise Stop('carried_pending_exception_binding')
    if r.get('settlement_receipt_sha256')!=attempt['reconciliation_receipt_sha256']:raise Stop('settlement_disposition_binding')
    settlement=session.root/'settlements'/(attempt['reconciliation_receipt_sha256']+'.json')
    if not settlement.exists() or digest(settlement.read_bytes())!=attempt['reconciliation_receipt_sha256']:raise Stop('settlement_archive_missing')
    _charge_evidence(session,unique_json(settlement.read_bytes()))
    if attempt['status']!='paused_output_review':
        _,data=_custody_file(session,r.get('independent_stop_disposition'));d=unique_json(data)
        for k in ('manifest_sha256','runtime_path','authority_sha256','cell_id','request_sha256','settlement_receipt_sha256'):
            if d.get(k)!=r.get(k):raise Stop('independent_disposition_binding')
        expected=[p for p in [session.root/cell/'diagnostic.json',session.root/cell/'parsed.json'] if p.exists()]
        actual=[_custody_file(session,ref)[0] for ref in d.get('stop_evidence',[])]
        if not expected or set(actual)!=set(expected) or len(actual)!=len(expected):raise Stop('independent_stop_evidence')
        if d.get('status')!='ROOT_DISPOSITIONED' or d.get('original_stop')!=attempt['status'] or d.get('decision')!='retain_invalid_advance' or d.get('canonical_acceptance') is not False:raise Stop('independent_stop_not_dispositioned')
    index=next(i for i,c in enumerate(session.m['cells']) if c['id']==cell);next_index=index+1
    if l['cursor'] not in (index,next_index):raise Stop('cursor_history_mismatch')
    expected=session.m['cells'][next_index]['id'] if next_index<len(session.m['cells']) else None
    if r.get('next_cell_id')!=expected:raise Stop('next_cell_binding')
    if expected is not None and any(x['cell_id']==expected for x in l['attempts']):raise Stop('next_cell_already_attempted')
    if expected is None:
        if r.get('action')!='finish_after_review':raise Stop('terminal_disposition_action')
        l['state']='completed_reviewed'
    else:
        if r.get('action')!='resume_next_unattempted':raise Stop('continuation_disposition_action')
        l['state']='ready'
    l['cursor']=next_index
    l.setdefault('review_events',[]).append({'operation':'dispose_review_hold','receipt_sha256':receipt_sha,'cell_id':cell,'next_cell_id':expected,'independent_stop_retained':attempt['status']!='paused_output_review'})
    _retain_review_receipt(session,'dispositions',receipt_sha,raw);atomic(session.ledger,l);session.l=l
    return {'status':l['state'],'next_cell_id':expected}

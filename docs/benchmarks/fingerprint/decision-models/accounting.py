"""Read-only terminal-stage import. Retirement is not new dispatch authority."""
from decimal import Decimal
from pathlib import Path
from core import unique_json,digest


def retired(ledger,receipt):
    lp=Path(ledger);rp=Path(receipt);l=unique_json(lp.read_bytes());r=unique_json(rp.read_bytes())
    if digest(lp.read_bytes())!=r['ledger_sha256'] or l['status']!='RETIRED_INCOMPLETE_WITH_OUTSTANDING_LIABILITY' or r['paid_dispatch_authorized']:raise ValueError('retirement_receipt_binding')
    cash=Decimal(l['cash_spent_usd']);pending={k:str(v) for k,v in l['outstanding_reservations'].items()};exposure=cash+sum(map(Decimal,pending.values()),Decimal(0))
    if exposure!=Decimal(l['retirement']['retained_accounted_exposure_usd']):raise ValueError('retirement_exposure')
    if l['global_retry_pool']!=r['retry_pool_total'] or l['global_retry_capacity_reserved']!=0:raise ValueError('retirement_retry_pool')
    return {'accounting_kind':'retired_stage_carry','parent_accounting_status':l['status'],'parent_accounting_sha256':digest(lp.read_bytes()),'root_retirement_receipt_sha256':digest(rp.read_bytes()),'cash_usd':str(cash),'pending':pending,'held_stage_usd':'0','retained_accounted_exposure_usd':str(exposure),'released_unused_old_hold_usd':l['retirement']['released_unused_encumbrance_usd'],'attempts':len(l['attempts']),'retries':l['retries_used'],'initial_attempt_capacity_total':r['initial_attempts_consumed']+r['initial_attempt_capacity_remaining'],'initial_attempt_capacity_remaining':r['initial_attempt_capacity_remaining'],'global_retry_pool':l['global_retry_pool'],'global_retry_capacity_reserved_in_prior_stage':0,'new_retry_capacity_reserved':0,'allocations_usd':l['allocations_usd'],'semantic_hold':False,'historical_invalid_semantic_findings_preserved':True,'old_stage_reusable':False,'new_bench_authorized':False,'new_reservations_usd':'0','title_headroom_usd':str(Decimal('3.50')-exposure),'global_headroom_usd':str(Decimal('5.00')-exposure)}

import warnings


def main(report: dict):
    if report.get('run_skipped'):
        raise RuntimeError('Daily list run skipped: another run holds the lease; no lists were read')
    if report.get('rereads_complete') is False or report.get('rereads_budget_exceeded'):
        raise RuntimeError('Daily checkpoint rereads exceeded the hard request budget; no new countries started')
    failures = [row for row in report.get('lists', []) if 'error' in row]
    report['failed_lists'] = failures
    if any(row.get('error') == 'TMDBAccessDenied' or row.get('http_status') in (401, 403) for row in failures):
        raise RuntimeError(f'Daily list access error: {failures[:10]}')
    if report.get('hard_budget_exceeded') or any(row.get('error') == 'RequestBudgetExceeded' for row in failures):
        raise RuntimeError('Daily list hard request budget exhausted; completed checkpoints retained')
    refresh = report.get('offer_refresh') or {}
    if refresh.get('remaining'):
        warnings.warn(f"{refresh['remaining']} title offer refreshes remain queued; {refresh.get('deferred_reason', 'batch_limit_or_retry')}", RuntimeWarning)
    if (refresh.get('failed', 0) * 100 > refresh.get('selected', 0)
            or refresh.get('max_failure_days', 0) >= 3
            or any(row.get('consecutive_failure_days', 0) >= 3 for row in refresh.get('failures', []))):
        raise RuntimeError(f'Title offer refresh exceeded 1% failures or failed for 3 days: {refresh}')
    repeated = [row for row in failures if row.get('consecutive_failure_days', 0) >= 3]
    if repeated:
        raise RuntimeError(f'Daily lists failed for 3 consecutive days; checkpoints retained: {repeated[:10]}')
    attempted = report.get('lists_completed', 0) + report.get('lists_failed', 0)
    if report.get('lists_failed', 0) * 100 > attempted:
        raise RuntimeError(f"{report['lists_failed']} daily lists failed (more than 1%); checkpoints retained: {failures[:10]}")
    country = report.get('baseline_deferred_country')
    budget = report.get('baseline_deferred_budget')
    if report.get('baseline_deferred_reason') == 'country_exceeds_budget' and budget == 'memberships':
        raise RuntimeError(f'Country {country} exceeds the daily new-baseline {budget} budget; ramp cannot progress')
    if country:
        warnings.warn(f'Country {country} deferred by the daily new-baseline {budget} budget', RuntimeWarning)
    return report

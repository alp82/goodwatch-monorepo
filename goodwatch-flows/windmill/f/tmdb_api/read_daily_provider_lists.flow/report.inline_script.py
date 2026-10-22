import warnings


def main(report: dict):
    if report.get('run_skipped'):
        raise RuntimeError('Daily list run skipped: another run holds the lease; no lists were read')
    if report.get('rereads_complete') is False:
        raise RuntimeError('Daily checkpoint rereads exceeded the hard request budget; no new countries started')
    failures = [row for row in report.get('lists', []) if 'error' in row]
    report['failed_lists'] = failures
    if any(row.get('error') == 'TMDBAccessDenied' or row.get('http_status') in (401, 403) for row in failures):
        raise RuntimeError(f'Daily list access error: {failures[:10]}')
    if (any(row.get('error') in ('RequestBudgetExceeded', 'BaselineBudgetExceeded') for row in failures)
            or (report.get('baseline_deferred_budget') == 'requests'
                and report.get('baseline_budget', {}).get('max_requests') != 0)):
        raise RuntimeError('Daily list request budget exhausted; completed checkpoints retained')
    repeated = [row for row in failures if row.get('consecutive_failure_days', 0) >= 3]
    if repeated:
        raise RuntimeError(f'Daily lists failed for 3 consecutive days; checkpoints retained: {repeated[:10]}')
    attempted = report.get('lists_completed', 0) + report.get('lists_failed', 0)
    if report.get('lists_failed', 0) * 100 > attempted:
        raise RuntimeError(f"{report['lists_failed']} daily lists failed (more than 1%); checkpoints retained: {failures[:10]}")
    country = report.get('baseline_deferred_country')
    budget = report.get('baseline_deferred_budget')
    if report.get('baseline_deferred_reason') == 'country_exceeds_budget':
        raise RuntimeError(f'Country {country} exceeds the daily new-baseline {budget} budget; ramp cannot progress')
    if country:
        warnings.warn(f'Country {country} deferred by the daily new-baseline {budget} budget', RuntimeWarning)
    return report

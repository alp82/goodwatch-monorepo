import warnings


def main(report: dict):
    if report.get('run_skipped'):
        raise RuntimeError('Daily list run skipped: another run holds the lease; no lists were read')
    if report.get('rereads_complete') is False:
        raise RuntimeError('Daily checkpoint rereads exceeded the hard request budget; no new countries started')
    if report.get('lists_failed', 0):
        failures = [row for row in report.get('lists', []) if 'error' in row]
        raise RuntimeError(f"{report['lists_failed']} daily lists failed; checkpoints retained: {failures[:10]}")
    country = report.get('baseline_deferred_country')
    budget = report.get('baseline_deferred_budget')
    if report.get('baseline_deferred_reason') == 'country_exceeds_budget':
        raise RuntimeError(f'Country {country} exceeds the daily new-baseline {budget} budget; ramp cannot progress')
    if country:
        warnings.warn(f'Country {country} deferred by the daily new-baseline {budget} budget', RuntimeWarning)
    return report

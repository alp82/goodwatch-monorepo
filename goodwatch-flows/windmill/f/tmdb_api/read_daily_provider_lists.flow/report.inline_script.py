def main(report: dict):
    if report.get('run_skipped'):
        raise RuntimeError('Daily list run skipped: another run holds the lease; no lists were read')
    if report.get('lists_failed', 0):
        failures = [row for row in report.get('lists', []) if 'error' in row]
        raise RuntimeError(f"{report['lists_failed']} daily lists failed; checkpoints retained: {failures[:10]}")
    return report

"""Run offline checks and seal the exact draft.9 interface only on success."""
import hashlib
import json
from pathlib import Path
import unittest

import checks

HERE = Path(__file__).resolve().parent

if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(checks.ContractChecks)
    result = unittest.TextTestRunner(verbosity=1).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)
    files = {
        str(path.relative_to(HERE)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(HERE.rglob('*'))
        if path.is_file() and '__pycache__' not in path.parts and path.name != 'producer-freeze.json'
    }
    receipt = {'version': '2.0.0-draft.9', 'projection_version': 'similarity-v2.3',
               'checks_passed': result.testsRun, 'producer_interface': 'request-contract.json',
               'quality_benchmark_performed': False, 'files': files}
    (HERE / 'producer-freeze.json').write_text(json.dumps(receipt, indent=2) + '\n')

#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
cd "$repo_root"
python3 "$script_dir/cheap_loop_adapters.py"
python3 "$script_dir/cheap_loop_report.py" \
  "$script_dir/private/cheap-loop/round1.json" \
  "$script_dir/private/cheap-loop/round2.json" \
  "$script_dir/private/cheap-loop/round3.json" \
  "$script_dir/private/cheap-loop/review-adapted.json" \
  --review 1 docs/prototypes/crate-evidence/cheap-loop-round1-independent-review.json \
  --review 2 docs/prototypes/crate-evidence/cheap-loop-round2-independent-review.json \
  --review 3 docs/prototypes/crate-evidence/cheap-loop-round3-independent-review.json

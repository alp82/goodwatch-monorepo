#!/bin/sh
# #137 port fixes: uncached latency, two runs, combo-safe-v3-scan (old) against combo-safe-v3 (fixed), r6 as reference.
cd "$(dirname "$0")/../../.."
P=.venv/bin/python
R=results/simplify/port-fixes
F="simp_combo:FINAL/combo-safe-v3-scan simp_combo:FINAL/combo-safe-v3"
for i in 1 2; do
  $P harness/evalsimp.py latency $F --uncached --reps=5 2>&1 | grep -v "Warning\|Loading" > $R/latency-uncached-run$i.txt
done

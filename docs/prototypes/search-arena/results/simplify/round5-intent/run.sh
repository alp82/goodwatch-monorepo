#!/bin/sh
# Round 5 (intent encode): uncached + cached latency, two runs each, sequential.
cd "$(dirname "$0")/../../.."
P=.venv/bin/python
R=results/simplify/round5-intent
F="simp_combo:FINAL/combo-safe-v2-wcred simp_combo:FINAL/combo-safe-v2-wcred-par simp_combo:FINAL/combo-safe-v2-wcred-me5s"
for i in 1 2; do
  $P harness/evalsimp.py latency $F --uncached --reps=5 2>&1 | grep -v "Warning\|Loading" > $R/latency-uncached-run$i.txt
  $P harness/evalsimp.py latency $F --reps=5 2>&1 | grep -v "Warning\|Loading" > $R/latency-cached-run$i.txt
done
echo DONE > $R/run.log

#!/bin/sh
# Round 4 final runs: two cached score runs, two uncached latency runs (sequential, so they don't compete).
cd "$(dirname "$0")/../../.."
P=.venv/bin/python
R=results/simplify/round4
F="simp_combo:FINAL/combo simp_combo:FINAL/combo-safe simp_combo:FINAL/combo-v2 simp_combo:FINAL/combo-safe-v2"
$P harness/evalsimp.py score simp_combo:FINAL --reps=5 2>&1 | grep -v "Warning\|Loading" > $R/final-score-run1.txt
$P harness/evalsimp.py latency $F --uncached --reps=5 2>&1 | grep -v "Warning\|Loading" > $R/latency-uncached-run1.txt
$P harness/evalsimp.py score simp_combo:FINAL --reps=5 2>&1 | grep -v "Warning\|Loading" > $R/final-score-run2.txt
$P harness/evalsimp.py latency $F --uncached --reps=5 2>&1 | grep -v "Warning\|Loading" > $R/latency-uncached-run2.txt
echo DONE

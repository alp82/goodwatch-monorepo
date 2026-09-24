# Simplify round 1: leave-one-out ablation of r6

2026-09-23, branch `proto/search-simplify`. Every r6 mechanism with a config off switch in the rule table
(`baseline-complexity.md`, section 3) was switched off alone, plus the near-zero candidates and grouped ablations.
Seven mechanisms without a switch (M07, M10c, M11b, M14b, M19c, all of M19, the near-zero group) ran through
runtime patches in a scratch module, restored after every call. No harness module was edited.

Scoring: `harness/evalsimp.py score --reps=1 …`, all 62 candidates plus r6 in one interleaved run (475 s), then
3 combined sets in two short runs. The lists and scores are in `results/simplify/lists/` and `scores/`, named by
spec (`r6+w_peer=0.json`, `abl-*.json`). The table was recomputed from the saved lists with the current
`grades.json`.

r6 reference: dev 0.836, ho 0.761, ho2 0.728, ho3 0.893, ho4 0.837, dev-sty 0.812; 0 unjudged; bad5 40;
own10 6.00/6.00/6.00; title@1 6/7; p50 about 45 ms in this run.

## How to read it

- **S saved**: the points of S (T + R + X + P, baseline 394) that deleting the mechanism's code would remove.
  Counted from tables 2a and 3 and appendices A and B of `baseline-complexity.md`. Sub-row splits are my
  allocation of each mechanism's total and add up to it. A partial switch saves only the part it turns off.
  Rows marked approx. are rough.
- **Class**, over the five splits (dev, ho, ho2, ho3, ho4):
  - DROP: no split's plain Δ ndcg10 is below −0.005.
  - LIKELY-DROP: some plain Δ is below −0.005, but every condensed Δ is at least −0.005. The loss may come from
    ungraded titles.
  - KEEP: some condensed Δ is below −0.005.
- dev-sty (Δ dsty) is a subset of dev. The class rule does not use it, but it is shown because the style path
  lives there. A dsty loss shows up only diluted in dev.
- p50 comes from a single timing repeat under machine load. Only large gaps mean anything (facet + coverage off:
  30 ms against 46).

## Table (sorted by S saved)

| ablation | removes | S saved | class | Δ ndcg10 dev / ho / ho2 / ho3 / ho4 | Δ cond dev / ho / ho2 / ho3 / ho4 | Δ dsty plain / cond | unj tot | bad5 tot | own10 dsty/h3sty/ho4 | title@1 | p50 ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `r6+ent=False` | M16 + M17 + M18 (+M07, M14c) | 190 | KEEP | -0.065 / +0.000 / -0.009 / -0.173 / -0.132 | -0.063 / +0.000 / -0.009 / -0.173 / -0.132 | -0.073 / -0.057 | 2 | 46 | 8.25/7.50/4.67 | 6/7 | 52.2 |
| `abl-drop-plus-likely` | DROP + LIKELY-DROP rows | 94 | KEEP | -0.023 / -0.013 / -0.027 / -0.023 / -0.063 | -0.014 / -0.004 / +0.001 / +0.023 / +0.041 | -0.063 / -0.041 | 63 | 40 | 7.25/9.25/8.11 | 6/7 | 46.4 |
| `abl-drop-set` | every DROP row | 52 | KEEP | -0.009 / -0.003 / -0.005 / -0.003 / -0.002 | -0.005 / -0.003 / -0.001 / -0.003 / +0.007 | -0.020 / -0.009 | 10 | 39 | 6.00/6.00/6.11 | 6/7 | 44.8 |
| `r6+s6=False` | M18 (hyb5 style revived) | 50 | KEEP | -0.009 / +0.000 / +0.002 / -0.093 / -0.127 | -0.009 / +0.000 / +0.002 / -0.092 / -0.127 | -0.070 / -0.070 | 1 | 39 | 4.00/4.00/3.78 | 6/7 | 43.8 |
| `abl-drop-core` | DROP set minus M14, M17c | 39 | DROP | -0.002 / -0.003 / -0.005 / -0.003 / -0.002 | -0.001 / -0.003 / -0.001 / -0.003 / +0.007 | -0.020 / -0.009 | 8 | 39 | 6.00/6.00/6.11 | 6/7 | 46.4 |
| `r6+w_fp=0+w_emb=0+w_terms=0+w_agree=0+w_peer=0+w_mention=0` | M18b-h | 36 | KEEP | -0.024 / +0.000 / -0.006 / -0.100 / -0.261 | -0.008 / +0.000 / +0.004 / +0.003 / -0.037 | -0.200 / -0.061 | 111 | 37 | 5.25/5.75/5.78 | 6/7 | 46.8 |
| `r6+facet=0+cov=0` | M09 + M10 | 35 | KEEP | -0.007 / -0.053 / -0.024 / +0.000 / +0.000 | -0.002 / -0.042 / -0.013 / +0.000 / +0.000 | +0.000 / +0.000 | 19 | 50 | 6.00/6.00/6.00 | 6/7 | 29.7 |
| `abl-nearzero-all` | M19b + M08b + M15 + M17c + M07 + M14b | 34 | KEEP | -0.015 / +0.000 / +0.000 / +0.000 / +0.000 | -0.011 / +0.000 / +0.000 / +0.000 / +0.000 | -0.007 / +0.004 | 3 | 40 | 6.00/6.00/6.00 | 6/7 | 44.3 |
| `r6+ref=False` | M11 | 28 | KEEP | -0.001 / -0.004 / -0.031 / +0.000 / +0.000 | -0.001 / -0.004 / -0.023 / +0.000 / +0.000 | +0.000 / +0.000 | 3 | 43 | 6.00/6.00/6.00 | 6/7 | 44.9 |
| `r6+fold=False+era_w=0+b.fuzzy=0+era_off=1.0` | M19b + M08b + M15 + M17c | 25 | KEEP | -0.014 / +0.000 / +0.000 / +0.000 / +0.000 | -0.012 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 2 | 40 | 6.00/6.00/6.00 | 6/7 | 46.2 |
| `r6+cov=0` | M10 | 19 | KEEP | +0.002 / -0.032 / -0.012 / +0.000 / +0.000 | +0.002 / -0.032 / -0.007 / +0.000 / +0.000 | +0.000 / +0.000 | 3 | 46 | 6.00/6.00/6.00 | 6/7 | 41.0 |
| `r6+era=False` | M08 | 19 | KEEP | -0.005 / -0.001 / -0.030 / +0.000 / +0.000 | -0.005 / -0.001 / -0.006 / +0.000 / +0.000 | +0.000 / +0.000 | 9 | 41 | 6.00/6.00/6.00 | 6/7 | 47.2 |
| `r6+text=none` | M02 | 18 | KEEP | -0.018 / -0.061 / -0.093 / -0.006 / +0.000 | -0.007 / -0.028 / -0.034 / -0.000 / +0.000 | +0.000 / +0.000 | 60 | 52 | 6.00/6.00/6.00 | 6/7 | 45.9 |
| `r6+w_peer=0+w_mention=0` | M18f + M18g | 18 | LIKELY-DROP | -0.003 / +0.000 / +0.000 / -0.010 / -0.058 | -0.001 / +0.000 / +0.000 / -0.004 / +0.019 | -0.025 / -0.010 | 18 | 40 | 6.00/6.00/6.00 | 6/7 | 44.7 |
| `r6+facet=0` | M09 | 16 | KEEP | -0.005 / -0.015 / -0.009 / +0.000 / +0.000 | -0.002 / -0.005 / -0.001 / +0.000 / +0.000 | +0.000 / +0.000 | 13 | 44 | 6.00/6.00/6.00 | 6/7 | 38.8 |
| `r6+neg=0` | M06 (+M05d) | 16 | KEEP | -0.028 / -0.029 / -0.017 / +0.000 / +0.000 | -0.015 / -0.011 / +0.010 / +0.000 / +0.000 | -0.007 / +0.004 | 36 | 40 | 6.00/6.00/6.00 | 6/7 | 44.1 |
| `r6+w_peer=0` | M18g | 13 | LIKELY-DROP | -0.005 / +0.000 / +0.000 / -0.001 / -0.045 | -0.004 / +0.000 / +0.000 / -0.001 / +0.023 | -0.042 / -0.031 | 13 | 40 | 6.00/6.00/6.00 | 6/7 | 44.9 |
| `r6+nonen=False` | M05a + M05c + M05d | 12 | KEEP | -0.008 / -0.003 / -0.023 / +0.000 / +0.001 | -0.008 / -0.003 / -0.002 / +0.000 / +0.002 | +0.000 / +0.000 | 8 | 41 | 6.00/6.00/6.11 | 6/7 | 45.5 |
| `r6+spell=False` | M04 | 11 | KEEP | -0.007 / -0.004 / -0.000 / +0.000 / +0.000 | -0.007 / -0.004 / +0.007 / +0.000 / +0.000 | +0.000 / +0.000 | 4 | 39 | 6.00/6.00/6.00 | 6/7 | 45.0 |
| `r6+w_fp=0+w_emb=0+w_terms=0+w_agree=0` | M18c/d/e/h | 11 | KEEP | -0.029 / +0.000 / -0.004 / -0.066 / -0.212 | -0.015 / +0.000 / +0.003 / +0.009 / -0.023 | -0.241 / -0.120 | 87 | 40 | 5.50/6.00/5.56 | 6/7 | 45.3 |
| `abl-fold-all-off` | M19 | 10 | DROP | -0.001 / +0.000 / -0.003 / +0.000 / +0.000 | -0.001 / +0.000 / -0.003 / +0.000 / +0.000 | -0.006 / -0.006 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 44.7 |
| `r6+era_w=0` | M08b | 10 | DROP | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 47.6 |
| `r6+b.fuzzy=0` | M15 | 9 | KEEP | -0.010 / +0.000 / +0.000 / +0.000 / +0.000 | -0.010 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 42.3 |
| `r6+own_boost=0+own_min=0+own_max=10` | M18l + M18m + M18o | 9 | KEEP | -0.001 / +0.000 / +0.000 / -0.003 / -0.054 | -0.001 / +0.000 / +0.000 / +0.016 / -0.016 | -0.006 / -0.006 | 15 | 40 | 7.50/7.50/6.44 | 6/7 | 46.2 |
| `r6+w_terms=0+w_agree=0` | M18e + M18h | 9 | KEEP | -0.006 / +0.000 / +0.001 / -0.055 / -0.113 | -0.001 / +0.000 / +0.001 / -0.013 / -0.001 | -0.052 / -0.007 | 44 | 41 | 6.00/6.00/5.78 | 6/7 | 46.1 |
| `r6+b.kind=False` | M14a + M14b + M14c | 8 | DROP | -0.003 / +0.000 / +0.000 / +0.000 / +0.000 | -0.003 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 45.4 |
| `r6+own_min=0+own_max=10` | M18m + M18o | 8 | LIKELY-DROP | -0.002 / +0.000 / +0.003 / +0.010 / -0.028 | +0.001 / +0.000 / +0.003 / +0.035 / +0.024 | -0.013 / +0.010 | 24 | 40 | 8.75/9.00/7.67 | 6/7 | 45.0 |
| `r6+mix_fil=0` | M17b centroid mix | 7 | LIKELY-DROP | +0.000 / +0.000 / +0.000 / -0.020 / -0.000 | +0.000 / +0.000 / +0.000 / -0.004 / -0.000 | +0.000 / +0.000 | 4 | 40 | 6.00/6.00/6.00 | 6/7 | 44.4 |
| `r6+style_head=0` | M18n | 7 | DROP | -0.000 / +0.000 / -0.000 / +0.000 / +0.000 | -0.000 / +0.000 / -0.000 / +0.000 / +0.000 | -0.001 / -0.001 | 0 | 39 | 6.00/6.00/6.00 | 6/7 | 46.2 |
| `abl-creator-off` | M14b | 5 | DROP | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 43.8 |
| `abl-franchise-off` | M11b | 5 | KEEP | +0.000 / -0.007 / -0.013 / +0.000 / +0.000 | +0.000 / -0.007 / -0.013 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 42 | 6.00/6.00/6.00 | 6/7 | 46.2 |
| `r6+era_off=1.0` | M17c | 5 | DROP | -0.004 / +0.000 / +0.000 / +0.000 / +0.000 | -0.002 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 2 | 40 | 6.00/6.00/6.00 | 6/7 | 45.3 |
| `r6+w_mention=0` | M18f | 5 | LIKELY-DROP | -0.000 / +0.000 / +0.000 / -0.004 / -0.021 | -0.000 / +0.000 / +0.000 / +0.001 / +0.010 | -0.000 / -0.000 | 6 | 40 | 6.00/6.00/6.00 | 6/7 | 45.6 |
| `abl-less-off` | M07 | 4 | DROP | -0.001 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | -0.007 / +0.004 | 1 | 40 | 6.00/6.00/6.00 | 6/7 | 48.6 |
| `r6+b.strict=0` | M13 | 3 | KEEP | -0.053 / -0.038 / -0.032 / -0.062 / +0.000 | -0.053 / -0.038 / -0.032 / -0.062 / +0.000 | +0.000 / +0.000 | 0 | 46 | 6.00/6.00/6.00 | 6/7 | 44.1 |
| `r6+b=0+w_jev=0` | M01b + M18i | 3 | KEEP | -0.204 / -0.217 / -0.101 / -0.094 / -0.082 | -0.070 / -0.037 / +0.007 / -0.008 / +0.008 | -0.099 / -0.077 | 309 | 40 | 6.00/6.00/6.11 | 6/7 | 46.4 |
| `r6+damp=0+gw=0` | M18k | 3 | LIKELY-DROP | +0.001 / +0.000 / +0.000 / -0.008 / -0.029 | +0.002 / +0.000 / +0.000 / -0.003 / -0.002 | +0.007 / +0.018 | 11 | 40 | 6.00/6.00/6.00 | 6/7 | 47.7 |
| `r6+prior=(0,0)` | M03 | 3 | KEEP | -0.080 / -0.109 / -0.020 / -0.026 / -0.000 | -0.018 / -0.015 / +0.020 / +0.000 / -0.000 | +0.000 / +0.000 | 156 | 42 | 6.00/6.00/6.00 | 6/7 | 44.9 |
| `abl-colloc-off` | M10c | 2 | LIKELY-DROP | -0.003 / -0.006 / -0.004 / +0.000 / +0.000 | -0.001 / -0.001 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 7 | 41 | 6.00/6.00/6.00 | 6/7 | 50.1 |
| `r6+a=0` | M01a | 2 | KEEP | -0.167 / -0.221 / -0.259 / -0.060 / -0.000 | -0.060 / -0.090 / -0.126 / -0.012 / -0.000 | +0.000 / +0.000 | 269 | 53 | 6.00/6.00/6.00 | 6/7 | 48.5 |
| `r6+b=0` | M01b (general) | 2 | KEEP | -0.192 / -0.217 / -0.101 / -0.073 / +0.000 | -0.061 / -0.037 / +0.007 / -0.006 / +0.000 | +0.000 / +0.000 | 279 | 39 | 6.00/6.00/6.00 | 6/7 | 45.6 |
| `r6+damp=0` | M18k damp | 2 | KEEP | +0.000 / +0.000 / +0.000 / -0.016 / -0.013 | +0.000 / +0.000 / +0.000 / -0.005 / +0.011 | +0.001 / +0.001 | 10 | 40 | 6.00/6.00/6.00 | 6/7 | 48.7 |
| `r6+fil_boost=0` | M17b boost | 2 | KEEP | -0.078 / +0.000 / -0.029 / -0.256 / -0.068 | -0.059 / +0.000 / -0.007 / -0.153 / -0.060 | +0.000 / +0.000 | 73 | 44 | 6.00/6.00/4.89 | 6/7 | 45.2 |
| `r6+ref_agree=0` | M11d | 2 | KEEP | -0.000 / +0.001 / -0.006 / +0.000 / +0.000 | -0.000 / +0.001 / -0.006 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 42 | 6.00/6.00/6.00 | 6/7 | 44.1 |
| `r6+ref_facet=False` | M11e | 2 | DROP | -0.000 / -0.002 / -0.001 / +0.000 / +0.000 | -0.000 / -0.001 / -0.001 / +0.000 / +0.000 | +0.000 / +0.000 | 1 | 41 | 6.00/6.00/6.00 | 6/7 | 45.9 |
| `r6+ref_mix=0` | M11c | 2 | DROP | -0.000 / +0.003 / -0.002 / +0.000 / +0.000 | -0.000 / +0.003 / +0.001 / +0.000 / +0.000 | +0.000 / +0.000 | 3 | 40 | 6.00/6.00/6.00 | 6/7 | 45.9 |
| `r6+sparse_bigram=0` | M02 bigrams | 2 | KEEP | -0.001 / -0.015 / -0.007 / +0.000 / +0.000 | +0.001 / -0.010 / +0.007 / +0.000 / +0.000 | +0.000 / +0.000 | 11 | 42 | 6.00/6.00/6.00 | 6/7 | 45.9 |
| `r6+w_agree=0` | M18h | 2 | DROP | -0.000 / +0.000 / +0.000 / -0.003 / -0.002 | +0.001 / +0.000 / +0.000 / +0.003 / +0.007 | -0.003 / +0.008 | 4 | 40 | 6.00/6.00/6.11 | 6/7 | 46.7 |
| `abl-postfold-off` | M19c | 1 | DROP | +0.000 / +0.000 / -0.003 / +0.000 / +0.000 | +0.000 / +0.000 / -0.003 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 44.6 |
| `r6+b.cap=None` | M14a cap | 1 | DROP | -0.001 / +0.000 / +0.000 / +0.000 / +0.000 | -0.001 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 38 | 6.00/6.00/6.00 | 6/7 | 43.9 |
| `r6+b.kind_all=False` | M14a rule 1 | 1 | DROP | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 46.5 |
| `r6+c=0` | M02 score only | 1 | KEEP | -0.016 / -0.059 / -0.092 / -0.006 / +0.000 | -0.006 / -0.031 / -0.033 / -0.000 / +0.000 | +0.000 / +0.000 | 59 | 49 | 6.00/6.00/6.00 | 6/7 | 44.8 |
| `r6+cov_concrete=False` | M10b | 1 | KEEP | -0.012 / -0.008 / +0.005 / +0.000 / +0.000 | -0.006 / +0.002 / +0.006 / +0.000 / +0.000 | +0.000 / +0.000 | 13 | 42 | 6.00/6.00/6.00 | 6/7 | 47.7 |
| `r6+ent_facet=False` | M09 rule 6 | 1 | DROP | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 46.5 |
| `r6+fold=False` | M19b | 1 | DROP | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 / +0.000 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 43.7 |
| `r6+gw=0` | M18k gw | 1 | LIKELY-DROP | -0.002 / +0.000 / +0.000 / -0.002 / -0.020 | -0.002 / +0.000 / +0.000 / +0.003 / +0.007 | -0.013 / -0.013 | 7 | 41 | 6.00/6.00/6.00 | 6/7 | 47.8 |
| `r6+nonen_mix=0` | M05c (hyb4 only) | 1 | LIKELY-DROP | -0.005 / -0.004 / -0.020 / +0.000 / +0.000 | -0.003 / -0.001 / -0.003 / +0.000 / +0.000 | +0.000 / +0.000 | 11 | 40 | 6.00/6.00/6.00 | 6/7 | 45.1 |
| `r6+own_boost=0` | M18l | 1 | KEEP | -0.001 / +0.000 / +0.000 / -0.017 / -0.044 | -0.001 / +0.000 / +0.000 / -0.017 / -0.030 | -0.006 / -0.006 | 5 | 40 | 5.75/5.25/5.56 | 6/7 | 46.4 |
| `r6+sparse_body=False` | M02 rule 4 | 1 | DROP | +0.001 / -0.000 / +0.001 / +0.000 / +0.000 | +0.001 / -0.000 / +0.001 / +0.000 / +0.000 | +0.000 / +0.000 | 0 | 40 | 6.00/6.00/6.00 | 6/7 | 44.8 |
| `r6+w_emb=0` | M18d | 1 | KEEP | -0.010 / +0.000 / -0.000 / -0.019 / -0.077 | -0.006 / +0.000 / -0.000 / +0.014 / +0.014 | -0.085 / -0.052 | 34 | 42 | 6.00/6.00/6.11 | 6/7 | 46.1 |
| `r6+w_fp=0` | M18c | 1 | KEEP | -0.006 / +0.000 / +0.001 / -0.016 / -0.022 | -0.006 / +0.000 / +0.001 / -0.005 / +0.032 | -0.051 / -0.047 | 19 | 41 | 6.00/6.00/6.11 | 6/7 | 45.9 |
| `r6+w_jev=0` | M18i | 1 | KEEP | -0.012 / +0.000 / +0.000 / -0.021 / -0.082 | -0.009 / +0.000 / +0.000 / -0.002 / +0.008 | -0.099 / -0.077 | 30 | 41 | 6.00/6.00/6.11 | 6/7 | 45.1 |
| `r6+w_res=0` | M18j | 1 | LIKELY-DROP | +0.000 / +0.000 / +0.000 / +0.000 / -0.012 | +0.000 / +0.000 / +0.000 / +0.000 / +0.007 | +0.000 / +0.000 | 5 | 42 | 6.00/6.00/6.11 | 6/7 | 47.1 |
| `r6+w_terms=0` | M18e (score) | 1 | KEEP | -0.003 / +0.000 / +0.001 / -0.040 / -0.081 | -0.001 / +0.000 / +0.001 / -0.018 / +0.011 | -0.022 / -0.004 | 33 | 40 | 6.00/5.75/5.78 | 6/7 | 45.6 |

Spec notes:
- `abl-*` rows come from `/tmp/…/scratchpad/abl.py`, which is not in the repo. It holds runtime patches:
  - `less-off`: `less = []`; the clause is still stripped.
  - `creator-off`: `names_creator → None`.
  - `colloc-off`: `collocated → False`.
  - `franchise-off`: `franchise_rows → ∅`, so the reference title can appear.
  - `postfold-off`: `run6.run(fold=False)`.
  - `fold-all-off`: the same plus `fold=False` in the config.
  - The combined sets are listed in the next section.
- `r6+b.kind=False` removes all of M14 (M14a, M14b and M14c). The `creator-off`, `b.cap=None` and
  `b.kind_all=False` rows are pieces of it.

## First classification

**DROP (11 rows, S 52 without double counting):**
- M19, all of cut folding: `abl-fold-all-off`, 10. This includes M19b (`fold=False`, exactly 0) and M19c
  (post-blend fold, ho2 −0.003).
- M08b, the era recent/old prior: `era_w=0`, 10. Exactly 0.
- M14, the title-word bonus: `b.kind=False`, 8, dev −0.003. Its pieces: `creator-off` exactly 0, `cap=None`
  (bad5 38 < 40), `kind_all=False` exactly 0.
- M18n, the "both" head: `style_head=0`, 7, 0.000 (bad5 39).
- M17c, early/late career: `era_off=1.0`, 5, dev −0.004.
- M07, "less X": 4, dev −0.001.
- M11e, reference facets: `ref_facet=False`, 2.
- M11c, reference dense mix: `ref_mix=0`, 2.
- M18h, style agreement: `w_agree=0`, 2.
- M02 rule 4, body-only BM25: `sparse_body=False`, 1.
- M09 rule 6, entity-path facets: `ent_facet=False`, 1. Exactly 0.

**LIKELY-DROP (only worse before grading):**
- `w_peer=0+w_mention=0` (18), `w_peer=0` (13), `own_min=0+own_max=10` (8), `mix_fil=0` (7), `w_mention=0` (5),
  `damp=0+gw=0` (3), `colloc-off` (2), `gw=0` (1), `nonen_mix=0` (1), `w_res=0` (1).
- Three of them are really KEEP on a guardrail or on the style group:
  - `own_min=0+own_max=10` pushes own10 to 8.75/9.00/7.67, above the 3 to 6 target. KEEP whatever the grades
    say.
  - `w_peer=0` loses dev-sty −0.042, and −0.031 even condensed. The ho4 loss is the only one that grading could
    reverse. Treat it as KEEP unless ho4 grades come back strongly positive. `w_peer=0+w_mention=0` inherits
    this.
  - `gw=0` loses dev-sty −0.013, condensed too. It is borderline.

**KEEP, clear loss (condensed below −0.005 somewhere):**
- Core signals:
  - dense `a=0`
  - fingerprint `b=0`, and `b=0+w_jev=0`
  - BM25 `text=none` and `c=0`
  - `prior=(0,0)`
- General text handling:
  - `spell=False`: dev −0.007, with no unjudged titles in the dev loss.
  - `neg=0`
  - `nonen=False`: dev −0.008.
  - `era=False`: the range filter; ho2 −0.030, −0.006 condensed.
  - `facet=0`: ho −0.015, −0.005 condensed.
  - `cov=0`
  - `facet=0+cov=0`
  - `cov_concrete=False`
  - `ref=False`
  - `ref_agree=0`: ho2 −0.006, with no unjudged titles.
  - `franchise-off`: ho −0.007, ho2 −0.013. The reference title comes back in at a high rank.
- Blend:
  - `b.strict=0`
  - `b.fuzzy=0`: one query, "Incepton", loses Inception at #1 (dev −0.010). It is not near-zero.
- Entity handling:
  - `ent=False`, `s6=False`
  - `fil_boost=0`
- Style signals:
  - `w_fp`, `w_emb`, `w_jev`, `w_terms`, `w_terms+w_agree`
  - the centroid groups
  - `own_boost=0`, and `own_boost=0+own_min=0+own_max=10`
  - `damp=0`
- Borderline KEEPs whose failing splits are within −0.010 condensed and have unjudged titles (in the pool):
  `facet=0`, `nonen=False`, `damp=0`, `sparse_bigram=0`, `cov_concrete=False`.

**Near-zero group.** `abl-nearzero-all` (dev −0.015) fails only because of fuzzy (−0.010) and era_off (−0.004).
Without fuzzy, the other five are the DROP rows above.

## Combined sets (interaction check)

| set | S | dev | ho | ho2 | ho3 | ho4 | dsty | unj | bad5 |
|---|---|---|---|---|---|---|---|---|---|
| `abl-drop-set`: every DROP row | 52 | −0.009 (c −0.005) | −0.003 | −0.005 (c −0.001) | −0.003 | −0.002 (c +0.007) | −0.020 (c −0.009) | 10 | 39 |
| `abl-drop-core`: DROP minus M14 and M17c | 39 | −0.002 | −0.003 | −0.005 (c −0.001) | −0.003 | −0.002 (c +0.007) | −0.020 (c −0.009) | 8 | 39 |
| `abl-drop-plus-likely`: DROP + every LIKELY-DROP | ~94 | −0.023 (c −0.014) | −0.013 | −0.027 | −0.023 (c +0.023) | −0.063 (c +0.041) | −0.063 | 63 | 40 |

## Interactions and observations

- **The small losses add up.** Each DROP row is at most −0.004 alone. Together they cost dev −0.009, which fails
  the rule. The losses come from different queries, so this is summing, not interaction:
  - "early spielberg" −0.217 (M17c);
  - "sunglasses" −0.098 (M14);
  - "tarantino vibes" −0.073 and "anime about pirates" −0.066 (M19);
  - "kubrick-esque" −0.064, "christopher nolan" −0.040 and "edgar wright" (M18h agreement);
  - "whole movie takes place in one room" −0.062 (`sparse_body`);
  - "like david lynch but less weird" (M07).

  `abl-drop-core` keeps M14 and M17c and passes every split. It still loses dev-sty −0.020 (−0.009 condensed),
  from M19, M18h and M07. The next round should decide on dev-sty explicitly.
- **ref_mix and ref_facet interact** on "like Breaking Bad but a comedy":
  - `ref_mix=0` alone: +0.075.
  - `ref_facet=False` alone: −0.064.
  - Both: −0.075.

  They are not independent. Drop both or keep both.
- **M19 is a metric artefact risk.** Folding exists because the round-6 metric scores a 2nd cut as 0. Without
  the fold, only the post-blend step matters (ho2 −0.003 and the two queries above). Before dropping it, check
  whether a simpler dedup (same director and title stem) is needed anyway for production.
- **Zero coverage is not proof.** `era_w`, `creator-off`, `kind_all`, `ent_facet` and `fold` (M19b) change no
  list, because no query in the 127 exercises them: 0 queries say "recent/old", 0 are creator-name only. The
  real queries planned for holdout5 may say "new movies". Handoff rule: under 0.005 goes. Say so in the log.
- **Facets and coverage are not substitutes.** facet −0.015 ho alone, cov −0.032 ho alone, both −0.053. Both
  also speed things up: the p50 drops from 46 to 30 ms without both. This is a latency lever if a merged
  mechanism can replace them.
- **Style neighbours.** Every single style signal (fp, emb, terms, jev, peers) is worth 0.02 to 0.10 on
  dev-sty and ho4 before grading. The combined off loses ho4 −0.26 plain, −0.037 condensed. Merging them is a
  round-2 question (handoff hypothesis 2), not a drop.
- **Own-title slots are what hold own10 at 6.** Removing them breaks the 3 to 6 target on every style group.
- **b.cap=None and style_head=0 lower bad5** (38 and 39) at no ndcg cost.

## Grading pool `simp1`

`evalsimp.py pool simp1` over the ablations where grading could change the verdict:
- the 10 LIKELY-DROP rows;
- the 5 borderline KEEPs (`facet=0`, `nonen=False`, `damp=0`, `sparse_bigram=0`, `cov_concrete=False`);
- the 3 combined sets.

Excluded: large ablations with a clear condensed loss elsewhere. For example, `b=0` and `prior=(0,0)` have
ho2/ho3 gaps but lose dev by 0.02 to 0.06 even condensed.

- **139 pairs over 62 queries**:
  - ppl 16, ho2 12, core 11, sty 11, new 8, lab 4.
  - `abl-drop-plus-likely` alone brings 63.
- Files:
  - `results/grading/r6-simp1-part1.json` (assessor A, shuffled);
  - `results/grading/r6-simp1-part1-rev.json` (assessor B, reversed).
- Not graded. After merging, run `evalsimp.py table` to re-score the saved lists.

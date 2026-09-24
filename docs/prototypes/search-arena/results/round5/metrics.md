# Round 5 metrics: cast, crew and studio matching

Candidate `r5` = `r4-combo-fast` + person / studio boosts (`harness/rankers5.py`, `harness/entities.py`), frozen in
`LOG.md` ("Round 5") before holdout3 was read. Baseline `r4-combo-fast` (the accepted winner). Graded pools: 341 new
dev pairs, 271 new holdout3 pairs (A/B quadratic weighted kappa 0.900 and 0.854; 2 holdout3 pairs settled by a blind
assessor C). Packets carry a `credits` field from round 5 on (contract note).

Detail tables: `metrics-dev.md` (dev, holdout, holdout2, per entity query with top 10s) and
`holdout3/metrics-tables.md` (holdout3 per query with top 10s).

## Verdict (contract, round-5 note)

- ndcg10 r5 − r4-combo-fast on holdout3: +0.107 (needs >= +0.05): pass
- bad5 r5 3 vs r4-combo-fast 2 (not higher): FAIL
- earlier splits, r5 − r4-combo-fast (no drop over 0.01): dev (all) +0.056, holdout +0.000, holdout2 +0.012: pass
- verdict: **r5 does not win**

## holdout3

| ranker | holdout3 ndcg10 | bad5 (holdout3) | good10 (holdout3) |
|---|---|---|---|
| prod | 0.388 | 10 | 4.25 |
| r4-combo-fast | 0.724 | 2 | 6.92 |
| r5 | 0.831 | 3 | 7.42 |

### holdout3 per query

| query | entity (match) | intent | prod | r4-combo-fast | r5 | Δ r5 − base |
|---|---|---|---|---|---|---|
| ppl-02 keanu reeves action | Keanu Reeves (full) | filmography | 0.165 | 0.710 | 1.000 | +0.290 |
| ppl-04 tom hanks war movies | Tom Hanks (full) | filmography | 0.228 | 0.586 | 0.903 | +0.317 |
| ppl-06 leonardo dicapro thrillers | Leonardo DiCaprio (fuzzy) | filmography | 0.192 | 0.721 | 0.992 | +0.270 |
| ppl-07 stephen chow's kung fu comedies | Stephen Chow (full) | filmography | 0.825 | 0.958 | 0.962 | +0.004 |
| ppl-10 wes anderson style | Wes Anderson (full) | style | 0.824 | 0.842 | 0.800 | -0.041 |
| ppl-12 something in the style of guy ritchie | Guy Ritchie (full) | style | 0.513 | 0.819 | 0.545 | -0.274 |
| ppl-14 coen brothers humor | Joel Coen & Ethan Coen (team) | style | 0.666 | 0.687 | 0.687 | +0.000 |
| ppl-16 kubrick-esque | Stanley Kubrick (surname) | style | 0.206 | 0.794 | 0.573 | -0.221 |
| ppl-18 christopher nolan | Christopher Nolan (full) | both | 0.133 | 0.885 | 0.900 | +0.015 |
| ppl-19 jim carrey | Jim Carrey (full) | both | 0.162 | 0.717 | 0.698 | -0.020 |
| ppl-22 a24 horror | A24 (alias) | filmography | 0.305 | 0.262 | 0.909 | +0.647 |
| ppl-24 hbo prestige drama | HBO (alias) | filmography | 0.436 | 0.710 | 1.000 | +0.290 |

Grade-0 titles in the top 5: r5 ppl-16 Apocalypse Now (#1) and Apocalypse Now Redux (#4), ppl-04 Charlie Wilson's War (#5); r4-combo-fast ppl-16 The Matrix (#3), ppl-04 Captain Phillips (#5).

## dev and regression splits

| ranker | ppl-dev ndcg10 | dev (all) ndcg10 | dev (pre-round-5) ndcg10 | holdout ndcg10 | holdout2 ndcg10 | bad5 (ppl-dev) | good10 (ppl-dev) |
|---|---|---|---|---|---|---|---|
| prod | 0.277 | 0.508 | 0.582 | 0.450 | 0.515 | 13 | 2.58 |
| r4-combo-fast | 0.643 | 0.777 | 0.820 | 0.761 | 0.722 | 10 | 6.08 |
| r5 | 0.864 | 0.833 | 0.823 | 0.761 | 0.734 | 3 | 8.50 |

## Per query: entity queries (dev, holdout, holdout2)

| query | split | entity (match) | intent | prod | r4-combo-fast | r5 | Δ r5 − base | unj10 r5 |
|---|---|---|---|---|---|---|---|---|
| lab-01 tarkovsky | dev | Andrei Tarkovsky (surname) | both | 0.359 | 0.610 | 0.694 | +0.084 | 0 |
| ho2-15 terry gilliam | holdout2 | Terry Gilliam (full) | both | 0.319 | 0.690 | 0.901 | +0.211 | 0 |
| ho2-16 jackie chan movies | holdout2 | Jackie Chan (full) | filmography | 0.946 | 0.964 | 1.000 | +0.036 | 0 |
| ppl-01 funny brad pitt movies | dev | Brad Pitt (full) | filmography | 0.161 | 0.225 | 0.920 | +0.695 | 0 |
| ppl-03 bill murray deadpan comedies | dev | Bill Murray (full) | filmography | 0.382 | 0.457 | 0.857 | +0.400 | 0 |
| ppl-05 early spielberg | dev | Steven Spielberg (surname) | filmography | 0.269 | 0.564 | 0.896 | +0.332 | 0 |
| ppl-08 lustige Filme mit Bud Spencer und Terence Hill | dev | Bud Spencer (full), Terence Hill (full) | filmography | 0.000 | 0.000 | 1.000 | +1.000 | 0 |
| ppl-09 tarantino vibes | dev | Quentin Tarantino (surname) | style | 0.577 | 1.000 | 0.805 | -0.195 | 0 |
| ppl-11 like david lynch but less weird | dev | David Lynch (full) | style | 0.083 | 0.462 | 0.438 | -0.024 | 0 |
| ppl-13 denis villeneuve atmosphere | dev | Denis Villeneuve (full) | style | 0.399 | 0.749 | 0.964 | +0.215 | 0 |
| ppl-15 miyazaki-like | dev | Hayao Miyazaki (surname) | style | 0.411 | 1.000 | 0.766 | -0.234 | 0 |
| ppl-17 vince gilligan | dev | Vince Gilligan (full) | both | 0.205 | 0.634 | 0.940 | +0.306 | 0 |
| ppl-20 edgar wright | dev | Edgar Wright (full) | both | 0.334 | 0.880 | 0.784 | -0.096 | 0 |
| ppl-21 studio ghibli | dev | Studio Ghibli (alias) | filmography | 0.254 | 0.913 | 1.000 | +0.087 | 0 |
| ppl-23 pixar | dev | Pixar (alias) | filmography | 0.246 | 0.832 | 1.000 | +0.168 | 0 |

## Latency and cost

No paid calls, no added cost. Detection p50 0.02 ms / p95 0.15 ms (local, after warm-up; fuzzy matching only for
short queries with an out-of-vocabulary word). Entity path: in-memory person / studio → titles map (< 0.1 ms), one
more dense list in the Qdrant batch (centroid vector, top 500) and one more fingerprint cosine in the in-process scan.
Estimated +3-6 ms p50 on entity queries only; r5 ≈ 35-50 ms after the reading, whole-search p95 ~0.55 s (unchanged).

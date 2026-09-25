# How the simplified search ranking works

The candidate is `simp_combo.FINAL["combo-safe-v3"]` in `harness/simp_combo.py`, one module of about 1,360 lines. It
replaces r6, which spread over 13 modules. It runs after production's Jev reading and adds no paid calls. All models
are local CPU models.

| | r6 | combo-safe-v3 |
|---|---|---|
| Simplicity score (tunables + rules + regexes + paths) | 394 | 218 |
| Regular expression sites | 35 | 5 |
| Separate query-type code paths | 8 | 3 (general, non-English, reference) |
| NDCG@10 dev / holdout / holdout2 / holdout3 / holdout4 | .788 / .754 / .712 / .888 / .828 | .827 / .780 / .754 / .911 / .872 |
| NDCG@10 holdout5 | .764 | .794 |
| Grade-0 titles in the top 5, all splits | 62 | 40 |

## One query, step by step

`rank()` (`harness/simp_combo.py:178`) runs five steps:

1. **Language.** Production's non-English flag, or a small stopword check (`looks_foreign`, line 320), sends the query
   to the multilingual embedding (`multilingual-e5-small`). English uses `bge-base-en-v1.5` over each title's text
   without its title. When Jev's reading has English chips, a non-English query's dense signal is the mean of
   z(`multilingual-e5-small` cosine) and z(`bge-base` cosine of the chips), z-scored over every filtered title
   (`mix_z`, line 214). Its candidates are the union of each cosine's top 2,000, scored with both (line 1155), the
   same union and rescore the port runs in Qdrant.
2. **Reference** (`resolve_reference`, line 666). This step finds a person, a studio, or a "like X" title, or none.
   All three become one `Reference` (line 653) with these fields:
   - weighted titles;
   - seed titles, from which the profile is built;
   - an intent: `like`, `filmography`, `style` or `both`;
   - a residual query: the words that remain, such as "funny" in "funny brad pitt shows".
3. **Scoring** (`rank_query`, line 1118). One function handles every query. The intent changes only numbers, never
   code.
4. **Title blend** (`blend`, line 1484). This step ports production's title-lookup blend, so exact title searches
   still win.
5. **Clean-up.** This step keeps one alternate cut per film (`fold_cuts`, line 1420). For person, studio and "like X"
   queries, it then bounds the entity's own titles in the top 10 (`bound_own`, line 1361).

## The score

Every signal is z-scored over the candidate pool. The pool is the union of the top lists of each signal: 500 each for
the whole-query lists, 300 for the partial ones.

| signal | weight | code |
|---|---|---|
| Jev fingerprint: production's weighted sum of Jev weights × 74 scores | `b` 0.48 | `weighted_sum`, line 221 |
| Dense cosine of the query (or residual) to each title | `a` 0.4 | line 1145 |
| BM25 over tags, keywords, tropes and essence text | 0.12 | `sparse_top`, line 1162 |
| Facets: dense match to each of Jev's searched phrases, averaged | 0.1 | `facets`, line 603 |
| Facet coverage: the weakest facet unit counts, so "western with samurai" needs both | 0.3 | `facet_units`, line 626 |
| Negation, embedding: similarity to the negated phrase | −0.1 | line 1215 |
| Negation, labels: the title's keywords or tags name the negated thing | −2.0 × share | `label_negation`, line 552 |
| Votes and GoodWatch score prior | 0.1 each | line 1221 |

With a reference, the ranker adds:

| signal | weight | code |
|---|---|---|
| Fingerprint centroid of the seed titles | 0.8 | `reference_profile`, line 1248 |
| Embedding centroid of the seed titles | 0.6 | same |
| Term profile: BM25 of the top 40 terms the seeds share, weighted by IDF; ties sorted by term | 0.3 | `term_scores`, line 1269 |
| Peers: top titles of the 15 people or studios with the nearest fingerprint centroid | 0.3 | `peer_scores`, line 1338 |
| Name mentions in other titles' texts | 0.1 | `mention_scores`, line 1302 |
| Own-title boost × credit weight: 4.0 for filmography, 1.0 otherwise | | line 1234 |
| Popularity damping for others' titles (style and both) | −0.2 | line 1236 |

For `like` and `filmography` queries, the profile counts at 0.15 strength. For `style` and `both`, it counts at full
strength.

## Mechanisms that replaced r6's special cases

- **People and studios** (`name_index` line 898, `detect` line 979). One name index covers full names, last names
  and studio brands. A key resolves when two tests pass:
  - its entity's main-credit votes reach 3 times the next candidate's (`name_dominance`);
  - they also reach 150k × (1 + how often the key occurs as a plain word) (`name_votes`).

  This replaces r6's common-word guards, surname rules and word lists. People who share most of their credits
  merge into a team (the Coen brothers). A one-edit typo matches full names only ("sofia copola").
- **Intent** (`nearest_intent`, line 1052). The ranker replaces the names with "X", encodes the query with
  `multilingual-e5-small` and picks the nearest of 39 example phrases (`INTENT_EXAMPLES`, line 791). This matches the
  gold label on 37 of 42 queries; r6's rules match 35. The encode runs in a worker thread that overlaps the other
  encodes (`intent_pool` and `settle`, lines 844 and 852).
- **Credits** (`credits`, line 829). There are two classes: main (weight 1) and minor (0.5).
  - Main credits: the director, a Writing-department writer, the creator, and the top 4 billed actors.
  - Show creators come from `data/credits-v2.jsonl.gz`. When TMDB has no Creator credit, the fallback is the
    show's writers, never pure executive producers. This fixes "funny brad pitt shows".
    - Built by: `scripts/pull_credits.py --writer-creators`.
- **Own titles in the top 10** (`bound_own`, line 1361). The bounds by intent:

  | intent | own titles in the top 10 |
  |---|---|
  | style | 3 to 6 |
  | both | 6 to 10 |
  | "like X" | at most 1, never at rank 1 |

  "like X but Y" queries show none of X's own titles.
- **Negation** (`split_negation`, line 496). One marker-word list (English, German, French and Spanish) cuts the
  negated clauses out of the query. "less X" is handled the same way. Turkish negates after the element: a
  postposition ("zombi olmadan", "zombi yok") or a "-sız" word ("zombisiz") negates a known element. The label penalty
  (`label_negation`) acts like a soft filter when the catalog labels the negated thing. A non-English negated phrase
  first gets its known element words in English (`english_negation`, from the word list
  `goodwatch-webapp/app/server/search-ranking/negation-words.json`), so "Krimi ohne Mord" hits the "murder" labels.
- **Era** (`era_filter`, line 582). One regex finds a decade or a year and filters to it. "early" and "late" with a
  person add a small year term (`career_w`).
- **Spell correction** (`correct_word`, line 290). An unknown word becomes the most frequent catalog word one edit
  away.

## Config and variants

`DEFAULTS` (line 51) documents every key. `combo-safe-v3` (line 165) is `DEFAULTS` plus five override sets:
- `SAFE`: per-signal secondary weights, facets from 2 phrases, the agreement term, the career term and style
  suffixes such as "kubrickesque";
- `V2`: co-directed films count toward the own-title bounds, and non-English entity queries reuse the intent vector;
- the writer-only credits file;
- the intent thread and `neg_lex` 2.0;
- the two port fixes the benchmark found (issue #137): `terms_tiebreak` (the top 40 profile terms sorted by weight,
  then by term, so exact ties don't depend on numpy's sort order) and `nonen_union_k` 2,000 (the non-English union
  and rescore above).

`combo-safe-v3-scan` is `combo-safe-v3` without the two fixes, as it was scored in round 6. Both give the same top 10
on every graded query; the fixes changed ranks 11 to 50 of 5 queries (`results/LOG.md`, "Port fixes").

The other `FINAL` entries are earlier rounds, kept for comparison. Remove them when porting.

## Tools

- Scoring: `harness/evalsimp.py score simp_combo:FINAL/combo-safe-v3`. Add `--overlay` for the re-graded vague
  queries, `--split holdout5` for the holdout, and `latency ... --uncached` for timing with no embedding cache.
- Playground: `.venv/bin/python playground/serve.py --port 8766`, which shows production, `combo-safe-v3`, r6 and
  r4-combo-fast side by side.
- History: `results/LOG.md`, from "Simplification loop, round 0" on. Complexity counting rules:
  `results/simplify/baseline-complexity.md`.

## Known gap: negation needs the catalog to label the negated thing

"space opera without aliens" (`ho2-09`) scores 0 for every ranker, including production and r6. The label
penalty (`label_negation`) can demote only titles whose keywords or essence tags name the negated thing. Star Wars,
Star Wars: Clone Wars, Ahsoka and all three Guardians of the Galaxy films carry no alien keyword or tag. Their
embeddings also rate them below average for "aliens" (z about −0.8). The ranker therefore has no evidence that they
contain aliens.

TV Tropes has the evidence, but in both directions:
- Presence tropes such as "Human Aliens" and "Rubber-Forehead Aliens" sit on Star Wars.
- The absence trope "Absent Aliens" sits on the right answers: The Expanse, Foundation, Firefly, Serenity and Legend
  of the Galactic Heroes.

Trope-name matching is too noisy for presence ("The Dragon" is a henchman trope on 943 titles). An absence-trope
boost (`harness/simp_trope.py`, variant `trope-abs`, +2 S) moves The Expanse, Legend of the Galactic Heroes,
Serenity, Foundation and Firefly into the top 6 and changes no other query. It wasn't adopted: of 38,314 trope
names, only "aliens" has a matching absence trope among the 23 negation queries.

The durable fix is catalog data, not a ranking rule. The title enrichment should label concrete content elements
(aliens, robots, dragons, gore, romance) as keywords or tags. Then the existing label penalty works without any new
rule. The same gap applies to any negated element the enrichment doesn't label.

## Before porting

- Production routes Spanish and Turkish queries as English. The non-English path only fires for the flag or
  `looks_foreign`.
- Facet phrases are encoded one by one, up to 41 encodes on one query. Batch them in the port.
- The Jev reading falls back to basic search on HTTP 529 errors, with no retries.
- `holdout5` is agent-written. Confirm on real queries once there is traffic.
- No prototype names in production code: rename `combo-safe-v3`, `simp_combo` and the like.

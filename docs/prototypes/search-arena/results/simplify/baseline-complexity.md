# Baseline complexity of r6

Measured 2026-09-23 on branch `proto/search-simplify`. The subject is `run6.FINAL["r6"]` as it ranks a query
through `run6.run`: `rankers6.hyb6`, which falls back to `rankers5.hyb5` and then to `rankers4.hyb4`, plus
`blend4.blend`, `cuts.fold` and `run6.cap_own`, with every helper they call.

Mechanical part: `.venv/bin/python harness/complexity.py [--verbose] [--json out.json]`. It traces `run6.run` over
all 127 queries (dev, holdout, holdout2 to holdout4) with `sys.monitoring` and reports lines of code, regex sites,
config keys read, module constants, word lists and numeric-literal candidates. It runs in about 45 s. The hand
counts (rules, paths, and the review of literals and config keys) are in this file.

## 1. Simplicity score

**Score S = T + R + X + P**, unweighted, where T counts tunables, R rules, X regexes and P query-type paths.
Lines of code are reported separately and are not part of S.

Why no weights: each counted item is one decision a maintainer has to understand, tune or ablate. Weighting
regexes by alternations or word lists by size would let vocabulary size dominate: STOP alone has 142 words.
LOC stays out of S because it punishes readable code and rewards dense one-liners.

To avoid double counting:
- A regex is not also counted as a rule.
- A word list counts as one rule, whatever its size.
- An on/off switch is not a tunable. The mechanism it enables is counted through its rules. Otherwise
  hard-coding a flag would lower S without removing anything.

### Counting rules

**Scope.** Code reachable when r6 ranks a query:
- `run6.run` and `run6.cap_own`;
- the ranker chain and every helper it calls;
- the offline indexes built lazily on first use: the BM25 index, the spell vocabulary, the person, studio, peer,
  reference-title and cut indexes.

Branches the 127 queries never take still count when r6's config enables them (for example, era "recent"). Not
in scope:
- the data layer: `catalog.py`, `context.py` (which holds production's hard filters) and `qemb.py`;
- the evaluation code;
- dead code (section 4).

**T, tunables = T_c + T_m.**
- **T_c, config tunables.** A key of the merged config counts when r6's live path reads it and its value flows
  into a computation. The merged config is `rankers6.DEFAULTS6`, plus the FINAL overrides, plus the blend kwargs.
  A tuple of weights counts one per element (`prior` = 2). `own_slots` counts once.
  Not counted:
  - the 14 on/off switches (listed in 2b);
  - dead keys. These are keys that are never read; keys read only in dead code; switches whose value disables
    dead code (0, None, False); selectors whose other values only reach dead code; and keys shadowed by another
    key (`sparse_k` by `trunc.sparse`).
- **T_m, magic numbers.** A numeric literal or module-level numeric constant in live code counts when changing
  it would change the ranking or the entity detection. Each code site counts once, even when it repeats a value
  used elsewhere, because duplicated code means duplicated tuning. A default argument counts when r6's call
  relies on it.
  Excluded:
  - 0 and ±1 used as identity, offset or index;
  - unit conversions: 100 for percent, 1000 for ms, 1e12 in the id encoding, the 1900/2000 century bases and
    the decade arithmetic;
  - numerical guards (1e-12, 1e-6);
  - exact-match sentinels (lexical 2, fuzz 100);
  - structural minimums that define the thing counted: a pair needs 2 items, a full name needs 2 tokens;
  - cleanup loop counts (`range(3)`);
  - BM25's 0.5 IDF smoothing;
  - the stemmer's suffix table (the stemmer counts as one rule);
  - output sizes (TOP 50, the blend's `limit`);
  - debug-only values.
  Every counted literal is listed in appendix A.

**R, rules.** One rule is one hand-written decision that changes behavior for some queries or titles: an
if/else special case, a heuristic, a filter or a hand-made word list (one rule each). A guard repeated at
several call sites is one rule, listed with all its sites. Not rules: the regex itself (counted in X), linear
fusion, z-scoring, top-k. Every counted rule is listed in appendix B.

**X, regexes.** Each compiled regex that live code references, and each inline `re.*` call site in live code.
Sites are counted, not distinct patterns, and tokenizers are included. A regex whose result is never used is
dead code and does not count.

**P, paths.** Distinct pipelines selected by classifying the whole query by:
- language;
- a reference title;
- an entity's presence, kind, intent or lean.

The general path counts 1, so a ranker with a single pipeline has P = 1. Triggers on single signals are rules,
not paths: negation, era, facets, coverage, fuzzy title, creator name, "less X" and an empty residual.

**LOC.** Non-comment, non-blank, non-docstring lines, from `complexity.py`:
- `loc_functions`: every function entered at least once, plus the module-level definitions the executed code
  references. This includes dead branches inside live functions.
- `loc_executed`: only the statements that ran. This is a lower bound.

**Measuring a candidate.** Run `complexity.py --module runN --name rN`. Then walk its code paths and redo
tables 2b, 3 and appendices A and B, keeping the table IDs so the diff shows what each change removed. The
script's `proxy_score` (config keys read + constant leaves + literal candidates + regex sites + word lists)
needs no hand review. It is only a trend check: 306 for r6.

## 2. Baseline counts for r6

| | count | notes |
|---|---|---|
| T_c config tunables | **55** | 54 keys (`prior` counts as 2). The 103 config entries are 54 live, 14 switches, 34 dead and the `trunc` container (2b) |
| T_m magic numbers | **132** | 10 of them are the production blend's scoring constants. 51 are in entity detection (appendix A) |
| **T** | **187** | |
| R rules | **164** | 8 are production-parity blend rules. 11 are word lists (appendix B) |
| X regexes | **35** | 30 distinct patterns. 6 are word tokenizers (`[^\W_]+` 3x, `[^\W\d_]+` 2x, and the reference-span tokenizer, which also takes apostrophes) |
| P paths | **8** | general, reference title, non-English, entity filmography, entity style, entity both, actor-lean head, studio-vs-person |
| **S** | **394** | 375 without the production-parity blend (10 T_m + 8 R + 1 X) |
| LOC, functions entered | 1,752 | about 121 of them are dead branches (section 4). Whole files: 2,685 in the 13 modules + run6.py |
| LOC, executed | 1,614 | a lower bound (branches the queries don't take) |

The 40% win target in the handoff puts a candidate at **S ≤ 236**.

**Where S lives**:

| area | mechanisms | S | share |
|---|---|---|---|
| Entity detection and indexes | M16 | 104 | 26% |
| Style path | M18 | 62 | 16% |
| General text handling | M04 to M11: spell, non-English, negation, less, era, facets, coverage, reference | 131 | 33% |
| Core fusion and sparse | M01 to M03 | 29 | 7% |
| Title blend | M12 to M15 | 39 | 10% |
| Entity filmography | M17 | 19 | 5% |
| Cut folding | M19 | 10 | 3% |

**How often mechanisms fire** on the 127 queries (from the hyb6 debug output, a proxy for how much an ablation can
move):

| trigger | queries |
|---|---|
| facets ≥ 2 | 48 |
| facet coverage | 27 |
| empty residual on an entity query | 24 |
| entity style | 19 |
| negation on a non-entity query | 16 |
| post-blend cut fold changes the top 50 | 16 |
| entity filmography | 14 |
| non-English | 10 (7 by production's flag) |
| entity both | 6 |
| studio entity | 6 |
| reference title | 6 |
| spell fix | 5 |
| era range | 4 |
| fuzzy title hit | 1 |
| entity early/late | 1 |
| entity negation or "less" | 1 |
| era recent/old | 0 |
| creator-name title bonus | 0 |

### 2a. Score by mechanism

T_c and T_m are tunables, R rules, X regexes and P paths. Sub-rows and switches are in the rule table (section 3).

| ID | mechanism | T_c | T_m | R | X | P | S |
|---|---|---|---|---|---|---|---|
| M01 | candidate pool and z-fusion (dense, fingerprint) | 5 | 1 | 1 | 0 | 1 | 8 |
| M02 | sparse BM25F | 3 | 9 | 5 | 1 | 0 | 18 |
| M03 | prior: votes and GoodWatch score (general, filmography) | 2 | 0 | 1 | 0 | 0 | 3 |
| M04 | spell correction | 0 | 6 | 4 | 1 | 0 | 11 |
| M05 | non-English handling | 1 | 2 | 12 | 2 | 1 | 18 |
| M06 | negation | 1 | 1 | 7 | 7 | 0 | 16 |
| M07 | "less X" (entity paths) | 1 | 0 | 2 | 1 | 0 | 4 |
| M08 | era | 1 | 7 | 6 | 5 | 0 | 19 |
| M09 | facets (Jev phrases) | 1 | 9 | 6 | 0 | 0 | 16 |
| M10 | facet coverage | 4 | 4 | 11 | 0 | 0 | 19 |
| M11 | "like X" reference title | 3 | 4 | 12 | 8 | 1 | 28 |
| M12 | title blend, production port | 0 | 10 | 8 | 1 | 0 | 19 |
| M13 | strict title matching | 1 | 0 | 1 | 1 | 0 | 3 |
| M14 | title-word bonus by query kind | 1 | 3 | 4 | 0 | 0 | 8 |
| M15 | fuzzy title matching | 1 | 4 | 4 | 0 | 0 | 9 |
| M16 | person and studio detection, credit weights, intent | 0 | 51 | 46 | 6 | 1 | 104 |
| M17 | entity filmography path (hyb5) | 6 | 5 | 7 | 0 | 1 | 19 |
| M18 | style path (hyb6), sub-rows M18a to M18p | 24 | 15 | 20 | 0 | 3 | 62 |
| M19 | alternate-cut folding | 0 | 1 | 7 | 2 | 0 | 10 |
| | **total** | **55** | **132** | **164** | **35** | **8** | **394** |

### 2b. Config keys (103 entries)

**Live tunables (54 keys, 55 values).** Keys marked "default" come from DEFAULTS; the others are FINAL overrides.

| group | keys |
|---|---|
| Core | `emb` bgeb-notitle (default); `a` 0.4; `b` 0.48; `c` 0.12; `prior` (0.1, 0.1) (default); `k_emb` 500 (default); `k_fp` 500 (default); `trunc.sparse` 300; `sparse_bigram` 2.0 |
| General text handling | `neg` 0.1 (default); `facet` 0.1 (default); `era_w` 0.3 (default; only reached for recent/old, 0 queries); `nonen_mix` 0.5; `ref_votes` 10000 (default); `ref_mix` 0.2; `ref_agree` 0.2; `cov` 0.3; `cov_beta` 0.5; `cov_k` 300; `cov_max_tokens` 5 (default) |
| Filmography | `fil_boost` 4.0; `mix_fil` 0.3; `cen_k` 20; `cen_top` 500; `early_frac` 0.4; `era_off` 0.35 |
| Style | `less_neg` 0.3; `cen6_k` 20; `w_fp` 0.8; `w_emb` 0.6; `w_terms` 0.3; `w_mention` 0.1; `w_peer` 0.3; `w_agree` 0.2; `w_jev` 0.4; `w_res` 0.3; `damp` 0.2; `gw` 0.1; `own_w` 0.8; `own_boost` 1.0; `own_min` 3; `own_max` 6; `own_slots` (0, 2, 4, 6, 8); `terms_n` 40; `terms_min_df` 2; `peer_k` 15; `peer_titles` 8; `k_cen` 500; `k_terms` 300; `head_style` 6; `head_actor` 6 |
| Blend | `strict` 0.9; `fuzzy` 0.88; `cap` 0.65 |

**On/off switches (14, not counted in T):** `era`, `spell`, `nonen`, `ref`, `ref_facet`, `cov_concrete`,
`sparse_body`, `ent`, `ent_facet`, `s6`, `fold`, `text` ("sparse"; "none" is the only full off switch for BM25),
`kind`, `kind_all`.

**Dead keys (34).** Deleting each one, with the code it gates, changes nothing:
- `agree` 0.0: non-reference agreement.
- `cen_fp` 0.3, `mix_style` 0.7, `sty_prior` 1.0, `sty_boost` 0.3, `sty_cap` 4: hyb5's style branch, which r6
  never reaches.
- `cen_fp_fil` 0.0: multiplies the hyb5 fingerprint centroid by 0.
- `cov_fields` "body", `cov_mode` "z", `cov_head` 50.
- `ent_sparse_people` True: its gated branch drops people fields.
- `era_mode` "filter": the "soft" range arm is dead.
- `facet_source` "phrases": the chunks and auto branches are dead.
- `less_fp` 0.0.
- `long` False, `long_n`, `long_w`.
- `neg_own_min`, `neg_own_max`, `neg_own_boost`, `neg_w`, `style_head`: all None.
- `peer_emb` 0.0.
- `ref_fp` 0.0, `ref_fp_mod` 0.0, `ref_tags` 0.
- `ref_text` "full", `ref_sparse` "body": only "mod" branches, and `sparse_body` already sets the body fields.
- `sparse_k` 300: shadowed by `trunc.sparse`.
- `sparse_tf` "raw", `sparse_w` None.
- `trunc.dense`, `trunc.facet`, `trunc.neg`: they only feed `_floor`, a no-op (section 4).

Checked by perturbation: changing `trunc` to sparse only, `sparse_k`, `cov_head`/`long_n`/`long_w`, the five hyb5
style keys, and `ref_text`/`ref_sparse` changed 0 of 127 top-50 lists.

## 3. Rule table

Columns:
- **where**: file:line in `harness/`.
- **tunables**: T_c keys and T_m literals (by value).
- **regexes**: the regex sites.
- **off**: the config value that disables the mechanism, or ✗ when there is none (then the minimal code change).

"Partial" means the switch leaves part of the mechanism running.

| ID | mechanism | where | what it does | tunables | regexes | off |
|---|---|---|---|---|---|---|
| M01a | dense query | rankers4:205-206, 228; rankers5:139-140; rankers6:251-252 | bge-base-notitle cosine of the (negation-free, spell-corrected) query | `emb`, `a` (hyb4, hyb5), `w_res` (hyb6), `k_emb` | – | `a=0` (hyb4, hyb5; candidates still pooled) |
| M01b | Jev fingerprint sum | rankers.py:23-27; rankers4:229, 306; rankers6:289 | weights × 0..10 scores | `b`, `w_jev`, `k_fp` | – | `b=0`; `w_jev=0` on style |
| M01c | candidate union and fusion | rankers4:230-232, 304-306; rankers.py:17-20, 59-70 | union of the per-signal top lists, sum of weighted z-scores, top 100 | LIMIT 100 | – | core, no switch |
| M02 | sparse BM25F | sparse.py:22-168; rankers4:243-264, 314-328; rankers5:153-165, 187-189 | BM25F over tags, keywords, tropes, essence, creators and cast (title field weight 0); bigram terms; top-k hits only | `c`, `trunc.sparse`, `sparse_bigram`; K1 1.2, B 0.75, field weights 2/2/1/1/4/1.5, min token length 2 | sparse `_WORD` | `text="none"` (full). `c=0` (score only, candidates stay). `sparse_body=False` puts the title field back |
| M03 | prior | rankers2:135-139; rankers4:353-357; rankers5:212-217 | p·z(log votes) + q·z(GoodWatch score); a missing score becomes the mean | `prior` (2) | – | `prior=(0,0)` |
| M04 | spell correction | rankers3:38-78; rankers4:174-175; rankers5:107-108; rankers6:228-229 | an unknown word (df < 3, 4+ letters, ASCII) becomes the most frequent vocabulary word within edit distance 1, or 2 for 8+ letters | 20, 4, 3, 8, 2, 200 | rankers3:77 | `spell=False` |
| M05a | stopword language check | rankers3:113-125; rankers4:169; rankers5:97; rankers6:218 | 2+ fr/de/es stopwords, more than English ones, means non-English | best ≥ 2 | – | `nonen=False` |
| M05b | native routing and skips | rankers4:170, 185, 255, 285; rankers5:98, 107, 154; rankers6:219, 228; entities:346, 360, 384, 413 | non-English: me5s embedding; no sparse, spell, reference or coverage; detection matches only multi-word names | – | – | ✗ for production's flag (`ctx.non_english`). Minimal: `non_en = False` at rankers4:169, rankers5:97 and rankers6:218. `nonen=False` only drops the local check |
| M05c | English chip mix | rankers3:128-141; rankers4:208-217; rankers5:141-148 | e = mix of z(me5s native) and z(bge on Jev's want/attribute chips) | `nonen_mix` (hyb4), 0.5 hard-coded (hyb5) | `^Low\s+`, `^Not\s+` | `nonen=False`. `nonen_mix=0` works in hyb4 only (partial) |
| M05d | avoid chips as negation | rankers4:217, 349-350 | Jev's avoid and excluded chips join the negation penalty | – | (M05c) | ✗ separately (`nonen=False` also drops M05c). Minimal: `extra_neg = []` at rankers4:217 |
| M06a | negation split | rankers2:27-91; rankers4:176; rankers5:111; rankers6:232 | marker-led clauses (26 en/de/fr/es markers, "more X than Y") are cut from the query; cleanup; a clause sharing a word with the positive text is dropped | content-word length > 2 | `_MARKER_RE`, `_THAN_RE`, `_STOP`, `_DANGLING`, `_WORDS`, rankers2:81, rankers2:85 | `neg=0` (partial: `facets()` still drops facets with negated words, rankers2:107-108, 121) |
| M06b | negation penalty | rankers4:345-352; rankers5:194-197; rankers6:292-294 | − neg · z(max cosine to the negated clauses) | `neg` | – | `neg=0` |
| M07 | "less X" | rankers5:44, 109-112, 196; rankers6:230-233, 294 | on entity queries, "less/fewer/not so X" joins the negated clauses with weight max(neg, less_neg) | `less_neg` | `_LESS` | ✗. `less_neg ≤ 0.1` only lowers the weight. Minimal: `less = []` at rankers5:109 and rankers6:230 |
| M08a | era range filter | rankers3:83-108; rankers4:178-182; rankers5:115-120 | a decade or year (±1) in the query filters the candidates when ≥ 50 remain | 50 (2 sites), year ±1 | `_DECADE`, `_DECADE_ROMANCE`, `_YEAR` | `era=False`. `era_mode="soft"` turns the filter into a prior. Not on the style path (hyb6 ignores era) |
| M08b | era recent/old prior | rankers3:86-87, 104-107; rankers4:358-367; rankers5:218-227 | "recent/new/…" gives a recency prior (capped at 2026), "old/vintage" an age prior; a missing year becomes the median | `era_w`; 30, 2026 (2 sites each) | `_RECENT`, `_OLD` | `era_w=0` (or `era=False`) |
| M09 | facets | rankers2:99-122; rankers4:266-281, 329-332; rankers5:166-176, 190-193 | Jev phrases (p ≥ 0.1, up to 4, at least 2), without negated words; one candidate list each (top 200); facet · (0.5 mean + 0.5 min of z). Entity path: phrases without entity words | `facet`; 0.1, 4, 2, 200 (3 sites), 2 (2 sites), 0.5 | – (`_CHUNK` is dead) | `facet=0`. `ent_facet=False` on the entity path only |
| M10a | facet coverage | rankers4:113-153, 283-302, 333-344 | short queries (≤ 5 tokens, no reference, English): units from Jev phrases (spell-corrected, generic/stop/negated words dropped, collocations merged), 2 to 4 units, one needs a Jev-concrete word; score cov · z(min over units of z(dense) + β·z(BM25 body)) | `cov`, `cov_beta`, `cov_k`, `cov_max_tokens`; 0.1, 4, 2, 0.3 | – | `cov=0` |
| M10b | concrete-word gate | rankers4:287-289 | coverage only when a unit has a concrete word | – | – | `cov_concrete=False` (coverage then fires more) |
| M10c | collocation merge | rankers4:124-129, 144-147 | adjacent words become one unit when their bigram df / min unigram df ≥ 0.3 | 0.3 | – | ✗. Minimal: `collocated()` returns False |
| M11a | reference detection | rankers4:40-94 | "like / similar to / in the vein of … X", or "X but Y" without a marker; the longest span (≤ 8 words) that equals a title with ≥ 10k votes; modifier = the rest | `ref_votes`; 8, 3 | `_LIKE`, `_NOT_LIKE`, `_BUT`, `_MOD_LEAD`, rankers4:58, 75, 79 | `ref=False` (whole M11) |
| M11b | franchise exclusion | rankers4:97-108, 190-194; blend4:46-47, 54 | the reference and its same-stem titles (stem ≥ 2 words or ≥ 6 letters) are removed from candidates and blend | 2, 6 | rankers4:101 | ✗ on its own. Minimal: `exclude = set()` and skip the mask edit (rankers4:191, 193-194). The user wants the reference allowed back (handoff) |
| M11c | reference dense mix | rankers4:219-226 | dense = (1 − ref_mix) z(query) + ref_mix z(cosine to the reference's passage vector) | `ref_mix` | – | `ref_mix=0` |
| M11d | reference agreement | rankers4:308-311 | + ref_agree · min(z dense, z fingerprint) | `ref_agree` | – | `ref_agree=0` |
| M11e | reference facets | rankers4:269-277 | with a modifier, facets = [reference vector, modifier]; otherwise Jev facets without reference words | 2 | – | `ref_facet=False` (Jev facets instead) |
| M12 | title blend (production port) | blend.py:12-41; blend4:17-91 | TMDB title-lookup rows plus discovery. Lexical: exact 2 / phrase 1.05 / all words 0.9 / 0.65 × coverage / partial prefix 0.15; score max(lex, 0.9·10/(9+rank)) + 0.15·min; popularity tiebreak; imdb dedup | 1.05, 0.9, 0.65, 0.15, 2 (prefix length), 10, 9, 0.1, 0.9, 0.15 | blend `_WORD` | ✗, production parity, not an ablation target |
| M13 | strict title matching | blend2:21-30; blend4:32-34, 39 | a partial title match keeps its lexical score only when the similarity of query to title (or the part before ":" / " - ", or the original name) is ≥ 0.9 | `strict` | `_SPLIT` | `strict=0` |
| M14a | title-word bonus by kind | blend4:22, 35-38 | a failed strict match keeps min(lex, cap) when every Jev-concrete query word is in the title | `cap` | – | `kind=False`; `kind_all=False` (any concrete word); `cap=None` (uncapped) |
| M14b | creator-name bonus | blend3:21-47; blend4:23, 37 | same bonus when the query is only name tokens of one creator with ≥ 2 titles (≤ 3 words, a word of ≥ 4 letters). Fired on 0 of 127 | 2, 3, 4 | – | ✗ separately (`kind=False` drops M14a too). Minimal: `creator = None` at blend4:23 |
| M14c | no bonus on entity queries | run6:51-52 | `kind` off when an entity is detected | – | – | ✗. Minimal: delete run6:51-52 |
| M15 | fuzzy title | blend2:33-87; blend4:52-58 | short queries (≤ 4 words, ≥ 5 letters) with an out-of-vocabulary word: the best rapidfuzz title ≥ 0.88 (then most votes; none if an exact title exists) enters as lexical 1.05 | `fuzzy`; 4, 5, 20, 1.05 | – | `fuzzy=0` |
| M16a | person index | entities:115-211, 316-329 | full and original names (the higher votes_sum wins); surnames of dominant people (lead score, 3× dominance); sibling teams; prominent people for fuzzy matching; role classification | SURNAME_VOTES, SURNAME_DOMINANCE; 2, 4, 3, 2, 3, 3, 3, 3, 4, 2 (appendix A) | – | `ent=False` (whole M16 to M18) |
| M16b | credit weights | entities:122-158, 467-484 | per-title credit weight: director, creator, writer, billing tier and department rules; mean over entities | 0.9, 0.5, 0.8, 0.8, 0.9, 0.6, 0.5, (i ≤ 1), 3, 5, 8, 0.85, 0.6, 0.4, 0.5 | – | ✗ (code; needed by M17 and M18) |
| M16c | common-word guard | entities:92-110 | a single word that is a frequent essence or title word, a stopword, filler or style word, or shorter than 3 letters, needs a full-name match | COMMON_LOWER_DF, COMMON_ANY_DF, COMMON_TITLE_DF; 3 | entities:97 | ✗ (module constants) |
| M16d | studio index | entities:216-287 | companies (first two 1.0, else 0.8) and networks grouped by alias: suffix, studio, the and walt stripped; brand prefix; weak single-word aliases; all-common aliases only as full suffixed names; ≥ 8 titles | STUDIO_MIN_TITLES, RARE_LOWER_DF; 0.8, (i ≤ 1), 2, 50, 2 | – | ✗ (code) |
| M16e | detection | entities:339-446 | n-grams longest first (4 to 1); studio alias (a weak one needs a film word next to it); full name; mononym; team ("X brothers", plural); surname with -esque/-ian/-like/-ish; suffixed studio; fuzzy full name (ratio ≥ 90, 3/2-grams) or surname (7+ letters, distance 1) only when nothing matched and the query has ≤ 5 tokens | FUZZY_NAME_CUTOFF, FUZZY_MAX_WORDS; 4, 5, 3, 5, 5, 3, 3, 7, 1 | fold (entities:77, 79), hyphen (entities:343), `_STYLE_SUFFIX` | `ent=False`. Fuzzy only: `entities.FUZZY_MAX_WORDS = 0` (module constant) |
| M16f | intent and lean | entities:447-462 | style marker (style words, "in the vein of / à la", suffix) → style; film word, other content words, era word or all-studio → filmography; else both; lean = filmography when every entity is an actor | – (word lists) | entities:449 | ✗ (code) |
| M17a | residual query | rankers5:61-68, 104-114; rankers6:225-235 | the query without entity spans and brothers/bros/sisters; filler and style words dropped; empty when no content word | – | (M06, M07) | ✗ |
| M17b | filmography scoring | rankers5:122-189, 228-233 | credited titles ranked by the residual: dense = (1 − mix_fil) z(query) + mix_fil z(centroid of the top cen_k main titles), or the centroid alone; candidates add the centroid top and every credited title; + fil_boost · weight | `fil_boost`, `mix_fil`, `cen_k`, `cen_top`; 0.85, 3, 0.5 (entities:490-492) | – | ✗ for the path (`ent=False` drops all entity handling). `fil_boost=0`, `mix_fil=0` per signal |
| M17c | early/late career | rankers5:71-85 | "early"/"late" scales the credit weight down (× era_off) outside the first or last 40% of the career | `early_frac`, `era_off`; 0.85, 10 | – | `era_off=1.0` |
| M18a | style dispatch | rankers6:214-216 | style/both intents take hyb6; filmography takes hyb5 | – | – | ✗: `s6=False` swaps in r5's style path, it doesn't switch style off |
| M18b | style centroid rows | rankers6:54-69, 242-245, 262 | the top cen6_k main-role titles (w ≥ 0.85, else ≥ 0.5 when fewer than 3), weighted by log votes; two candidate lists (k_cen) | `cen6_k`, `k_cen`; 3, 0.5, 0.85 | – | – (needed by M18c to M18h) |
| M18c | fingerprint centroid | rankers6:245, 278-279 | w_fp · z(cosine to the fingerprint centroid) | `w_fp` | – | `w_fp=0` (candidates stay) |
| M18d | embedding centroid | rankers6:244, 278, 280 | w_emb · z(cosine to the bge centroid); English bge even for non-English queries | `w_emb` | – | `w_emb=0` (candidates stay) |
| M18e | term profile | rankers6:130-156, 246-247, 264-266, 281-282 | stemmed terms of the centroid titles shared by ≥ terms_min_df of them, weight = share × IDF, top terms_n, BM25 body scores; top k_terms join the candidates; needs ≥ 2 rows | `w_terms`, `terms_n`, `terms_min_df`, `k_terms`; 2 | – | `w_terms=0` (with `w_agree=0` to skip the computation) |
| M18f | name mentions | rankers6:159-171, 248, 267-269, 285-286 | BM25 body score of the studio name, or the person's name plus a non-common surname; top 100 join; w · z(log1p) | `w_mention`; 2.0, 100 | – | `w_mention=0` |
| M18g | peers | rankers6:72-127, 253-260, 271, 287-288 | offline centroids of directors and creators (≥ 3 main-crew titles, ≥ 200k votes) and of studio groups (≥ 8 titles, ≥ 200k); the nearest peer_k of the same kind by fingerprint centroid; their top peer_titles titles get max(z, 0) | `w_peer`, `peer_k`, `peer_titles`; 0.85, 3, 200k, 8, 200k | – | `w_peer=0` |
| M18h | agreement | rankers6:283-284 | w_agree · min(z fp, z emb, z terms) | `w_agree` | – | `w_agree=0` |
| M18i | Jev fingerprint on style | rankers6:289 | w_jev · z(weighted sum) | `w_jev` | – | `w_jev=0` |
| M18j | residual on style | rankers6:250-252, 272-273, 290-291 | w_res · z(cosine to the residual query) | `w_res` | – | `w_res=0` (candidates stay) |
| M18k | popularity damping | rankers6:295-296 | gw · z(GoodWatch score) − damp · z(log votes) on titles that aren't the entity's own | `damp`, `gw` | – | `damp=0`; `gw=0` |
| M18l | own-title boost | rankers6:275, 305 | + own_boost for credit weight ≥ own_w | `own_w`, `own_boost` | – | `own_boost=0` |
| M18m | own slots and cap | rankers6:174-209, 327 | the top 10 holds own_min to own_max own titles: extras move below 10, missing ones are pulled into the slots | `own_min`, `own_max`, `own_slots`; 10 | – | `own_min=0` and `own_max=10` |
| M18n | "both" head | rankers6:316-325 | the first head_n own titles by filmography score, then the style list with reduced slots; head_n by lean (actor or crew) | `head_style`, `head_actor`, `fil_boost`; 10 | – | `style_head=0` (a dead key today, at None; keep it while ablating) |
| M18o | cap after blend | run6:57-59, 66-80 | style intent only: own_max re-applied after the blend and the fold | 10 | – | `own_max=10` (together with M18m). ✗ on its own. Minimal: delete run6:57-59 |
| M18p | style candidate pool | rankers6:241, 262-274 | credited titles with w ≥ 0.5 plus every signal's top list | 0.5 | – | core, no switch |
| M19a | cut index | cuts.py:26-125 | cut suffix or director possessive plus a shared director; part markers (Vol. 1/2) link to the whole cut; duplicate records (same text, years ±1, shared or one missing director) | 1 (years) | `_CUT`, `_PART` | – |
| M19b | fold before slots | rankers6:310-315 | 2nd+ cuts move to the end before M18m. 0 of 127 top-50 lists change without it | – | – | `fold=False` |
| M19c | fold after blend | run6:54-56 | 2nd+ cuts dropped from every list (changes 16 of 127 top-50 lists) | – | – | ✗ as config (`run6.run(..., fold=False)` argument). Minimal: read `kw.get("fold", True)` there |

**Missing off switches.** 20 of the 58 rows have no config value that turns them off:
- M01c and M18p: core, nothing to ablate.
- M12: production parity.
- M18b and M19a: supporting pieces, turned off with their consumers.

The other 15 are rule units a later round may want to ablate: M05b, M05d, M07, M10c, M11b, M14b, M14c,
M16b, M16c, M16d, M16f, M17a, M18a, M18o, M19c. Four more rows have only a partial switch: M05c, M06a, M17b and
M02 (with `c` only).

Path branch sites (query classification tested in code):
- `non_en`: rankers4:170, 174, 185, 208, 255, 285; rankers5:98, 107, 141, 154; rankers6:219, 228.
- `ref`: rankers4:185-195, 198, 205, 219, 234, 245, 253, 269, 275, 285, 308.
- entity: rankers5:90-94; rankers6:215; run6:51, 58.
- intent and lean: rankers5:136, 230, 239-240; rankers6:215, 316-317; entities:455-461.
- entity kind: entities:475; rankers6:110, 162.

## 4. Dead or unreachable code on r6's path

Each item can be deleted with zero change to r6's rankings. About 121 lines are dead branches inside live
functions (4a and 4b). Another 933 lines of the 13 path modules plus run6.py are never entered (4c and 4e).

**4a. Branches dead under FINAL["r6"]**
- rankers4 (hyb4):
  - 197-203: `long`.
  - 233-236 and 312-313: `ref_fp`/`ref_fp_mod` = 0.
  - 238-242 and 315-317: the Crate text pool (`text` is "sparse").
  - 246-252: `ref_tags` and `ref_sparse` "mod". `s_query` is always `positive`.
  - 320-323 and 325: `sparse_tf`, and the crate/sparse average.
  - 335-341: `cov_mode` "head".
  - 295: the `cov_fields` else branch.
  - 361-363: the era range arm of the soft prior, reachable only with `era_mode` "soft".
  - 308-311: the non-reference branch of `agree`, which is 0.
  - 205: the `ref_text` "mod" arm.
  - 174: `and not looks_foreign(text)` is redundant, because `non_en` already contains it when `nonen` is on.
- rankers5 (hyb5):
  - 230-260: the whole style/both branch, with `sty_boost`, `sty_cap`, the head and the cap. hyb6 takes every
    style/both query while `s6` is on, so hyb5 only sees filmography.
  - 136-137 (`style`, `mix_style`) and 215 (`sty_prior`) always take the filmography value.
  - 229: `own`, used only by that branch.
  - 132-134 plus the `cen_fp_fil` term on 185: the fingerprint centroid, multiplied by 0.
  - 156-157: the `ent_sparse_people` branch.
  - 198-211 plus `_fps_mean` and `_cache` (47-54): `less_fp`.
  - 221-223: the soft range arm.
- rankers6 (hyb6):
  - 297-304: the `neg_own_*` block.
  - 294: the `neg_w` conditional.
  - 318-319: `style_head`.
  - 118: the `peer_emb` term.
  - The embedding centroids of `peer_index` (`M`, `Ms`, and the `cen` argument of `peers`): stored but only
    used times 0. They also cost build time.
- rankers2: 109, the chunks computation; 115-120, the `facet_source` branches; `_CHUNK` (96). The result of
  both regexes is unused with "phrases".
- blend4:
  - 19 and 67-68: the outside-name fallback. Discovery ids always come from the catalog. The call also reads
    every capture when `X._names` isn't pre-filled, a blindness risk for holdout5.
  - 60-61: `exclude` on discovery rows. hyb4 already masked them.
- Duplicate choices:
  - `head_actor` equals `head_style` (6), so the lean branch in rankers6:317 is a no-op.
  - hyb5 hard-codes 0.5 where hyb4 reads `nonen_mix`, which is also 0.5.

**4b. No-op computations**
- `rankers3._floor` and its 8 call sites (rankers4:221, 222, 228, 271, 280, 293, 348, 350) are identities on
  every candidate: `min(x, kth)` restores the top-k exactly, and candidates are always inside the rows. Delete
  the function and `trunc.dense`/`facet`/`neg`. Checked: 0 lists change.
- `Detection.residual` (entities:454) is built and never read on the path.
- `sparse.DEFAULT_W["title"]` 1.0: every query zeroes the title field. The field itself stays, because the
  collocation document frequencies (`rankers4._df`) use the default index.
- Debug-only code: `rankers6._peer_name`, `_term_names`, the `centroid`/`peers`/`terms`/`comp`/`cand` debug
  fields, and `blend2.FUZZY_MS` with its timing lines.
- hyb5 calls `entities.detect` a second time after hyb6 has already run it. This is wasted work, not a behavior
  change.

**4c. Functions in path modules that r6 never enters**
- rankers.py: everything except `z`, `top`, `as_list`, `weighted_sum` and `LIMIT`:
  - `retrieve`, `prod_replay`, `fp_count`, `emb_only`, `candidate_union`, `hyb_lin`, `hyb_rrf`,
    `emb_then_fp`, `nojev_knn`, `registry`, `STAGES`;
  - `fp_cosine`, `emb_name_for`, `emb_scores`;
  - `text_array`, which only the dead Crate branch uses.
  - 151 lines.
- rankers2: `hyb2`, `DEFAULT`, `emb_name_for`, `qvec`, `pct`. 72 lines.
- rankers3: `hyb3` and `_floor`. `LEADER` stays only as the base of the defaults. 113 lines.
- blend.py `blend`, blend2 `blend`, blend3 `blend` (blend4 re-implements all three): 190 lines. Only
  `words`/`normalized`/`title_match`, `title_similarity`/`fuzzy_hit`/`vocabulary`/`eligible_titles` and
  `creator_tokens`/`names_creator` are live.
- sparse `doc_freq` and `stats`; entities `warm` and `__main__`; cuts `__main__`.

**4d. Dead config keys.** The 34 keys in 2b.

**4e. Evaluation and grading code (not ranking; list, don't count)**
- run6.py, except `run`, `cap_own`, `cfg` and `FINAL`. That is `contexts`, `base_lists`, the metrics,
  `variants`, `sweep`, `pool`, `final`, `report` and `holdout4*`: 310 lines.
- run5.py and run4.py, except the FINAL chain that builds r6's config (`KW4`/`BK4`/`STRICT`, `cfg`).
- run.py, run2.py, run3.py.
- metrics.py, grade4.py, grade6.py, holdout.py, holdout2.py, pool.py, anchors.py, regrade_effect.py.
- live_bench.py, live_build.py, live_replay.mjs.
- `cuts.second_cuts`.
- The embedding builders embed_notitle*.py are offline data prep. Keep them to rebuild the data.

**Near-dead, not proven zero-change.** These are the first things to ablate:
- M19b, the fold before slots: 0 of 127 lists change.
- M14b, the creator-name bonus: fires on 0 queries.
- M08b, the era recent/old prior: 0 queries.
- M15, fuzzy title: 1 query.
- M17c, early/late career: 1 query.
- M07 "less X": 1 query.

**Divergences worth knowing before merging paths.** The style path (hyb6) skips:
- era;
- facets;
- the sparse residual;
- the English chips for non-English queries.

`cap_own` applies to style but not to both. `sparse_k` is shadowed by `trunc.sparse` in hyb4 and hyb5.

## Appendix A: counted magic numbers (132)

Listed as file:line, then the value and its meaning.

- **M01** (1): rankers.py:12 `LIMIT` 100.
- **M02** (9): sparse.py:
  - 67: K1 1.2, B 0.75.
  - 66: field weights tags 2, keywords 2, tropes 1, essence 1, creators 4, cast 1.5. The title weight is dead.
  - 53: minimum token length 2.
- **M04** (6): rankers3:
  - 50: vocabulary df ≥ 20.
  - 56: length < 4, and known when df ≥ 3.
  - 58: 8 letters before distance 2, and the distance 2.
  - 59: `limit` 200.
- **M05** (2): rankers3:125, best ≥ 2; rankers5:148, the 0.5/0.5 mix.
- **M06** (1): rankers2:47, content word length > 2.
- **M08** (7): rankers4:181 and rankers5:118, ≥ 50; rankers4:363 and rankers5:223, 30; rankers4:365 and
  rankers5:225, 2026; rankers3:103, year ±1.
- **M09** (9): rankers2:99, `min_p` 0.1 and `max_n` 4; rankers2:122, ≥ 2; rankers4:272, 281 and rankers5:176,
  top 200; rankers4:277 and rankers5:172, ≥ 2; rankers4:331, the 0.5 mean/min mix.
- **M10** (4): rankers4:132, `min_p` 0.1 and `max_n` 4; rankers4:153, ≥ 2 units; rankers4:124, ratio 0.3.
- **M11** (4): rankers4:80, 8 words; rankers4:83, key ≥ 3; rankers4:103, stem ≥ 2 words or ≥ 6 letters.
- **M12** (10, production parity): blend.py:34, 36, 38, 40, 39 (1.05, 0.9, 0.65, 0.15, prefix length 2);
  blend4:75, 77 (10, 9, 0.1, 0.9, 0.15).
- **M14** (3): blend3:32, creator titles ≥ 2; blend3:41, ≤ 3 words and a word ≥ 4 letters.
- **M15** (4): blend2:67, ≤ 4 words and ≥ 5 letters; blend2:74, `limit` 20; blend4:56/58, lexical 1.05.
- **M16** (51):
  - entities:43-51, the 9 module constants: SURNAME_VOTES 500k, SURNAME_DOMINANCE 3, STUDIO_MIN_TITLES 8,
    COMMON_LOWER_DF 20, COMMON_TITLE_DF 15, COMMON_ANY_DF 250, RARE_LOWER_DF 2, FUZZY_NAME_CUTOFF 90,
    FUZZY_MAX_WORDS 5.
  - Credit weights:
    - 143: 0.9, 0.5, 0.8.
    - 146: 0.8.
    - 148: 0.9, 0.6.
    - 149: 0.5, and the first 2 writers.
    - 153: billing cutoffs 3, 5, 8 and weights 0.85, 0.6, 0.4.
    - 155: 0.5.
    - 229: 0.8, and the first 2 companies.
  - Person index:
    - 180: main role 0.85.
    - 181: crew 2×.
    - 187: titles ≥ 2.
    - 192: surname length ≥ 4.
    - 197: titles ≥ 3.
    - 204: SURNAME_VOTES/2, titles ≥ 3, and the next 3 people.
    - 205: ≥ 3 shared titles.
    - 208: titles ≥ 3 and 4×SURNAME_VOTES.
    - 321: cast ≥ 2× crew.
  - Common words and studios:
    - 110: length < 3.
    - 264: alias length ≥ 2.
    - 271: < 50 rows.
    - 276: ≥ 2 words.
  - Detection:
    - 354: n-grams up to 4.
    - 370: titles ≥ 5.
    - 372: titles < 3 and popularity < 5.
    - 375: titles ≥ 5.
    - 417/418: df < 3.
    - 420: fuzzy n-grams 3 and 2.
    - 436: 7 letters.
    - 438: distance 1.
- **M17** (5): rankers5:74, 0.85; rankers5:79, span ≥ 10; entities:487, 491, 492 (`min_w` 0.85, < 3, the 0.5
  fallback).
- **M18** (15):
  - rankers6:63, 66, 67: `min_w` 0.85, < 3, 0.5.
  - rankers6:83, 84: 0.85, 3 titles, 200k votes.
  - rankers6:94: 8 rows, 200k.
  - rankers6:138: ≥ 2 rows.
  - rankers6:171: bigram 2.0.
  - rankers6:268: top 100.
  - rankers6:241: 0.5.
  - rankers6:174: `n_top` 10.
  - rankers6:325: 10.
  - run6:66: n 10.
- **M19** (1): cuts.py:109, years within 1.

## Appendix B: counted rules (164)

The word lists are marked (list).

- **M01** (1): the candidate set is the union of the per-signal top lists.
- **M02** (5):
  1. STOP (list).
  2. The light stemmer.
  3. Adjacent bigrams.
  4. Body-only query (no title field).
  5. Keep only the top-k hits with a score above 0.
- **M03** (1): a missing GoodWatch score becomes the mean.
- **M04** (4):
  1. Which words get corrected: ASCII, alphabetic, ≥ 4 letters, df < 3.
  2. Distance 1, or 2 for long words.
  3. The candidate vocabulary: title, original title, essence, tags and keywords of eligible titles, df ≥ 20.
  4. Tie-break by distance, then frequency.
- **M05** (12):
  1. The looks-foreign rule.
  2. `_FOREIGN` (list).
  3. `_EN` (list).
  4. Chips: skip phrase chips.
  5. Chips: want and attribute chips are positive.
  6. Chips: avoid and excluded chips are negative, prefix stripped.
  7. No sparse for non-English.
  8. No spell correction.
  9. No reference title.
  10. No coverage.
  11. Avoid chips join the negation penalty.
  12. Detection guard for foreign queries.
- **M06** (7):
  1. `_MARKERS` (list).
  2. A nested marker inside a clause is skipped.
  3. Dangling-conjunction cleanup.
  4. The "more … than" scaffolding is dropped.
  5. An empty positive text falls back to the full text.
  6. A negated clause that shares a word with the positive text is dropped.
  7. The penalty uses the max over clauses.
- **M07** (2): the "less" clause is added to the negated clauses; its weight is max(neg, less_neg).
- **M08** (6):
  1. A decade or year filters the candidates.
  2. Only when ≥ 50 remain.
  3. The recent prior.
  4. The old prior.
  5. A missing year becomes the median.
  6. Precedence: decade, then year, then recent, then old.
- **M09** (6):
  1. Jev phrases with p ≥ min_p, deduplicated.
  2. Facets with negated words are dropped.
  3. At least 2 facets.
  4. One candidate list per facet.
  5. Mean + min combination.
  6. The entity path drops entity words and needs a residual.
- **M10** (11):
  1. Gate: not a reference query, short query.
  2. Units come from the phrases after spell correction.
  3. `_GENERIC` (list).
  4. Stop, negated, reference, one-letter and digit words are dropped.
  5. Collocation merge.
  6. Dedup, including sub-word overlap.
  7. 2 to 4 units.
  8. A concrete word is required.
  9. Unit score: dense + β·BM25 body.
  10. Min over units.
  11. Per-unit candidate lists.
- **M11** (12):
  1. The title index: vote floor, original titles, keys without "the", most votes wins.
  2. The "like" negative context (`_NOT_LIKE`).
  3. "X but Y" without a marker, unless a negation follows "but".
  4. Span rules: ≤ 8 words, ≥ 3 characters, not a stopword.
  5. Without a marker, the title must run up to "but".
  6. The modifier is stripped of leading fillers.
  7. The franchise stem rule.
  8. Exclusion from the mask and the blend.
  9. The dense mix with the reference vector.
  10. The agreement term.
  11. Facets = [reference, modifier].
  12. Facets with reference words are dropped.
- **M12** (8, production parity):
  1. Exact title.
  2. Phrase in title.
  3. All words in title.
  4. Word coverage.
  5. Partial prefix.
  6. The score formula.
  7. Popularity tiebreak.
  8. imdb dedup.
- **M13** (1): the similarity test on the title, the part before ":"/" - ", or the original name.
- **M14** (4):
  1. The bonus needs every concrete word (`kind_all`).
  2. The creator-name query rule.
  3. `names_creator` matching: creators with ≥ 2 titles, ≤ 3 words, a long word.
  4. No bonus on entity queries.
- **M15** (4):
  1. Short-query gate.
  2. An out-of-vocabulary word is required.
  3. Veto when an exact title exists.
  4. Best by score, then votes.
- **M16** (46):
  - Person index:
    1. Name and original name, highest votes_sum.
    2. Surname candidates: ≥ 2 titles, ≥ 4 letters.
    3. The lead-score definition.
    4. Surname prominence and dominance.
    5. Sibling teams.
    6. The prominent list.
    7. `_role`.
  - Credit weights:
    8. Directors: show versus movie, job.
    9. Creators by source.
    10. Writers: department, first two on shows.
    11. Cast billing tiers.
    12. A non-Acting cast credit counts × 0.5.
    13. Mean over entities; any team member counts.
  - Common words and studios:
    14. The common-word guard.
    15. Company position and network weights.
    16. Alias stripping.
    17. Brand prefix.
    18. Weak single-word alias.
    19. An all-common alias only as a full suffixed name.
    20. Minimum group size.
  - Detection:
    21. Hyphen split.
    22. Longest n-gram first.
    23. A single token must not be common.
    24. A weak studio needs a film word next to it.
    25. An all-common full name needs a prominent owner.
    26. The owner needs ≥ 3 titles or popularity ≥ 5.
    27. Mononym rule.
    28. Team rule (brothers/bros/sisters, plural).
    29. Surname with a style suffix.
    30. Suffixed studio means style.
    31. Fuzzy gate.
    32. The unknown-word definition.
    33. Fuzzy full name.
    34. Fuzzy surname.
  - Intent:
    35. Era word.
    36. Style marker, including the "vein" regex.
    37. Film marker.
    38. Residual words.
    39. Intent precedence.
    40. Lean.
  - Word lists and alias prefixes:
    41. `_SUFFIX` (list).
    42. `_STYLE_WORDS` (list).
    43. `_FILM_WORDS` (list).
    44. `_ERA_WORDS` (list).
    45. `_FILLER` (list).
    46. `_NAME_SUFFIX` (list). The studio/the/walt prefixes are part of rule 16.
- **M17** (7):
  1. The residual text: spans and brothers/bros/sisters removed.
  2. An empty residual means centroid-only scoring.
  3. early/late `era_scale`.
  4. The centroid rows, with the fallback.
  5. Dense mix, or the centroid alone.
  6. Extra candidates: centroid top and credited titles.
  7. The filmography boost.
- **M18** (20):
  - M18b:
    1. The main-rows fallback.
    2. Log-votes weights.
  - M18e:
    3. The df ≥ 2 share filter.
    4. The share × IDF weight with ≥ 2 rows.
  - M18f:
    5. Name words (studio name, or full name plus a non-common surname).
    6. log1p z.
  - M18g:
    7. Person peer eligibility.
    8. Studio peer eligibility.
    9. Peers of the same kind.
    10. Exclude self.
    11. Clip at 0, max over peer titles.
  - Other pieces:
    12. M18h: min of three.
    13. M18k: damp non-own titles only.
    14. M18l: own = weight ≥ own_w.
  - M18m:
    15. Move the extras.
    16. Pull into slots, drop the last non-own title.
  - M18n:
    17. Head by filmography score.
    18. Reduced slots for the rest.
  - Last steps:
    19. M18o: re-cap after the blend (style only).
    20. M18p: the candidate pool rule.
- **M19** (7):
  1. Cut suffix with a shared director.
  2. Director possessive prefix.
  3. Part-marker link.
  4. Duplicate records.
  5. Fold keeps the first.
  6. Fold before the slots.
  7. Fold after the blend.

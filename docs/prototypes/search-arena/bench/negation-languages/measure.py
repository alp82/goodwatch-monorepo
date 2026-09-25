"""Non-English negations against the English labels (#169): does a query's label penalty hit the same titles as its
English element?

Usage (from docs/prototypes/search-arena, with .venv/bin/python):
  bench/negation-languages/measure.py bench/negation-languages/queries-tuning.json \
      bench/negation-languages/routing-tuning.json
  bench/negation-languages/measure.py bench/negation-languages/queries-heldout.json \
      bench/negation-languages/routing-heldout.json

queries-*.json: agent-written German, French, Spanish and Turkish negation queries, written without seeing the word
list (queries-tuning.json: two variants of 25 English negation queries per language; queries-heldout.json: 25 other
queries, one per language). routing-*.json: the webapp's language routing (`nonEnglish` in
combined-search/language.server.ts) for each text. A query is routed non-English when that says so or when
`looks_foreign` does, as in the webapp's ranker; English-routed queries are spell-corrected first.

A query matches when the titles its negated clauses hit (label_negation, max over clauses) are exactly the titles
the English element hits (label_negation("aliens") for "sin extraterrestres"). Prints the misses and the matches per
language.
"""
import json, os, sys
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "harness"))
import numpy as np  # noqa: E402
import simp_combo as SC  # noqa: E402

queries = json.load(open(sys.argv[1]))
route = json.load(open(sys.argv[2]))


def hits(text):
    non_en = route.get(text, False) or SC.looks_foreign(text)
    _, negated = SC.split_negation(text if non_en else SC.spell(text))
    rows = set()
    for n in negated:
        rows |= set(np.flatnonzero(SC.label_negation(n, non_en) > 0))
    return negated, rows, non_en


per = defaultdict(lambda: [0, 0])
for q in queries:
    element = q["english_element"]
    if "animals dying" in q["english_query"] and q["id"].endswith("-a"):
        element = "animals dying"   # the tuning set's "a" variants negate dying animals
    want = set(np.flatnonzero(SC.label_negation(element) > 0))
    negated, got, non_en = hits(q["query"])
    per[q["lang"]][0] += 1
    if got == want:
        per[q["lang"]][1] += 1
    else:
        print(q["id"], repr(q["query"]), "non-English" if non_en else "English", negated,
              [SC.english_negation(n, non_en) for n in negated], len(got), "titles, English", repr(element), len(want))
print({lang: f"{m}/{n}" for lang, (n, m) in per.items()}, "total", sum(m for _, m in per.values()), "/", len(queries))

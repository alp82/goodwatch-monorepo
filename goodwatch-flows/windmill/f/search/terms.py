"""Search terms and the BM25F document weights stored in `terms_bm25f_v1`.

Search scores a title's keyword match with BM25F over four body fields: essence tags,
TMDB keywords, TV Tropes names and the essence text. The score splits into a document
side, stored per title as a Qdrant sparse vector, and a query side the webapp computes:

    score(q, d) = sum over the query's distinct terms t of  IDF(t) * w(t, d)
    w(t, d)     = tf~ / (K1 + tf~)
    tf~         = sum over fields f of  W_f * tf_f(t, d) / (1 - B + B * len_f(d) / AVG_LEN_f)
    IDF(t)      = ln(1 + (N - df(t) + 0.5) / (df(t) + 0.5))   over the eligible titles

`w(t, d)` depends only on the title and the constants below, so it can be stored.
The average field lengths are frozen: they were measured over the 50,305 eligible titles
(votes >= 2000) of the catalog snapshot of 2026-09-23, and they drift under 1% in 30 days.
Changing any constant, the tokenizer, the stemmer or the stopwords changes the stored
weights, so it needs a new vector version and a full embedding run.

Terms are stemmed words plus adjacent-word bigrams (`time_loop`). The webapp must
tokenize queries with exactly the same rules.
"""

import re

import numpy as np

_WORD = re.compile(r"[^\W_]+", re.UNICODE)

STOPWORDS = frozenset("""a an the and or of to in on at for with without by from as is are was were be been being it its
this that these those there their them they he she his her him i me my we our you your do does did done not no nor but so
than too very can could would should will just about into over under after before through between during against up down
out off again further then once here where when why how all any both each few more most other some such only own same s t
don now also who whom which what while if because until get got make give want wants like something anything some kind
movie movies film films show shows series watch watching one ones really lot lots bit thing things feel feels""".split())

# Body fields in summation order. The order matters: float32 sums are not associative.
FIELD_WEIGHTS = {"tags": 2.0, "keywords": 2.0, "tropes": 1.0, "essence": 1.0}
FIELDS = tuple(FIELD_WEIGHTS)
K1 = 1.2
B = 0.75
AVG_FIELD_LENGTHS = {
    "tags": np.float32(17.76190948486328),
    "keywords": np.float32(11.27830982208252),
    "tropes": np.float32(158.60101318359375),
    "essence": np.float32(41.319679260253906),
}

_SUFFIXES = (("ies", "y", 5), ("sses", "ss", 5), ("ness", "", 7), ("ings", "", 7), ("ing", "", 6),
             ("edly", "", 7), ("ed", "", 5), ("ly", "", 6), ("es", "e", 5), ("s", "", 4))


def stem(word: str) -> str:
    """Light suffix stemmer: plurals, -ing, -ed, -ly."""
    if len(word) <= 3 or word.isdigit():
        return word
    for suffix, replacement, min_length in _SUFFIXES:
        if word.endswith(suffix) and len(word) >= min_length:
            if suffix == "s" and word.endswith(("ss", "us", "is")):
                return word
            if suffix == "es" and not word.endswith(("ches", "shes", "xes", "sses", "zes")):
                return word[:-1]
            if suffix == "es":
                return word[:-2]
            return word[: -len(suffix)] + replacement
    return word


def tokens(text: str | None) -> list[str]:
    """The stemmed content words of a text, in order, without stopwords."""
    out = []
    for word in _WORD.findall((text or "").lower()):
        if word in STOPWORDS or len(word) < 2:
            continue
        out.append(stem(word))
    return out


def terms(text: str | None) -> list[str]:
    """Unigrams and adjacent bigrams of one text span. A field is a list of spans, so
    bigrams never cross from one tag or keyword to the next."""
    words = tokens(text)
    return words + [f"{a}_{b}" for a, b in zip(words, words[1:])]


def document_weights(fields: dict[str, list[str]]) -> dict[str, float]:
    """w(t, d) for every term of one title, from its body fields as lists of text spans.

    The arithmetic runs in float32 in the same order as the benchmark's batch build
    (docs/prototypes/search-arena/bench/sparse/common.py), so the values are bitwise equal.
    """
    b = np.float32(B)
    tf: dict[str, np.float32] = {}
    for field in FIELDS:
        counts: dict[str, int] = {}
        length = 0
        for span in fields.get(field) or []:
            length += len(tokens(span))
            for term in terms(span):
                counts[term] = counts.get(term, 0) + 1
        if not counts:
            continue
        norm = np.float32(1 - B) + b * np.float32(length) / AVG_FIELD_LENGTHS[field]
        scale = np.float32(np.float32(FIELD_WEIGHTS[field]) / max(norm, np.float32(1e-6)))
        for term, count in counts.items():
            value = scale * np.float32(count)
            tf[term] = tf[term] + value if term in tf else value
    k1 = np.float32(K1)
    return {term: float(value / (k1 + value)) for term, value in tf.items()}


def main() -> None:
    """Shared module; no standalone input."""

"""Builders for the search indexes the webapp loads. Pure functions, no I/O.

`f/search/build_indexes` reads the eligible titles from Qdrant and Crate, the credits and
companies from Crate, and hands them to `build_indexes()` here. The result is a set of
JSON documents (one per index file) plus the reference profiles for Qdrant.

Every rule here is ported from the search ranker that was tuned offline, so the webapp
can rank exactly like it. The formats are documented in
docs/implementation/search-ranking/README.md ("Index files").

Terms: an eligible title has `goodwatch_overall_score_voting_count >= 2000` and isn't
adult. Rows are eligible titles in point id order.
"""

import base64
import math
import re
import unicodedata
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import numpy as np

from f.search import terms as bm25f
from f.search.title_text import TitleInputs, term_fields

ELIGIBLE_VOTES = 2000

# --- credits (people and their titles) ---------------------------------------------------
DIRECTOR_JOBS = ("Director", "Co-Director")
WRITER_JOBS = ("Writer", "Screenplay", "Story", "Novel", "Original Story", "Theatre Play", "Author", "Characters",
               "Idea", "Co-Writer", "Book", "Teleplay", "Short Story", "Comic Book", "Screenstory",
               "Scenario Writer", "Adaptation", "Dialogue", "Original Concept", "Graphic Novel")
CREATOR_JOB = "Creator"
EXECUTIVE_PRODUCER_JOB = "Executive Producer"
# A show without a Creator credit takes people with one of these script credits as creators.
SCRIPT_JOBS = ("Writer", "Teleplay", "Screenplay")
CREW_JOBS = DIRECTOR_JOBS + WRITER_JOBS + (CREATOR_JOB, EXECUTIVE_PRODUCER_JOB)
# Billing positions read from Crate (order_default below these).
CAST_ORDER_LIMIT = {"movie": 15, "show": 40}
CAST_N = 15
MAX_DIRECTORS, MAX_WRITERS, MAX_CREATORS = 5, 8, 4
MAX_FALLBACK_CREATORS = 2
# A person referenced by one eligible title is kept only with this TMDB popularity.
KEEP_POPULARITY = 5.0

MINOR_CREDIT = 0.5        # weight of a credit that isn't a main credit (main credits weigh 1)
LEAD_BILLING = 3          # actors billed at order <= this have a main credit
COMPANY_MAIN = 2          # the first this many listed production companies have a main credit

# --- names ---------------------------------------------------------------------------------
TEAM_OVERLAP = 0.5        # two people with a key form a team when this share of the second's main titles is shared
NAME_VOTES = 150_000      # a key resolves only when its entity's main-title votes >= NAME_VOTES x (1 + word df)
NAME_DOMINANCE = 3.0      # ... and >= NAME_DOMINANCE x the next entity with the key

# --- reference profiles and peers ------------------------------------------------------------
PROFILE_SEEDS = 20        # a profile is built from the entity's top main-credit titles by votes
PROFILE_TERMS = 40
PROFILE_TERMS_MIN_DF = 2
PEER_TITLES = 8           # titles kept per peer
PEER_MIN_VOTES = 200_000
PEER_MIN_TITLES = {"p": 3, "s": 8}

# --- collocations -----------------------------------------------------------------------------
COLLOCATION_RATIO = 0.3   # a bigram is a collocation when its df >= this x the rarer word's df

# --- spell correction -------------------------------------------------------------------------
SPELL_MIN_DF = 20

# Point ids of search_reference_profiles are UUIDv5 of the entity key in this namespace.
PROFILE_NAMESPACE = uuid.UUID("6f1c2d8e-5b0a-4f7e-9a51-3c2e8d4b7a10")

# Boolean payload flags the search filters on, in bit order of the title table's `flags`.
BOOL_FLAGS = (
    "is_anime",
    "suitability_adults", "suitability_date_night", "suitability_family", "suitability_friends",
    "suitability_group_party", "suitability_intergenerational", "suitability_kids", "suitability_partner",
    "suitability_public_viewing_safe", "suitability_solo_watch", "suitability_teens",
    "context_is_background_friendly", "context_is_binge_friendly", "context_is_comfort_watch",
    "context_is_drop_in_friendly", "context_is_pure_escapism", "context_is_thought_provoking",
)

# Intent examples; "X" stands for the names. The webapp picks the intent of the nearest example
# to the query with every name replaced by "X", in multilingual-e5-small.
INTENT_EXAMPLES = {
    "filmography": ["X movies", "X films", "films starring X", "movies directed by X", "X filmography",
                    "X's best films", "X comedies", "X crime thrillers", "X sci-fi movies", "old X films",
                    "X animated films", "X series", "shows created by X", "X's early work", "late X movies",
                    "Filme mit X", "les films de X", "películas de X"],
    "style": ["movies like X", "films similar to X", "in the style of X", "X-ish vibes", "reminds me of X",
              "something with a X aesthetic", "X-esque", "X kind of humor", "X feel", "the X tone", "X mood",
              "as if X made it", "X inspired", "X type of film", "X sort of thing", "un film comme X",
              "im Stil von X", "al estilo de X"],
    "both": ["X and films like theirs", "X plus similar picks", "X's work and others like it"],
}
QUERY_PREFIX = "query: "

# Alternate cuts: a title that ends in one of these suffixes is a cut of the title without it.
_CUT = re.compile(
    r"(?:\s*[:\-–(]\s*|\s+)(?:the\s+)?(?:redux|extended(?:\s+(?:edition|cut|version))?|director'?s\s+cut|final\s+cut|"
    r"special\s+edition|uncut|whole\s+bloody\s+affair|ultimate\s+(?:cut|edition)|unrated(?:\s+(?:cut|edition|version))?|"
    r"theatrical\s+cut|encore\s+cut|re-?edit|recut|[a-z]+\s+[a-z]+'?s\s+cut|remastered|deluxe\s+edition|"
    r"memorial\s+edition)\s*\)?\s*$", re.IGNORECASE)

_WORD = re.compile(r"[^\W_]+", re.UNICODE)


# === text helpers (the webapp implements the same rules) =====================================

def words(s: str | None) -> list[str]:
    """Lowercased runs of letters and digits."""
    return _WORD.findall((s or "").lower())


def normalized(s: str | None) -> str:
    return " ".join(words(s))


def fold(s: str | None) -> str:
    """Name keys: lowercase, strip diacritics, drop a possessive 's, & -> and, + -> space."""
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"['’`]s\b", "", s)
    s = s.replace("&", " and ").replace("+", " ")
    return " ".join(_WORD.findall(s))


# === inputs ====================================================================================

@dataclass
class Title:
    """One eligible title, combined from its Qdrant payload and Crate row."""
    point_id: int
    media_type: str                 # "movie" or "show"
    tmdb_id: int
    title: str                      # the title, else the original title, else ""
    original_title: str             # "" when unknown
    year: int                       # 0 when unknown
    votes: int
    goodwatch_score: float | None
    popularity: float
    imdb_id: str | None
    flags: dict = field(default_factory=dict)
    production_method: str | None = None
    essence_text: str = ""
    essence_tags: list = field(default_factory=list)
    keywords: list = field(default_factory=list)
    tropes: list = field(default_factory=list)

    def term_fields(self) -> dict[str, list[str]]:
        """The BM25F body fields, built exactly as the embed-titles flow builds them."""
        return term_fields(TitleInputs(title=self.title, original_title=self.original_title or None,
                                       year=self.year or None, essence_text=self.essence_text or None,
                                       essence_tags=self.essence_tags, keywords=self.keywords, tropes=self.tropes))


@dataclass
class Person:
    name: str | None
    original_name: str | None
    department: str | None          # TMDB known_for_department
    popularity: float | None


@dataclass
class Sources:
    """Everything the builders read. `titles` are the eligible titles in point id order, and
    the vector arrays are aligned with them."""
    titles: list[Title]
    fingerprints: np.ndarray        # (n, 74) float32, fingerprint_v1 (L2-normalized)
    text_en: np.ndarray             # (n, 768) float32, text_en_v1
    text_multi: np.ndarray          # (n, 384) float32, text_multi_v1
    crew: list                      # (media_type, tmdb_id, person_id, job, episode_count or None)
    cast: list                      # (media_type, tmdb_id, person_id, order_default, episode_count or None)
    people: dict                    # person_id -> Person
    media_companies: dict           # (media_type, tmdb_id) -> (production_company_ids, network_ids)
    company_names: dict             # company id -> name
    network_names: dict             # network id -> name
    term_ids: dict                  # term -> id in search_terms


# === credits ===================================================================================

@dataclass
class TitleCredits:
    directors: list                 # [(person_id, job)]
    writers: list                   # [person_id]
    creators: list                  # [person_id]
    creator_source: str | None      # "creator", "fallback_writer" or None
    cast: list                      # [(person_id, order)]


def title_credits(src: Sources) -> list[TitleCredits]:
    """Directors, writers, creators and top-billed cast per title.

    - Directors: Director before Co-Director, then most episodes (shows), at most 5.
    - Writers: the writing jobs, one entry per person, most episodes first, at most 8.
    - Creators: the Creator credits. A show without one takes people with a script credit
      (Writer, Teleplay, Screenplay), those who are also Executive Producer first, then by
      episodes, at most 2. Pure producers never become creators.
    - Cast: the top 15 by billing order.
    """
    crew = defaultdict(list)
    for mt, m, p, job, ep in src.crew:
        crew[(mt, m)].append((p, job, ep or 0))
    cast = defaultdict(list)
    for mt, m, p, order, _ep in src.cast:
        if order is not None and order < CAST_ORDER_LIMIT[mt]:
            cast[(mt, m)].append((order, p))
    out = []
    for t in src.titles:
        key = (t.media_type, t.tmdb_id)
        show = t.media_type == "show"
        cr = crew.get(key, [])
        directors, seen = [], set()
        for p, job, _ep in sorted((x for x in cr if x[1] in DIRECTOR_JOBS), key=lambda x: (x[1] != "Director", -x[2], x[0])):
            if p not in seen:
                seen.add(p)
                directors.append((p, job))
        writer_jobs, writer_episodes = defaultdict(list), Counter()
        for p, job, ep in cr:
            if job in WRITER_JOBS:
                writer_jobs[p].append(job)
                writer_episodes[p] = max(writer_episodes[p], ep)
        writers = sorted(writer_jobs, key=lambda p: (-writer_episodes[p], min(WRITER_JOBS.index(j) for j in writer_jobs[p]),
                                                     p))[:MAX_WRITERS]
        creators = sorted({p for p, job, _ in cr if job == CREATOR_JOB})
        source = "creator" if creators else None
        if not creators and show:
            best, jobs = Counter(), defaultdict(set)
            for p, job, ep in cr:
                if job == EXECUTIVE_PRODUCER_JOB or job in SCRIPT_JOBS:
                    best[p] = max(best[p], ep)
                    jobs[p].add("producer" if job == EXECUTIVE_PRODUCER_JOB else "script")
            creators = sorted((p for p in best if "script" in jobs[p]),
                              key=lambda p: (-len(jobs[p]), -best[p], p))[:MAX_FALLBACK_CREATORS]
            source = "fallback_writer" if creators else None
        billed, seen = [], set()
        for order, p in sorted(cast.get(key, [])):
            if p not in seen:
                seen.add(p)
                billed.append((p, order))
        out.append(TitleCredits(directors[:MAX_DIRECTORS], writers, creators[:MAX_CREATORS], source, billed[:CAST_N]))
    return out


def person_credits(src: Sources, tc: list[TitleCredits]) -> dict[int, dict[int, tuple[float, str]]]:
    """person id -> {row: (credit weight, role)}. Two classes: a main credit weighs 1, any other
    MINOR_CREDIT (a film's co-director has the role "co-director").

    Main: a film's director or Writing-department writer, a show's first-listed director or
    writer, a creator, and the actors billed at order <= LEAD_BILLING ("department" is the
    person's known_for_department). The highest weight wins; on a tie the first role."""
    per = defaultdict(dict)

    def put(pid, r, main, role):
        w = 1.0 if main else MINOR_CREDIT
        cur = per[pid].get(r)
        if cur is None or w > cur[0]:
            per[pid][r] = (w, role)

    def department(pid):
        p = src.people.get(pid)
        return p.department if p else None

    for r, (t, c) in enumerate(zip(src.titles, tc)):
        show = t.media_type == "show"
        for i, (p, job) in enumerate(c.directors):
            put(p, r, i == 0 if show else job == "Director", "director" if show or job == "Director" else "co-director")
        for p in c.creators:
            put(p, r, True, "creator")
        for i, p in enumerate(c.writers):
            put(p, r, department(p) == "Writing" and (i == 0 or not show), "writer")
        for p, order in c.cast:
            put(p, r, (order or 0) <= LEAD_BILLING and department(p) in (None, "Acting"), "cast")
    return per


def kept_persons(src: Sources, tc: list[TitleCredits]) -> dict[int, Person]:
    """The people the name index knows: named, with two or more eligible titles in any role, or
    one title and TMDB popularity >= KEEP_POPULARITY. First-seen order."""
    titles = Counter()
    order = {}
    for c in tc:
        roles = dict.fromkeys([p for p, _ in c.cast] + [p for p, _ in c.directors] + c.writers + c.creators)
        for p in roles:
            order.setdefault(p, len(order))
            titles[p] += 1
    out = {}
    for p in sorted(order, key=order.get):
        person = src.people.get(p)
        if not person or not person.name:
            continue
        if titles[p] >= 2 or (person.popularity or 0) >= KEEP_POPULARITY:
            original = person.original_name if person.original_name and person.original_name != person.name else None
            out[p] = Person(person.name, original, person.department, person.popularity)
    return out


def studios(src: Sources) -> dict[tuple[str, int], tuple[str | None, dict[int, float]]]:
    """(kind, id) -> (name, {row: weight}): production companies ("c", the first COMPANY_MAIN
    listed are main credits) and networks ("n", always main). First-seen order."""
    names, rows = {}, defaultdict(dict)
    for r, t in enumerate(src.titles):
        companies, networks = src.media_companies.get((t.media_type, t.tmdb_id), (None, None))
        for i, c in enumerate(companies or []):
            key = ("c", c)
            names[key] = src.company_names.get(c)
            w = 1.0 if i < COMPANY_MAIN else MINOR_CREDIT
            rows[key][r] = max(rows[key].get(r, 0), w)
        if t.media_type == "show":
            for c in networks or []:
                key = ("n", c)
                names[key] = src.network_names.get(c)
                rows[key][r] = 1.0
    return {k: (names[k], dict(rows[k])) for k in names}


def studio_member(key: tuple[str, int]) -> str:
    return f"{key[0]}:{key[1]}"


# === words and terms ============================================================================

def word_frequencies(titles: list[Title]) -> Counter:
    """Word -> document frequency over titles, original titles, essence texts, tags and keywords."""
    cnt = Counter()
    for t in titles:
        ws = set()
        for s in (t.title, t.original_title, t.essence_text, " ".join(t.essence_tags), " ".join(t.keywords)):
            ws.update(words(s))
        cnt.update(ws)
    return cnt


def title_terms(t: Title) -> set[str]:
    """The body terms of a title: exactly the terms of its terms_bm25f_v1 vector."""
    out = set()
    for spans in t.term_fields().values():
        for span in spans:
            out.update(bm25f.terms(span))
    return out


def idf(df: np.ndarray, n: int) -> np.ndarray:
    """BM25 IDF over the eligible titles: ln(1 + (N - df + 0.5) / (df + 0.5))."""
    df = np.asarray(df, np.float64)
    return np.log(1 + (n - df + 0.5) / (df + 0.5))


@dataclass
class TermIndex:
    terms: list[str]                # body terms of the eligible titles that have an id
    ids: np.ndarray                 # their search_terms ids
    df: np.ndarray                  # their document frequency
    idf: np.ndarray                 # float64
    n: int                          # eligible titles
    rows: list[np.ndarray]          # per title: indexes into `terms`, sorted
    missing: int                    # terms without an id yet (their titles aren't embedded yet)


def term_index(titles: list[Title], term_ids: dict[str, int]) -> TermIndex:
    seen: dict[str, int] = {}
    per_title = []
    for t in titles:
        per_title.append(np.array([seen.setdefault(x, len(seen)) for x in title_terms(t)], np.int64))
    counts = np.bincount(np.concatenate(per_title), minlength=len(seen)) if seen else np.zeros(0, np.int64)
    missing = sum(1 for t in seen if t not in term_ids)
    terms = sorted(t for t in seen if t in term_ids)
    # position in `terms` of each first-seen index, -1 without an id
    pos = np.full(len(seen), -1, np.int64)
    for i, t in enumerate(terms):
        pos[seen[t]] = i
    rows = []
    for a in per_title:
        p = pos[a]
        rows.append(np.sort(p[p >= 0]))
    dfa = np.array([counts[seen[t]] for t in terms], np.int64)
    return TermIndex(terms, np.array([term_ids[t] for t in terms], np.int64), dfa, idf(dfa, len(titles)),
                     len(titles), rows, missing)


def collocation_people(src: Sources) -> list[tuple[list[str], list[str]]]:
    """Per title, the (creators, cast) names of the lexical index the collocation test was tuned
    on: a film's first 3 Director credits, a show's Creator credits (else its top 2 Executive
    Producers or Writers by episodes), and the top 5 billed actors."""
    crew = defaultdict(list)
    for mt, m, p, job, ep in src.crew:
        if (mt == "movie" and job == "Director") or (mt == "show" and job in (CREATOR_JOB, EXECUTIVE_PRODUCER_JOB, "Writer")):
            crew[(mt, m)].append(((0 if job in (CREATOR_JOB, "Director") else 1, -(ep or 0)), p))
    cast = defaultdict(list)
    for mt, m, p, order, _ep in src.cast:
        if order is not None and order < (5 if mt == "movie" else 12):
            cast[(mt, m)].append((order, p))

    def name(p):
        person = src.people.get(p)
        return person.name if person and person.name else None

    out = []
    for t in src.titles:
        key = (t.media_type, t.tmdb_id)
        cr = sorted(set(crew.get(key, [])))
        cp = [p for k, p in cr if k[0] == 0][:3]
        if not cp and t.media_type == "show":
            seen = []
            for _, p in cr:
                if p not in seen:
                    seen.append(p)
            cp = seen[:2]
        billed = []
        for _, p in sorted(set(cast.get(key, []))):
            if p not in billed and p not in cp:
                billed.append(p)
        out.append(([n for n in map(name, cp) if n], [n for n in map(name, billed[:5]) if n]))
    return out


def collocations(titles: list[Title], people: list[tuple[list[str], list[str]]]) -> list[str]:
    """Bigram terms whose document frequency is >= COLLOCATION_RATIO x the rarer word's, over
    the title, the body fields, and the creator and cast names. Sorted."""
    df = Counter()
    for t, (creators, cast) in zip(titles, people):
        spans = [t.title] + ([t.original_title] if t.original_title and t.original_title != t.title else [])
        spans += list(t.essence_tags) + list(t.keywords) + list(t.tropes) + [t.essence_text] + creators + cast
        ts = set()
        for s in spans:
            ts.update(bm25f.terms(s))
        df.update(ts)
    out = []
    for term, n in df.items():
        if "_" not in term:
            continue
        a, b = term.split("_", 1)
        if a in df and b in df and n / max(1, min(df[a], df[b])) >= COLLOCATION_RATIO:
            out.append(term)
    return sorted(out)


# === name index ================================================================================

@dataclass
class Candidate:
    kind: str                       # "person", "team" or "studio"
    name: str
    members: tuple                  # person ids, or studio keys
    mass: float                     # votes of the main-credit titles


def entity_key(c: Candidate) -> str:
    if c.kind == "studio":
        return "studio:" + ",".join(studio_member(k) for k in sorted(c.members))
    return f"{c.kind}:" + ",".join(str(p) for p in sorted(c.members))


def name_index(votes: np.ndarray, persons: dict[int, Person], credits: dict, st: dict) -> dict[str, list[Candidate]]:
    """key -> [Candidate], heaviest first. Keys: a person's folded name and original name and the
    last word of each; a studio's folded name and its first word, all studios with the key merged
    into one brand. The two heaviest people of a key who share most main credits merge into a team."""
    votes = votes.astype(np.float64)

    def mass(rw):
        return float(sum(votes[r] for r, w in rw.items() if w >= 1))

    idx = defaultdict(list)
    for pid, v in persons.items():
        c = Candidate("person", v.name, (pid,), mass({r: w for r, (w, _) in credits.get(pid, {}).items()}))
        keys = set()
        for n in (v.name, v.original_name or ""):
            if fold(n):
                keys |= {fold(n), fold(n).split()[-1]}
        for k in sorted(keys):
            idx[k].append(c)
    brand = defaultdict(set)
    for key, (n, _) in st.items():
        ws = fold(n).split()
        for a in ({" ".join(ws), ws[0]} if ws else ()):
            brand[a].add(key)
    for a, keys in brand.items():
        rw = {}
        for k in keys:
            for r, w in st[k][1].items():
                rw[r] = max(rw.get(r, 0), w)
        # the brand's name: the studio with the most titles (then the lowest key)
        name = st[min(keys, key=lambda k: (-len(st[k][1]), k))][0]
        idx[a].append(Candidate("studio", name, tuple(sorted(keys)), mass(rw)))
    for k, cs in idx.items():
        cs.sort(key=lambda c: -c.mass)
        if len(cs) > 1 and cs[0].kind == cs[1].kind == "person":
            main = [{r for r, (w, _) in credits.get(c.members[0], {}).items() if w >= 1} for c in cs[:2]]
            if main[1] and len(main[0] & main[1]) >= TEAM_OVERLAP * len(main[1]):
                team = Candidate("team", f"{cs[0].name} & {cs[1].name}", cs[0].members + cs[1].members,
                                 cs[0].mass + cs[1].mass)
                idx[k] = [team] + cs[2:]
    return dict(idx)


def resolves(cs: list[Candidate], word_df: int) -> bool:
    """The heaviest candidate outweighs the next one NAME_DOMINANCE times and the key's reading
    as an ordinary word."""
    second = cs[1].mass if len(cs) > 1 else 0.0
    return cs[0].mass >= NAME_DOMINANCE * second and cs[0].mass >= NAME_VOTES * (1 + word_df)


def resolved_keys(idx: dict[str, list[Candidate]], word_df: Counter) -> dict[str, Candidate]:
    """key -> the entity it names, for every key that resolves. A multi-word key never occurs
    as a word, so its word df is 0; those keys are also the typo-matching targets."""
    return {k: cs[0] for k, cs in idx.items() if resolves(cs, word_df.get(k, 0))}


# === entities and profiles =======================================================================

@dataclass
class Entity:
    key: str
    point_id: str                   # search_reference_profiles point id
    candidate: Candidate
    titles: dict[int, float]        # row -> weight (the max over members)
    codirected: set[int]            # rows a person member co-directed (a minor credit)
    mention: list[str]              # folded names searched in other titles' texts
    seeds: list[int] = field(default_factory=list)


def entity_titles(c: Candidate, credits: dict, st: dict) -> tuple[dict[int, float], set[int]]:
    w, co = {}, set()
    for m in c.members:
        rw = st[m][1] if c.kind == "studio" else {r: x for r, (x, _) in credits.get(m, {}).items()}
        for r, x in rw.items():
            w[r] = max(w.get(r, 0), x)
        if c.kind != "studio":
            co |= {r for r, (_, role) in credits.get(m, {}).items() if role == "co-director"}
    return w, co


def mention_names(c: Candidate, persons: dict[int, Person], resolved: dict[str, Candidate]) -> list[str]:
    """A studio's folded name; each person's folded full name, plus the last name when that
    key resolves to an entity that includes the person."""
    if c.kind == "studio":
        return [fold(c.name)]
    names = []
    for pid in c.members:
        full = fold(persons[pid].name)
        names.append(full)
        if " " in full:
            other = resolved.get(full.split()[-1])
            if other is not None and other.kind != "studio" and pid in other.members:
                names.append(full.split()[-1])
    return names


def seed_rows(weights: dict[int, float], votes: np.ndarray, point_ids: np.ndarray, k: int = PROFILE_SEEDS) -> list[int]:
    """The top k titles by votes among the main credits (all credits when there are none).
    Ties: lower point id first."""
    rows = [r for r, w in weights.items() if w >= 1] or list(weights)
    rows.sort(key=lambda r: (-votes[r], point_ids[r]))
    return rows[:k]


def centroid(m: np.ndarray, rows: list[int], votes: np.ndarray) -> np.ndarray:
    """L2-normalized centroid of m's rows, weighted by log(1 + votes)."""
    rows = np.asarray(rows, np.int64)
    w = np.log1p(votes[rows]).astype(np.float64)
    c = (m[rows] * (w / (w.sum() or 1))[:, None]).sum(0)
    return (c / (np.linalg.norm(c) or 1)).astype(np.float32)


def profile_terms(seeds: list[int], ti: TermIndex) -> list[tuple[str, float]]:
    """Terms that at least min(PROFILE_TERMS_MIN_DF, seeds) seeds share, weighted by the share of
    seeds times IDF; the top PROFILE_TERMS sorted by (-weight, term)."""
    if not seeds:
        return []
    dfo = np.zeros(len(ti.terms), np.int64)
    for r in seeds:
        dfo[ti.rows[r]] += 1
    w = dfo / len(seeds) * ti.idf
    w[dfo < min(PROFILE_TERMS_MIN_DF, len(seeds))] = 0
    nz = np.flatnonzero(w > 0)
    cols = sorted(nz, key=lambda j: (-w[j], ti.terms[j]))[:PROFILE_TERMS]
    return [(ti.terms[j], float(w[j])) for j in cols]


def entities(resolved: dict[str, Candidate], credits: dict, st: dict, persons: dict[int, Person],
             votes: np.ndarray, point_ids: np.ndarray) -> dict[str, Entity]:
    out = {}
    for c in resolved.values():
        key = entity_key(c)
        if key in out:
            continue
        titles, co = entity_titles(c, credits, st)
        e = Entity(key, str(uuid.uuid5(PROFILE_NAMESPACE, key)), c, titles, co, mention_names(c, persons, resolved))
        e.seeds = seed_rows(titles, votes, point_ids)
        out[key] = e
    return out


# === peers ======================================================================================

def peers(credits: dict, st: dict, fp: np.ndarray, votes: np.ndarray, point_ids: np.ndarray) -> list[tuple[str, np.ndarray, list[int]]]:
    """Directors and creators with >= 3 main director / creator titles, and studios with >= 8
    main titles, each with >= 200k votes over them: (member id, fingerprint centroid, top
    PEER_TITLES rows by votes)."""
    groups = [(f"p:{pid}", [r for r, (w, role) in d.items() if w >= 1 and role in ("director", "creator")], "p")
              for pid, d in credits.items()]
    groups += [(studio_member(key), [r for r, w in rw.items() if w >= 1], "s") for key, (_, rw) in st.items()]
    out = []
    for member, rows, kind in groups:
        if len(rows) < PEER_MIN_TITLES[kind] or votes[rows].sum() < PEER_MIN_VOTES:
            continue
        top = sorted(rows, key=lambda r: (-votes[r], point_ids[r]))[:PEER_TITLES]
        out.append((member, centroid(fp, rows, votes), top))
    return out


# === negation labels, cuts =========================================================================

def negation_labels(titles: list[Title]) -> list[tuple[str, list[str], list[int]]]:
    """Keyword and essence-tag labels (lowercased): (label, its content stems, rows). A negated
    phrase hits a label when the label holds every stem of the phrase."""
    labels = defaultdict(set)
    for r, t in enumerate(titles):
        for x in list(t.keywords) + list(t.essence_tags):
            labels[x.lower()].add(r)
    out = []
    for label in sorted(labels):
        stems = sorted(set(bm25f.tokens(label)))
        if stems:
            out.append((label, stems, sorted(labels[label])))
    return out


def cut_edges(titles: list[Title], directors: list[set[int]]) -> list[tuple[int, int]]:
    """Pairs of rows that are alternate cuts of one film. Titles are grouped by their normalized
    title without a cut suffix; two titles of a group are cuts when they share a director or
    exactly one has director credits, and either carries a cut suffix or their years differ by at
    most 1 (duplicate records of one release)."""
    groups = defaultdict(list)
    for r, t in enumerate(titles):
        m = _CUT.search(t.title or "")
        cut = bool(m and m.start())
        groups[normalized(t.title[: m.start()] if cut else t.title)].append((r, t.year, cut))
    out = set()
    for ps in groups.values():
        for i, (p, yp, cp) in enumerate(ps):
            for q, yq, cq in ps[i + 1:]:
                a, b = directors[p], directors[q]
                if (a & b or bool(a) != bool(b)) and (cp or cq or (yp and yq and abs(yp - yq) <= 1)):
                    out.add((min(p, q), max(p, q)))
    return sorted(out)


# === encoding helpers ================================================================================

def f32(a: np.ndarray) -> dict:
    """A float32 array as {"shape", "float32": base64 of little-endian bytes}."""
    a = np.ascontiguousarray(a, dtype="<f4")
    return {"shape": list(a.shape), "float32": base64.b64encode(a.tobytes()).decode()}


def i8(a: np.ndarray) -> dict:
    a = np.ascontiguousarray(a, dtype=np.int8)
    return {"shape": list(a.shape), "int8": base64.b64encode(a.tobytes()).decode()}


def quantized(m: np.ndarray) -> dict:
    """Symmetric int8 per column: value = int8 * scale[column]."""
    scale = np.abs(m).max(0).astype(np.float64) / 127
    scale[scale == 0] = 1
    q = np.clip(np.round(m / scale), -127, 127).astype(np.int8)
    return {"scale": f32(scale.astype(np.float32)), "values": i8(q)}


def num(x) -> float | None:
    if x is None:
        return None
    x = float(x)
    return None if math.isnan(x) else x


# === the build ===================================================================================

@dataclass
class Build:
    files: dict[str, dict]          # index file name -> JSON document
    profiles: list[dict]            # search_reference_profiles points: {id, fingerprint, text_en, payload}
    stats: dict


def build_indexes(src: Sources, encode_intents=None) -> Build:
    """All index files and reference profiles. `encode_intents(texts) -> (n, 384) float32`
    encodes the intent examples in multilingual-e5-small (None leaves the vectors out)."""
    titles = src.titles
    point_ids = np.array([t.point_id for t in titles], np.int64)
    votes = np.array([t.votes for t in titles], np.int64)
    stats = {"titles": len(titles)}

    tc = title_credits(src)
    credits = person_credits(src, tc)
    persons = kept_persons(src, tc)
    st = studios(src)
    wf = word_frequencies(titles)
    idx = name_index(votes, persons, credits, st)
    resolved = resolved_keys(idx, wf)
    ents = entities(resolved, credits, st, persons, votes, point_ids)
    ti = term_index(titles, src.term_ids)
    stats |= {"persons": len(persons), "studios": len(st), "name_keys": len(idx), "resolved_keys": len(resolved),
              "entities": len(ents), "terms": len(ti.terms), "terms_without_id": ti.missing,
              "shows_with_fallback_creators": sum(c.creator_source == "fallback_writer" for c in tc)}

    files = {}
    files["title_table"] = {
        "point_ids": point_ids.tolist(),
        "titles": [t.title for t in titles],
        "original_titles": [t.original_title for t in titles],
        "years": [t.year for t in titles],
        "votes": votes.tolist(),
        "goodwatch_scores": [num(t.goodwatch_score) for t in titles],
        "popularity": [num(t.popularity) or 0.0 for t in titles],
        "imdb_ids": [t.imdb_id for t in titles],
        "flag_names": list(BOOL_FLAGS),
        "flags": [sum(1 << i for i, f in enumerate(BOOL_FLAGS) if t.flags.get(f)) for t in titles],
        "production_methods": [t.production_method for t in titles],
    }
    files["term_statistics"] = {
        "n": ti.n,
        "terms": ti.terms,
        "ids": ti.ids.tolist(),
        "df": ti.df.tolist(),
    }
    spell = sorted(w for w, c in wf.items() if c >= SPELL_MIN_DF and w.isalpha())
    wlist = sorted(wf)
    files["word_frequencies"] = {
        "words": wlist,
        "df": [wf[w] for w in wlist],
        "spell_vocabulary": spell,
    }
    files["collocations"] = {"bigrams": collocations(titles, collocation_people(src))}

    ent_list = sorted(ents.values(), key=lambda e: e.key)
    ent_pos = {e.key: i for i, e in enumerate(ent_list)}
    keys = sorted(resolved)
    files["name_index"] = {
        "keys": keys,
        "entity": [ent_pos[entity_key(resolved[k])] for k in keys],
        "entities": [
            {
                "id": e.point_id,
                "kind": e.candidate.kind,
                "name": e.candidate.name,
                "members": [studio_member(m) if e.candidate.kind == "studio" else f"p:{m}" for m in e.candidate.members],
                "mass": e.candidate.mass,
                "titles": [[int(point_ids[r]), w] for r, w in sorted(e.titles.items(), key=lambda x: point_ids[x[0]])],
                "codirected": sorted(int(point_ids[r]) for r in e.codirected),
                "mention": e.mention,
            }
            for e in ent_list
        ],
    }
    pe = peers(credits, st, src.fingerprints, votes, point_ids)
    files["peers"] = {
        "members": [m for m, _, _ in pe],
        "fingerprints": f32(np.stack([c for _, c, _ in pe]) if pe else np.zeros((0, 74), np.float32)),
        "titles": [[int(point_ids[r]) for r in rows] for _, _, rows in pe],
    }
    labels = negation_labels(titles)
    files["negation_labels"] = {
        "labels": [x[0] for x in labels],
        "stems": [x[1] for x in labels],
        "titles": [[int(point_ids[r]) for r in x[2]] for x in labels],
    }
    directors = [{p for p, _ in c.directors} for c in tc]
    files["alternate_cuts"] = {
        "pairs": [[int(point_ids[a]), int(point_ids[b])] for a, b in cut_edges(titles, directors)],
    }
    texts = [t for ex in INTENT_EXAMPLES.values() for t in ex]
    intents = {
        "labels": [c for c, ex in INTENT_EXAMPLES.items() for _ in ex],
        "texts": texts,
        "model": "intfloat/multilingual-e5-small",
        "prefix": QUERY_PREFIX,
    }
    if encode_intents is not None:
        intents["vectors"] = f32(encode_intents([QUERY_PREFIX + t for t in texts]))
    files["intent_examples"] = intents
    files["mix_vectors"] = {
        "point_ids": point_ids.tolist(),
        "text_multi_v1": quantized(src.text_multi),
        "text_en_v1": quantized(src.text_en),
    }

    profiles = []
    for e in ent_list:
        if not e.seeds:
            continue
        profiles.append({
            "id": e.point_id,
            "fingerprint_v1": centroid(src.fingerprints, e.seeds, votes),
            "text_en_v1": centroid(src.text_en, e.seeds, votes),
            "payload": {"kind": e.candidate.kind, "name": e.candidate.name,
                        "terms": [{"term": t, "weight": w} for t, w in profile_terms(e.seeds, ti)]},
        })
    stats |= {"profiles": len(profiles), "peers": len(pe), "negation_labels": len(labels),
              "alternate_cut_pairs": len(files["alternate_cuts"]["pairs"]), "collocations": len(files["collocations"]["bigrams"]),
              "words": len(wlist), "spell_vocabulary": len(spell)}
    return Build(files, profiles, stats)


def main() -> None:
    """Shared module; no standalone input."""

"""Round 5: local person and studio detection plus the intent of the query (filmography, style or both).

`detect(query)` -> Detection or None. Pure dictionary lookups over query n-grams (<= 4 words), plus a rapidfuzz
fallback only for n-grams with a word outside the catalog vocabulary.

Person index (data/persons.json.gz, data/credits.jsonl.gz):
- full names and original names of every kept person (titles >= 2); a shared full name goes to the person with the
  highest votes_sum,
- surnames of prominent people (titles >= 3 and lead score >= SURNAME_VOTES; lead score = votes over main-role
  titles, director / creator credits 2x) when that person dominates everyone else with the surname (lead score >=
  SURNAME_DOMINANCE x the next one), e.g. "tarantino", "nolan", "spielberg",
- "<surname> brothers|sisters|bros" and plural surnames ("wachowskis") -> every prominent person with the surname
  who shares titles with the top one (Joel and Ethan Coen),
- common-word guard: a single word (mononym, surname, alias) that is a frequent lowercase word in the essence texts
  (e.g. "hill", "stone", "king") or a frequent title word needs a full-name match,
- style suffixes: "-esque", "-like", "-ian" ("lynchian", "miyazaki-like").
Fuzzy: an n-gram of 2-3 words containing a word outside the catalog vocabulary is matched against the full names
of prominent people (rapidfuzz ratio >= 90); a single unknown word of 7+ letters against dominant surnames
(edit distance 1).

Studio index (data/companies.jsonl.gz): production companies and networks, grouped by alias. The alias is the
normalized name, and the name without company suffixes ("Pictures", "Studios", "Productions", ...) or a leading
"studio" ("Studio Ghibli" -> "ghibli"), or a leading "walt". A name starting with an existing alias joins that
group ("HBO Max" -> "hbo"). A group needs >= STUDIO_MIN_TITLES eligible titles. An alias made only of common words is
kept only as the full original name when it ends in a company suffix.

Intent:
- style: a style marker ("vibes", "style", "atmosphere", "humor", "like X", "-esque", "-like", "-ian", "feel", ...),
- filmography: a filmography marker ("movies", "films", "starring", "with", "by", "Filme mit", "early", ...) or
  other content words in the query (the residual), and every studio query without a style marker,
- both: a bare person name. `lean` is "style" for directors / writers / creators, "filmography" for actors.
"""
import gzip, json, os, re, time, unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field

import numpy as np

import catalog as C
import sparse as S
from rankers3 import looks_foreign, word_freq

SURNAME_VOTES = 500_000     # lead score: votes over main-role titles, director / creator credits 2x
SURNAME_DOMINANCE = 3.0
STUDIO_MIN_TITLES = 8
COMMON_LOWER_DF = 20      # essence texts where the word appears in lowercase
COMMON_TITLE_DF = 15      # eligible titles containing the word
COMMON_ANY_DF = 250       # essence texts with the word in any case ("British", "Christmas")
RARE_LOWER_DF = 2         # a single-word studio alias cut from a longer name must (almost) never be a lowercase word
FUZZY_NAME_CUTOFF = 90
FUZZY_MAX_WORDS = 5        # typo matching only for short queries

_SUFFIX = set("pictures picture productions production studios studio films film entertainment animation company "
              "inc ltd llc co corporation corp media releasing international features television tv group "
              "distribution enterprises cinema".split())
_STYLE_WORDS = set("vibe vibes vibey style styled stylish esque like feel feels feeling atmosphere atmospheric "
                   "aesthetic aesthetics humor humour tone mood energy similar inspired vein sensibility touch "
                   "flavor flavour spirit type sort kind way approach à la".split())
_FILM_WORDS = set("movie movies film films filme filmen show shows series tv starring stars star with featuring feat "
                  "by directed director written produced voiced mit von avec de del con filmography early late later "
                  "recent old classic best top every all complete career works work".split())
_ERA_WORDS = {"early": "early", "late": "late", "later": "late", "recent": "late", "new": "late", "newer": "late",
              "old": "early", "older": "early", "classic": "early", "frühe": "early", "frühen": "early"}
_FILLER = set("a an the and or und et y of in on for to me some any good great best top all every movie movies film "
              "films filme filmen show shows series tv starring stars star with featuring feat by directed "
              "director written produced voiced mit von avec de del con from filmography works work career "
              "early late later recent old older classic newer new frühe frühen s give want watch something "
              "anything".split())

_state = {}


def fold(s):
    """Lowercase, strip diacritics, keep letters / digits, collapse spaces."""
    s = unicodedata.normalize("NFKD", (s or "").lower())
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"['’`]s\b", "", s)            # possessive
    s = s.replace("&", " and ").replace("+", " ")
    return " ".join(re.findall(r"[^\W_]+", s))


_NAME_SUFFIX = {"jr", "sr", "ii", "iii", "iv"}


def surname(name):
    t = [w for w in fold(name).split() if w not in _NAME_SUFFIX]
    return t[-1] if len(t) >= 2 else None


# --- common words -------------------------------------------------------------------------------

def _common():
    if "common" not in _state:
        cat = C.load()
        low, anycase, tit = Counter(), Counter(), Counter()
        for r in np.flatnonzero(cat.eligible()):
            ws = set(re.findall(r"[^\W\d_]+", cat.essence_text[r]))
            low.update({w for w in ws if w.islower()})
            anycase.update({w.lower() for w in ws})
            tit.update(set(fold(cat.title[r]).split()))
        common = {w for w, n in low.items() if n >= COMMON_LOWER_DF} | {w for w, n in anycase.items() if n >= COMMON_ANY_DF}
        _state["common_word"] = common | S.STOP | _FILLER | _STYLE_WORDS   # studios: "Marvel" may be a title word
        _state["common"] = _state["common_word"] | {w for w, n in tit.items() if n >= COMMON_TITLE_DF}
        _state["low"] = low
    return _state["common"]


def is_common(word, titles=True):
    _common()
    return word in _state["common" if titles else "common_word"] or len(word) < 3


# --- person index -------------------------------------------------------------------------------

def _persons():
    if "persons" not in _state:
        p = json.load(gzip.open(os.path.join(C.DATA, "persons.json.gz"), "rt", encoding="utf-8"))
        _state["persons"] = {int(k): v for k, v in p.items()}
    return _state["persons"]


def credits():
    """person id -> {row: (weight, role)} and row -> ... ; company key -> {row: weight}. Cached."""
    if "credits" in _state:
        return _state["credits"]
    cat = C.load()
    per = defaultdict(dict)

    def put(pid, r, w, role):
        cur = per[pid].get(r)
        if cur is None or w > cur[0]:
            per[pid][r] = (w, role)

    with gzip.open(os.path.join(C.DATA, "credits.jsonl.gz"), "rt", encoding="utf-8") as f:
        for line in f:
            t = json.loads(line)
            r = cat.row_of.get(t["id"])
            if r is None:
                continue
            show = t["media_type"] == "show"
            for i, d in enumerate(t["directors"]):
                # shows list episode directors by episode count: only the top one is a main credit
                w = (0.9 if i == 0 else 0.5) if show else (1.0 if d.get("job") == "Director" else 0.8)
                put(d["id"], r, w, "director")
            for d in t["creators"]:
                put(d["id"], r, 1.0 if t.get("creator_source") == "creator" else 0.8, "creator")
            for i, d in enumerate(t["writers"]):
                w = 0.9 if d.get("department") == "Writing" else 0.6
                put(d["id"], r, (w if i <= 1 else 0.5) if show else w, "writer")
            for d in t["cast"]:
                o = d.get("order") or 0
                # the first four billed are leads (ensembles such as Snatch bill Brad Pitt fourth)
                w = 1.0 if o <= 3 else 0.85 if o <= 5 else 0.6 if o <= 8 else 0.4
                if d.get("department") and d["department"] != "Acting":
                    w *= 0.5  # a director's cameo
                put(d["id"], r, w, "cast")
    _state["credits"] = per
    return per


def _person_index():
    if "pidx" in _state:
        return _state["pidx"]
    P = _persons()
    full = {}
    for pid, v in P.items():
        for n in {v["name"], v.get("original_name") or ""}:
            k = fold(n)
            if not k:
                continue
            if k not in full or v["votes_sum"] > P[full[k]]["votes_sum"]:
                full[k] = pid
    cat = C.load()
    cr = credits()

    def lead(pid):
        """Votes over the person's main-role titles (director / creator 2x, lead cast / writer 1x)."""
        tot = 0
        for r, (w, role) in cr.get(pid, {}).items():
            if w >= 0.85:
                tot += cat.votes[r] * (2 if role in ("director", "creator") else 1)
        return tot

    by_sur = defaultdict(list)
    for pid, v in P.items():
        s = surname(v["name"])
        if s and v["titles"] >= 2:
            by_sur[s].append(pid)
    sur = {}
    groups = {}
    for s, pids in by_sur.items():
        if len(s) < 4:
            continue
        score = {p: lead(p) for p in pids}
        pids.sort(key=lambda p: -score[p])
        top = P[pids[0]]
        if top["titles"] < 3 or score[pids[0]] < SURNAME_VOTES:
            continue
        second = score[pids[1]] if len(pids) > 1 else 0
        if score[pids[0]] >= SURNAME_DOMINANCE * second:
            sur[s] = pids[0]
        # sibling teams: prominent people with the surname who share titles with the top one
        mine = set(cr.get(pids[0], {}))
        team = [pids[0]] + [p for p in pids[1:4] if P[p]["titles"] >= 3 and score[p] >= SURNAME_VOTES / 2
                            and len(mine & set(cr.get(p, {}))) >= 3]
        if len(team) >= 2:
            groups[s] = team
    prominent = [k for k, pid in full.items() if P[pid]["titles"] >= 3 and P[pid]["votes_sum"] >= 4 * SURNAME_VOTES
                 and " " in k]
    _state["pidx"] = dict(full=full, sur=sur, groups=groups, prominent=prominent)
    return _state["pidx"]


# --- studio index -------------------------------------------------------------------------------

def _studio_index():
    if "sidx" in _state:
        return _state["sidx"]
    cat = C.load()
    names, rows = {}, defaultdict(dict)     # (kind, id) -> name ; (kind, id) -> {row: weight}
    with gzip.open(os.path.join(C.DATA, "companies.jsonl.gz"), "rt", encoding="utf-8") as f:
        for line in f:
            t = json.loads(line)
            r = cat.row_of.get(t["id"])
            if r is None:
                continue
            for i, c in enumerate(t["companies"] or []):
                names[("c", c["id"])] = c["name"]
                rows[("c", c["id"])][r] = 1.0 if i <= 1 else 0.8
            for c in t["networks"] or []:
                names[("n", c["id"])] = c["name"]
                rows[("n", c["id"])][r] = 1.0

    def stripped(k):
        ws = k.split()
        while len(ws) > 1 and ws[-1] in _SUFFIX:
            ws = ws[:-1]
        if len(ws) > 1 and ws[0] in ("studio", "the"):
            ws = ws[1:]
        if len(ws) > 1 and ws[0] == "walt":
            ws = ws[1:]
        return " ".join(ws)

    alias = defaultdict(set)
    for key, n in names.items():
        k = fold(n)
        if not k:
            continue
        alias[k].add(key)
        alias[stripped(k)].add(key)
        if k.startswith("studio ") or k.startswith("walt "):
            alias[" ".join(k.split()[1:])].add(key)
    # brand prefix: "hbo max" joins "hbo" when "hbo" is itself the full name of a studio or network
    fulls = {fold(n) for n in names.values()}
    for key, n in names.items():
        first = fold(n).split()[:1]
        if first and first[0] in fulls and first[0] != fold(n):
            alias[first[0]].add(key)
    common = _common()
    low = _state["low"]
    out = {}
    for a, keys in alias.items():
        ws = a.split()
        if not ws or len(a) < 2:
            continue
        weak = False
        if len(ws) == 1 and low.get(a, 0) > RARE_LOWER_DF:
            # "lighthouse" (Lighthouse Pictures) is also a word: it counts only for a big group ("marvel") and only
            # next to a film word ("marvel movies"), see detect()
            n_rows = len({r for k in keys for r in rows[k]})
            if n_rows < 50 or low.get(a, 0) >= COMMON_LOWER_DF:
                continue
            weak = True
        if all(is_common(w, titles=False) for w in ws):
            # all common words: only a full original name that ends in a company suffix ("Working Title Films")
            full = [k for k in keys if fold(names[k]) == a and len(ws) >= 2 and ws[-1] in _SUFFIX]
            if not full:
                continue
        rw = {}
        for k in keys:
            for r, w in rows[k].items():
                rw[r] = max(rw.get(r, 0), w)
        if len(rw) < STUDIO_MIN_TITLES:
            continue
        out[a] = dict(keys=sorted(keys), rows=rw, weak=weak, name=names[sorted(keys, key=lambda k: -len(rows[k]))[0]])
    _state["sidx"] = out
    return out


# --- detection ----------------------------------------------------------------------------------

@dataclass
class Entity:
    kind: str                 # "person" | "studio"
    name: str
    ids: list                 # person ids, or studio keys
    span: tuple               # token span in the folded query (start, end)
    match: str                # full | original | surname | team | alias | fuzzy
    role: str = ""            # person: director | writer | creator | actor


@dataclass
class Detection:
    entities: list
    intent: str               # filmography | style | both
    lean: str                 # for "both": style | filmography
    residual: str             # query without entity spans and filler (may be "")
    era: str = None           # early | late | None
    tokens: list = field(default_factory=list)
    ms: float = 0.0


_STYLE_SUFFIX = re.compile(r"^(.{4,}?)(?:esque|ian|like|ish)$")


def _role(pid):
    P = _persons()
    v = P[pid]
    cr = v["credits"]
    crew = cr["director"] + cr["creator"]
    if v["department"] == "Acting" and cr["cast"] >= 2 * max(1, crew):
        return "actor"
    if cr["director"] >= max(cr["creator"], 1):
        return "director"
    if cr["creator"]:
        return "creator"
    if cr["writer"]:
        return "writer"
    return "actor"


def warm():
    word_freq()
    _person_index()
    _studio_index()
    credits()


def detect(query):
    t0 = time.perf_counter()
    pidx, sidx = _person_index(), _studio_index()
    P = _persons()
    raw = re.sub(r"(?<=[^\W_])-(?=[^\W_])", " - ", query or "")   # "miyazaki-like" -> "miyazaki - like"
    toks = fold(raw).split()
    # the word lists are English: in other languages only multi-word full names count ("Bud Spencer")
    foreign = looks_foreign(query)
    ents, used = [], set()
    style_marker = False

    def free(i, j):
        return not any(k in used for k in range(i, j))

    # 1. exact n-grams, longest first
    for n in (4, 3, 2, 1):
        for i in range(0, len(toks) - n + 1):
            j = i + n
            if not free(i, j):
                continue
            g = " ".join(toks[i:j])
            if n == 1 and (is_common(g, titles=False) or foreign):
                continue
            hit = None
            if g in sidx and not (sidx[g]["weak"] and not ({toks[i - 1] if i else "", toks[j] if j < len(toks) else ""}
                                                            & (_FILM_WORDS | {"studio", "studios"}))):
                hit = Entity("studio", sidx[g]["name"], sidx[g]["keys"], (i, j), "alias")
            elif n >= 2 and g in pidx["full"]:
                pid = pidx["full"][g]
                v = P[pid]
                # a full name of common words only needs a prominent owner
                if all(is_common(w) for w in g.split()) and not (v["titles"] >= 5 and v["votes_sum"] >= SURNAME_VOTES):
                    continue
                if v["titles"] < 3 and v["popularity"] < 5:
                    continue
                hit = Entity("person", v["name"], [pid], (i, j), "full", _role(pid))
            elif n == 1 and not is_common(g) and g in pidx["full"] and P[pidx["full"][g]]["titles"] >= 5 and \
                    P[pidx["full"][g]]["votes_sum"] >= SURNAME_VOTES and " " not in P[pidx["full"][g]]["name"].strip():
                pid = pidx["full"][g]
                hit = Entity("person", P[pid]["name"], [pid], (i, j), "mononym", _role(pid))
            if hit:
                ents.append(hit)
                used.update(range(i, j))
    # 2. surnames, sibling teams, style suffixes
    for i, w in enumerate(toks):
        if i in used or foreign:
            continue
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        base = w
        team = nxt in ("brothers", "bros", "sisters") or (w.endswith("s") and w[:-1] in pidx["groups"] and not is_common(w))
        if team:
            base = w[:-1] if w.endswith("s") and w[:-1] in pidx["groups"] else w
            if base in pidx["groups"] and not is_common(base):
                pids = pidx["groups"][base]
                span = (i, i + 2) if nxt in ("brothers", "bros", "sisters") else (i, i + 1)
                ents.append(Entity("person", " & ".join(P[p]["name"] for p in pids), pids, span, "team", _role(pids[0])))
                used.update(range(*span))
                continue
        m = _STYLE_SUFFIX.match(w)
        cands = [(w, False)] + ([(m.group(1), True)] if m else [])
        for c, suffixed in cands:
            if c in pidx["sur"] and not is_common(c):
                pid = pidx["sur"][c]
                ents.append(Entity("person", P[pid]["name"], [pid], (i, i + 1), "surname", _role(pid)))
                used.add(i)
                style_marker |= suffixed
                break
            if suffixed and c in sidx and not is_common(c, titles=False):
                ents.append(Entity("studio", sidx[c]["name"], sidx[c]["keys"], (i, i + 1), "alias"))
                used.add(i)
                style_marker = True
                break
    # 3. fuzzy (typos), only for n-grams with an unknown word
    low = _state["low"]
    if len(ents) == 0 and not foreign and len(toks) <= FUZZY_MAX_WORDS:
        from rapidfuzz import fuzz, process
        from rapidfuzz.distance import Levenshtein
        vocab = word_freq()
        unknown = [i for i, w in enumerate(toks) if i not in used and w.isalpha() and vocab.get(w, 0) < 3
                   and vocab.get(S.stem(w), 0) < 3 and not is_common(w)]
        done = False
        for n in (3, 2):
            for i in range(0, len(toks) - n + 1):
                j = i + n
                if done or not free(i, j) or not any(k in unknown for k in range(i, j)) or \
                        any(w in S.STOP or w in _FILLER or w in _STYLE_WORDS for w in toks[i:j]):
                    continue
                g = " ".join(toks[i:j])
                hit = process.extractOne(g, pidx["prominent"], scorer=fuzz.ratio, score_cutoff=FUZZY_NAME_CUTOFF)
                if hit and len(hit[0].split()) == n:
                    pid = pidx["full"][hit[0]]
                    ents.append(Entity("person", P[pid]["name"], [pid], (i, j), "fuzzy", _role(pid)))
                    used.update(range(i, j))
                    done = True
        if not done:
            for i in unknown:
                w = toks[i]
                if len(w) < 7:
                    continue
                hit = process.extractOne(w, list(pidx["sur"]), scorer=Levenshtein.distance, score_cutoff=1)
                if hit:
                    pid = pidx["sur"][hit[0]]
                    ents.append(Entity("person", P[pid]["name"], [pid], (i, i + 1), "fuzzy", _role(pid)))
                    used.add(i)
                    break
    if not ents:
        return None
    ents.sort(key=lambda e: e.span)
    rest = [w for k, w in enumerate(toks) if k not in used]
    era = next((_ERA_WORDS[w] for w in rest if w in _ERA_WORDS), None)
    style_marker |= any(w in _STYLE_WORDS for w in rest) or bool(re.search(r"\b(?:in the vein of|à la|a la)\b", fold(query)))
    film_marker = any(w in _FILM_WORDS for w in rest)
    residual_words = [w for w in rest if w not in _FILLER and w not in _STYLE_WORDS and w not in S.STOP and w != "-"
                      and w not in ("brothers", "bros", "sisters")]
    # keep the modifier after "but" ("but less weird") in the residual for the negation / modifier logic
    residual = " ".join(residual_words)
    if style_marker:
        intent = "style"
    elif film_marker or residual_words or era or all(e.kind == "studio" for e in ents):
        intent = "filmography"
    else:
        intent = "both"
    lean = "filmography" if all(e.kind == "person" and e.role == "actor" for e in ents) else "style"
    return Detection(ents, intent, lean, residual, era, toks, (time.perf_counter() - t0) * 1000)


# --- per-entity title weights and reference titles ------------------------------------------------

def title_weights(det, cat):
    """row -> weight in [0, 1]: the mean over entities of each entity's credit weight (a title with both Bud Spencer
    and Terence Hill scores 1, one of them 0.5); studios by company position / network."""
    per = []
    sidx = _studio_index()
    cr = credits()
    for e in det.entities:
        w = {}
        if e.kind == "studio":
            key = next(a for a, v in sidx.items() if v["keys"] == e.ids)
            w = dict(sidx[key]["rows"])
        else:
            for pid in e.ids:   # a team: any member counts
                for r, (x, role) in cr.get(pid, {}).items():
                    w[r] = max(w.get(r, 0), x)
        per.append(w)
    rows = set().union(*[set(w) for w in per])
    return {r: sum(w.get(r, 0) for w in per) / len(per) for r in rows}


def main_rows(det, cat, k=12, min_w=0.85):
    """The entities' top titles by votes among their main-role credits (weight >= min_w), for the style centroid."""
    tw = title_weights(det, cat)
    rows = [r for r, w in tw.items() if w >= min_w and cat.votes[r] >= 2000]
    if len(rows) < 3:
        rows = [r for r, w in tw.items() if w >= 0.5 and cat.votes[r] >= 2000]
    rows.sort(key=lambda r: -cat.votes[r])
    return rows[:k]


if __name__ == "__main__":
    import sys
    warm()
    for q in sys.argv[1:]:
        print(q, "->", detect(q))

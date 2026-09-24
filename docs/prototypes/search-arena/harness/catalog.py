"""Local catalog and embeddings, loaded once and cached.

`load()` returns a Catalog with numpy columns in catalog row order (the embedding row order).
The first call parses data/catalog.jsonl.gz (about a minute) and writes data/catalog.pkl.
"""
import gzip, json, os, pickle, time
from dataclasses import dataclass, field

import numpy as np

ARENA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ARENA, "data")
CACHE = os.path.join(DATA, "catalog.pkl")
CACHE_VERSION = 2

DIMS = (
    "adrenaline tension scare violence romance eroticism wholesome wonder pathos melancholy uncanny catharsis "
    "nostalgia situational_comedy wit_wordplay physical_comedy cringe_humor absurdist_humor satire_parody dark_humor "
    "fantasy futuristic historical contemporary_realism crime mystery warfare political sports biographical "
    "coming_of_age family_dynamics psychological showbiz gaming pop_culture social_commentary class_and_capitalism "
    "technology_and_humanity spiritual narrative_structure dialogue_quality character_depth slow_burn fast_pace "
    "intrigue complexity rewatchability hopefulness bleakness ambiguity novelty homage_and_reference "
    "non_linear_narrative meta_narrative surrealism eccentricity philosophical educational direction acting "
    "cinematography editing music_composition world_immersion spectacle visual_stylization pastiche psychedelic "
    "grotesque camp_and_irony dialogue_centrality music_centrality sound_centrality"
).split()
DIM_INDEX = {k: i for i, k in enumerate(DIMS)}
assert len(DIMS) == 74

# Boolean payload flags production can filter on (FLAGS in d4.server.ts whose qdrant key is the id).
BOOL_FLAGS = [
    "is_anime",
    "suitability_adults", "suitability_date_night", "suitability_family", "suitability_friends",
    "suitability_group_party", "suitability_intergenerational", "suitability_kids", "suitability_partner",
    "suitability_public_viewing_safe", "suitability_solo_watch", "suitability_teens",
    "context_is_background_friendly", "context_is_binge_friendly", "context_is_comfort_watch",
    "context_is_drop_in_friendly", "context_is_pure_escapism", "context_is_thought_provoking",
]

EMBEDDINGS = {
    # name: (file, hf model, query prefix)
    "e5s": ("emb-e5-small-v2.npy", "intfloat/e5-small-v2", "query: "),
    "e5s-notitle": ("emb-e5-small-v2-notitle.npy", "intfloat/e5-small-v2", "query: "),
    "bgeb": ("emb-bge-base-en-v1.5.npy", "BAAI/bge-base-en-v1.5",
             "Represent this sentence for searching relevant passages: "),
    "bgeb-notitle": ("emb-bge-base-en-v1.5-notitle.npy", "BAAI/bge-base-en-v1.5",
                     "Represent this sentence for searching relevant passages: "),
    "bges": ("emb-bge-small-en-v1.5.npy", "BAAI/bge-small-en-v1.5",
             "Represent this sentence for searching relevant passages: "),
    "me5s": ("emb-multilingual-e5-small.npy", "intfloat/multilingual-e5-small", "query: "),
}


@dataclass
class Catalog:
    ids: np.ndarray            # int64 point ids
    tmdb_id: np.ndarray        # int64
    is_show: np.ndarray        # bool
    title: list
    original_title: list
    year: np.ndarray           # int32, 0 when unknown
    genres: list               # list[list[str]]
    essence_text: list
    essence_tags: list
    keywords: list
    tropes: list
    imdb_id: list
    fp: np.ndarray             # (n, 74) float32, the L2-normalized Qdrant vector
    fps: np.ndarray            # (n, 74) float32, raw 0..10 fingerprint_scores (payload)
    flags: dict                # name -> (n,) int8: 1 true, 0 false, -1 null
    production_method: list
    votes: np.ndarray          # int64
    goodwatch_score: np.ndarray  # float32, nan when unknown
    popularity: np.ndarray     # float32
    row_of: dict = field(default_factory=dict)  # point id -> row

    def media_type(self, row):
        return "show" if self.is_show[row] else "movie"

    def eligible(self, lesser_known=False):
        """Default candidate universe: votes >= 2000 (adult titles are not in the snapshot)."""
        return np.ones(len(self.ids), bool) if lesser_known else self.votes >= 2000


def _build():
    t0 = time.time()
    cols = {k: [] for k in ("ids tmdb_id is_show title original_title year genres essence_text essence_tags "
                            "keywords tropes imdb_id fp fps production_method votes goodwatch_score popularity").split()}
    flags = {k: [] for k in BOOL_FLAGS}
    with gzip.open(os.path.join(DATA, "catalog.jsonl.gz"), "rt", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            cols["ids"].append(r["id"])
            cols["tmdb_id"].append(r["tmdb_id"])
            cols["is_show"].append(r["media_type"] == "show")
            cols["title"].append(r.get("title") or r.get("original_title") or "")
            cols["original_title"].append(r.get("original_title") or "")
            cols["year"].append(int(r["year"]) if r.get("year") else 0)
            cols["genres"].append(r.get("genres") or [])
            cols["essence_text"].append(r.get("essence_text") or "")
            cols["essence_tags"].append(r.get("essence_tags") or [])
            cols["keywords"].append(r.get("keywords") or [])
            cols["tropes"].append(r.get("tropes") or [])
            cols["imdb_id"].append((r.get("imdb_id") or "").strip() or None)
            cols["fp"].append(r["fingerprint"])
            s = r.get("fingerprint_scores") or {}
            cols["fps"].append([float(s.get(k, 0) or 0) for k in DIMS])
            fl = r.get("flags") or {}
            for k in BOOL_FLAGS:
                v = fl.get(k)
                flags[k].append(-1 if v is None else int(bool(v)))
            cols["production_method"].append(fl.get("production_method"))
            cols["votes"].append(int(r.get("votes") or 0))
            g = r.get("goodwatch_score")
            cols["goodwatch_score"].append(np.nan if g is None else float(g))
            cols["popularity"].append(float(r.get("popularity") or 0))
    c = Catalog(
        ids=np.array(cols["ids"], np.int64), tmdb_id=np.array(cols["tmdb_id"], np.int64),
        is_show=np.array(cols["is_show"], bool), title=cols["title"], original_title=cols["original_title"],
        year=np.array(cols["year"], np.int32), genres=cols["genres"], essence_text=cols["essence_text"],
        essence_tags=cols["essence_tags"], keywords=cols["keywords"], tropes=cols["tropes"], imdb_id=cols["imdb_id"],
        fp=np.array(cols["fp"], np.float32), fps=np.array(cols["fps"], np.float32),
        flags={k: np.array(v, np.int8) for k, v in flags.items()}, production_method=cols["production_method"],
        votes=np.array(cols["votes"], np.int64), goodwatch_score=np.array(cols["goodwatch_score"], np.float32),
        popularity=np.array(cols["popularity"], np.float32),
    )
    print(f"catalog parsed: {len(c.ids)} rows in {time.time() - t0:.0f}s", flush=True)
    return c


_catalog = None


def load():
    global _catalog
    if _catalog is not None:
        return _catalog
    if os.path.exists(CACHE):
        with open(CACHE, "rb") as f:
            version, fields = pickle.load(f)
        c = Catalog(**fields) if version == CACHE_VERSION else None
    else:
        c = None
    if c is None:
        c = _build()
        with open(CACHE, "wb") as f:
            fields = {k: v for k, v in c.__dict__.items() if k != "row_of"}
            pickle.dump((CACHE_VERSION, fields), f, protocol=pickle.HIGHEST_PROTOCOL)
    ids = json.load(open(os.path.join(DATA, "emb-ids.json")))
    assert len(ids) == len(c.ids) and ids[0] == c.ids[0] and ids[-1] == c.ids[-1], "emb-ids.json out of order"
    c.row_of = {int(p): i for i, p in enumerate(c.ids)}
    _catalog = c
    return c


_emb = {}


def embeddings(name):
    """(n, dim) float32 L2-normalized passage embeddings for a model key in EMBEDDINGS."""
    if name not in _emb:
        path = os.path.join(DATA, EMBEDDINGS[name][0])
        _emb[name] = np.load(path).astype(np.float32)
    return _emb[name]


def point_id(media_type, tmdb_id):
    return (2 if media_type in ("show", "tv") else 1) * 1_000_000_000_000 + int(tmdb_id)


if __name__ == "__main__":
    c = load()
    print(len(c.ids), "rows,", int(c.eligible().sum()), "eligible")

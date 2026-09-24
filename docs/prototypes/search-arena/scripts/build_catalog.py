"""Read-only snapshot of every non-adult fingerprinted title.

Qdrant scroll (media_fingerprint_v1) -> Crate SELECT by tmdb_id batches -> data/catalog.jsonl.gz
Usage: python scripts/build_catalog.py   (system python is enough; stdlib only)
"""
import gzip, json, os, sys, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from readonly_stores import E, sql

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "data", "catalog.jsonl.gz")
QDRANT = "http://10.0.0.20:6333"
COLLECTION = "media_fingerprint_v1"

# Same order as goodwatch-webapp/app/server/utils/fingerprint.ts VALID_FINGERPRINT_KEYS.
FP_KEYS = [
    "adrenaline", "tension", "scare", "violence", "romance", "eroticism", "wholesome", "wonder", "pathos", "melancholy", "uncanny", "catharsis", "nostalgia",
    "situational_comedy", "wit_wordplay", "physical_comedy", "cringe_humor", "absurdist_humor", "satire_parody", "dark_humor",
    "fantasy", "futuristic", "historical", "contemporary_realism", "crime", "mystery", "warfare", "political", "sports", "biographical", "coming_of_age", "family_dynamics", "psychological", "showbiz", "gaming", "pop_culture", "social_commentary", "class_and_capitalism", "technology_and_humanity", "spiritual",
    "narrative_structure", "dialogue_quality", "character_depth", "slow_burn", "fast_pace", "intrigue", "complexity", "rewatchability", "hopefulness", "bleakness", "ambiguity", "novelty", "homage_and_reference", "non_linear_narrative", "meta_narrative", "surrealism", "eccentricity", "philosophical", "educational",
    "direction", "acting", "cinematography", "editing", "music_composition", "world_immersion", "spectacle", "visual_stylization", "pastiche", "psychedelic", "grotesque", "camp_and_irony", "dialogue_centrality", "music_centrality", "sound_centrality",
]
assert len(FP_KEYS) == 74

FLAG_KEYS = [
    "is_anime", "production_method",
    "suitability_adults", "suitability_date_night", "suitability_family", "suitability_friends", "suitability_group_party",
    "suitability_intergenerational", "suitability_kids", "suitability_partner", "suitability_public_viewing_safe",
    "suitability_solo_watch", "suitability_teens",
    "context_is_background_friendly", "context_is_binge_friendly", "context_is_comfort_watch", "context_is_drop_in_friendly",
    "context_is_pure_escapism", "context_is_thought_provoking",
]
PAYLOAD = ["tmdb_id", "media_type", "title", "original_title", "release_year", "genres", "tropes", "adult",
           "fingerprint_scores_v1", "goodwatch_overall_score_voting_count", "goodwatch_overall_score_normalized_percent",
           "imdb_user_score_rating_count", "tmdb_user_score_rating_count", "poster_path"] + FLAG_KEYS


def qdrant(path, body):
    req = urllib.request.Request(f"{QDRANT}{path}", data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json", "api-key": E.get("QDRANT_API_KEY", "")})
    return json.load(urllib.request.urlopen(req, timeout=120))["result"]


def scroll_all():
    points, offset = [], None
    while True:
        # points/scroll is a read endpoint despite POST.
        body = {"limit": 5000, "with_payload": PAYLOAD, "with_vector": ["fingerprint_v1"]}
        if offset is not None:
            body["offset"] = offset
        r = qdrant(f"/collections/{COLLECTION}/points/scroll", body)
        points += r["points"]
        offset = r.get("next_page_offset")
        print(f"qdrant scrolled {len(points)}", file=sys.stderr)
        if offset is None:
            return points


def crate_rows(table, ids):
    out = {}
    batches = [ids[i:i + 1000] for i in range(0, len(ids), 1000)]

    def one(batch):
        r = sql(f"SELECT tmdb_id, adult, imdb_id, popularity, essence_text, essence_tags, substr(synopsis, 1, 600) AS synopsis, "
                f"keywords, tropes, original_title FROM {table} WHERE tmdb_id IN ({','.join('?' * len(batch))})", batch)
        return [dict(zip(r["cols"], row)) for row in r["rows"]]

    with ThreadPoolExecutor(6) as ex:
        for n, rows in enumerate(ex.map(one, batches)):
            for row in rows:
                out[row["tmdb_id"]] = row
            if n % 20 == 0:
                print(f"crate {table} {n + 1}/{len(batches)}", file=sys.stderr)
    return out


def main():
    t0 = time.time()
    points = scroll_all()
    by_type = {"movie": [], "show": []}
    for p in points:
        by_type[p["payload"]["media_type"]].append(p["payload"]["tmdb_id"])
    crate = {t: crate_rows(t, ids) for t, ids in by_type.items()}
    points.sort(key=lambda p: p["id"])
    stats = {"qdrant_points": len(points), "adult_skipped": 0, "no_crate_row": 0, "written": 0, "movie": 0, "show": 0,
             "votes>=2000": 0, "no_essence_text": 0, "no_keywords": 0, "no_tropes": 0}
    with gzip.open(OUT, "wt", encoding="utf-8") as f:
        for p in points:
            pl = p["payload"]
            c = crate[pl["media_type"]].get(pl["tmdb_id"])
            if c is None:
                stats["no_crate_row"] += 1
            if pl.get("adult") is True or (c and c.get("adult") is True):
                stats["adult_skipped"] += 1
                continue
            c = c or {}
            fps = pl.get("fingerprint_scores_v1") or {}
            tropes = pl.get("tropes") or c.get("tropes") or []
            rec = {
                "id": p["id"],
                "tmdb_id": pl["tmdb_id"],
                "media_type": pl["media_type"],
                "title": pl.get("title"),
                "original_title": pl.get("original_title") or c.get("original_title"),
                "year": pl.get("release_year"),
                "genres": pl.get("genres") or [],
                "essence_text": c.get("essence_text"),
                "essence_tags": c.get("essence_tags") or [],
                "synopsis": c.get("synopsis"),
                "keywords": c.get("keywords") or [],
                "tropes": tropes,
                "fingerprint": [round(x, 6) for x in p["vector"]["fingerprint_v1"]],
                "fingerprint_scores": {k: fps.get(k) for k in FP_KEYS},
                "flags": {k: pl.get(k) for k in FLAG_KEYS},
                "votes": pl.get("goodwatch_overall_score_voting_count") or 0,
                "imdb_votes": pl.get("imdb_user_score_rating_count"),
                "tmdb_votes": pl.get("tmdb_user_score_rating_count"),
                "goodwatch_score": pl.get("goodwatch_overall_score_normalized_percent"),
                "popularity": c.get("popularity"),
                "imdb_id": c.get("imdb_id"),
                "poster_path": pl.get("poster_path"),
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            stats["written"] += 1
            stats[rec["media_type"]] += 1
            stats["votes>=2000"] += rec["votes"] >= 2000
            stats["no_essence_text"] += not rec["essence_text"]
            stats["no_keywords"] += not rec["keywords"]
            stats["no_tropes"] += not rec["tropes"]
    stats["seconds"] = round(time.time() - t0)
    json.dump(stats, open(os.path.join(HERE, "data", "catalog-stats.json"), "w"), indent=1)
    print(json.dumps(stats))


if __name__ == "__main__":
    main()

"""Explicit Wikidata external IDs become catalog links only after local checks."""

from f.external_ids.imdb_ids import effective_imdb_id
from f.tvdb.ids import tmdb_id


def values(entity, prop):
    claims = entity.get("claims", {}).get(prop, [])
    preferred = [c for c in claims if c.get("rank") == "preferred"]
    return [
        c["mainsnak"]["datavalue"]["value"]
        for c in preferred or claims
        if c.get("rank") != "deprecated" and "datavalue" in c.get("mainsnak", {})
    ]


def item_ids(entity, prop):
    return [
        v["id"] for v in values(entity, prop) if isinstance(v, dict) and v.get("id")
    ]


def label(entity, fallback=""):
    labels = entity.get("labels", {})
    return (labels.get("en") or labels.get("mul") or {}).get("value", fallback)


class Identities:
    def __init__(self, db, connector, entities):
        self.db, self.entities = db, entities
        self.links = {}
        for kind, prop, table, collection in [
            ("movie", "P4947", "movie", "tmdb_movie_details"),
            ("show", "P4983", "show", "tmdb_tv_details"),
            ("person", "P4985", "person", None),
        ]:
            candidates = {}
            for qid, entity in entities.items():
                ids = {tmdb_id(v) for v in values(entity, prop)}
                if len(ids) == 1 and None not in ids:
                    candidates[qid] = ids.pop()
            ids = sorted(set(candidates.values()))
            present = set()
            for offset in range(0, len(ids), 2000):
                present.update(
                    r["tmdb_id"]
                    for r in connector.select(
                        f"SELECT tmdb_id FROM {table} WHERE tmdb_id = ANY(?)",
                        (ids[offset : offset + 2000],),
                    )
                )
            source = (
                {
                    d["tmdb_id"]: d
                    for d in db[collection].find(
                        {"tmdb_id": {"$in": ids}},
                        {
                            "tmdb_id": 1,
                            "tmdb_deleted": 1,
                            "imdb_id": 1,
                            "imdb_id_override": 1,
                            "external_ids": 1,
                        },
                    )
                }
                if collection
                else {}
            )
            for qid, local in candidates.items():
                if local not in present:
                    continue
                if collection:
                    doc = source.get(local)
                    if not doc or doc.get("tmdb_deleted"):
                        continue
                    imdb, _ = effective_imdb_id(doc, kind == "movie")
                    remote = {
                        v for v in values(entities[qid], "P345") if isinstance(v, str)
                    }
                    if imdb and remote and remote != {imdb}:
                        continue
                self.links[(qid, kind)] = local

    def is_work(self, qid):
        entity = self.entities.get(qid, {})
        return bool(
            values(entity, "P4947")
            or values(entity, "P4983")
            or set(item_ids(entity, "P31"))
            & {
                "Q11424",
                "Q5398426",
                "Q21191270",
                "Q3464665",
                "Q7366",
                "Q134556",
                "Q105543609",
                "Q24856",
                "Q7889",
            }
        )

    def recipient(self, qid):
        entity = self.entities.get(qid, {})
        local = self.links.get((qid, "person"))
        # Do not turn a film/group into a person merely because it is an award subject.
        if local or "Q5" in item_ids(entity, "P31"):
            return {
                "identity": f"person:{local}" if local else "wikidata:" + qid,
                "kind": "person",
                "person_tmdb_id": local,
                "wikidata_id": qid,
                "name": label(entity, qid),
                "link_status": "verified" if local else "unmapped",
            }
        return {
            "identity": "wikidata:" + qid,
            "kind": "organization"
            if not any((qid, k) in self.links for k in ["movie", "show"])
            else "work",
            "wikidata_id": qid,
            "name": label(entity, qid),
            "link_status": "unmapped",
        }

    def work(self, qid, role="recognized_work"):
        entity = self.entities.get(qid, {})
        for kind in ["movie", "show"]:
            local = self.links.get((qid, kind))
            if local:
                return {
                    "identity": f"{kind}:{local}",
                    "kind": kind,
                    "wikidata_id": qid,
                    "media_type": kind,
                    "media_tmdb_id": local,
                    "role": role,
                    "link_status": "verified",
                    "name": label(entity, qid),
                }
        types = item_ids(entity, "P31")
        kind = (
            "song"
            if any(t in types for t in ["Q7366", "Q134556", "Q105543609"])
            else "episode"
            if "Q21191270" in types
            else "season"
            if "Q3464665" in types
            else "movie"
            if values(entity, "P4947") or "Q11424" in types
            else "show"
            if values(entity, "P4983") or "Q5398426" in types
            else "work"
        )
        return {
            "identity": "wikidata:" + qid,
            "kind": kind,
            "wikidata_id": qid,
            "role": role,
            "link_status": "unmapped",
            "name": label(entity, qid),
        }

    def works(self, qid):
        work = self.work(qid)
        result = [work]
        # Explicit containment only: an episode/song is not equated to its series/film.
        seen, queue = {qid}, [(qid, 0)]
        while queue:
            current, depth = queue.pop(0)
            if depth >= 3:
                continue
            entity = self.entities.get(current, {})
            for parent in item_ids(entity, "P179") + item_ids(entity, "P361"):
                if parent in seen:
                    continue
                seen.add(parent)
                parent_work = self.work(parent, "context_title")
                if parent_work.get("link_status") == "verified":
                    result.append(parent_work)
                else:
                    queue.append((parent, depth + 1))
        return result


def main():
    """Importable verified catalog joins."""

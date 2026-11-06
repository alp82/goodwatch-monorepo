"""Resolve award relationships from explicit source identities, retaining unresolved evidence."""

from f.external_ids.imdb_ids import effective_imdb_id
from f.tvdb.ids import checked_id, tmdb_id


def object_value(value):
    return value if isinstance(value, dict) else {}


def title_target(nominee):
    targets = []
    for field, kind in (("movie", "movie"), ("series", "show")):
        value = object_value(nominee.get(field))
        if value:
            targets.append((kind, checked_id(value.get("id"))))
    character = object_value(nominee.get("character"))
    for field, kind in (("movieId", "movie"), ("seriesId", "show")):
        if character.get(field) not in (None, 0):
            targets.append((kind, checked_id(character[field])))
    episode = object_value(nominee.get("episode"))
    if episode.get("seriesId") not in (None, 0):
        targets.append(("show", checked_id(episode["seriesId"])))
    if not targets:
        return None, None, "missing_source_identity"
    if any(tvdb is None for _, tvdb in targets):
        return None, None, "invalid_source_identity"
    if len(set(targets)) != 1:
        return None, None, "conflict"
    return *targets[0], None


def category_title_query(kind, tvdb):
    fields = (
        ["movie.id", "character.movieId"]
        if kind == "movie"
        else ["series.id", "character.seriesId", "episode.seriesId"]
    )
    return {"$or": [{"nominees." + field: tvdb} for field in fields]}


class NominationLinks:
    def __init__(self, db, nominees, connector=None):
        self.db, self.connector = db, connector
        keys = {
            f"{kind}:{tvdb}"
            for n in nominees
            for kind, tvdb, _ in [title_target(n)]
            if tvdb
        }
        self.entities = {
            d["_id"]: d
            for d in db.tvdb_entities.find({"_id": {"$in": list(keys)}, "status": "ok"})
        }
        title_projection = {"tvdb_id": 1, "tmdb_deleted": 1}
        if any(object_value(n.get("character")).get("id") for n in nominees):
            title_projection.update(
                {
                    "characters." + key: 1
                    for key in ("id", "peopleId", "name", "movieId", "seriesId")
                }
            )
        self.titles = {
            d["_id"]: d
            for d in db.tvdb_titles.find(
                {
                    "_id": {
                        "$in": [
                            f"{d['kind']}:{tmdb_id(d.get('tmdb_id'))}"
                            for d in self.entities.values()
                        ]
                    }
                },
                title_projection,
            )
        }
        self.sources = {}
        self.present = {}
        for kind, source, table in [
            ("movie", "tmdb_movie_details", "movie"),
            ("show", "tmdb_tv_details", "show"),
        ]:
            ids = [
                tmdb_id(d.get("tmdb_id"))
                for d in self.entities.values()
                if d["kind"] == kind
            ]
            ids = [i for i in ids if i]
            self.sources[kind] = {
                d["tmdb_id"]: d
                for d in db[source].find(
                    {"tmdb_id": {"$in": ids}},
                    {
                        "imdb_id": 1,
                        "imdb_id_override": 1,
                        "external_ids": 1,
                        "tmdb_deleted": 1,
                        "tmdb_id": 1,
                    },
                )
            }
            self.present[kind] = (
                {
                    r["tmdb_id"]
                    for r in connector.select(
                        f"SELECT tmdb_id FROM {table} WHERE tmdb_id = ANY(?)", (ids,)
                    )
                }
                if connector and ids
                else set()
            )
        self.people, self.credits = {}, {}

    def title(self, nominee):
        kind, tvdb, error = title_target(nominee)
        if error:
            return kind, tvdb, None, error
        entity = self.entities.get(f"{kind}:{tvdb}", {})
        tmdb = tmdb_id(entity.get("tmdb_id"))
        if not tmdb:
            return kind, tvdb, None, "unmapped"
        # The normalized mapping must still agree with the saved source's explicit remote ID.
        remote = {
            tmdb_id(r.get("id"))
            for r in entity.get("remote_ids") or []
            if r.get("type") == (10 if kind == "movie" else 12)
        }
        if remote != {tmdb}:
            return kind, tvdb, None, "conflict"
        source = self.sources[kind].get(tmdb)
        local = self.titles.get(f"{kind}:{tmdb}", {})
        if not source or source.get("tmdb_deleted") or local.get("tmdb_deleted"):
            return kind, tvdb, None, "missing_local_title"
        imdb, _ = effective_imdb_id(source, kind == "movie")
        remote_imdb = {
            r.get("id")
            for r in entity.get("remote_ids") or []
            if r.get("type") == 2 and r.get("id")
        }
        local_tvdb = (
            checked_id((source.get("external_ids") or {}).get("tvdb_id"))
            if kind == "show"
            else None
        )
        verified_tvdb = checked_id(local.get("tvdb_id"))
        if (
            (imdb and remote_imdb and remote_imdb != {imdb})
            or (local_tvdb and local_tvdb != tvdb)
            or (verified_tvdb and verified_tvdb != tvdb)
        ):
            return kind, tvdb, None, "conflict"
        if self.connector and tmdb not in self.present[kind]:
            return kind, tvdb, None, "missing_local_title"
        return kind, tvdb, tmdb, "verified"

    def recipient(self, nominee, kind, tvdb, tmdb):
        character = object_value(nominee.get("character"))
        cid, pid = (
            checked_id(character.get("id")),
            checked_id(character.get("peopleId")),
        )
        result = {
            "tvdb_character_id": cid,
            "tvdb_person_id": pid,
            "person_tmdb_id": None,
            "credit_id": None,
            "actor_link_status": "missing_source_identity",
            "character_link_status": "missing_source_identity",
        }
        if not character:
            return result
        result["character_link_status"] = (
            "unverified" if cid else "invalid_source_identity"
        )
        if not tmdb:
            result["actor_link_status"] = "unverified_title"
            return result
        local = self.titles.get(f"{kind}:{tmdb}", {})
        roles = (
            [c for c in local.get("characters") or [] if checked_id(c.get("id")) == cid]
            if cid
            else []
        )
        parent_field = "movieId" if kind == "movie" else "seriesId"
        other_field = "seriesId" if kind == "movie" else "movieId"
        evidence = [character] + roles
        parents = {
            checked_id(c.get(parent_field))
            for c in evidence
            if c.get(parent_field) is not None
        }
        people = {
            checked_id(c.get("peopleId"))
            for c in evidence
            if c.get("peopleId") is not None
        }
        if (
            (parents and parents != {tvdb})
            or any(c.get(other_field) not in (None, 0) for c in evidence)
            or len(people) > 1
        ):
            result.update(
                actor_link_status="conflict", character_link_status="conflict"
            )
            return result
        # A matching cast snapshot or explicit parent ID verifies the portrayal's title.
        if cid and (roles or parents == {tvdb}):
            result["character_link_status"] = "verified"
        pid = next(iter(people), None)
        result["tvdb_person_id"] = pid
        if not pid:
            return result
        if result["character_link_status"] != "verified":
            result["actor_link_status"] = "unverified_character"
            return result
        if pid not in self.people:
            person = (
                self.db.tvdb_entities.find_one({"_id": f"person:{pid}", "status": "ok"})
                or {}
            )
            person_id = tmdb_id(person.get("tmdb_id"))
            remotes = {
                tmdb_id(r.get("id"))
                for r in person.get("remote_ids") or []
                if r.get("type") == 15
            }
            status = "unmapped"
            if person_id and remotes != {person_id}:
                status = "conflict"
            elif person_id:
                exists = (
                    self.connector.select(
                        "SELECT tmdb_id FROM person WHERE tmdb_id = ?", (person_id,)
                    )
                    if self.connector
                    else [person_id]
                )
                status = "verified" if exists else "missing_local_person"
            self.people[pid] = (person_id if status == "verified" else None, status)
        person_id, status = self.people[pid]
        result.update(person_tmdb_id=person_id, actor_link_status=status)
        if person_id and self.connector:
            key = (kind, tmdb)
            if key not in self.credits:
                self.credits[key] = self.connector.select(
                    "SELECT person_tmdb_id, character, credit_id FROM person_appeared_in WHERE media_type = ? AND media_tmdb_id = ?",
                    key,
                )
            from f.tvdb.publish import exact_credit

            names = {c.get("name") for c in evidence if c.get("name")}
            if len(names) == 1:
                result["credit_id"] = exact_credit(
                    self.credits[key], person_id, names.pop()
                )
        return result


def main():
    """Importable award identity resolver."""

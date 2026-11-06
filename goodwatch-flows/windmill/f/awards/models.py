"""Source observations and canonical entries have separate identities and lifecycles."""

import hashlib
import json
import re
from dataclasses import asdict, dataclass, field

from f.tvdb.ids import tmdb_id

SOURCES = {"tvdb", "wikidata"}
QID = re.compile(r"Q[1-9][0-9]*\Z")


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False, default=str).encode()
    ).hexdigest()


@dataclass
class Observation:
    source: str
    record_id: str
    program_key: str
    category_key: str
    category_name: str
    year: int | None
    outcome: str
    ceremony_key: str | None = None
    ceremony_label: str | None = None
    ceremony_date: str | None = None
    nomination_status: str = "confirmed"
    recipients: list = field(default_factory=list)
    works: list = field(default_factory=list)
    portrayals: list = field(default_factory=list)
    references: list = field(default_factory=list)
    flags: list = field(default_factory=list)
    recipient_set_status: str = "unknown"
    entry_basis: str = "unknown"
    selection_key: str | None = None
    raw_ref: str | None = None
    source_category_id: str | None = None

    def to_dict(self):
        data = asdict(self)
        data["recipients"] = sorted(data["recipients"], key=lambda r: r["identity"])
        data["works"] = sorted(
            data["works"], key=lambda w: (w["identity"], w.get("role", ""))
        )
        data["portrayals"] = sorted(data["portrayals"], key=digest)
        data["references"] = sorted(set(data["references"]))
        data["flags"] = sorted(set(data["flags"]))
        if self.source not in SOURCES or not self.record_id or not self.category_key:
            raise ValueError("Invalid source observation identity")
        if self.outcome not in {"won", "not_won", "pending", "unknown", "disputed"}:
            raise ValueError("Invalid result status")
        if self.nomination_status not in {"confirmed", "unknown", "not_applicable"}:
            raise ValueError("Invalid nomination status")
        for work in self.works:
            if work.get("media_type") not in {None, "movie", "show"}:
                raise ValueError("Invalid local title kind")
            if (
                work.get("media_tmdb_id") is not None
                and tmdb_id(work["media_tmdb_id"]) is None
            ):
                raise ValueError("Invalid local title ID")
        for person in self.recipients:
            if (
                person.get("person_tmdb_id") is not None
                and tmdb_id(person["person_tmdb_id"]) is None
            ):
                raise ValueError("Invalid local person ID")
        return data


def nomination_year(value):
    value = str(value or "")
    return (
        int(value)
        if value.isascii()
        and value.isdecimal()
        and len(value) == 4
        and 1888 <= int(value) <= 2200
        else None
    )


def entry_identity(observation):
    """Unknown recipients/editions must not manufacture exact matches from title/year."""
    if not observation.get("ceremony_key") or "identity_conflict" in observation.get(
        "flags", []
    ):
        return None
    basis = observation.get("entry_basis")
    recipients = sorted(
        {r["identity"] for r in observation.get("recipients", []) if r.get("identity")}
    )
    works = sorted(
        {
            w["identity"]
            for w in observation.get("works", [])
            if w.get("role") == "recognized_work" and w.get("identity")
        }
    )
    if basis in {"person", "career"}:
        if not recipients:
            return None
        selection = ["recipients", recipients, works]
    elif basis in {"work", "ensemble", "song"}:
        if not works:
            return None
        # Song identities must identify a song, not just its parent film.
        if basis == "song" and not any(
            w.get("kind") == "song"
            for w in observation.get("works", [])
            if w.get("role") == "recognized_work"
        ):
            return None
        selection = ["works", works]
    else:
        return None
    return digest(
        [
            observation["program_key"],
            observation["category_key"],
            observation["ceremony_key"],
            selection,
        ]
    )


def reconcile_observations(observations):
    """Pure reconciliation. Canonical IDs are allocated separately from matching keys."""
    entries, unresolved = {}, []
    for observation in observations:
        key = entry_identity(observation)
        if key is None:
            unresolved.append(observation)
            continue
        entry = entries.setdefault(
            key,
            {
                "match_key": key,
                "program_key": observation["program_key"],
                "category_key": observation["category_key"],
                "category_name": observation["category_name"],
                "ceremony_key": observation["ceremony_key"],
                "ceremony_label": observation.get("ceremony_label"),
                "ceremony_date": observation.get("ceremony_date"),
                "year": observation.get("year"),
                "recipients": {},
                "works": {},
                "portrayals": {},
                "observations": [],
                "outcomes": set(),
                "nomination_status": "unknown",
                "recipient_set_status": "unknown",
            },
        )
        entry["outcomes"].add(observation["outcome"])
        entry["observations"].append(observation)
        if observation.get("nomination_status") == "confirmed":
            entry["nomination_status"] = "confirmed"
        for recipient in observation.get("recipients", []):
            entry["recipients"][recipient["identity"]] = recipient
        for portrayal in observation.get("portrayals", []):
            entry["portrayals"][digest(portrayal)] = portrayal
        for work in observation.get("works", []):
            entry["works"][(work["identity"], work["role"])] = work
        if observation.get("recipient_set_status") in {"partial", "complete"}:
            entry["recipient_set_status"] = observation["recipient_set_status"]
    for entry in entries.values():
        outcomes = entry.pop("outcomes")
        entry["result_status"] = (
            "disputed"
            if "disputed" in outcomes or {"won", "not_won"} <= outcomes
            else "won"
            if "won" in outcomes
            else "not_won"
            if "not_won" in outcomes
            else "pending"
            if "pending" in outcomes
            else "unknown"
        )
        entry["recipients"] = list(entry["recipients"].values())
        entry["works"] = list(entry["works"].values())
        entry["portrayals"] = list(entry["portrayals"].values())
    return list(entries.values()), unresolved


def main():
    """Importable domain contracts."""

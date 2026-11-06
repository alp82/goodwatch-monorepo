"""Reviewed program/category identities, independent of provider IDs and display names."""

import re
import unicodedata

from f.awards.store import canonical_id

# Public family labels preserve existing Discover filter semantics.
PROGRAMS = {
    "oscars": ("Academy Awards", ["Q19020"]),
    "globes": ("Golden Globe Awards", ["Q1011547"]),
    "emmys": ("Primetime Emmy Awards", ["Q1044427"]),
    "bafta.film": ("BAFTA Awards", ["Q732997"]),
    "bafta.tv": ("BAFTA Awards", ["Q1369077"]),
    "critics.film": ("Critics' Choice Awards", ["Q7585305"]),
    "critics.tv": ("Critics' Choice Awards", ["Q2465314"]),
    "sag": ("Screen Actors Guild Awards", ["Q268200"]),
    "wga": ("Writers Guild of America Awards", ["Q1415017"]),
    "dga": ("Directors Guild of America Awards", ["Q1111310"]),
    "pga": ("Producers Guild of America Awards", ["Q3406648"]),
    "daytime": ("Daytime Emmy Awards", ["Q1179189"]),
    "cesars": ("César Awards", ["Q174389"]),
    "baeksang": ("Baeksang Arts Awards", ["Q483826"]),
    "mtv": ("MTV Movie & TV Awards", ["Q110145"]),
    "nta": ("National Television Awards", ["Q1099088"]),
    "canadian": ("Canadian Screen Awards", ["Q3459735"]),
    "gemini": ("Gemini Awards", ["Q923408"]),
    "genie": ("Genie Awards", ["Q1502249"]),
    "canadian-film": ("Canadian Film Awards", ["Q5029994"]),
    "bijou": ("Bijou Awards", ["Q104854197"]),
}
TVDB_PROGRAMS = {
    1: "oscars",
    2: "globes",
    3: "mtv",
    4: "critics",
    5: "emmys",
    6: "sag",
    7: "wga",
    8: "pga",
    9: "dga",
    10: "daytime",
    11: "bafta",
    12: "bijou",
    13: "canadian-film",
    14: "genie",
    15: "gemini",
    16: "canadian",
    18: "nta",
    19: "cesars",
    21: "baeksang",
}
OSCAR_CATEGORIES = {
    "picture": (
        "Best Picture",
        ["Best Motion Picture", "Outstanding Motion Picture", "Outstanding Picture"],
    ),
    "actor-leading": ("Actor in a Leading Role", ["Best Actor"]),
    "actress-leading": ("Actress in a Leading Role", ["Best Actress"]),
    "actor-supporting": ("Actor in a Supporting Role", ["Best Supporting Actor"]),
    "actress-supporting": ("Actress in a Supporting Role", ["Best Supporting Actress"]),
    "director": ("Directing", ["Best Director"]),
    "cinematography": ("Cinematography", ["Best Cinematography"]),
    "editing": ("Film Editing", ["Best Film Editing"]),
    "score": ("Music (Original Score)", ["Best Original Score"]),
    "song": ("Music (Original Song)", ["Best Original Song"]),
    "sound": ("Sound", ["Best Sound"]),
    "sound-editing": ("Sound Editing", ["Best Sound Editing"]),
    "sound-mixing": ("Sound Mixing", ["Best Sound Mixing"]),
    "costume": ("Costume Design", ["Best Costume Design"]),
    "production-design": ("Production Design", ["Best Production Design"]),
    "makeup": ("Makeup and Hairstyling", ["Best Makeup and Hairstyling"]),
    "visual-effects": ("Visual Effects", ["Best Visual Effects"]),
    "original-screenplay": (
        "Writing (Original Screenplay)",
        ["Best Writing, Original Screenplay", "Best Original Screenplay"],
    ),
    "adapted-screenplay": (
        "Writing (Adapted Screenplay)",
        ["Best Writing, Adapted Screenplay", "Best Adapted Screenplay"],
    ),
    "international": (
        "International Feature Film",
        ["Best International Feature Film", "Best Foreign Language Film"],
    ),
    "animated-feature": ("Animated Feature Film", ["Best Animated Feature"]),
    "documentary-feature": (
        "Documentary Feature Film",
        ["Best Documentary Feature", "Best Documentary Feature Film"],
    ),
    "documentary-short": (
        "Documentary Short Film",
        ["Best Documentary (Short Subject)", "Best Documentary Short Film"],
    ),
    "animated-short": ("Short Film (Animated)", ["Best Animated Short Film"]),
    "live-short": ("Short Film (Live Action)", ["Best Live Action Short Film"]),
}


def normalized(value):
    value = (
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    )
    return re.sub("[^a-z0-9]+", " ", value).strip()


def basis(name):
    text = normalized(name)
    if any(
        x in text for x in ["honorary", "lifetime", "career achievement", "fellowship"]
    ):
        return "career"
    if "song" in text:
        return "song"
    if "ensemble" in text or "cast in" in text or "acting ensemble" in text:
        return "ensemble"
    if any(x in text for x in ["actor", "actress", "performance", "presenter", "host"]):
        return "person"
    return "work"


class Registry:
    def __init__(self, db):
        self.db, self.cache = db, {}
        self.ceremonies = {}
        for ceremony in db.award_ceremonies.find({"active": {"$ne": False}}):
            self.ceremonies.setdefault(
                (ceremony["program_key"], ceremony.get("award_year")), []
            ).append(ceremony)

    def category(self, source, source_id, program, label):
        if program not in PROGRAMS:
            raise ValueError("Unreviewed award program")
        key = (source, str(source_id), program, label)
        if key in self.cache:
            return self.cache[key]
        display = label
        norm = normalized(label)
        semantic = None
        if program == "oscars":
            candidate = normalized(re.sub(r"^Academy Award for ", "", label))
            for code, (name, aliases) in OSCAR_CATEGORIES.items():
                if candidate in {normalized(v) for v in [name, *aliases]}:
                    semantic, display = code, name
                    break
        # Outside the reviewed Oscar aliases, only exact label aliases within the
        # same program are merged. Broad historical/combined categories stay distinct.
        if semantic is None:
            existing = self.db.award_categories.find_one(
                {"program_key": program, "aliases": norm}
            )
            semantic = existing["semantic_key"] if existing else f"{source}:{source_id}"
        category_key = f"{program}/{semantic}"
        category_id = canonical_id(self.db, "category", category_key)
        program_id = canonical_id(self.db, "program", program)
        self.db.award_programs.update_one(
            {"_id": program_id},
            {
                "$set": {
                    "key": program,
                    "family_key": program.split(".")[0],
                    "name": PROGRAMS[program][0],
                }
            },
            upsert=True,
        )
        self.db.award_categories.update_one(
            {"_id": category_id},
            {
                "$set": {
                    "key": category_id,
                    "canonical_key": category_key,
                    "program_key": program,
                    "program_id": program_id,
                    "semantic_key": semantic,
                    "name": display,
                    "entry_basis": basis(display),
                },
                "$addToSet": {"aliases": norm},
            },
            upsert=True,
        )
        self.db.award_source_identities.update_one(
            {"_id": f"category-source:{source}:{source_id}:{program}"},
            {
                "$set": {
                    "kind": "category",
                    "source": source,
                    "source_id": str(source_id),
                    "program_key": program,
                    "canonical_id": category_id,
                }
            },
            upsert=True,
        )
        result = {
            "key": category_id,
            "canonical_key": category_key,
            "id": category_id,
            "semantic_key": category_key,
            "name": display,
            "entry_basis": basis(display),
            "program_id": program_id,
        }
        self.cache[key] = result
        return result


def main():
    """Importable reviewed identities."""

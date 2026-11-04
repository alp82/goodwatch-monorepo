"""Published catalog prose uses ASCII hyphens. Source captures and identities stay exact."""
from copy import deepcopy
import json

# Used by both the publisher and the one-off backfill. Names, URLs and keys are excluded.
PROSE_FIELDS = {
    "movie": ("synopsis", "tagline", "essence_text"),
    "show": ("synopsis", "tagline", "essence_text"),
    "translation": ("overview", "tagline"),
    "season": ("overview",),
    "episode": ("overview",),
    "season_translation": ("overview",),
    "episode_translation": ("overview",),
    "trope_catalog": ("description", "description_doc"),
    "trope_catalog_page": ("description", "description_doc"),
}


def normalize_text(value):
    return value.replace("\u2014", "-") if isinstance(value, str) else value


def normalize_description_doc(value):
    """Replace text only; one UTF-16 unit becomes one, so all spans remain valid."""
    if value is None:
        return None
    serialized = isinstance(value, str)
    doc = json.loads(value) if serialized else deepcopy(value)
    for block in doc["blocks"]:
        nodes = block["items"] if block["kind"] == "list" else [block]
        for node in nodes:
            node["text"] = normalize_text(node["text"])
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":"), sort_keys=True) if serialized else doc


def normalize_row(table, row):
    result = dict(row)
    for field in PROSE_FIELDS.get(table, ()):
        if field in result:
            result[field] = (normalize_description_doc(result[field]) if field == "description_doc"
                             else normalize_text(result[field]))
    return result

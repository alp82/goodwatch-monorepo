"""The text of a title that search embeds, part of the contract in ADR 0002.

A title's inputs come from two stores, as they did in the catalog the ranker was tuned on:

- the Qdrant point's payload: `title`, `original_title`, `release_year`, `genres`, `tropes`
- the Crate `movie` or `show` row: `essence_text`, `essence_tags`, the synopsis cut to
  600 characters by Crate's `substr`, `keywords`, and `original_title` and `tropes` as
  fallbacks

The payload and Crate disagree for a few thousand titles (older original titles, trope
names, genre order), so reading everything from one store would change those vectors.

- `english_text` (bge-base-en-v1.5): the text without the title, no prefix.
- `multilingual_text` (multilingual-e5-small): the text with the title, prefixed with
  `passage: `.
- `term_fields`: the BM25F body fields for `terms_bm25f_v1`.

Changing any of these means a new vector version and a full embedding run.
"""

import hashlib
import json
from dataclasses import dataclass, field

# The vectors this contract writes. It is part of the input hash, so a new version
# re-embeds every title.
CONTRACT = "text_en_v1+text_multi_v1+terms_bm25f_v1"

MULTILINGUAL_PREFIX = "passage: "
MAX_KEYWORDS = 25
MAX_TROPES = 15

# Payload fields and Crate columns the text needs.
PAYLOAD_FIELDS = ["title", "original_title", "release_year", "genres", "tropes"]
CRATE_COLUMNS = ("tmdb_id, original_title, essence_text, essence_tags, substr(synopsis, 1, 600) AS synopsis, "
                 "keywords, tropes")


@dataclass(frozen=True)
class TitleInputs:
    title: str | None
    original_title: str | None
    year: int | None
    genres: list[str] = field(default_factory=list)
    essence_text: str | None = None
    essence_tags: list[str] = field(default_factory=list)
    synopsis: str | None = None
    keywords: list[str] = field(default_factory=list)
    tropes: list[str] = field(default_factory=list)


def title_inputs(payload: dict, crate_row: dict) -> TitleInputs:
    """Combine a point's payload and its Crate row the way the catalog snapshot did."""
    return TitleInputs(
        title=payload.get("title"),
        original_title=payload.get("original_title") or crate_row.get("original_title"),
        year=payload.get("release_year"),
        genres=payload.get("genres") or [],
        essence_text=crate_row.get("essence_text"),
        essence_tags=crate_row.get("essence_tags") or [],
        synopsis=crate_row.get("synopsis"),
        keywords=crate_row.get("keywords") or [],
        tropes=payload.get("tropes") or crate_row.get("tropes") or [],
    )


def _text(head: str, inputs: TitleInputs) -> str:
    if inputs.year:
        head += f" ({inputs.year})"
    parts = [head]
    if inputs.genres:
        parts.append(", ".join(inputs.genres))
    if inputs.essence_tags:
        parts.append(", ".join(inputs.essence_tags))
    # Titles without an essence use the synopsis, so they still say what they're about.
    body = inputs.essence_text or inputs.synopsis
    if body:
        parts.append(body.strip())
    if inputs.keywords:
        parts.append("Keywords: " + ", ".join(inputs.keywords[:MAX_KEYWORDS]))
    if inputs.tropes:
        parts.append("Tropes: " + ", ".join(inputs.tropes[:MAX_TROPES]))
    return ". ".join(p.rstrip(". ") for p in parts if p) + "."


def english_text(inputs: TitleInputs) -> str:
    """Input of bge-base-en-v1.5: the text without the title. The year stays."""
    # Without a title the head is " (1988)"; the catalog stripped the whole text.
    return _text("", inputs).lstrip()


def multilingual_text(inputs: TitleInputs) -> str:
    """Input of multilingual-e5-small: the text with the title and the passage prefix."""
    return MULTILINGUAL_PREFIX + _text(inputs.title or inputs.original_title or "", inputs)


def term_fields(inputs: TitleInputs) -> dict[str, list[str]]:
    """The BM25F body fields as lists of text spans. Keywords and tropes are not cut."""
    return {
        "tags": list(inputs.essence_tags),
        "keywords": list(inputs.keywords),
        "tropes": list(inputs.tropes),
        "essence": [inputs.essence_text or ""],
    }


def input_hash(inputs: TitleInputs) -> str:
    """Changes exactly when one of the title's three vectors would change."""
    key = [CONTRACT, english_text(inputs), multilingual_text(inputs), term_fields(inputs)]
    return hashlib.sha256(json.dumps(key, ensure_ascii=False).encode()).hexdigest()


def main() -> None:
    """Shared module; no standalone input."""

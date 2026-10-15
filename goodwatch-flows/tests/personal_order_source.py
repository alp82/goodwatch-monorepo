"""Verify renamed predictors against the original research bytes, without connectors."""
import json
from hashlib import sha256
from pathlib import Path


MAPPING = json.loads((Path(__file__).resolve().parents[2] /
                      "docs/research/personal-order-source-mapping.json").read_text())


def copied_block(source, markers):
    return source.split(markers[0], 1)[1].split(markers[1], 1)[0]


def original_math(product_source):
    # Reverse only the documented text substitutions, including comments and names.
    # Any change to calculations or whitespace still fails the original byte digest.
    source = product_source
    for old, new in reversed(MAPPING["mathRenames"]):
        source = source.replace(new, old)
    copied = copied_block(source, MAPPING["originalMarkers"])
    assert sha256(copied.encode()).hexdigest() == MAPPING["copiedSha256"]
    return copied


def renamed_reference(source):
    for old, new in MAPPING["mathRenames"] + MAPPING["referenceRenames"]:
        source = source.replace(old, new)
    return source

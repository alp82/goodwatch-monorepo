"""Render separate similarity and metadata generation contracts from the approved selection."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "generation"
SIM_VERSION = "2.0.0-similarity.1"
META_VERSION = "2.0.0-metadata.1"


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def object_schema(properties):
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


def render():
    OUT.mkdir(exist_ok=True)
    registry_bytes = (HERE.parent / "definition.json").read_bytes()
    registry = json.loads(registry_bytes)
    mapping_bytes = (HERE / "mapping.json").read_bytes()
    mapping = json.loads(mapping_bytes)
    assert hashlib.sha256(registry_bytes).hexdigest() == mapping["registry_sha256"]
    groups = registry["attribute_groups"]
    files = {}
    for lane, version in (("similarity", SIM_VERSION), ("metadata", META_VERSION)):
        rows = [r for r in mapping["fields"] if (r["destination"] == "fingerprint") == (lane == "similarity")]
        definitions, score_groups = {}, {}
        for row in rows:
            group, key = row["field"].split(".")
            spec = groups[group][key]
            definitions.setdefault(group, {})[key] = {
                "definition": spec["definition"], "measurement": spec["measurement"],
                "applicability": spec["applicability"],
            }
            score_groups.setdefault(group, {})[key] = {"type": ["integer", "null"], "minimum": 0, "maximum": 10}
        props = {
            "format_version": {"const": version}, "title": {"type": "string", "minLength": 1},
            "year": {"type": "integer"},
            "attribute_groups": object_schema({g: object_schema(p) for g, p in score_groups.items()}),
        }
        definition = {
            "format_version": version, "source_registry_version": registry["version"],
            "score_count": len(rows), "attribute_groups": definitions,
            "rubrics": {k: v for k, v in registry["scoring_contract"]["rubrics"].items()
                        if k in {r["measurement"] for r in rows}},
            "scope_rule": registry["scoring_contract"]["scope"],
            "coexistence": "Dimensions are independent; opposing or related traits can coexist. Do not force their scores to sum to a fixed total.",
        }
        if lane == "metadata":
            presence = {f"{g}.{k}": s["presence_definition"] for g, attrs in groups.items()
                        for k, s in attrs.items() if "presence_definition" in s}
            assert len(presence) == 146
            definition["content_presence_definitions"] = presence
            definition["presence_rule"] = "Score centrality and occurrence independently. Unknown is not absent. Inapplicable is not absent. Positive centrality with applicable absent presence is inconsistent."
            presence_spec = object_schema({
                "presence": {"type": "string", "enum": ["present", "absent", "unknown"]},
                "applicability": {"type": "string", "enum": ["applicable", "not_applicable", "unknown"]},
            })
            props["content_presence"] = object_schema({key: presence_spec for key in presence})
        schema = {"$schema": "https://json-schema.org/draft/2020-12/schema", **object_schema(props)}
        files[f"{lane}.definition.json"] = encoded(definition)
        files[f"{lane}.schema.json"] = encoded(schema)

    files["similarity.SYSTEM.txt"] = ("""Generate a GoodWatch similarity fingerprint for the supplied title and scope, using the supplied definitions and scoring rubrics. Use your knowledge of the exact work plus the supplied title information; the synopsis is a summary, not the limit of your knowledge. Do not research with tools.

Assess every one of the 258 requested attributes independently. Return exactly the required JSON object, using the supplied canonical group/key names and format_version. All scores are integers from 0 to 10. No presence sidecar, metadata, quality evaluations, explanations, Markdown or extra fields.

Aim for a complete numeric fingerprint by making your best supported assessment of the work as a whole. Score weak and absent traits as well as prominent traits. Use 0 when the attribute's rubric supports zero: intensity/frequency zero means the trait is absent; centrality zero means it has no narrative importance, even if a minor occurrence exists. Do not leave an entire low-relevance group unassessed just because it is not a central part of this title. Do not infer factual absence merely from synopsis silence. Do not assign zero solely because you cannot recall or assess the trait.

Null is an explicit exception for genuine inability to assess, conflicting knowledge, or uncertain identity/scope; retain it rather than inventing a score. A null-bearing response will be stored for completion and will not become a published vector. Do not use null as shorthand for a supported zero. All selected dimensions apply to movies and shows; there are no movie-specific series NAs in this request.

Separate literal world mechanisms from metaphor and subjective tone. Judge centrality within the depicted work, not its real-world reception or your opinion of its quality. Related and opposing traits may coexist. Before returning, check all requested keys, ranges and whether any zeros or nulls reflect uncertainty rather than an assessment. Return your first completed assessment only.
""").encode()
    files["metadata.SYSTEM.txt"] = ("""Generate the separate GoodWatch metadata assessment for the supplied exact title and scope. Use title knowledge plus supplied information; no tool research. Return only the supplied JSON shape: format_version, title, year, attribute_groups and content_presence. Emit the 296 requested integer-or-null scores and 146 typed presence entries. This is not a similarity vector and is not a complete advisory or title-analysis record.

Use each definition and rubric independently. Preserve unknown or unassessed scores as null; movies have null show-only series traits. Distinguish no narrative importance from verified absence. Presence is present/absent/unknown with separate applicability; never turn lack of recall or synopsis silence into absent. Positive centrality and applicable absent presence for the same concept must not coexist. Quality is not intensity; poor execution is different from not applicable. Do not include the similarity scores, previous model outputs, explanations or Markdown.
""").encode()
    files["vector.schema.json"] = encoded({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        **object_schema({"format_version": {"const": SIM_VERSION},
                         "projection_version": {"const": mapping["version"]},
                         "title": {"type": "string", "minLength": 1}, "year": {"type": "integer"},
                         "scores": {"type": "array", "minItems": 258, "maxItems": 258,
                                    "items": {"type": "integer", "minimum": 0, "maximum": 10}}}),
    })
    for name, body in files.items():
        (OUT / name).write_bytes(body)
    manifest = {
        "status": "approved_selection_benchmark_contract_not_production",
        "similarity_version": SIM_VERSION, "metadata_version": META_VERSION,
        "registry_sha256": mapping["registry_sha256"],
        "mapping_sha256": hashlib.sha256(mapping_bytes).hexdigest(),
        "ordered_similarity_fields": mapping["ordered_fields"],
        "counts": {"similarity": 258, "metadata_scores": 296, "metadata_presence": 146},
        "wire_keys": "canonical group.key; no measurement suffixes",
        "vector_scaling": "Raw ordinal scores only. Retrieval metric, weights and normalized serving representation remain separate.",
        "files": {name: {"sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body)} for name, body in files.items()},
    }
    (OUT / "manifest.json").write_bytes(encoded(manifest))
    print(json.dumps({"path": str(OUT), "manifest_sha256": hashlib.sha256((OUT / 'manifest.json').read_bytes()).hexdigest(),
                      "files": manifest["files"]}, indent=2))


if __name__ == "__main__":
    render()

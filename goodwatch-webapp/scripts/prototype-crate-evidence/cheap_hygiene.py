"""Conservative prose-only catalog identity audit; no retrieval/model calls.

No title IDs, request text, paid plans, or broad tag-substring exclusions.
Attraction identity is a product-scope flag, not a claim the work is unavailable.
CLI scans every supplied frozen row and writes a reviewable inventory.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path


def _sentences(text):
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+|\n+', text or '') if s.strip()]


def candidate_hygiene(row):
    """Return supported identity flags; absence means unknown/keep, not proof."""
    prose = ' '.join(row.get(k) or '' for k in ('essence_text', 'synopsis'))
    sentences = _sentences(prose)
    reasons = []
    identity = []
    for sentence in sentences:
        # Identity attribution must describe this work/experience, not adaptation
        # origin, plot setting, or a generic metaphorical "thrill ride".
        if re.search(r'\b(?:designed|created|built)\s+as\s+(?:an?\s+)?(?:immersive\s+)?(?:theme|amusement)\s+park\s+(?:attraction|ride)\b', sentence, re.I):
            identity.append(sentence)
        elif re.search(r'\b(?:in\s+)?this\s+(?:all[ -]new\s+|new\s+)?ride\s+at\s+\w', sentence, re.I):
            identity.append(sentence)
        elif re.search(r'\b(?:this|the)\s+(?:thrilling\s+)?ride\s+(?:combines|uses|features)\b', sentence, re.I) and re.search(r'\bsimulat(?:ion|or)\b', sentence, re.I):
            identity.append(sentence)
    corroboration = [s for s in sentences if re.search(r'\b(?:simulat(?:ion|or) technology|(?:3[ -]?d|360[ -]degree).{0,100}(?:imagery|screens)|audience.{0,70}(?:rocked|seated|motion)|immersive theme park attraction)\b', s, re.I)]
    if identity and corroboration:
        reasons.append({'kind': 'attraction_identity', 'scope': 'Separate from ordinary film/series results unless attraction experiences are requested; not evidence of nonrelease.', 'identity_spans': identity, 'corroborating_spans': corroboration})
    pilot_identity = [s for s in sentences if re.search(r'\bthis\s+is\s+(?:the\s+)?(?:original\s+)?(?:tv\s+|television\s+)?pilot\s+(?:version|episode)\b', s, re.I)]
    nonrelease = [s for s in sentences if re.search(r'\b(?:unaired|unreleased|never (?:aired|broadcast|released)|(?:not|never) released|did not released|failed to become a series)\b', s, re.I)]
    release_conflict = [s for s in sentences if re.search(r'\b(?:this (?:pilot|episode|version) (?:was|has been) released|premiered the series|series premiered|picked up.{0,50}premiered)\b', s, re.I)]
    if pilot_identity and nonrelease and not release_conflict:
        reasons.append({'kind': 'standalone_nonreleased_pilot', 'scope': 'Exclude from ordinary released-title results; retain audit evidence.', 'identity_spans': pilot_identity, 'corroborating_spans': nonrelease})
    return reasons


def audit(sample_path):
    raw = Path(sample_path).read_bytes()
    rows = json.loads(raw)
    flagged = []
    for row in rows:
        reasons = candidate_hygiene(row)
        if reasons:
            flagged.append({'key': f"{row['media_type']}:{row['tmdb_id']}", 'title': row['title'], 'year': row.get('release_year'), 'reasons': reasons, 'essence_text': row.get('essence_text'), 'synopsis': row.get('synopsis')})
    return {'detector_version': 1, 'rows_scanned': len(rows), 'sample_sha256': hashlib.sha256(raw).hexdigest(), 'model_calls': 0, 'db_calls': 0, 'flags': flagged, 'limitations': ['Conservative high-precision prose patterns are intentionally incomplete.', 'Attraction flags describe identity and ordinary-search scope, not work quality or availability.', 'Tags, venue alone, ride adaptations/settings and historical pilot mentions do not trigger exclusion.', 'No flag means unknown/keep, not certified ordinary format.']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sample', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.write_text(json.dumps(audit(args.sample), ensure_ascii=False, indent=2) + '\n')

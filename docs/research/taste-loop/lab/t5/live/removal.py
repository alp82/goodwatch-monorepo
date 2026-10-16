"""Live-only closure: explicit aliases, movie series, normalized movie namesakes and production's franchise prefix.

The cutoff pack contains cast person IDs, but no character identities or character credits, so same-character links
across franchise ids are removed only when production's own `franchiseOf` title prefix matches.
"""
import re
import unicodedata

from ..cases import forbidden as original_forbidden


def normalized_title(title):
    folded = unicodedata.normalize('NFKC', title or '').casefold()
    return ' '.join(''.join(c if c.isalnum() else ' ' for c in folded).split())


def franchise_of(title):
    """Python copy of production `franchiseOf` (live `sides.server.ts`); parity is tested against the pinned TS."""
    text = re.sub(r'^(the|a|an) ', '', (title or '').lower(), count=1)
    text = re.split(r':| - | part ', text)[0]
    return re.sub(r'\s+(\d+|ii|iii|iv|v|vi)$', '', text).strip()


def forbidden(named, titles):
    blocked = set(named)
    while True:
        previous = blocked.copy()
        blocked = original_forbidden(blocked, titles)
        names = {normalized_title(t.get('title')) for t in titles if t['key'] in blocked}
        names.discard('')
        blocked.update(t['key'] for t in titles if t['media_type'] == 'movie'
                       and normalized_title(t.get('title')) in names)
        prefixes = {franchise_of(t.get('title')) for t in titles if t['key'] in blocked}
        prefixes.discard('')
        blocked.update(t['key'] for t in titles if t['media_type'] == 'movie'
                       and franchise_of(t.get('title')) in prefixes)
        if blocked == previous:
            return blocked

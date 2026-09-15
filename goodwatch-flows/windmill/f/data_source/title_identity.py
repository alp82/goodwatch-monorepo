"""Authoritatively resolved historical movie aliases; TV IDs are independent.

Verified against TMDB details and matching IMDb identities on 2026-09-15.
Mongo provider_identity_unresolved retains original quarantine provenance.
"""

RETIRED_MOVIE_IDS = {5338654: 658039, 3635601: 872517, 162483: 10679}


def canonical_title_id(media_type: str, tmdb_id: int) -> int:
    tmdb_id = int(tmdb_id)
    return RETIRED_MOVIE_IDS.get(tmdb_id, tmdb_id) if media_type == "movie" else tmdb_id


def main():
    pass

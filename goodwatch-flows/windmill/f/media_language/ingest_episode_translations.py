"""Independent, additive companion to tmdb_fetch_episodes_from_api. No catalog deletions."""
from f.media_language.episode_translations import Bounds, ingest_titles


def main(tmdb_ids: list[int], dry_run: bool = True, max_requests: int = 250,
         max_seasons: int = 10, max_episodes: int = 100,
         max_seasons_per_title: int | None = None, max_episodes_per_title: int | None = None,
         resume: list[dict] | None = None):
    # Windmill can pass None for omitted arguments; omission always stays read-only.
    dry_run = dry_run is not False
    tmdb_ids = tmdb_ids or []
    max_requests = max_requests or 250
    bounds = Bounds(titles=100, seasons=max_seasons or 10, episodes=max_episodes or 100,
                    requests=max_requests, seasons_per_title=max_seasons_per_title,
                    episodes_per_title=max_episodes_per_title)
    import requests
    import wmill
    token = wmill.get_variable('u/Alp/TMDB_API_KEY')

    def get(path):
        response = requests.get('https://api.themoviedb.org/3/' + path,
                                params={'api_key': token}, timeout=(5, 30))
        response.raise_for_status()
        return response.json()

    connector = None
    try:
        if not dry_run:
            from f.db.cratedb import CrateConnector
            connector = CrateConnector()
        return ingest_titles(tmdb_ids, get, connector, dry_run=dry_run, bounds=bounds, resume=resume)
    finally:
        if connector:
            connector.disconnect()

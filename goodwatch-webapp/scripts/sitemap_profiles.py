"""Member profiles (/u/<handle>) for sitemap_profiles.xml: members with a handle whose scores are public and who have
enough of them that the profile page is indexed (docs/implementation/member-profile/README.md, Q5).

The page decides `indexable` from scores the catalog still has (at least 20, app/server/profile/page.server.ts). A
score whose title left the catalog still has a row here, so a listed profile can answer noindex; the Windmill flow
(f/seo/regenerate_sitemaps.py) leaves profiles that fail the live check out instead of failing the whole publish."""
import json
from datetime import date
from typing import List, Optional, Tuple

BASE_URL = "https://goodwatch.app"
# INDEX_MIN_SCORES in app/server/profile/page.server.ts (owner decision Q5).
MIN_SCORES = 20
HANDLE_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789_")


def scores_public(raw: Optional[str]) -> bool:
    """profile_visibility is a JSON object of part -> audience; unset or unreadable means everything is public."""
    if not raw:
        return True
    try:
        value = json.loads(raw)
    except (TypeError, ValueError):
        return True
    if not isinstance(value, dict):
        return True
    audience = value.get("scores")
    return audience not in ("members", "me")


def valid_handle(handle) -> bool:
    return (isinstance(handle, str) and 3 <= len(handle) <= 30 and handle[0].isalpha()
            and handle[0] in HANDLE_CHARS and set(handle) <= HANDLE_CHARS)


def select_profiles(cursor) -> List[Tuple[str, Optional[date]]]:
    """(URL, lastmod) pairs, by handle. lastmod is the day of the member's latest score change."""
    cursor.execute(
        "SELECT p.user_id, p.handle, count(*), max(s.updated_at) FROM doc.user_profile p "
        "JOIN doc.user_score s ON s.user_id = p.user_id "
        "WHERE p.deleted_at IS NULL AND p.handle IS NOT NULL AND s.score IS NOT NULL AND s.score > 0 "
        "GROUP BY p.user_id, p.handle HAVING count(*) >= ?", [MIN_SCORES])
    members = {user_id: (handle, updated) for user_id, handle, _count, updated in cursor.fetchall()
               if valid_handle(handle)}
    if not members:
        return []
    cursor.execute("SELECT user_id, value FROM doc.user_setting WHERE key = 'profile_visibility' AND user_id = ANY(?)",
                   [list(members)])
    hidden = {user_id for user_id, value in cursor.fetchall() if not scores_public(value)}
    urls = []
    for user_id, (handle, updated) in members.items():
        if user_id in hidden:
            continue
        # Crate returns timestamps as epoch milliseconds.
        lastmod = date.fromtimestamp(updated / 1000) if isinstance(updated, (int, float)) and updated > 0 else None
        urls.append((f"{BASE_URL}/u/{handle}", lastmod))
    return sorted(urls)

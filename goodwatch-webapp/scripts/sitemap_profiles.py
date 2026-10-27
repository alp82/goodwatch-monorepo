"""Dormant member-profile eligibility, held out until an internal discovery route exists.

Member profiles (/u/<handle>) for sitemap_profiles.xml: members with a handle whose scores are public and who have
enough of them that the profile page is indexed (docs/implementation/member-profile/README.md, Q5).

The page decides `indexable` from scores the catalog still has (at least 20, app/server/profile/page.server.ts). A
score whose title left the catalog still has a row here, so a listed profile can answer noindex; the Windmill flow
(f/seo/regenerate_sitemaps.py) leaves profiles that fail the live check out instead of failing the whole publish.

Members whose profile went public with the release (created before PROFILE_PUBLIC_SINCE in app/domain/profile.ts) stay
out until they confirm Who sees what on Edit profile (profile_public_notice_seen = "yes"); the page answers noindex
until then (owesProfilesStrip)."""
import json
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

# Held out until public profiles have an intended internal discovery route.
# This affects sitemap inclusion only; profile pages keep their indexing policy.
PROFILES_IN_SITEMAP = False

BASE_URL = "https://goodwatch.app"
# INDEX_MIN_SCORES in app/server/profile/page.server.ts (owner decision Q5).
MIN_SCORES = 20
# PROFILE_PUBLIC_SINCE in app/domain/profile.ts, as epoch milliseconds.
PUBLIC_SINCE_MS = int(datetime(2026, 10, 23, 2, 30, tzinfo=timezone.utc).timestamp() * 1000)
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
    if not PROFILES_IN_SITEMAP:
        return []
    cursor.execute(
        "SELECT p.user_id, p.handle, count(*), max(s.updated_at), p.created_at FROM doc.user_profile p "
        "JOIN doc.user_score s ON s.user_id = p.user_id "
        "WHERE p.deleted_at IS NULL AND p.handle IS NOT NULL AND s.score IS NOT NULL AND s.score > 0 "
        "GROUP BY p.user_id, p.handle, p.created_at HAVING count(*) >= ?", [MIN_SCORES])
    rows = cursor.fetchall()
    members = {user_id: (handle, updated) for user_id, handle, _count, updated, _created in rows
               if valid_handle(handle)}
    # Created before the release, or with no date: needs the member's confirmation.
    unconfirmed = {user_id for user_id, _h, _c, _u, created in rows
                   if user_id in members and not (isinstance(created, (int, float)) and created >= PUBLIC_SINCE_MS)}
    if not members:
        return []
    cursor.execute("SELECT user_id, key, value FROM doc.user_setting "
                   "WHERE key IN ('profile_visibility', 'profile_public_notice_seen') AND user_id = ANY(?)",
                   [list(members)])
    hidden = set()
    for user_id, key, value in cursor.fetchall():
        if key == "profile_visibility" and not scores_public(value):
            hidden.add(user_id)
        elif key == "profile_public_notice_seen" and value == "yes":
            unconfirmed.discard(user_id)
    hidden |= unconfirmed
    urls = []
    for user_id, (handle, updated) in members.items():
        if user_id in hidden:
            continue
        # Crate returns timestamps as epoch milliseconds.
        lastmod = date.fromtimestamp(updated / 1000) if isinstance(updated, (int, float)) and updated > 0 else None
        urls.append((f"{BASE_URL}/u/{handle}", lastmod))
    return sorted(urls)

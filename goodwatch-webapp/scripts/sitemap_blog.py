"""The blog URLs of sitemap_static.xml, read from app/content/blog/posts.json. Why they carry dates: docs/sitemap.md.

posts.json is the single list of posts: a JSON array of
{"slug": "...", "published": "YYYY-MM-DD", "updated": "YYYY-MM-DD", "draft": true|false}. A draft renders at its
address with robots noindex, nofollow, so it is left out here, as it is on /blog and in the feed
(app/utils/blog-posts.ts). Other keys are ignored."""
from datetime import date
from typing import List, Optional, Tuple
import json
import os
import re

SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ISO_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _day(value, field: str, slug: str) -> date:
    if not isinstance(value, str) or not ISO_DAY.match(value):
        raise ValueError(f"Blog post {slug!r}: {field} must be a YYYY-MM-DD date, got {value!r}")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"Blog post {slug!r}: {field} is not a real date: {value!r}") from None


def read_blog_posts(path: str, today: Optional[date] = None) -> List[dict]:
    """Returns the published posts as {"slug", "published", "updated"} with dates, sorted by slug. Drafts are left out.

    A missing file means no posts. Anything that would list a broken or falsely dated URL fails:
    a bad slug, a bad date, updated before published or after today, a duplicate slug, or a draft flag that isn't
    true or false. A draft's dates aren't checked against today, since it isn't listed."""
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as posts_file:
        try:
            raw = json.load(posts_file)
        except json.JSONDecodeError as error:
            raise ValueError(f"{path} is not valid JSON: {error}") from None
    if not isinstance(raw, list):
        raise ValueError(f"{path} must hold a JSON array of posts")

    posts = {}
    drafts = set()
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError(f"Every entry of {path} must be an object, got {item!r}")
        slug = item.get("slug")
        if not isinstance(slug, str) or not SLUG.match(slug):
            raise ValueError(f"Blog post slug must match {SLUG.pattern}, got {slug!r}")
        if slug in posts or slug in drafts:
            raise ValueError(f"Blog post {slug!r} is listed twice")
        draft = item.get("draft", False)
        if not isinstance(draft, bool):
            raise ValueError(f"Blog post {slug!r}: draft must be true or false, got {draft!r}")
        published = _day(item.get("published"), "published", slug)
        updated = _day(item.get("updated"), "updated", slug)
        if updated < published:
            raise ValueError(f"Blog post {slug!r}: updated {updated} is before published {published}")
        if draft:
            drafts.add(slug)
            continue
        if today is not None and updated > today:
            raise ValueError(f"Blog post {slug!r}: updated {updated} is after today ({today})")
        posts[slug] = {"slug": slug, "published": published, "updated": updated}
    return [posts[slug] for slug in sorted(posts)]


def blog_urls(base_url: str, posts: List[dict]) -> List[Tuple[str, date]]:
    """(URL, lastmod) pairs: the blog index with the newest updated date, then each post with its own."""
    if not posts:
        return []
    return [(f"{base_url}/blog", max(post["updated"] for post in posts))] + [
        (f"{base_url}/blog/{post['slug']}", post["updated"]) for post in posts]

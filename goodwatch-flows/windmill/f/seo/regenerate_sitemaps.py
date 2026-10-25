# requirements:
# crate==2.2.1
# python-dotenv==1.1.1
# wmill==1.806.0

"""Run the repository's sitemap generator and live gate, then publish one commit."""
import hashlib
import html
import importlib.util
import json
import re
import sys
import tempfile
import time
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

import wmill
from crate import client

REPOSITORY = "alp82/goodwatch-monorepo"
API = f"https://api.github.com/repos/{REPOSITORY}"
OUTPUT = "goodwatch-webapp/public/sitemaps/"
SCRIPTS = "goodwatch-webapp/scripts/"
CATEGORIES = "goodwatch-webapp/app/ui/explore/category/"
BLOG_POSTS = "goodwatch-webapp/app/content/blog/posts.json"
TOKEN_VARIABLE = "u/Alp/GITHUB_SITEMAP_TOKEN"
SOURCE_FILES = [SCRIPTS + name for name in (
    "create_sitemaps.py", "check_sitemap_urls.py", "sitemap_query.py",
    "sitemap_lastmod.py", "sitemap_selection.py", "sitemap_people.py", "sitemap_profiles.py", "sitemap_crate.py",
    "sitemap_blog.py", "sitemap_new.py",
    "utils.py",
)] + [CATEGORIES + name + ".ts" for name in ("moods", "streaming", "genres")] + [BLOG_POSTS]


def request(url, method="GET", data=None, token=None, raw=False):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "goodwatch-sitemaps",
               "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = Request(url, method=method, headers=headers,
                  data=json.dumps(data).encode() if data is not None else None)
    try:
        with urlopen(req, timeout=60) as response:
            body = response.read()
    except HTTPError as error:
        raise RuntimeError(f"GitHub request failed: HTTP {error.code}") from None
    except URLError:
        raise RuntimeError("GitHub request failed: network error") from None
    return body if raw else json.loads(body)


def snapshot():
    head = request(API + "/git/ref/heads/main")["object"]["sha"]
    tree = request(API + f"/git/trees/{head}?recursive=1")
    if tree.get("truncated"):
        raise RuntimeError("GitHub tree is truncated; refusing incomplete comparison")
    return head, tree["sha"], {item["path"]: item["sha"] for item in tree["tree"]
                              if item["type"] == "blob"}


def load_sources(root, head):
    for path in SOURCE_FILES:
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(request(
            f"https://raw.githubusercontent.com/{REPOSITORY}/{head}/{path}", raw=True))


def load_previous(root, head, existing):
    """Read the previous artifacts from the same pinned revision as the code."""
    directory = root / "previous-sitemaps"
    directory.mkdir()
    for path in existing:
        if path.startswith(OUTPUT) and "/" not in path[len(OUTPUT):] and Path(path).match("sitemap*.xml"):
            (directory / Path(path).name).write_bytes(request(
                f"https://raw.githubusercontent.com/{REPOSITORY}/{head}/{path}", raw=True))


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# The live check's reasons (check_sitemap_urls.judge) that say a page is gone or kept out of the index.
LEFT_PAGE = re.compile(r"^(status (404|410)|robots meta tag says .*noindex.*|X-Robots-Tag says .*noindex.*)$", re.I)


def page_left(reason):
    """Whether a failed live check says the page itself left (gone, or noindex), not that the check couldn't tell."""
    return bool(LEFT_PAGE.match(reason))


PREVIOUS_URL = re.compile(r"<url>\s*<loc>([^<]+)</loc>(?:\s*<lastmod>(\d{4}-\d{2}-\d{2})</lastmod>)?")


def new_on_services_sitemap(generator, root):
    """sitemap_new.xml from the site's pages index (sitemap_new.py). When the index fails, is incomplete or lists no
    page, the previous file's pages are written again: a bad read never empties or shortens the published file, and
    the live check still leaves out a page that emptied since."""
    try:
        return generator.create_new_sitemap()
    except Exception as error:
        # The site's own answer (an HTTP error, a timeout, an incomplete index); it holds no secret, but the class says
        # enough.
        print(f"Keeping the previous sitemap_new.xml: the pages index failed ({type(error).__name__})", flush=True)
    previous = root / "previous-sitemaps" / "sitemap_new.xml"
    if not previous.exists():
        return {"pages": [], "lastmod": None}
    pages = [(html.unescape(loc), date.fromisoformat(day) if day else None)
             for loc, day in PREVIOUS_URL.findall(previous.read_text())]
    return generator.write_new_sitemap(pages)


def generate_and_check(root):
    """Import the exact same generator/checker used by make sitemaps-checked."""
    scripts = root / SCRIPTS
    sys.path.insert(0, str(scripts))
    try:
        generator = load_module("sitemap_generator", scripts / "create_sitemaps.py")
        checker = load_module("sitemap_checker", scripts / "check_sitemap_urls.py")
        output = root / OUTPUT
        output.mkdir(parents=True)
        generator.SITEMAP_DIR = str(output)
        generator.prepare_sitemaps(root / "previous-sitemaps")
        # Same workspace variables and connection format as f/db/cratedb.
        connection = None
        profiles = {"profiles": []}
        new_pages = {"pages": []}
        lastmods = {}
        try:
            connection = client.connect(
                wmill.get_variable("u/Alp/CRATE_HOSTS").split(","),
                username=wmill.get_variable("u/Alp/CRATE_USER"),
                password=wmill.get_variable("u/Alp/CRATE_PASS"),
                timeout=180,
            )
            cursor = connection.cursor()
            try:
                movies = generator.create_detail_sitemaps(cursor, "movie")
                shows = generator.create_detail_sitemaps(cursor, "show")
                categories = generator.create_category_sitemaps()
                static = generator.create_landing_sitemaps()
                people = generator.create_person_sitemap(cursor, {
                    "movie": movies["title_ids"], "show": shows["title_ids"],
                })
                profiles = generator.create_profile_sitemap(cursor)
                new_pages = new_on_services_sitemap(generator, root)
                lastmods = {
                    "movie": movies["lastmod"], "show": shows["lastmod"],
                    "static": static["lastmod"], "categories": categories["lastmod"], "people": people["lastmod"],
                    "profiles": profiles["lastmod"],
                    "new": new_pages["lastmod"],
                }
                generator.create_master_sitemap_index(lastmods)
            finally:
                cursor.close()
        except Exception:
            # Database exceptions can contain private connection details.
            raise RuntimeError("Sitemap generation failed; check CrateDB access and generator compatibility") from None
        finally:
            if connection is not None:
                connection.close()
        urls, problems = checker.read_sitemap_urls(str(output))
        print(f"Generated {len(urls)} URLs; checking every URL live", flush=True)
        # A listed URL that the live robots.txt disallows fails; a page larger than Google reads warns.
        robots, robots_problem = checker.fetch_robots()
        if robots_problem:
            problems.append(robots_problem)
        time.sleep(checker.MIN_DELAY_SECONDS)
        warnings = []
        failures = checker.check_urls(
            urls, checker.fetch, lambda: time.sleep(checker.MIN_DELAY_SECONDS),
            lambda line: print(line, flush=True), robots, warnings,
        )
        print(checker.summary(len(urls), failures, problems, warnings), flush=True)
        # A member profile that left (its owner hid their scores or lost some since the list was read: noindex, or 404
        # when it is gone) is left out; it doesn't hold up the rest of the sitemaps. Any other failure (5xx, a timeout,
        # a redirect) says nothing about the profile and stays fatal, so nothing is committed.
        profile_failures = [(url, reason) for url, reason in failures
                            if urlparse(url).path.startswith("/u/") and page_left(reason)]
        if profile_failures:
            for url, reason in profile_failures:
                print(f"Leaving out profile {url}: {reason}", flush=True)
            skip = {url for url, _ in profile_failures}
            lastmods["profiles"] = generator.write_profile_sitemap(profiles["profiles"], skip)["lastmod"]
            generator.create_master_sitemap_index(lastmods)
            failures = [failure for failure in failures if failure not in profile_failures]
            urls = [url for url in urls if url not in skip]
        # A /new page whose titles aged out of its window since the list was read answers noindex (or 404 when it is
        # gone): left out too. Any other failure (5xx, a timeout, a redirect) says nothing about the page and stays
        # fatal, so nothing is committed and the previous files stay.
        new_failures = [(url, reason) for url, reason in failures
                        if urlparse(url).path.startswith("/new/") and page_left(reason)]
        if new_failures:
            for url, reason in new_failures:
                print(f"Leaving out new-on-services page {url}: {reason}", flush=True)
            skip = {url for url, _ in new_failures}
            lastmods["new"] = generator.write_new_sitemap(new_pages["pages"], skip)["lastmod"]
            generator.create_master_sitemap_index(lastmods)
            failures = [failure for failure in failures if failure not in new_failures]
            urls = [url for url in urls if url not in skip]
        if failures or problems or not urls:
            raise RuntimeError(f"Sitemap check failed: {len(failures)} URLs, {len(problems)} file problems; nothing committed")
        return len(urls), {OUTPUT + p.name: p.read_bytes() for p in sorted(output.glob("sitemap*.xml"))}
    finally:
        sys.path.remove(str(scripts))
        for name in ("sitemap_lastmod", "sitemap_selection", "sitemap_people", "sitemap_profiles", "sitemap_query",
                     "sitemap_crate", "sitemap_blog", "sitemap_new", "utils"):
            sys.modules.pop(name, None)


def blob_sha(content):
    return hashlib.sha1(f"blob {len(content)}\0".encode() + content).hexdigest()


def changes_for(files, existing):
    def sitemap_path(path):
        return path.startswith(OUTPUT) and "/" not in path[len(OUTPUT):] and Path(path).match("sitemap*.xml")

    if not files or not all(sitemap_path(path) for path in files):
        raise ValueError("Refusing files outside the generated sitemap scope")
    changes = [{"path": path, "mode": "100644", "type": "blob", "content": content.decode("utf-8")}
               for path, content in files.items() if existing.get(path) != blob_sha(content)]
    changes += [{"path": path, "mode": "100644", "type": "blob", "sha": None}
                for path in sorted(existing) if sitemap_path(path) and path not in files]
    return changes


def publish(head, tree, changes):
    token = wmill.get_variable(TOKEN_VARIABLE)
    if not token:
        raise RuntimeError(f"Missing secret workspace variable {TOKEN_VARIABLE}")
    # Do not rebase stale generation over a newer main. The final non-force ref
    # update also rejects a race after this check, preserving concurrent changes.
    current = request(API + "/git/ref/heads/main", token=token)["object"]["sha"]
    if current != head:
        raise RuntimeError("main changed during the live check; rerun with fresh sources")
    new_tree = request(API + "/git/trees", "POST", {"base_tree": tree, "tree": changes}, token)
    today = datetime.now(timezone.utc).date().isoformat()
    commit = request(API + "/git/commits", "POST", {
        "message": f"chore(seo): regenerate the sitemap on {today} (#351)",
        "tree": new_tree["sha"], "parents": [head],
    }, token)
    request(API + "/git/refs/heads/main", "PATCH", {"sha": commit["sha"], "force": False}, token)
    return commit["sha"]


def main(dry_run: bool = True):
    head, tree, existing = snapshot()
    with tempfile.TemporaryDirectory(prefix="goodwatch-sitemaps-") as directory:
        root = Path(directory)
        load_sources(root, head)
        load_previous(root, head, existing)
        url_count, files = generate_and_check(root)
        changes = changes_for(files, existing)
        result = {"source_commit": head, "url_count": url_count, "check": "passed",
                  "changed_files": [item["path"] for item in changes], "dry_run": dry_run,
                  "commit": None}
        if changes and not dry_run:
            result["commit"] = publish(head, tree, changes)
        print(json.dumps(result), flush=True)
        return result

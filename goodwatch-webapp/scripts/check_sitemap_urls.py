"""Checks every URL that the sitemap files in a directory list, against the live site: the URL answers 200 without
a redirect, and the page's <link rel="canonical"> equals the listed URL. How and when to run it: docs/sitemap.md.
  uv run check_sitemap_urls.py [<directory>] [--delay <seconds>]
Each URL is requested once, with a pause between requests, so about 1,100 URLs take 50 minutes.
Exits 0 when every URL passes and 1 otherwise."""
from html.parser import HTMLParser
from typing import Callable, List, Optional, Tuple
from urllib.parse import urlsplit
import argparse
import glob
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ElementTree

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DIR = os.path.join(SCRIPT_DIR, "../public/sitemaps/")
SITE_HOST = "goodwatch.app"
# Names the check in the server logs, so that its requests can be told apart from visitors and crawlers.
USER_AGENT = "goodwatch-sitemap-check (+https://goodwatch.app)"
# The check runs against production. Two seconds between requests keep it far below what a crawler sends.
MIN_DELAY_SECONDS = 2.0
TIMEOUT_SECONDS = 30
# The canonical link is in the head. Reading stops there, or here for a page without one.
MAX_HTML_BYTES = 5_000_000
NAMESPACE = "{http://www.sitemaps.org/schemas/sitemap/0.9}"

# What one request returned: the status, the HTML up to the end of the head, and the Location header.
Response = Tuple[int, str, Optional[str]]


def read_sitemap_urls(directory: str) -> Tuple[List[str], List[str]]:
    """Reads every sitemap*.xml in the directory. Returns the listed page URLs, each once and in file order, and
    the problems of the files themselves: an index that names a file the directory lacks, or a file that is neither
    an index nor a URL set."""
    urls: List[str] = []
    problems: List[str] = []
    paths = sorted(glob.glob(os.path.join(directory, "sitemap*.xml")))
    if not paths:
        problems.append(f"no sitemap*.xml in {directory}")
    names = {os.path.basename(path) for path in paths}
    for path in paths:
        name = os.path.basename(path)
        try:
            root = ElementTree.parse(path).getroot()
        except ElementTree.ParseError as error:
            problems.append(f"{name}: not valid XML ({error})")
            continue
        locs = [(loc.text or "").strip() for loc in root.iter(f"{NAMESPACE}loc")]
        if root.tag == f"{NAMESPACE}sitemapindex":
            for loc in locs:
                listed = loc.rsplit("/", 1)[-1]
                if listed not in names:
                    problems.append(f"{name}: lists {loc}, and the directory has no {listed}")
        elif root.tag == f"{NAMESPACE}urlset":
            if not locs:
                problems.append(f"{name}: lists no URL")
            urls.extend(locs)
        else:
            problems.append(f"{name}: neither a sitemap index nor a URL set")
    return list(dict.fromkeys(urls)), problems


class CanonicalParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonicals: List[str] = []

    def handle_starttag(self, tag, attrs):
        if tag != "link":
            return
        attributes = dict(attrs)
        if "canonical" in (attributes.get("rel") or "").lower().split():
            self.canonicals.append(attributes.get("href") or "")


def find_canonicals(html: str) -> List[str]:
    """The href of every <link rel="canonical"> in the HTML."""
    parser = CanonicalParser()
    parser.feed(html)
    return parser.canonicals


def judge(loc: str, status: int, html: str, location: Optional[str] = None) -> Optional[str]:
    """The reason the URL fails, or None when it passes."""
    if 300 <= status < 400:
        return f"status {status}, redirects to {location or 'an unnamed URL'}"
    if status != 200:
        return f"status {status}"
    canonicals = find_canonicals(html)
    if not canonicals:
        return "no canonical link"
    if len(set(canonicals)) > 1:
        return f"several canonical links: {', '.join(canonicals)}"
    if canonicals[0] != loc:
        return f"canonical is {canonicals[0]}"
    return None


def check_urls(urls: List[str], fetch: Callable[[str], Response], pause: Callable[[], None],
               report: Callable[[str], None] = lambda line: None) -> List[Tuple[str, str]]:
    """Requests each URL once, pausing between requests. Returns (URL, reason) for every URL that fails."""
    failures: List[Tuple[str, str]] = []
    for index, url in enumerate(urls):
        if index:
            pause()
        parts = urlsplit(url)
        if parts.scheme != "https" or parts.netloc != SITE_HOST:
            reason: Optional[str] = f"not a URL on https://{SITE_HOST}, not requested"
        else:
            try:
                reason = judge(url, *fetch(url))
            except Exception as error:  # A URL without an answer fails; the run goes on to the next one.
                reason = f"no answer ({type(error).__name__}: {error})"
        if reason:
            failures.append((url, reason))
            report(f"FAIL {url}: {reason}")
        if (index + 1) % 50 == 0:
            report(f"{index + 1} of {len(urls)} checked, {len(failures)} failed")
    return failures


def summary(url_count: int, failures: List[Tuple[str, str]], problems: List[str]) -> str:
    lines = ["", "Sitemap check summary",
             f"  URLs checked: {url_count}",
             f"  Passed: {url_count - len(failures)}",
             f"  Failed: {len(failures)}",
             f"  Problems in the files: {len(problems)}"]
    lines += [f"  FAIL {url}: {reason}" for url, reason in failures]
    lines += [f"  FILE {problem}" for problem in problems]
    lines.append("Result: " + ("passed" if not failures and not problems and url_count else "FAILED"))
    return "\n".join(lines)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def fetch(url: str) -> Response:
    opener = urllib.request.build_opener(NoRedirect)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
            body = b""
            while b"</head>" not in body and len(body) < MAX_HTML_BYTES:
                chunk = response.read(65536)
                if not chunk:
                    break
                body += chunk
            return response.status, body.decode("utf-8", errors="replace"), None
    except urllib.error.HTTPError as error:
        return error.code, "", error.headers.get("Location")


def main() -> int:
    parser = argparse.ArgumentParser(description="Check every URL the sitemap files list against the live site.")
    parser.add_argument("directory", nargs="?", default=DEFAULT_DIR,
                        help="directory with the sitemap files (default: public/sitemaps)")
    parser.add_argument("--delay", type=float, default=MIN_DELAY_SECONDS,
                        help=f"seconds between requests, at least {MIN_DELAY_SECONDS:g}")
    args = parser.parse_args()
    if args.delay < MIN_DELAY_SECONDS:
        parser.error(f"--delay must be at least {MIN_DELAY_SECONDS:g} seconds")

    def report(line: str):
        print(line, flush=True)

    urls, problems = read_sitemap_urls(args.directory)
    report(f"Checking {len(urls)} URLs from {os.path.abspath(args.directory)}, {args.delay:g} seconds apart "
           f"(about {round(len(urls) * (args.delay + 0.7) / 60)} minutes)")
    failures = check_urls(urls, fetch, lambda: time.sleep(args.delay), report)
    report(summary(len(urls), failures, problems))
    return 0 if not failures and not problems and urls else 1


if __name__ == "__main__":
    sys.exit(main())

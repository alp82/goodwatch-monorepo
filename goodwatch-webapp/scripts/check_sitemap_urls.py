"""Checks every URL that the sitemap files in a directory list, against the live site: the URL answers 200 without
a redirect, the page's <link rel="canonical"> equals the listed URL, neither a robots meta tag nor an X-Robots-Tag
header says noindex, and the live robots.txt lets Googlebot fetch it. A page whose HTML is larger than Google reads
gets a warning. How and when to run it: docs/sitemap.md.
  uv run check_sitemap_urls.py [<directory>] [--delay <seconds>]
robots.txt and then each URL are requested once, with a pause between requests, so about 1,100 URLs take 50 minutes.
Exits 0 when every URL passes and 1 otherwise. Warnings don't change the exit code."""
from html.parser import HTMLParser
from typing import Callable, List, NamedTuple, Optional, Tuple
from urllib.parse import urlsplit
import argparse
import glob
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ElementTree

from sitemap_http import build_opener

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DIR = os.path.join(SCRIPT_DIR, "../public/sitemaps/")
SITE_HOST = "goodwatch.app"
# Names the check in the server logs, so that its requests can be told apart from visitors and crawlers.
USER_AGENT = "goodwatch-sitemap-check (+https://goodwatch.app)"
# The check runs against production. Two seconds between requests keep it far below what a crawler sends.
MIN_DELAY_SECONDS = 2.0
TIMEOUT_SECONDS = 30
# The canonical link and the robots meta tag are in the head: the HTML is kept up to its end, or this far for a page
# without one. The rest of the page is only counted.
MAX_HEAD_BYTES = 5_000_000
# Googlebot reads the first 2 MB of an HTML file, uncompressed, and leaves the rest out of indexing:
# https://developers.google.com/search/docs/crawling-indexing/googlebot. 2 MB is read as 2,000,000 bytes, the smaller
# reading, so that a page near the limit gets the warning.
GOOGLE_HTML_LIMIT_BYTES = 2_000_000
# Counting stops here, so a page that never ends can't hold up the run.
MAX_COUNTED_BYTES = 50_000_000
NAMESPACE = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
# The crawler whose rules in robots.txt apply, and whose name an X-Robots-Tag or meta tag may address.
CRAWLER = "googlebot"


class Response(NamedTuple):
    """What one request returned."""
    status: int
    # The HTML up to the end of the head.
    html: str
    location: Optional[str] = None
    # Every X-Robots-Tag header of the response.
    robots_headers: Tuple[str, ...] = ()
    # The size of the body in bytes, uncompressed; None when it wasn't read.
    size: Optional[int] = None


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


class RobotsMetaParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.directives: List[str] = []

    def handle_starttag(self, tag, attrs):
        if tag != "meta":
            return
        attributes = dict(attrs)
        if (attributes.get("name") or "").strip().lower() in ("robots", CRAWLER):
            self.directives.append(attributes.get("content") or "")


def find_robots_meta(html: str) -> List[str]:
    """The content of every robots meta tag in the HTML that Googlebot obeys: name="robots" or name="googlebot"."""
    parser = RobotsMetaParser()
    parser.feed(html)
    return parser.directives


def says_noindex(directives: str) -> bool:
    """Whether a list of robots rules, such as "noindex, follow", keeps the page out of the index."""
    return any(rule.strip().lower() in ("noindex", "none") for rule in directives.split(","))


def header_says_noindex(value: str) -> bool:
    """Whether an X-Robots-Tag header keeps the page out of Google's index. A header may address one crawler
    ("otherbot: noindex"); such a header counts only when it names Googlebot. A rule like "unavailable_after: <date>"
    is not a crawler's name."""
    named = re.match(r"\s*([A-Za-z][\w-]*)\s*:(.*)$", value)
    if named and named.group(1).lower() not in ("unavailable_after", "max-snippet", "max-image-preview",
                                                  "max-video-preview"):
        return named.group(1).lower() == CRAWLER and says_noindex(named.group(2))
    return says_noindex(value)


def judge(loc: str, status: int, html: str, location: Optional[str] = None,
          robots_headers: Tuple[str, ...] = (), size: Optional[int] = None) -> Optional[str]:
    """The reason the URL fails, or None when it passes. The size only warns, see warn()."""
    if 300 <= status < 400:
        return f"status {status}, redirects to {location or 'an unnamed URL'}"
    if status != 200:
        return f"status {status}"
    noindex_headers = [value for value in robots_headers if header_says_noindex(value)]
    if noindex_headers:
        return f"X-Robots-Tag says {noindex_headers[0]!r}, a sitemap lists pages to index"
    noindex_meta = [content for content in find_robots_meta(html) if says_noindex(content)]
    if noindex_meta:
        return f"robots meta tag says {noindex_meta[0]!r}, a sitemap lists pages to index"
    canonicals = find_canonicals(html)
    if not canonicals:
        return "no canonical link"
    if len(set(canonicals)) > 1:
        return f"several canonical links: {', '.join(canonicals)}"
    if canonicals[0] != loc:
        return f"canonical is {canonicals[0]}"
    return None


def warn(response: Response) -> Optional[str]:
    """A warning for a page that passes but that Google reads only in part, or None."""
    if response.status == 200 and response.size is not None and response.size > GOOGLE_HTML_LIMIT_BYTES:
        size = f"more than {MAX_COUNTED_BYTES:,}" if response.size >= MAX_COUNTED_BYTES else f"{response.size:,}"
        return (f"HTML is {size} bytes, Google reads only the first {GOOGLE_HTML_LIMIT_BYTES:,}: "
                f"what comes later is not indexed")
    return None


class RobotsRules:
    """The rules of a robots.txt for one crawler, read as Google reads them
    (https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec): the group that names the crawler, or
    else the * group; in a rule, * matches any characters and a final $ ends the path; the longest matching rule
    wins, and Allow wins a tie. urllib.robotparser knows neither * nor $, and the site's rules use both."""

    def __init__(self, text: str, crawler: str = CRAWLER):
        groups: List[Tuple[List[str], List[Tuple[bool, str]]]] = []
        agents: List[str] = []
        rules: List[Tuple[bool, str]] = []
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            field, value = (part.strip() for part in line.split(":", 1))
            field = field.lower()
            if field == "user-agent":
                if rules:  # A user-agent line after rules starts a new group.
                    groups.append((agents, rules))
                    agents, rules = [], []
                agents.append(value.lower())
            elif field in ("allow", "disallow") and agents:
                if value:  # An empty Disallow allows everything.
                    rules.append((field == "allow", value))
        if agents:
            groups.append((agents, rules))
        named = [rules for agents, rules in groups if crawler in agents]
        anyone = [rules for agents, rules in groups if "*" in agents]
        # Google merges every group that names the crawler, and falls back to * only without one.
        chosen = named or anyone
        self.rules = [rule for rules in chosen for rule in rules]

    @staticmethod
    def _matches(rule: str, path: str) -> bool:
        anchored = rule.endswith("$")
        pattern = "".join(".*" if char == "*" else re.escape(char) for char in (rule[:-1] if anchored else rule))
        return re.match(pattern + ("$" if anchored else ""), path) is not None

    def blocking_rule(self, url: str) -> Optional[str]:
        """The Disallow rule that keeps the crawler from the URL, or None when it may fetch it."""
        parts = urlsplit(url)
        path = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
        best: Optional[Tuple[int, bool, str]] = None
        for allow, rule in self.rules:
            if self._matches(rule, path):
                candidate = (len(rule), allow, rule)
                if best is None or candidate[:2] > best[:2]:
                    best = candidate
        return None if best is None or best[1] else best[2]


def check_urls(urls: List[str], fetch: Callable[[str], tuple], pause: Callable[[], None],
               report: Callable[[str], None] = lambda line: None,
               robots: Optional[RobotsRules] = None,
               warnings: Optional[List[Tuple[str, str]]] = None) -> List[Tuple[str, str]]:
    """Requests each URL once, pausing between requests. Returns (URL, reason) for every URL that fails, and adds
    (URL, warning) to `warnings` for a URL that passes with one. With `robots`, a URL that robots.txt keeps Googlebot
    from fails without being requested: a compliant crawler wouldn't request it either. The weekly Windmill job
    (goodwatch-flows/windmill/f/seo/regenerate_sitemaps.py) calls this from the file on main, so its signature only
    grows."""
    failures: List[Tuple[str, str]] = []
    if warnings is None:
        warnings = []
    requested = 0
    for index, url in enumerate(urls):
        parts = urlsplit(url)
        warning: Optional[str] = None
        blocking = robots.blocking_rule(url) if robots else None
        if parts.scheme != "https" or parts.netloc != SITE_HOST:
            reason: Optional[str] = f"not a URL on https://{SITE_HOST}, not requested"
        elif blocking:
            reason = f"robots.txt disallows it for Googlebot (Disallow: {blocking}), not requested"
        else:
            if requested:
                pause()
            requested += 1
            try:
                response = Response(*fetch(url))
                reason = judge(url, *response)
                warning = None if reason else warn(response)
            except Exception as error:  # A URL without an answer fails; the run goes on to the next one.
                reason = f"no answer ({type(error).__name__}: {error})"
        if reason:
            failures.append((url, reason))
            report(f"FAIL {url}: {reason}")
        if warning:
            warnings.append((url, warning))
            report(f"WARN {url}: {warning}")
        if (index + 1) % 50 == 0:
            report(f"{index + 1} of {len(urls)} checked, {len(failures)} failed")
    return failures


def summary(url_count: int, failures: List[Tuple[str, str]], problems: List[str],
            warnings: List[Tuple[str, str]] = ()) -> str:
    lines = ["", "Sitemap check summary",
             f"  URLs checked: {url_count}",
             f"  Passed: {url_count - len(failures)}",
             f"  Failed: {len(failures)}",
             f"  Warnings: {len(warnings)}",
             f"  Problems in the files: {len(problems)}"]
    lines += [f"  FAIL {url}: {reason}" for url, reason in failures]
    lines += [f"  WARN {url}: {warning}" for url, warning in warnings]
    lines += [f"  FILE {problem}" for problem in problems]
    lines.append("Result: " + ("passed" if not failures and not problems and url_count else "FAILED"))
    return "\n".join(lines)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def read_page(stream) -> Tuple[str, int]:
    """Reads a response body to its end, or to MAX_COUNTED_BYTES. Returns the HTML up to the end of the head and the
    number of bytes."""
    head = b""
    size = 0
    while size < MAX_COUNTED_BYTES:
        chunk = stream.read(65536)
        if not chunk:
            break
        size += len(chunk)
        if b"</head>" not in head and len(head) < MAX_HEAD_BYTES:
            head += chunk
    return head.decode("utf-8", errors="replace"), size


def fetch(url: str) -> Response:
    opener = build_opener(NoRedirect)
    # No Accept-Encoding: the body comes uncompressed, so its size is what Google's limit counts.
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with opener.open(request, timeout=TIMEOUT_SECONDS) as response:
            html, size = read_page(response)
            return Response(response.status, html, None, tuple(response.headers.get_all("X-Robots-Tag") or ()),
                            size)
    except urllib.error.HTTPError as error:
        with error:
            return Response(error.code, "", error.headers.get("Location"),
                            tuple(error.headers.get_all("X-Robots-Tag") or ()))


def fetch_robots(base: str = f"https://{SITE_HOST}") -> Tuple[Optional[RobotsRules], Optional[str]]:
    """The live robots.txt. Returns its rules, or a problem when it can't be read. Google reads a missing robots.txt
    (4xx) as no rules, and stops crawling the site when it can't get an answer (5xx, no response)."""
    request = urllib.request.Request(f"{base}/robots.txt", headers={"User-Agent": USER_AGENT})
    try:
        with build_opener().open(request, timeout=TIMEOUT_SECONDS) as response:
            return RobotsRules(response.read(MAX_HEAD_BYTES).decode("utf-8", errors="replace")), None
    except urllib.error.HTTPError as error:
        with error:
            if 400 <= error.code < 500:
                return RobotsRules(""), None
            return None, f"robots.txt: status {error.code}, Google crawls nothing while it can't read it"
    except Exception as error:
        return None, f"robots.txt: no answer ({type(error).__name__}: {error})"


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
    robots, robots_problem = fetch_robots()
    if robots_problem:
        problems.append(robots_problem)
        report(f"FILE {robots_problem}")
    time.sleep(args.delay)
    warnings: List[Tuple[str, str]] = []
    failures = check_urls(urls, fetch, lambda: time.sleep(args.delay), report, robots, warnings)
    report(summary(len(urls), failures, problems, warnings))
    return 0 if not failures and not problems and urls else 1


if __name__ == "__main__":
    sys.exit(main())

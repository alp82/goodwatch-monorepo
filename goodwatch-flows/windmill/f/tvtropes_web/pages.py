# extra_requirements:
# beautifulsoup4
# html5lib

"""Parsed TV Tropes work pages: identity check, trope list and subpage links.

Plain HTML, no browser. html5lib parses the page the way a browser does, so the
rules below read the same elements the earlier Playwright crawler read (for
example `<p><div>…</div></p>` becomes an empty paragraph, a div and another
empty paragraph). The identity rules were reviewed in #129 and are unchanged.
"""

import re
from functools import cached_property
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

from f.tvtropes_web.title_variations import slug
from f.utils.string import remove_prefix

BASE_URL = "https://tvtropes.org/pmwiki/pmwiki.php/"

YEAR = r"\b(?:18|19|20)\d{2}\b"
KIND = r"\b(film|movie|series|sitcom|television show|TV show|miniseries)\b"
# A year directly qualifying one of these dates the source, not this release.
SOURCE_WORK = r"(?:novel|novella|book|memoir|comic|graphic novel|short story|play|manga|musical|video game)"
SHARED_FILM_PAGE = r"\b(?:film series|film duology|two films|both films|two[- ]part film|two parts|two volumes)\b"
# A page whose subject IS a set of films ("The Godfather is a trilogy of
# American crime films"). The set noun must be the predicate of the defining
# verb: a comma, a preposition, a relative clause or a film/movie noun in
# between means the subject is one film that merely belongs to a set ("a 2003
# film, the third in the Y trilogy", "the first film in a trilogy", "a film
# that launched a franchise"). A possessive is not a verb: "the first movie in
# Sam Raimi's Spider-Man Trilogy" (Film/SpiderMan1) is one film.
COUNT = r"(?:\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"
FILM_SET = (
    r"(?:trilogy|tetralogy|duology|franchise|two[- ]part(?:er)?"
    r"|(?:film|movie) series"
    r"|(?:series|saga|set|pair|trio|quartet) of (?:" + COUNT + r" )?(?:[\w'’-]+ ){0,3}?(?:films|movies)"
    r"|" + COUNT + r" (?:[\w'’-]+ ){0,3}?(?:films|movies))"
)
DEFINED_AS_FILM_SET = (
    r"(?:\b(?:is|are|was|were|refers to|consists? of|comprises?|spans?)|\bit['’]s)\s+"
    r"(?:(?!(?:in|of|from|to|by|that|which|who|and|or|film|movie|films|movies)\b)[\w'’-]+\s+){0,6}?"
    + FILM_SET
    + r"\b"
)
# Country qualifiers TV Tropes appends to remakes; deliberately a closed set.
DISAMBIGUATION_SUFFIXES = {"US", "UK", "USA", "AU", "CA"}
# On a country-suffixed page a dated sentence in these terms is about the
# sibling production (HouseOfCardsUK: "In 2013, Netflix released an
# American-set original series"), not the work the page defines.
OTHER_PRODUCTION = r"\b(?:remake|remade|reboot|rebooted|[A-Z][a-z]+-set|(?:adaptation|version) of this|not to be confused)\b"
# Namespaces that hold a work page, never evidence for a single title.
WORK_NAMESPACES = {"Main", "Franchise", "Film", "Series", "Anime", "Animation", "WesternAnimation"}
# Subpages beyond this many mean something is off; refuse rather than guess.
MAX_PAGES = 20


def media_namespace(media_type: str) -> str:
    """`movie` → Film, `tv`/`show` → Series; Film and Series pass through."""
    return {"movie": "Film", "tv": "Series", "show": "Series"}.get(media_type, media_type)


def page_identity(url):
    parsed = urlparse(url or "")
    prefix = "/pmwiki/pmwiki.php/"
    if parsed.hostname not in ("tvtropes.org", "www.tvtropes.org") or not parsed.path.startswith(prefix):
        return "", ""
    parts = parsed.path[len(prefix):].split("/")
    return tuple(parts) if len(parts) == 2 else ("", "")


def normalize_url(url):
    """The canonical https://tvtropes.org form of a work page URL, or None."""
    namespace, name = page_identity(url)
    return BASE_URL + namespace + "/" + name if namespace and name else None


def allowed_namespaces(media_type):
    return {media_namespace(media_type), "WesternAnimation", "Animation", "Anime"}


def split_sentences(text):
    # "Vol. 1" and similar abbreviations do not end a sentence.
    return re.split(r"(?<!\bVol\.)(?<!\bNo\.)(?<!\bPt\.)(?<!\bvs\.)(?<=[.!?])\s+", text)


def year_suffixed_name(name, release_year, variations):
    """TV Tropes appends a release year only to tell same-titled works apart,
    so an exact `<title variation><catalog year>` page name dates the work."""
    stem = re.sub(r"(?:19|20)\d{2}$", "", name)
    return (
        bool(release_year)
        and name == stem + str(release_year)
        and any(stem.casefold() == v.casefold() for v in variations)
    )


# ===== Serialization that matches the browser's innerHTML =====

VOID_ELEMENTS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param",
                 "source", "track", "wbr", "keygen"}
RAW_TEXT_ELEMENTS = {"script", "style", "xmp", "iframe", "noembed", "noframes", "plaintext"}


def _escape_text(text):
    return text.replace("&", "&amp;").replace("\xa0", "&nbsp;").replace("<", "&lt;").replace(">", "&gt;")


def _escape_attribute(value):
    # Browsers escape < and > in attribute values too (HTML spec change of 2025).
    return (value.replace("&", "&amp;").replace("\xa0", "&nbsp;").replace('"', "&quot;")
            .replace("<", "&lt;").replace(">", "&gt;"))


def _serialize(node, parent_name, out):
    if isinstance(node, Comment):
        out.append("<!--" + str(node) + "-->")
    elif isinstance(node, NavigableString):
        out.append(str(node) if parent_name in RAW_TEXT_ELEMENTS else _escape_text(str(node)))
    elif isinstance(node, Tag):
        attributes = "".join(
            f' {key}="{_escape_attribute(value if isinstance(value, str) else " ".join(value))}"'
            for key, value in node.attrs.items()
        )
        out.append(f"<{node.name}{attributes}>")
        if node.name in VOID_ELEMENTS:
            return
        for child in node.children:
            _serialize(child, node.name, out)
        out.append(f"</{node.name}>")


def inner_html(tag):
    out = []
    for child in tag.children:
        _serialize(child, tag.name, out)
    return "".join(out)


# ===== Page =====


class WorkPage:
    """One fetched TV Tropes page. `url` is the URL after redirects."""

    def __init__(self, url: str, html: str):
        self.url = url
        self.soup = BeautifulSoup(html or "", "html5lib", multi_valued_attributes=None)

    @cached_property
    def article(self):
        return self.soup.select_one("#main-article")

    @cached_property
    def identity(self):
        return page_identity(self.url)

    def select(self, selector):
        return self.soup.select(selector)

    def links(self):
        """Every `#main-article a[href]` as (absolute url, text, parent text), like `a.href` in a browser."""
        return [
            (urljoin(self.url, a.get("href", "").strip()), a.get_text(), a.parent.get_text() if a.parent else "")
            for a in self.select("#main-article a[href]")
        ]

    @cached_property
    def introduction(self):
        # Use the opening work description, not a year mentioned in a trope/example.
        # Live pages open with empty spacer paragraphs; skip them.
        paragraphs = [p.get_text() for p in self.select("#main-article > p")]
        paragraphs = [text for text in paragraphs if text.strip()]
        return " ".join(paragraphs[:3])[:2500]


def identifies_work(page: WorkPage, original_title: Optional[str], release_year: Optional[int],
                    media_type: str, variations: list[str]) -> bool:
    """Whether the page is this title's work page. Judged on the final URL, after redirects."""
    media_type = media_namespace(media_type)
    namespace, name = page.identity
    if namespace not in allowed_namespaces(media_type):
        return False
    introduction = page.introduction
    year_in_name = year_suffixed_name(name, release_year, variations)
    # The same title under another year is, by the wiki's own naming, another
    # work, even when its intro opens with "not to be confused with the 2006 film".
    stem = re.sub(r"(?:19|20)\d{2}$", "", name)
    if stem != name and not year_in_name and any(stem.casefold() == v.casefold() for v in variations):
        return False
    compact = slug(introduction).casefold()
    matches_title = any(len(v) >= 3 and v.casefold() in compact for v in variations)
    # Numeric titles cannot be fuzzy matched inside another number.
    matches_title = matches_title or any(
        v.isdigit() and re.search(r"(?<!\w)" + re.escape(v) + r"(?!\w)", introduction) for v in variations
    )
    if not release_year:
        return False
    # A year-suffixed page name states the title itself (It, 21 Jump Street).
    if not matches_title and not year_in_name:
        return False
    text = introduction
    # A title such as "2001: A Space Odyssey" or "1917" is not a release year.
    if original_title and re.search(YEAR, original_title):
        text = text.replace(original_title, " ")
    # "the 1853 memoir ... and its 2013 film adaptation": skip the source's year.
    text = re.sub(YEAR + r"(?=(?:\s+[\w'’-]+){0,3}\s+" + SOURCE_WORK + r"\b)", " ", text)
    sentences = split_sentences(text)
    dated = next((s for s in sentences if re.search(YEAR, s)), "")
    # A shared film-series/volume page does not prove individual-title traits.
    # Such pages say so in their definition or dated sentence; a later aside
    # ("the two films are otherwise unrelated") is incidental.
    if media_type == "Film" and any(
        re.search(SHARED_FILM_PAGE, sentence, re.I) or re.search(DEFINED_AS_FILM_SET, sentence, re.I)
        for sentence in (sentences[0], dated)
    ):
        return False
    if year_in_name:
        # The page name supplies title and year; the introduction must still
        # describe the right medium.
        kind = re.search(KIND, introduction, re.I)
    else:
        # The first dated description must identify this release. A guessed near
        # year, or a later sentence about a remake, is insufficient.
        years = re.findall(YEAR, text)
        if not years or years[0] != str(release_year):
            return False
        # A country-suffixed page (HouseOfCardsUK) has a same-titled sibling,
        # which its intro usually mentions. The year only counts in the
        # sentence that defines this page's work: it names the title and does
        # not speak of another production.
        country_suffixed = any(
            name[: len(v)].casefold() == v.casefold() and name[len(v):] in DISAMBIGUATION_SUFFIXES
            for v in variations
        )
        if country_suffixed and (
            not any(len(v) >= 3 and v.casefold() in slug(dated).casefold() for v in variations)
            or re.search(OTHER_PRODUCTION, dated)
        ):
            return False
        # In shared animation namespaces, the first dated work description
        # determines media type. Prefer the kind word after the year; fall back to
        # the same sentence before it only when nothing follows ("the first
        # movie in the trilogy, released in 2002.").
        position = re.search(YEAR, dated).start()
        kind = re.search(KIND, dated[position:], re.I) or re.search(KIND, dated[:position], re.I)
    if not kind:
        return False
    return (kind[1].lower() in ("film", "movie")) == (media_type == "Film")


def _dated_text(introduction, original_title):
    text = introduction
    # A title such as "2001: A Space Odyssey" or "1917" is not a release year.
    if original_title and re.search(YEAR, original_title):
        text = text.replace(original_title, " ")
    # "the 1853 memoir ... and its 2013 film adaptation": skip the source's year.
    return re.sub(YEAR + r"(?=(?:\s+[\w'’-]+){0,3}\s+" + SOURCE_WORK + r"\b)", " ", text)


def matches_known_url(page: WorkPage, original_title: Optional[str], release_year: Optional[int],
                      media_type: str, variations: list[str]) -> bool:
    """The check for a URL from a curated source (Wikidata, the tvtropes2imdb mapping, a stored
    URL), like the critic crawls' title and year rule. `identifies_work` was built for guessed
    slugs and also wants a medium word such as "series" in the dated sentence; TV Tropes intros
    often say "Dom Com", "Cop Show" or "Live-Action Adaptation" instead. Here the Film/ or
    Series/ namespace gives the medium. Still required: the title (page name or introduction),
    and the page name's year or the introduction's first year within a year of the release.
    Only the local runner uses it, whose recovered rows are reviewed before import."""
    media_type = media_namespace(media_type)
    namespace, name = page.identity
    if namespace not in allowed_namespaces(media_type) or not release_year:
        return False
    stem = re.sub(r"(?:19|20)\d{2}$", "", name)
    names = {v.casefold() for v in variations}
    year_in_name = year_suffixed_name(name, release_year, variations)
    # The same title under another year is, by the wiki's own naming, another work.
    if stem != name and not year_in_name and stem.casefold() in names:
        return False
    introduction = page.introduction
    compact = slug(introduction).casefold()
    if not (name.casefold() in names or stem.casefold() in names
            or any(len(v) >= 3 and v.casefold() in compact for v in variations)):
        return False
    text = _dated_text(introduction, original_title)
    years = re.findall(YEAR, text)
    if not year_in_name and not (years and abs(int(years[0]) - release_year) <= 1):
        return False
    sentences = split_sentences(text)
    dated = next((s for s in sentences if re.search(YEAR, s)), "")
    if media_type == "Film" and any(
        re.search(SHARED_FILM_PAGE, s, re.I) or re.search(DEFINED_AS_FILM_SET, s, re.I) for s in (sentences[0], dated)
    ):
        return False
    if namespace == media_type:
        return True
    # Animation and Anime hold films and shows alike: the introduction must name the medium.
    kind = re.search(KIND, introduction, re.I)
    return bool(kind) and (kind[1].lower() in ("film", "movie")) == (media_type == "Film")


def trope_items(page: WorkPage, is_subpage: bool = False) -> list[dict]:
    """The page's trope list as `{name, url, html}`, only links to Main/ trope pages."""
    selector = "#main-article h2 ~ ul > li, #main-article h3 ~ ul > li, #main-article .folder > ul > li"
    if is_subpage:
        selector += ", #main-article > ul > li"

    def items(css):
        found = []
        for li in page.select(css):
            a = li.find("a")
            if a is not None:
                found.append({"href": a.get("href") or "", "name": a.get_text(), "li": li})
        return found

    found = items(selector)
    # Heading-less work pages (Band of Brothers) list tropes at the top level.
    # Identity is already established and items stay filtered to Main/ links;
    # this applies only when the primary selectors find no trope at all.
    if not is_subpage and not any(
        page_identity(urljoin(page.url, item["href"]))[0] == "Main" and item["name"].strip() for item in found
    ):
        found = items("#main-article > ul > li")
    tropes = []
    for item in found:
        url = urljoin(page.url, item["href"])
        if page_identity(url)[0] != "Main":
            continue
        name = item["name"].strip()
        if name:
            html = remove_prefix(text=inner_html(item["li"]).strip(), prefix=name)
            tropes.append({"name": name, "url": url, "html": html})
    return tropes


def owner_names(url):
    """The namespaces a work's own subpages live under (Film/CitizenKane1941 → CitizenKane…)."""
    _, name = page_identity(url)
    stem = re.sub(r"(?:19|20)\d{2}$", "", name)
    return {(base + suffix).casefold() for base in (name, stem) for suffix in ("", "Film", "Series", "Anime", "TV")}


def subpage_urls(page: WorkPage, owner: set, visited: set) -> list[str]:
    """Links to this work's `Tropes[A-Z]…` subpages, in page order. Links may sit
    outside a heading or folder list (Citizen Kane)."""
    urls = []
    for url, text, _ in page.links():
        namespace, name = page_identity(url)
        if not re.search(r"^Tropes[A-Za-z0-9]+$", name) or not re.search(r"Tropes", text, re.I):
            continue
        # Explicitly exclude franchise/work links and off-site links.
        if namespace.casefold() not in owner or namespace in WORK_NAMESPACES or url in visited or url in urls:
            continue
        urls.append(url)
    return urls


def unique_tropes(tropes: list[dict]) -> list[dict]:
    # Duplicate names can occur across folders; keep all distinct passages.
    return list({(t["name"], t["url"], t["html"]): t for t in tropes}.values())


def main():
    pass

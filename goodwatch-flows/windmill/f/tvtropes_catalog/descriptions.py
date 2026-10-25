# extra_requirements:
# beautifulsoup4
# html5lib

"""General TV Tropes Main-page introductions from already fetched HTML.

No transport or writes. html5lib follows browser error recovery, including wiki
paragraphs that contain divs and prematurely close under html.parser.
"""
import re
import unicodedata
from urllib.parse import parse_qsl, urljoin, urlparse

from bs4 import BeautifulSoup, Comment, FeatureNotFound, NavigableString, Tag

MAX_DESCRIPTION_BYTES = 24_000
MIN_DESCRIPTION_CHARS = 40
_MAIN_PATH = re.compile(r"/pmwiki/pmwiki\.php/Main/[A-Za-z0-9_]+")
_HIDDEN_STYLE = re.compile(r"(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b", re.I)
_HATNOTE = re.compile(r'^The (?:word|term|name|phrase) .{1,160} redirects? to this page\b', re.I)
_EXAMPLES_LABEL = re.compile(r"^examples?(?:\s+subpages?|\s+of\s+this\s+trope|\s+include)?\s*[:.!]?$", re.I)
_JUNK_CLASSES = {
    "quoteright", "quoteleft", "quoteblock", "quote", "acaptionright", "acaptionleft",
    "caption", "indent", "tvtropes-ad-unit", "ad-caption", "inlinefolder", "notelabel",
    "notetext", "footnote", "footnotes", "reference", "section-button", "editsection",
}
_INLINE_TAGS = {
    "a", "abbr", "acronym", "b", "bdi", "bdo", "big", "cite", "code", "data", "del", "dfn",
    "em", "font", "i", "img", "ins", "kbd", "label", "mark", "q", "ruby", "s", "samp",
    "small", "span", "strong", "sub", "sup", "time", "tt", "u", "var", "wbr",
}
_BLOCK_TAGS = {
    "address", "article", "aside", "blockquote", "dd", "div", "dl", "dt", "fieldset", "figure",
    "figcaption", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr",
    "li", "main", "nav", "ol", "p", "pre", "section", "table", "ul",
}
_STOP_IDS = {"article-footer", "main-footer", "footer", "content-footer", "main-article-footer", "article-bottom"}


def _main_url(value, *, navigation=False):
    try:
        parsed = urlparse(value or "")
    except (ValueError, TypeError):
        return None
    if (parsed.scheme != "https" or parsed.netloc.lower() not in {"tvtropes.org", "www.tvtropes.org"}
            or not _MAIN_PATH.fullmatch(parsed.path) or parsed.params):
        return None
    if parsed.query:
        # A wiki redirect adds a breadcrumb query that does not change the page
        # body. Alone it is not evidence that an arbitrary label identifies the subject.
        pairs = parse_qsl(parsed.query, keep_blank_values=True)
        if (not navigation or len(pairs) != 1 or pairs[0][0] != "from"
                or not re.fullmatch(r"Main\.[A-Za-z0-9_]+", pairs[0][1])):
            return None
    if parsed.fragment and not navigation:
        return None
    return "https://tvtropes.org" + parsed.path


def _identity(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value or "").casefold() if c.isalnum())


def _requested_redirect_identifies(name, requested_url, final_url, canonical):
    # Only a caller's actual, canonical bare request can supply the old identity.
    # Contextual labels that merely link another trope fail the slug comparison.
    requested = _main_url(requested_url)
    if not requested or requested != requested_url or requested.casefold() == canonical.casefold():
        return False
    slug = urlparse(requested).path.rsplit("/", 1)[1]
    if _identity(name) != _identity(slug):
        return False
    return parse_qsl(urlparse(final_url).query, keep_blank_values=True) == [("from", "Main." + slug)]


def _text(node):
    # Keep actual whitespace at inline markup boundaries: <em>un</em>kind is
    # "unkind", while <a>the hero</a> acts still has its original space.
    return re.sub(r"\s+", " ", node.get_text()).strip()


def _quote(text, node=None):
    if (node is not None and (node.name == "cite" or node.find("cite"))) or text.startswith(("—", "–")):
        return True
    return bool(re.fullmatch(r'[“"‘\'].*[”"’\'](?:\s*[—–-].*)?', text, re.S))


def _sanitize(soup):
    for node in list(soup.find_all(True)):
        if node.name is None or node.attrs is None:
            continue
        classes = set(node.get("class", []))
        if node.name in {"h3", "h4"} and _HATNOTE.match(_text(node)):
            node.decompose()
            continue
        hidden = (node.has_attr("hidden") or node.get("aria-hidden") == "true"
                  or _HIDDEN_STYLE.search(node.get("style", "")))
        if (hidden or classes & _JUNK_CLASSES or node.name in {
                "script", "style", "noscript", "iframe", "button", "select", "form",
                "blockquote", "figcaption", "table", "svg", "canvas", "audio", "video",
        }):
            node.decompose()
    for br in soup.find_all("br"):
        br.replace_with("\n")


def _paragraph_event(text, nodes):
    text = re.sub(r"\s+", " ", text).strip()
    if _EXAMPLES_LABEL.fullmatch(text):
        yield "stop", ""
        return
    tags = [node for node in nodes if isinstance(node, Tag)]
    if (text and not _quote(text) and not any(_quote(text, node) for node in tags)
            and not any(node.name == "img" or node.find("img") for node in tags)
            and not any((node.name == "a" and "/JustForFun/DescribeTopicHere" in node.get("href", ""))
                        or node.select_one('a[href*="/JustForFun/DescribeTopicHere"]') for node in tags)
            and text.casefold() not in {"advertisement:", "noreallife", "noexamplesplease"}):
        yield "paragraph", text


def _is_boundary(node):
    classes = set(node.get("class", []))
    return (node.name in {"hr", "h1", "h2", "h3", "h4", "h5", "h6", "footer", "aside", "nav", "header"}
            or bool(classes & {"folder", "folderlabel", "article-footer", "main-footer"})
            or node.get("id") in _STOP_IDS)


def _container_events(nodes):
    # Browser error recovery can leave the lead as bare text and inline links
    # after an image div closes a p. Keep the entire sibling run as one paragraph,
    # with actual source whitespace and inline word joins, before the next block.
    inline = []
    for node in nodes:
        if isinstance(node, Comment):
            continue
        if isinstance(node, NavigableString) or (
                isinstance(node, Tag) and node.name in _INLINE_TAGS
                and not _is_boundary(node) and not node.find(_BLOCK_TAGS)):
            inline.append(node)
            continue
        if inline:
            text = "".join(str(part) if isinstance(part, NavigableString) else part.get_text() for part in inline)
            yield from _paragraph_event(text, inline)
            inline = []
        yield from _events(node)
    if inline:
        text = "".join(str(part) if isinstance(part, NavigableString) else part.get_text() for part in inline)
        yield from _paragraph_event(text, inline)


def _events(node):
    """Paragraphs and bare inline runs in source order, with hard examples boundaries."""
    if not isinstance(node, Tag):
        return
    if _is_boundary(node):
        yield "stop", ""
        return
    if node.name in {"p", "li"}:
        yield from _paragraph_event(_text(node), [node])
        return
    yield from _container_events(node.children)


def _collect(nodes):
    paragraphs = []
    for kind, text in _container_events(nodes):
        if kind == "stop":
            return paragraphs, True
        paragraphs.append(text)
    return paragraphs, False


def _leading_media_hatnote(node):
    if not isinstance(node, Tag) or node.name not in {"h3", "h4"}:
        return False
    text = _text(node)
    small = node.select_one(".font-s")
    if (small is None or _text(small) != text
            or not re.fullmatch(r"For\b.+,\s*see\b.+[.!]", text, re.I)
            or re.search(r"\bexamples?\b", text, re.I)):
        return False
    # A disambiguation notice points to actual works, possibly with Main genre
    # links interspersed. A small heading or examples navigator alone is not one.
    for link in node.find_all("a", href=True):
        parsed = urlparse(urljoin("https://tvtropes.org", link["href"]))
        if (parsed.scheme == "https" and parsed.netloc == "tvtropes.org"
                and re.fullmatch(r"/pmwiki/pmwiki\.php/(?:Film|Literature|Manga|Anime|VideoGame|ComicBook|Webcomic|WesternAnimation|Series|LiveActionTV)/[A-Za-z0-9_]+", parsed.path)
                and not parsed.query and not parsed.fragment):
            return True
    return False


def _skip_leading_media_hatnotes(article):
    # Only inspect the validated article's leading siblings. Once real intro
    # text or any other boundary occurs, every later heading retains its meaning.
    for node in list(article.children):
        if isinstance(node, Comment):
            continue
        if isinstance(node, NavigableString):
            if node.strip():
                break
            continue
        if _leading_media_hatnote(node):
            node.decompose()
        elif any(_events(node)):
            break


def _following_in_content(article, content):
    # The fallback begins after the validated article, never before its heading
    # or navigation, and never escapes the page's actual main-content region.
    current = article
    while current is not content:
        yield from list(current.next_siblings)
        current = current.parent
        if current is None:
            return


def extract_description(html, name, final_url, *, requested_url=None):
    """Return {description, error, heading, canonical_url}; never fetch a page.

    Exact primary Main subjects qualify after final/canonical URL verification.
    An old name qualifies only with its caller-supplied bare requested_url,
    exact name/slug identity and the source's exact from=Main.OldSlug redirect.
    The first examples/heading/rule boundary ends the introduction. At the byte cap,
    keep only complete paragraphs; a first paragraph that cannot fit is rejected.
    """
    result = {"description": None, "error": None, "heading": "", "canonical_url": None}

    def reject(message):
        return {**result, "error": message}

    final = _main_url(final_url, navigation=True)
    if not final:
        return reject("Final URL is not a known HTTPS TV Tropes Main page")
    if not isinstance(html, (str, bytes)) or not html:
        return reject("Missing HTML")
    if not isinstance(name, str) or not _identity(name):
        return reject("Missing subject name")
    try:
        soup = BeautifulSoup(html, "html5lib")
    except FeatureNotFound:
        return reject("Missing html5lib parser dependency; install the pinned descriptions.script.lock dependencies before recovery")
    heading = soup.find("h1")
    if heading:
        # TV Tropes appends this UI breadcrumb after redirects. Only the primary
        # heading identifies the subject; the AKA itself never verifies an alias.
        for aka in heading.select(".aka-title"):
            aka.decompose()
    result["heading"] = re.sub(r"^Main\s*/\s*", "", _text(heading), flags=re.I) if heading else ""
    canonicals = {
        urljoin(final, link.get("href", ""))
        for link in soup.select('link[rel~="canonical"]')
        if isinstance(link.get("href"), str) and link["href"].strip()
    }
    if len(canonicals) != 1:
        return reject("Missing or ambiguous canonical URL")
    result["canonical_url"] = next(iter(canonicals))
    canonical = _main_url(result["canonical_url"])
    # The site can serve a stored case variant without redirecting while its
    # canonical tag supplies the preferred spelling. Subject validation below
    # still applies; a genuinely different slug must never pass this check.
    if not canonical or canonical.casefold() != final.casefold():
        return reject("Canonical URL does not match the final Main URL")
    result["canonical_url"] = canonical
    heading_identity = _identity(result["heading"])
    if heading_identity != _identity(name):
        if not heading_identity or not _requested_redirect_identifies(name, requested_url, final_url, canonical):
            return reject(f"Heading mismatch: {result['heading']!r}")
    _sanitize(soup)
    article = soup.select_one("#main-article")
    if not article:
        return reject("Missing main article")
    _skip_leading_media_hatnotes(article)
    paragraphs, boundary = _collect(list(article.children))
    if not boundary:
        content = article.find_parent(id="main-content")
        if content:
            continuation, continued_boundary = _collect(_following_in_content(article, content))
            if continued_boundary:
                paragraphs.extend(continuation)
            elif continuation:
                return reject("Unbounded introduction outside the main article")
    selected, size = [], 0
    for paragraph in paragraphs:
        added = len(paragraph.encode("utf-8")) + (2 if selected else 0)
        if size + added > MAX_DESCRIPTION_BYTES:
            if not selected:
                return reject("Introduction paragraph exceeds the UTF-8 byte budget")
            break
        selected.append(paragraph)
        size += added
    text = "\n\n".join(selected)
    if len(text) < MIN_DESCRIPTION_CHARS:
        return reject("Missing or very short introduction before the examples boundary")
    result["description"] = text
    return result


def main():
    pass

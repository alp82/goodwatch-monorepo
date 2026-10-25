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

from bs4 import BeautifulSoup, FeatureNotFound, Tag

MAX_DESCRIPTION_BYTES = 24_000
MIN_DESCRIPTION_CHARS = 40
_MAIN_PATH = re.compile(r"/pmwiki/pmwiki\.php/Main/[A-Za-z0-9]+")
_HIDDEN_STYLE = re.compile(r"(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b", re.I)
_HATNOTE = re.compile(r'^The (?:word|term|name|phrase) .{1,160} redirects? to this page\b', re.I)
_EXAMPLES_LABEL = re.compile(r"^examples?(?:\s+subpages?|\s+of\s+this\s+trope|\s+include)?\s*[:.!]?$", re.I)
_JUNK_CLASSES = {
    "quoteright", "quoteleft", "quoteblock", "quote", "acaptionright", "acaptionleft",
    "caption", "indent", "tvtropes-ad-unit", "ad-caption", "inlinefolder", "notelabel",
    "notetext", "footnote", "footnotes", "reference", "section-button", "editsection",
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
        # body. It is not evidence that the old name identifies the new subject.
        pairs = parse_qsl(parsed.query, keep_blank_values=True)
        if (not navigation or len(pairs) != 1 or pairs[0][0] != "from"
                or not re.fullmatch(r"Main\.[A-Za-z0-9]+", pairs[0][1])):
            return None
    if parsed.fragment and not navigation:
        return None
    return "https://tvtropes.org" + parsed.path


def _identity(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value or "").casefold() if c.isalnum())


def _text(node):
    # Keep actual whitespace at inline markup boundaries: <em>un</em>kind is
    # "unkind", while <a>the hero</a> acts still has its original space.
    return re.sub(r"\s+", " ", node.get_text()).strip()


def _quote(text, node):
    if node.find("cite") or text.startswith(("—", "–")):
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
                "blockquote", "figcaption", "table",
        }):
            node.decompose()
    for br in soup.find_all("br"):
        br.replace_with("\n")


def _events(node):
    """Paragraphs/list items in source order, and a hard examples/footer boundary."""
    if not isinstance(node, Tag):
        return
    classes = set(node.get("class", []))
    if (node.name in {"hr", "h1", "h2", "h3", "h4", "h5", "h6", "footer", "aside", "nav", "header"}
            or classes & {"folder", "folderlabel", "article-footer", "main-footer"}
            or node.get("id") in _STOP_IDS):
        yield "stop", ""
        return
    if node.name in {"p", "li"}:
        text = _text(node)
        if _EXAMPLES_LABEL.fullmatch(text):
            yield "stop", ""
            return
        if (text and not _quote(text, node) and not node.find("img")
                and not node.select_one('a[href*="/JustForFun/DescribeTopicHere"]')
                and text.casefold() not in {"advertisement:", "noreallife", "noexamplesplease"}):
            yield "paragraph", text
        return
    for child in node.children:
        yield from _events(child)


def _collect(nodes):
    paragraphs = []
    boundary = False
    for node in nodes:
        for kind, text in _events(node):
            if kind == "stop":
                boundary = True
                break
            paragraphs.append(text)
        if boundary:
            break
    return paragraphs, boundary


def _following_in_content(article, content):
    # The fallback begins after the validated article, never before its heading
    # or navigation, and never escapes the page's actual main-content region.
    current = article
    while current is not content:
        yield from list(current.next_siblings)
        current = current.parent
        if current is None:
            return


def extract_description(html, name, final_url):
    """Return {description, error, heading, canonical_url}; never fetch a page.

    Only exact Main subjects with matching final/canonical URLs qualify. The
    first examples/heading/rule boundary ends the introduction. At the byte cap,
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
        # heading identifies the subject; an AKA cannot satisfy an alias request.
        for aka in heading.select(".aka-title"):
            aka.decompose()
    result["heading"] = re.sub(r"^Main\s*/\s*", "", _text(heading), flags=re.I) if heading else ""
    if _identity(result["heading"]) != _identity(name):
        return reject(f"Heading mismatch: {result['heading']!r}")
    canonicals = {
        urljoin(final, link.get("href", ""))
        for link in soup.select('link[rel~="canonical"]')
        if isinstance(link.get("href"), str) and link["href"].strip()
    }
    if len(canonicals) != 1:
        return reject("Missing or ambiguous canonical URL")
    result["canonical_url"] = next(iter(canonicals))
    canonical = _main_url(result["canonical_url"])
    if canonical != final:
        return reject("Canonical URL does not match the final Main URL")
    result["canonical_url"] = canonical
    _sanitize(soup)
    article = soup.select_one("#main-article")
    if not article:
        return reject("Missing main article")
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

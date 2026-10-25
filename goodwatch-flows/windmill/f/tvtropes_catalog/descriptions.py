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
_SCRIPT_CHARACTERS = re.compile(r"[0-9+\-=()−\s]+\Z")
_SUPERSCRIPT = str.maketrans("0123456789+-=()−", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾⁻")
_SUBSCRIPT = str.maketrans("0123456789+-=()−", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎₋")
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
    pairs = parse_qsl(urlparse(final_url).query, keep_blank_values=True)
    # The site also canonicalizes capitalization inside its redirect breadcrumb,
    # e.g. AcCENTOnTheWrongSylLABle becomes AccentOnTheWrongSyllable.
    return (len(pairs) == 1 and pairs[0][0] == "from"
            and pairs[0][1].casefold() == ("Main." + slug).casefold())


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
        if node.name == "img" and _external_link_icon(node):
            # The wiki appends this UI marker to external links. It is not an
            # illustration, and must not cause its entire paragraph to be lost.
            node.decompose()
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
    # Preserve numeric formatting after note labels and hidden/quoted material are removed.
    # Unicode has exact digit/operator forms; unsupported text and nested scripts stay unchanged.
    for node in list(soup.find_all(["sup", "sub"])):
        if node.find(["sup", "sub"]) or node.find_parent(["sup", "sub"]):
            continue
        text = node.get_text()
        if text.strip() and _SCRIPT_CHARACTERS.fullmatch(text):
            node.replace_with(text.translate(_SUPERSCRIPT if node.name == "sup" else _SUBSCRIPT))


def _external_link_icon(node):
    if (node.get("width") != "12" or node.get("height") != "12"
            or node.parent.name != "a" or "urllink" not in node.parent.get("class", [])):
        return False
    try:
        url = urlparse(node.get("src", ""))
    except (ValueError, TypeError):
        return False
    return (url.scheme in {"http", "https"} and url.netloc == "static.tvtropes.org"
            and url.path == "/pmwiki/pub/external_link.gif"
            and not url.params and not url.query and not url.fragment)


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


def _leading_repair_notice(node):
    if (not isinstance(node, Tag) or node.name != "h2"
            or _text(node) != "This page is under review in the Trope Repair Shop."):
        return False
    links = node.find_all("a", href=True)
    if len(links) != 2 or [_text(link) for link in links] != ["under review", "Trope Repair Shop"]:
        return False
    discussion, repair = [urlparse(urljoin("https://tvtropes.org", link["href"])) for link in links]
    if any(url.scheme != "https" or url.netloc != "tvtropes.org" or url.params or url.fragment
           for url in (discussion, repair)):
        return False
    return (repair.path == "/pmwiki/pmwiki.php/Administrivia/TropeRepairShop" and not repair.query
            and discussion.path == "/pmwiki/posts.php"
            and bool(re.fullmatch(r"discussion=\d+\.\d+", discussion.query)))


def _skip_leading_metadata(article):
    # Only inspect the validated article's leading siblings. Once real intro
    # text or any other boundary occurs, every later heading retains its meaning.
    for node in list(article.children):
        if isinstance(node, Comment):
            continue
        if isinstance(node, NavigableString):
            if node.strip():
                break
            continue
        if _leading_media_hatnote(node) or _leading_repair_notice(node):
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
    exact name/slug identity and the source's from=Main.OldSlug redirect
    (allowing the site's capitalization correction).
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
    return _extract_intro(soup, result)


def _extract_intro(soup, result):
    """Shared intro cleanup after the caller has verified its actual identity evidence."""
    def reject(message):
        return {**result, "error": message}

    _sanitize(soup)
    article = soup.select_one("#main-article")
    if not article:
        return reject("Missing main article")
    _skip_leading_metadata(article)
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


def extract_archive_description(record, name, known_url):
    """Read an original decoded archive fragment; never construct missing metadata.

    Archive identity comes from its real primary heading and three agreeing body
    metadata fields, rather than the full HTTP document's canonical link. This
    adapter supplies no transport or provenance timestamps/hashes. An original
    record id may differ only when an actual archived AKA identifies it. An
    original alias subject additionally requires its exact original catalog URL.
    """
    result = {"description": None, "error": None, "heading": "", "canonical_url": None}

    def reject(message):
        return {**result, "error": message}

    # The publisher documents err=null for successful records; early shards
    # omit that optional field. A non-null error still invalidates the capture.
    if not isinstance(record, dict) or "error" in record or record.get("err") is not None:
        return reject("Invalid or failed archive record")
    if record.get("ns") != "Main":
        return reject("Archive namespace is not Main")
    slug = record.get("id")
    if not isinstance(slug, str) or not re.fullmatch(r"[A-Za-z0-9_]+", slug):
        return reject("Unsafe or missing archive Main id")
    known = _main_url(known_url)
    if not known:
        return reject("Known catalog URL is not a Main identity")
    if not isinstance(name, str) or not _identity(name):
        return reject("Missing subject name")
    html = record.get("article")
    if not isinstance(html, str) or not html.strip():
        return reject("Missing original archive HTML string")
    try:
        soup = BeautifulSoup(html, "html5lib")
    except FeatureNotFound:
        return reject("Missing html5lib parser dependency; install the pinned descriptions.script.lock dependencies before recovery")
    content = soup.select("#main-content")
    articles = soup.select("#main-article")
    if len(content) != 1 or len(articles) != 1 or content[0] not in articles[0].parents:
        return reject("Missing or ambiguous archive article structure")
    # Wiki prose may itself contain h1 section boundaries. Only the distinct
    # page header outside the real article can identify the primary subject.
    headings = [node for node in soup.find_all("h1") if articles[0] not in node.parents]
    if len(headings) != 1 or content[0] not in headings[0].parents:
        return reject("Missing or ambiguous archive primary heading")
    heading = headings[0]
    aliases = heading.select(".aka-title")
    original_alias = re.fullmatch(r"\(aka:\s*(.+?)\)", _text(aliases[0]), re.I) if len(aliases) == 1 else None
    archived_alias_identifies_record = bool(original_alias and _identity(original_alias.group(1)) == _identity(slug))
    for node in heading.select(".aka-title, .ns_parts, .watch_rank_wrap"):
        node.decompose()
    titles = heading.select(".wrapped_title, .wrap-entry-breadcrumb strong")
    if len(titles) > 1:
        return reject("Ambiguous archive primary heading")
    result["heading"] = _text(titles[0] if titles else heading)
    fields = {}
    for field in ("groupname-hidden", "title-hidden", "current_url"):
        nodes = soup.select("#" + field)
        if len(nodes) != 1 or content[0] not in nodes[0].parents:
            return reject("Missing or ambiguous archive body identity metadata")
        node = nodes[0]
        if field == "current_url":
            if not ("hidden" in node.get("class", []) or node.has_attr("hidden")
                    or _HIDDEN_STYLE.search(node.get("style", ""))):
                return reject("Archive current URL is not hidden body metadata")
            fields[field] = _text(node)
        else:
            if node.name != "input" or node.get("type", "").lower() != "hidden":
                return reject("Archive group/title is not hidden input metadata")
            fields[field] = node.get("value")
    title = fields["title-hidden"]
    if fields["groupname-hidden"] != "Main" or not isinstance(title, str) or not re.fullmatch(r"[A-Za-z0-9_]+", title):
        return reject("Archive hidden namespace/title is not a Main identity")
    expected = "https://tvtropes.org/pmwiki/pmwiki.php/Main/" + title
    if title.casefold() != slug.casefold() and not archived_alias_identifies_record:
        return reject("Archive original id differs without explicit archived AKA evidence")
    try:
        current = urlparse(fields["current_url"])
    except ValueError:
        return reject("Invalid archive current URL")
    observed = _main_url(current._replace(scheme="https").geturl()) if current.scheme in {"http", "https"} else None
    if not observed or observed.casefold() != expected.casefold():
        return reject("Archive current URL does not match record/catalog identity")
    primary_subject = (known.casefold() == observed.casefold()
                       and _identity(result["heading"]) == _identity(name))
    original = "https://tvtropes.org/pmwiki/pmwiki.php/Main/" + slug
    original_alias_subject = (
        title.casefold() != slug.casefold()
        and known.casefold() == original.casefold()
        and archived_alias_identifies_record
        and _identity(name) == _identity(slug)
        and _identity(result["heading"]) == _identity(title)
    )
    if not primary_subject and not original_alias_subject:
        return reject("Archive catalog subject lacks primary or exact original-alias identity evidence")
    result["canonical_url"] = observed
    challenge = soup.select_one("#challenge-form, #cf-challenge-running, #challenge-running, .cf-challenge") is not None
    _sanitize(soup)
    text = _text(articles[0])
    if (challenge or re.match(r"^(?:There is currently no text in this page|This page (?:does not exist|has been deleted)|Just a moment|Checking your browser|Access denied|Attention required|Verify you are human)\b", text, re.I)):
        return reject("Archive body is an unavailable page or browser challenge")
    return _extract_intro(soup, result)


def main():
    pass

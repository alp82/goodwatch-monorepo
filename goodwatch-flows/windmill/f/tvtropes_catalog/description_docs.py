"""Version 1 description contract. Pure validation; offsets are UTF-16 code units."""
import json
import re
from urllib.parse import urljoin, urlsplit


def wiki_link(value):
    """Keep wiki targets only, removing query/fragment and excluding site meta pages."""
    if not isinstance(value, str) or not value.strip() or any(ord(c) < 32 for c in value):
        return None
    try:
        url = urlsplit(urljoin('https://tvtropes.org/pmwiki/pmwiki.php/', value))
    except ValueError:
        return None
    match = re.fullmatch(r'/pmwiki/pmwiki\.php/([A-Za-z]+)/[A-Za-z0-9_]+', url.path)
    if (url.scheme not in {'http', 'https'} or url.netloc.lower() not in {'tvtropes.org', 'www.tvtropes.org'}
            or not match or match[1].casefold() == 'administrivia'):
        return None
    return 'https://tvtropes.org' + url.path


def utf16_length(text):
    return len(text.encode('utf-16-le')) // 2


def validate_description_doc(doc):
    """Return doc or raise ValueError. Kinds may overlap each other, never themselves.

    Each range must also end on a Unicode character boundary, not inside a surrogate pair.
    Empty arrays are optional; unknown fields are rejected to keep the v1 contract explicit.
    """
    def fail():
        raise ValueError('Invalid version-1 description document')

    def text_block(block, extra):
        if not isinstance(block, dict) or set(block) - ({'text', 'links', 'spoilers', 'em'} | extra):
            fail()
        text = block.get('text')
        if not isinstance(text, str) or not text.strip():
            fail()
        boundaries = {0}
        offset = 0
        for char in text:
            if 0xD800 <= ord(char) <= 0xDFFF:
                fail()
            offset += 2 if ord(char) > 0xFFFF else 1
            boundaries.add(offset)
        for key in ('links', 'spoilers', 'em'):
            ranges = block.get(key, [])
            if not isinstance(ranges, list):
                fail()
            previous = 0
            for span in ranges:
                if (not isinstance(span, list) or len(span) != (3 if key == 'links' else 2)
                        or type(span[0]) is not int or type(span[1]) is not int
                        or not previous <= span[0] < span[1] or span[0] not in boundaries or span[1] not in boundaries):
                    fail()
                if key == 'links' and (not isinstance(span[2], str) or wiki_link(span[2]) != span[2]):
                    fail()
                previous = span[1]

    if (not isinstance(doc, dict) or set(doc) != {'v', 'source', 'blocks'}
            or type(doc['v']) is not int or doc['v'] != 1 or doc['source'] not in ('archive', 'crawl', 'plain')
            or not isinstance(doc['blocks'], list) or not doc['blocks']):
        fail()
    for block in doc['blocks']:
        if not isinstance(block, dict):
            fail()
        kind = block.get('kind')
        if kind in ('p', 'heading'):
            text_block(block, {'kind'})
        elif kind == 'list':
            if set(block) != {'kind', 'items'} or not isinstance(block['items'], list) or not block['items']:
                fail()
            for item in block['items']:
                text_block(item, {'depth'})
                depth = item.get('depth')
                if type(depth) is not int or depth < 0:
                    fail()
        else:
            fail()
    return doc


def serialize_description_doc(value, description):
    """Accept extracted objects or staged JSON text; legacy plain-only inputs remain valid."""
    if value is None:
        return None
    if description is None:
        raise ValueError('A description document requires a description')
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            raise ValueError('Invalid description document JSON') from None
    validate_description_doc(value)
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def main():
    """Importable pure Windmill library; no transport or writes."""
    pass

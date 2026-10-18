"""Dates supported by evidence, independent of the database and generator."""
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional
import xml.etree.ElementTree as ET


def title_lastmod(dna_updated_at: Optional[int]) -> Optional[date]:
    """DNA updated_at also advances for vector repairs, without visible changes.

    Until a significant-content timestamp exists, neither it nor TMDB refresh
    times are evidence of a page modification. There is no synthetic floor.
    """
    return None


class SitemapHistory:
    """Snapshot bytes and index dates before any generated files are replaced."""

    def __init__(self, directory, today=None):
        self.today = today or datetime.now(timezone.utc).date()
        self.files = {p.name: p.read_bytes() for p in Path(directory).glob('sitemap*.xml')}
        self.dates = {}
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        for content in self.files.values():
            root = ET.fromstring(content)
            for entry in root.findall('s:sitemap', ns):
                loc = entry.findtext('s:loc', namespaces=ns)
                value = entry.findtext('s:lastmod', namespaces=ns)
                if loc and value:
                    name = loc.rsplit('/', 1)[-1]
                    parsed = date.fromisoformat(value)
                    if name in self.dates and self.dates[name] != parsed:
                        raise ValueError(f'Conflicting previous sitemap dates: {name}')
                    self.dates[name] = parsed

    def lastmod(self, filename, content):
        """Unknown historic dates stay omitted until a real byte change occurs."""
        if self.files.get(filename) == content:
            return self.dates.get(filename)
        return self.today

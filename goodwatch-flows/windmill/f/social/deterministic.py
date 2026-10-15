"""LLM-free title matching: explicit title mentions, exact catalog names, second signals.

No model calls and no paid APIs. A post links to a title only when its foreground
names the title exactly (quoted, a headline segment, or a capitalised run) and the
name resolves to exactly one catalog entry. Short or shared names need a second
signal: a release year, a cast/crew name from our own data, a season number, the
article's URL slug, or an official channel video ID.
"""
import re
from f.social.common import norm
from f.social.rules import foreground

VERSION = 'deterministic-1'
MAX_LINKS = 3
# Names shared by more catalog entries than this are too generic to resolve from text.
MAX_SHARED = 30
QUOTES = re.compile(r'[“"«‘\'](?P<q>[^“”"«»‘’\'\n]{2,90})[”"»’\']')
SEPARATORS = re.compile(r'\s*(?:\||•|·|//|—|–|\s-\s|:\s|\n|\(|\)|\[|\]|[!?]\s|\.\s)\s*')
WORD = re.compile(r"[\w'’&.-]+", re.U)
# Lower-case words allowed inside a capitalised title run.
JOINERS = {'a', 'an', 'the', 'of', 'and', 'in', 'on', 'to', 'for', 'at', 'by', 'or', 'with', 'from',
           'de', 'la', 'le', 'les', 'des', 'du', 'der', 'die', 'das', 'und', 'von', 'el', 'y', 'vs', '&'}
# Headline furniture that is never a title by itself.
FURNITURE = re.compile(r'(?i)^(?:official\s+)?(?:(?:final|teaser|first|new|main|international|red band)\s+)*'
                       r'(?:trailer|teaser|clip|featurette|review|interview|exclusive|watch|first look|sneak peek|'
                       r'behind the scenes|bts|recap|explained|ending explained|official|netflix|'
                       r'season \d+|episode \d+|part \d+|now streaming|in theaters.*|only in theaters.*)$')
TV_WORDS = re.compile(r'(?i)\b(?:series|season|seasons|episode|episodes|showrunner|miniseries|docuseries|sitcom|'
                      r'staffel|folge|serie|temporada|saison|s\d{1,2}\s?e\d{1,2}|tv show)\b')
GAME_WORDS = re.compile(r'(?i)\b(?:video ?games?|gaming|gamers?|playstation|xbox|nintendo|steam|shoot-?.em-?up)\b')
MOVIE_WORDS = re.compile(r'(?i)\b(?:film|films|movie|movies|feature|box office|director\'s cut|in theaters|'
                         r'kino|película|pelicula|filme)\b')
SEASON = re.compile(r'(?i)\b(?:season|staffel|temporada|saison)\s+(\d{1,2})\b|\bs(\d{1,2})\s?e\d{1,2}\b')
YEAR = re.compile(r'(?<!\d)(19[0-9]{2}|20[0-4][0-9])(?!\d)')
STOP = {'the', 'a', 'an', 'of', 'and', 'in', 'on', 'to', 'for', 'at', 'by', 'is', 'it', 'my', 'me', 'you',
        'we', 'he', 'she', 'they', 'this', 'that', 'what', 'who', 'how', 'why', 'all', 'one', 'new', 'love',
        'home', 'us', 'up', 'out', 'man', 'woman', 'night', 'day', 'life', 'time', 'world', 'live', 'show',
        'trailer', 'film', 'movie', 'series', 'season', 'episode', 'review', 'watch', 'official', 'netflix'}


# A title named only as a reference point ("a 'Succession' star", "from the director of X").
REFERENCE_AFTER = re.compile(r"(?i)^[’'\"”»]*\s*(?:'s\s+|’s\s+)?(?:(?:co-?)?stars?|actor|actress|alum|veteran|(?:co-?)?creators?|director|"
                             r"maker|makers|-?macherin|-?macher|spinoff|spin-off|sequel|prequel|remake|reboot|musical|stage|"
                             r"franchise|universe|writer|showrunner|producer|team|fame|fans?)\b")
REFERENCE_BEFORE = re.compile(r"(?i)(?:from the (?:director|creator|creators|makers|writer|producers?) of|since|than|like|"
                              r"in the vein of|after|second|third|fourth|fifth|follow-up to|sequel to|spinoff of|star of|creator of)\s*[‘'\"“«]*$")


# "'Ted Lasso's Cristo Fernández" is about the person, not the show.
POSSESSIVE_PERSON = re.compile(r"^[’'\"”]*[’']s[’']?\s+[A-Z][\w-]+\s+[A-Z]")


def text_of(post):
    """Headline and description; Bluesky posts are matched on their linked article card."""
    if post.get('source') == 'bluesky':
        card = post.get('context') or ''
        title, _, rest = card.partition('\n')
        return title.strip()[:1000], (rest + '\n' + (post.get('text') or ''))[:1800]
    fg = foreground(post)
    return fg['headline'], fg['description']


def reference_only(raw, text):
    """True when every occurrence of the mention reads as a reference to another work."""
    hits = [m for m in re.finditer(re.escape(raw), text, re.I)]
    return bool(hits) and all(REFERENCE_AFTER.match(text[m.end():m.end() + 24]) or
                              POSSESSIVE_PERSON.match(text[m.end():m.end() + 40]) or
                              REFERENCE_BEFORE.search(text[max(0, m.start() - 40):m.start()]) for m in hits)


def mentions(post):
    """Candidate title strings with the strongest cue that produced each one.

    Cues, strongest first: quoted (3), a whole headline segment or an all-caps run (2),
    a whole capitalised run (1), part of a capitalised run (0).
    """
    headline, description = text_of(post)
    out = {}

    def add(raw, cue, where):
        raw = re.sub(r'(?i)^(?:watch|review|trailer|exclusive|first look|recap)\s*[:\-–—]?\s+', '', raw.strip(' .,;:!?#*'))
        raw = re.sub(r'(?i)\s+(?:\d{1,2}|season \d+|staffel \d+|part \d+|official trailer|trailer|teaser)$', '', raw)
        key = norm(raw)
        if not key or FURNITURE.match(raw) or len(key) < 2 or len(key.split()) > 10:
            return
        if len(key.split()) == 1 and key in STOP:
            return
        rank = {'quoted': 3, 'segment': 2, 'caps': 2, 'titlecase': 1, 'subrun': 0}[cue]
        if (rank, where == 'headline') > out.get(key, {}).get('order', (-1, False)):
            out[key] = {'key': key, 'raw': raw, 'rank': rank, 'cue': cue, 'where': where,
                        'order': (rank, where == 'headline')}

    for where, source in (('headline', headline), ('description', description)):
        for m in QUOTES.finditer(source):
            add(m['q'], 'quoted', where)
        if where == 'headline':
            for part in SEPARATORS.split(source):
                if 0 < len(part.split()) <= 8 and title_cased(part):
                    add(part, 'segment', where)
        for run in capital_runs(source):
            words = run.split()
            caps = len(words) >= 2 and run.isupper()
            add(run.title() if caps else run, 'caps' if caps else 'titlecase', where)
            # Sub-runs catch "Netflix's Wednesday Season 2" -> "Wednesday"; they always need a person signal.
            for i in range(len(words)):
                for j in range(i + 2, min(len(words), i + 7) + 1):
                    if (i, j) != (0, len(words)) and words[i].lower() not in JOINERS and words[j - 1].lower() not in JOINERS:
                        add(' '.join(words[i:j]), 'subrun', where)
    return [{k: v for k, v in m.items() if k != 'order'} for m in out.values()]


def capital_runs(text):
    runs, current = [], []
    for token in WORD.findall(text):
        clean = token.strip("'’.-")
        if clean and (clean[0].isupper() or clean[0].isdigit()):
            current.append(clean)
        elif current and clean.lower() in JOINERS:
            current.append(clean)
        else:
            if current:
                runs.append(current)
            current = []
    if current:
        runs.append(current)
    out = []
    for run in runs:
        while run and run[-1].lower() in JOINERS:
            run = run[:-1]
        if run:
            out.append(' '.join(run))
    return out


def distinctive(key):
    words = key.split()
    significant = [w for w in words if w not in STOP]
    return len(words) >= 2 and len(significant) >= 1 and len(key) >= 6


def slug_words(post):
    urls = [post.get('url') or ''] if post.get('source') == 'rss' else []
    urls += re.findall(r'https?://\S+|\b[\w-]+\.[a-z]{2,}/\S+', post.get('text') or '')
    urls += (post.get('quality_evidence') or {}).get('urls') or []
    slugs = []
    for url in urls:
        path = re.sub(r'^[a-z]+://[^/]+', '', url.split('?')[0])
        slugs.append(' ' + norm(path.replace('-', ' ').replace('_', ' ')) + ' ')
    return ''.join(slugs)


class DeterministicMatcher:
    def __init__(self, select):
        self.select = select

    def match(self, posts):
        output = {p['post_id']: [] for p in posts}
        official = self.official(posts)
        found = {}
        for p in posts:
            keys = official.get(p['source_id'], set()) if p['source'] == 'youtube' else set()
            if len(keys) == 1:
                output[p['post_id']] = [{'key': next(iter(keys)), 'lane': 'official_video_id', 'confidence': .995,
                                        'confidence_basis': 'rule_score_not_calibrated',
                                        'reason': 'Allowlisted channel and unique official catalog video ID'}]
            else:
                found[p['post_id']] = mentions(p)
        names = sorted({m['key'] for ms in found.values() for m in ms})
        catalog = self.lookup(names)
        headline_names = {m['key'] for ms in found.values() for m in ms if m['where'] == 'headline'}
        people = self.people([c for key in headline_names for c in catalog.get(key, [])[:MAX_SHARED + 1]
                              if len(catalog.get(key, [])) <= MAX_SHARED])
        for p in posts:
            if p['post_id'] in found:
                output[p['post_id']] = self.decide(p, found[p['post_id']], catalog, people, official.get(p['source_id'], set()))
        return output

    def official(self, posts):
        yt = [p['source_id'] for p in posts if p['source'] == 'youtube']
        official = {}
        if yt:
            for row in self.select("SELECT media_type,media_tmdb_id,site_key FROM media_video WHERE site='YouTube' AND official=true AND site_key=ANY(?)", [yt]):
                kind = 'tv' if row['media_type'] in ('tv', 'show') else 'movie'
                official.setdefault(row['site_key'], set()).add(kind + ':' + str(row['media_tmdb_id']))
        return official

    def lookup(self, names):
        """Exact normalised title, original title or alternative title -> catalog rows."""
        catalog = {}
        for i in range(0, len(names), 25):
            chunk = names[i:i + 25]
            wanted = set(chunk)
            phrase = ' OR '.join('MATCH((title,original_title), ?) USING phrase' for _ in chunk)
            for kind, table in (('movie', 'movie'), ('tv', 'show')):
                for row in self.select(f'SELECT tmdb_id,title,original_title,release_year,popularity FROM {table} WHERE ({phrase}) LIMIT 5000', chunk):
                    for name in {norm(row['title']), norm(row['original_title'] or '')} & wanted:
                        add_candidate(catalog, name, kind, row)
            alias = ' OR '.join('MATCH(title, ?) USING phrase' for _ in chunk)
            aliases = self.select(f'SELECT media_type,media_tmdb_id,title FROM alternative_title WHERE ({alias}) LIMIT 5000', chunk)
            missing = {}
            for row in aliases:
                name = norm(row['title'])
                if name in wanted:
                    kind = 'tv' if row['media_type'] in ('tv', 'show') else 'movie'
                    missing.setdefault(kind, {}).setdefault(row['media_tmdb_id'], set()).add(name)
            for kind, ids in missing.items():
                table = 'show' if kind == 'tv' else 'movie'
                for row in self.select(f'SELECT tmdb_id,title,original_title,release_year,popularity FROM {table} WHERE tmdb_id=ANY(?)', [sorted(ids)]):
                    for name in ids[row['tmdb_id']]:
                        add_candidate(catalog, name, kind, row)
        return catalog

    def people(self, candidates):
        out = {}
        for kind in ('movie', 'tv'):
            all_ids = sorted({c['tmdb_id'] for c in candidates if c['media_type'] == kind})
            media = 'show' if kind == 'tv' else 'movie'
            crew, cast = [], []
            for i in range(0, len(all_ids), 400):
                ids = all_ids[i:i + 400]
                crew += self.select("SELECT media_tmdb_id,person_tmdb_id FROM person_worked_on WHERE media_type=? AND media_tmdb_id=ANY(?) AND job IN ('Director','Creator','Writer')", [media, ids])
                cast += self.select('SELECT media_tmdb_id,person_tmdb_id FROM person_appeared_in WHERE media_type=? AND media_tmdb_id=ANY(?) AND order_default < 8', [media, ids])
            persons = sorted({c['person_tmdb_id'] for c in crew + cast})
            names = {}
            for i in range(0, len(persons), 500):
                names.update({r['tmdb_id']: r['name'] for r in self.select('SELECT tmdb_id,name FROM person WHERE tmdb_id=ANY(?)', [persons[i:i + 500]])})
            for credit in crew + cast:
                if credit['person_tmdb_id'] in names:
                    out.setdefault(kind + ':' + str(credit['media_tmdb_id']), set()).add(names[credit['person_tmdb_id']])
        return out

    def decide(self, post, found, catalog, people, official_keys):
        headline, description = text_of(post)
        text = headline + '\n' + description
        plain_text = ' ' + norm(text) + ' '
        slug = slug_words(post)
        published = str(post.get('published_at') or '')[:4]
        years = {int(y) for y in YEAR.findall(text) if y != published}
        season = bool(SEASON.search(text))
        tv_hint, movie_hint = bool(TV_WORDS.search(text)), bool(MOVIE_WORDS.search(text))
        resolved = [m for m in found if catalog.get(m['key']) and m['where'] == 'headline']
        # Longest match wins: "Captain Hook" never stands in for "Captain Hook: The Cursed Tides".
        found = [m for m in found if not any(m['key'] != o['key'] and (' ' + m['key'] + ' ') in (' ' + o['key'] + ' ')
                                             for o in resolved)]
        accepted = {}
        for m in sorted(found, key=lambda m: (-m['rank'], headline.lower().find(m['raw'].lower()), -len(m['key']))):
            rows = catalog.get(m['key'], [])
            # The title must be named in the headline (the article card for Bluesky).
            if not rows or len(rows) > MAX_SHARED or m['where'] != 'headline' or reference_only(m['raw'], headline):
                continue
            adjacent = {int(y) for y in re.findall(re.escape(m['raw']) + r'[’\'"”]*\s*\((\d{4})\)', text, re.I)}
            def signals(row):
                found_signals = []
                year = row.get('release_year')
                if year and any(abs(y - year) <= 1 for y in adjacent | (years if m['rank'] >= 2 else set())):
                    found_signals.append('year')
                names = [n for n in people.get(row['key'], ()) if len(norm(n).split()) >= 2]
                if any(' ' + norm(n) + ' ' in plain_text for n in names):
                    found_signals.append('person')
                if row['media_type'] == 'tv' and season and m['rank'] >= 2:
                    found_signals.append('season')
                if row['key'] in official_keys:
                    found_signals.append('official')
                return found_signals
            # A person's name ("Zakir Khan") is not a title mention, even when a title shares it.
            if any(norm(n) == m['key'] for row in rows for n in people.get(row['key'], ())):
                continue
            scored = [(row, signals(row)) for row in rows]
            in_slug = (' ' + m['key'] + ' ') in slug and len(m['key']) >= 4
            if m['cue'] == 'subrun':
                scored = [s for s in scored if 'person' in s[1]]
            backed = [s for s in scored if s[1]]
            choice, basis = None, []
            if backed:
                best = max(len(s[1]) for s in backed)
                strong = [s for s in backed if len(s[1]) == best]
                # Type words narrow a shared name but never prove identity alone.
                typed = [s for s in strong if (s[0]['media_type'] == 'tv' and tv_hint and not movie_hint)
                         or (s[0]['media_type'] == 'movie' and movie_hint and not tv_hint)]
                if len(strong) == 1:
                    choice, basis = strong[0][0], list(strong[0][1])
                elif len(typed) == 1:
                    choice, basis = typed[0][0], typed[0][1] + ['type']
            elif len(rows) == 1 and distinctive(m['key']) and m['rank'] >= 1 and not subtitled(m['raw'], headline) \
                    and not (GAME_WORDS.search(text) and not MOVIE_WORDS.search(text)):
                if m['rank'] >= 2 or in_slug:
                    choice, basis = rows[0], ['unique_name']
            if choice is None:
                continue
            if in_slug:
                basis.append('slug')
            if choice['key'] not in accepted:
                accepted[choice['key']] = {'key': choice['key'], 'lane': 'deterministic_' + m['cue'], 'confidence': .95,
                    'confidence_basis': 'rule_score_not_calibrated',
                    'reason': f"{VERSION}: {m['cue']} mention '{m['raw'][:80]}' = {choice['title']} ({choice.get('release_year')}); signals: {', '.join(basis)}"}
        if len(accepted) > MAX_LINKS:
            return []
        return list(accepted.values())[:1] if len(accepted) > 1 and not listing(headline) else list(accepted.values())


def subtitled(raw, headline):
    """'Harry Potter: Castle Chronicles' names a different work than 'Harry Potter'."""
    return bool(re.search(re.escape(raw) + r"[’'\"”]*:\s+(?!(?:official|trailer|teaser|review|first|season|episode|staffel|sneak)\b)"
                          r"[A-Z0-9][\w’'-]*\s+[A-Z0-9]", headline, re.I if raw.isupper() else 0))


def title_cased(raw):
    words = [w for w in WORD.findall(raw) if w.lower() not in JOINERS]
    return bool(words) and all(w[0].isupper() or w[0].isdigit() for w in words)


def listing(headline):
    """Headlines that enumerate equal works: "'A,' 'B,' 'C' Make the Short List"."""
    return bool(re.search(r"[’'\"”],?\s*(?:,|and|&)\s*[‘'\"“]", headline)) and not re.search(r"(?i)\b(?:star|spinoff|sequel|creator)\b", headline)


def add_candidate(catalog, name, kind, row):
    key = kind + ':' + str(row['tmdb_id'])
    rows = catalog.setdefault(name, [])
    if all(r['key'] != key for r in rows):
        rows.append(row | {'key': key, 'media_type': kind})


def main():
    return {'library': True}

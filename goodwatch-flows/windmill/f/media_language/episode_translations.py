"""Additive TMDB text ingestion. Canonical season/episode membership is never written here."""
from dataclasses import dataclass
import time

LAUNCH_LOCALES = ('en', 'de', 'fr', 'es', 'it', 'pt-BR', 'pt-PT', 'ja', 'ko', 'zh-Hans', 'zh-Hant', 'pl', 'ru', 'ar')
BASES = {'en', 'de', 'fr', 'es', 'it', 'pt', 'ja', 'ko', 'zh', 'pl', 'ru', 'ar'}
KEY = ('show_id', 'tmdb_id', 'language_code', 'country_code')


def accepted_locale(language, country):
    if language not in BASES:
        return False
    if language == 'pt':
        return country in ('BR', 'PT')
    if language == 'zh':
        return country in ('CN', 'SG', 'TW', 'HK', 'MO')
    return True


def translation_rows(show_id, stable_id, payload):
    """A malformed response publishes nothing; blanks never clear a previous field."""
    if payload.get('id') != stable_id or not isinstance(payload.get('translations'), list):
        raise ValueError('Translation response does not match the canonical stable ID')
    rows = {}
    for item in payload['translations']:
        if not isinstance(item, dict):
            continue
        language, country = item.get('iso_639_1'), item.get('iso_3166_1')
        if not isinstance(country, str) or not accepted_locale(language, country):
            continue
        data = item.get('data')
        if not isinstance(data, dict):
            continue
        fields = {field: data[field].strip() for field in ('name', 'overview')
                  if isinstance(data.get(field), str) and data[field].strip()}
        if not fields:
            continue
        row = dict(zip(KEY, (show_id, stable_id, language, country))) | fields
        key = tuple(row[column] for column in KEY)
        # Duplicate locale records may add fields, but a blank cannot replace a value.
        rows[key] = rows.get(key, {}) | row
    return list(rows.values())


def publish_rows(connector, table, rows, *, preserve_existing=False):
    if table not in ('season_translation', 'episode_translation'):
        raise ValueError('Unexpected translation table')
    # Group by populated columns. Updates own ONLY returned nonblank fields, so a
    # partial response cannot overwrite an existing overview with NULL or empty text.
    groups = {}
    for row in rows:
        columns = tuple(column for column in (*KEY, 'name', 'overview') if column in row)
        groups.setdefault(columns, []).append(tuple(row[column] for column in columns))
    for columns, values in groups.items():
        updates = ', '.join(
            (f"{column} = CASE WHEN {table}.{column} IS NULL OR {table}.{column} = '' "
             f"THEN excluded.{column} ELSE {table}.{column} END") if preserve_existing
            else f'{column} = excluded.{column}' for column in columns if column not in KEY)
        sql = (f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)}) "
               f"ON CONFLICT ({', '.join(KEY)}) DO UPDATE SET {updates}")
        connector.run_many(sql, values)
    return len(rows)


@dataclass(frozen=True)
class Bounds:
    titles: int = 2
    seasons: int = 10
    episodes: int = 100
    requests: int = 250
    requests_per_second: float = 2

    def validate(self):
        if not (1 <= self.titles <= 100 and 1 <= self.seasons <= 100
                and 1 <= self.episodes <= 1000 and 1 <= self.requests <= 5000
                and 0 < self.requests_per_second <= 5):
            raise ValueError('Backfill bounds exceed the supported safe range')


def ingest_titles(tmdb_ids, get, connector=None, *, dry_run=True, bounds=Bounds(), sleep=time.sleep):
    """Explicit IDs in caller priority order. Bounded, serial and additive; no DELETE."""
    bounds.validate()
    ids = list(dict.fromkeys(tmdb_ids))
    if len(ids) > bounds.titles or any(type(i) is not int or i <= 0 for i in ids):
        raise ValueError('Supply a bounded positive integer title list')
    if not dry_run and connector is None:
        raise ValueError('Publication requires a connector')
    result = {'dry_run': dry_run, 'requests': 0, 'seasons': 0, 'episodes': 0,
              'rows': 0, 'failures': [], 'truncated': False}

    def request(path):
        if result['requests'] >= bounds.requests:
            result['truncated'] = True
            raise StopIteration('request limit')
        if result['requests']:
            sleep(1 / bounds.requests_per_second)
        result['requests'] += 1
        return get(path)

    def text(table, show_id, stable_id, path):
        try:
            rows = translation_rows(show_id, stable_id, request(path + '/translations'))
            pending[table].extend(rows)
            result['rows'] += len(rows)
        except StopIteration:
            raise
        except Exception as error:
            # Paths and exception classes only: never print API keys or HTTP bodies.
            result['failures'].append({'path': path, 'error': type(error).__name__})

    try:
        for show_id in ids:
            pending = {'season_translation': [], 'episode_translation': []}
            failures_before = len(result['failures'])
            try:
                show = request(f'tv/{show_id}')
                if show.get('id') != show_id or not isinstance(show.get('seasons'), list):
                    raise ValueError('Invalid show catalog')
                seen = set()
                for summary in show['seasons']:
                    number = summary.get('season_number')
                    if type(number) is not int or number < 0 or number in seen:
                        continue
                    seen.add(number)
                    if result['seasons'] >= bounds.seasons:
                        result['truncated'] = True
                        break
                    path = f'tv/{show_id}/season/{number}'
                    try:
                        season = request(path)
                        if season.get('id') != summary.get('id') or type(season.get('id')) is not int:
                            raise ValueError('Season identity mismatch')
                        if season.get('season_number') != number or not isinstance(season.get('episodes'), list):
                            raise ValueError('Invalid season catalog')
                        result['seasons'] += 1
                        text('season_translation', show_id, season['id'], path)
                        for episode in season['episodes']:
                            if result['episodes'] >= bounds.episodes:
                                result['truncated'] = True
                                break
                            episode_id, episode_number = episode.get('id'), episode.get('episode_number')
                            if (type(episode_id) is not int or episode_id <= 0 or type(episode_number) is not int
                                    or episode_number <= 0 or episode.get('season_number') != number
                                    or episode.get('show_id', show_id) != show_id):
                                continue
                            result['episodes'] += 1
                            text('episode_translation', show_id, episode_id, path + f'/episode/{episode_number}')
                    except StopIteration:
                        raise
                    except Exception as error:
                        result['failures'].append({'path': path, 'error': type(error).__name__})
            except StopIteration:
                raise
            except Exception as error:
                result['failures'].append({'path': f'tv/{show_id}', 'error': type(error).__name__})
            finally:
                # Stage this title before publication. Any failure or bound hit
                # preserves prior nonblank values, even for earlier successful
                # endpoints. A complete cohort may refresh returned fields.
                preserve_existing = result['truncated'] or len(result['failures']) > failures_before
                if not dry_run:
                    for table, rows in pending.items():
                        publish_rows(connector, table, rows, preserve_existing=preserve_existing)
    except StopIteration:
        pass
    return result

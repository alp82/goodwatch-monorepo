import os
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from arango import ArangoClient
import datetime
from decimal import Decimal
import json
import re
from config import get_arango_client, get_arango_db, get_arango_sys_db, ARANGO_DB, ARANGO_USER, ARANGO_PASSWORD
import time

class MovieImporter:
    def __init__(self, pg_cfg):
        self.pg_cfg = pg_cfg
        self.arango_client = None
        self.db = None
        self.graph = None
        self.collections = {}

    def connect_arango(self):
        client = get_arango_client()
        sys_db = get_arango_sys_db(client)
        if not sys_db.has_database(ARANGO_DB):
            sys_db.create_database(ARANGO_DB, users=[
                {'username': ARANGO_USER, 'password': ARANGO_PASSWORD, 'active': True}
            ])
        self.db = get_arango_db(client)
        self.collections = {}
        self.graph = None

    def ensure_collection(self, name, **kwargs):
        if self.db.has_collection(name):
            coll = self.db.collection(name)
        else:
            coll = self.db.create_collection(name, **kwargs)
        self.collections[name] = coll
        return coll

    def ensure_graph(self, graph_name, edge_defs):
        if self.db.has_graph(graph_name):
            graph = self.db.graph(graph_name)
            current_defs = {ed['edge_collection']: ed for ed in graph.edge_definitions()}
            for ed in edge_defs:
                ecoll = ed['edge_collection']
                froms = set(ed['from_vertex_collections'])
                tos = set(ed['to_vertex_collections'])
                if ecoll in current_defs:
                    cur_froms = set(current_defs[ecoll]['from_vertex_collections'])
                    cur_tos = set(current_defs[ecoll]['to_vertex_collections'])
                    if cur_froms != froms or cur_tos != tos:
                        graph.delete_edge_definition(ecoll)
                        graph.create_edge_definition(**ed)
                else:
                    graph.create_edge_definition(**ed)
        else:
            graph = self.db.create_graph(graph_name)
            for ed in edge_defs:
                graph.create_edge_definition(**ed)
        self.graph = graph
        return graph

    def setup_schema(self):
        # Ensure all collections
        collections = [
            'movies', 'shows', 'persons', 'genres', 'keywords', 'tropes',
            'movie_series', 'production_companies',
            'translations', 'images', 'videos', 'alternative_titles', 'certifications',
            'countries', 'languages', 'streaming_services', 'streaming_offers', 'seasons', 'scores'
        ]
        for name in collections:
            if not self.db.has_collection(name):
                self.db.create_collection(name)
            self.collections[name] = self.db.collection(name)

        # Edge definitions
        edge_defs = [
            ('has_translation', ['movies', 'shows'], ['translations']),
            ('has_image', ['movies', 'shows'], ['images']),
            ('has_video', ['movies', 'shows'], ['videos']),
            ('has_alternative_title', ['movies', 'shows'], ['alternative_titles']),
            ('has_certification', ['movies', 'shows'], ['certifications']),
            ('belongs_to_movie_series', ['movies'], ['movie_series']),
            ('produced_by', ['movies'], ['production_companies']),
            ('originates_from_country', ['movies', 'shows'], ['countries']),
            ('has_original_language', ['movies', 'shows'], ['languages']),
            ('has_spoken_language', ['movies', 'shows'], ['languages']),
            ('certification_for_country', ['certifications'], ['countries']),
            ('translation_in_language', ['translations'], ['languages']),
            ('alternative_title_for_country', ['alternative_titles'], ['countries']),
            ('available_in_country', ['movies', 'shows'], ['countries']),
            ('has_streaming_offer', ['movies', 'shows'], ['streaming_offers']),
            ('offer_for_streaming_service', ['streaming_offers'], ['streaming_services']),
            ('offer_in_country', ['streaming_offers'], ['countries']),
            ('has_season', ['shows'], ['seasons']),
            ('has_score', ['movies', 'shows'], ['scores']),
            ('translation_in_country', ['translations'], ['countries']),
        ]
        if not self.graph:
            raise Exception("Graph not initialized. Call connect_arango() and ensure_graph() first.")
        for edge, froms, tos in edge_defs:
            if not self.graph.has_edge_definition(edge):
                self.graph.create_edge_definition(
                    edge_collection=edge,
                    from_vertex_collections=froms,
                    to_vertex_collections=tos
                )

    def connect_postgres(self):
        self.pg_conn = psycopg2.connect(**self.pg_cfg)
        self.pg_cur = self.pg_conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    def close_postgres(self):
        if hasattr(self, 'pg_cur'):
            self.pg_cur.close()
        if hasattr(self, 'pg_conn'):
            self.pg_conn.close()

    @staticmethod
    def make_human_key(*args):
        import re
        raw = '_'.join(str(a) for a in args if a is not None)
        key = raw.lower().replace(' ', '_')
        key = re.sub(r'[^a-z0-9_\-]', '', key)
        return key[:128]

    def import_items(self, *, query, collection_name, id_prefix, type_label):
        start_time = time.time()
        try:
            self.pg_cur.execute(query)
            items = self.pg_cur.fetchall()
            print(f'Fetched {len(items)} {type_label} from PostgreSQL.')
            imported_count = 0

            # Debug counters for related collections
            node_counts = {
                'persons': 0,
                'translations': 0,
                'alternative_titles': 0,
                'images': 0,
                'videos': 0,
                'certifications': 0,
                'movie_series': 0,
                'production_companies': 0,
                'countries': 0,
                'languages': 0,
                'streaming_services': 0,
                'streaming_offers': 0,
                'seasons': 0,
                'scores': 0,
                'genres': 0,
                'keywords': 0,
                'tropes': 0
            }

            # Prepare batch insert buffers for each related collection
            batch_docs = {
                'persons': [],
                'translations': [],
                'alternative_titles': [],
                'images': [],
                'videos': [],
                'certifications': [],
                'movie_series': [],
                'production_companies': [],
                'countries': [],
                'languages': [],
                'streaming_services': [],
                'streaming_offers': [],
                'seasons': [],
                'scores': [],
                'genres': [],
                'keywords': [],
                'tropes': []
            }
            batch_edges = {}
            # Edge collections used in this import
            edge_collections = set()

            main_docs = []

            def safe_key(val):
                return re.sub(r'[^a-zA-Z0-9_\-]', '', str(val).replace(' ', '_')).lower()[:128]

            def normalize_named_list(lst):
                norm = []
                for item in lst:
                    if isinstance(item, dict):
                        if 'id' in item and 'name' in item:
                            norm.append({'id': safe_key(item['name']), 'name': item['name']})
                        elif 'name' in item:
                            norm.append({'id': safe_key(item['name']), 'name': item['name']})
                    elif isinstance(item, str):
                        norm.append({'id': safe_key(item), 'name': item})
                return norm

            def parse_json_field(field):
                if isinstance(field, str):
                    try:
                        return json.loads(field)
                    except Exception:
                        return []
                return field if field else []

            def trim_val(val):
                try:
                    if isinstance(val, list):
                        preview = val[:2]
                        return f"{preview}... (+{len(val)-2} more)" if len(val) > 2 else str(preview)
                    s = str(val)
                    return s[:200] + ('...' if len(s) > 200 else '')
                except Exception:
                    return str(val)

            for item in items:
                doc = dict(item)
                for key, value in doc.items():
                    if isinstance(value, datetime.datetime) or isinstance(value, datetime.date):
                        doc[key] = value.isoformat()
                    elif isinstance(value, Decimal):
                        doc[key] = float(value)
                if collection_name in ('movies', 'shows'):
                    title = doc.get('title') or doc.get('original_title')
                    year = doc.get('release_year') or doc.get('first_air_year') or ''
                    tmdb_id = doc.get('tmdb_id')
                    doc['_key'] = self.make_human_key(title, year, tmdb_id)
                elif collection_name == 'persons':
                    name = doc.get('name')
                    pid = doc.get('id') or doc.get('_key') or doc.get('tmdb_id')
                    doc['_key'] = self.make_human_key(name, pid)
                elif collection_name in ('genres', 'keywords', 'tropes'):
                    name = doc.get('name')
                    doc['_key'] = safe_key(name)
                else:
                    doc['_key'] = safe_key(doc.get('name') or doc.get('id') or doc.get('tmdb_id'))
                if not doc['_key']:
                    print(f"Skipping {type_label} due to missing or null key: {doc.get('title')}")
                    continue
                # Remove all redundant fields at once
                redundant_fields = set([
                    'genres', 'keywords', 'tropes', 'cast', 'crew',
                    'translations', 'images', 'videos', 'alternative_titles', 'certifications', 'collection',
                    'origin_country_codes', 'original_language_code', 'spoken_language_codes',
                    'streaming_providers', 'streaming_country_codes', 'seasons',
                    # All score fields
                    'tmdb_url', 'tmdb_user_score_original', 'tmdb_user_score_normalized_percent', 'tmdb_user_score_rating_count',
                    'imdb_url', 'imdb_user_score_original', 'imdb_user_score_normalized_percent', 'imdb_user_score_rating_count',
                    'metacritic_url', 'metacritic_user_score_original', 'metacritic_user_score_normalized_percent', 'metacritic_user_score_rating_count',
                    'metacritic_meta_score_original', 'metacritic_meta_score_normalized_percent', 'metacritic_meta_score_review_count',
                    'rotten_tomatoes_url', 'rotten_tomatoes_audience_score_original', 'rotten_tomatoes_audience_score_normalized_percent', 'rotten_tomatoes_audience_score_rating_count',
                    'rotten_tomatoes_tomato_score_original', 'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_tomato_score_review_count',
                    'aggregated_user_score_normalized_percent', 'aggregated_user_score_rating_count',
                    'aggregated_official_score_normalized_percent', 'aggregated_official_score_review_count',
                    'aggregated_overall_score_normalized_percent', 'aggregated_overall_score_voting_count',
                ])
                for field in list(doc.keys()):
                    if field in redundant_fields:
                        doc.pop(field)
                translations = parse_json_field(item.get('translations'))
                translation_docs = []
                translation_edges = []
                translation_lang_edges = []
                translation_country_edges = []
                if translations:
                    for t in translations:
                        iso1 = t.get('iso_639_1') or 'xx'
                        iso2 = t.get('iso_3166_1') or 'xx'
                        tkey = self.make_human_key(doc['_key'], iso1, iso2)
                        tdoc = {
                            '_key': tkey,
                            'parent_key': doc['_key'],
                            'iso_639_1': iso1,
                            'iso_3166_1': iso2,
                            'name': t.get('name'),
                            'english_name': t.get('english_name'),
                        }
                        if 'data' in t and isinstance(t['data'], dict):
                            tdoc.update(t['data'])
                        batch_docs['translations'].append(tdoc)
                        translation_edges.append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"translations/{tkey}"
                        })
                        if iso1:
                            lang = iso1.strip().lower()
                            batch_docs['languages'].append({'_key': lang})
                            translation_lang_edges.append({
                                '_from': f"translations/{tkey}",
                                '_to': f"languages/{lang}"
                            })
                        if iso2:
                            country = iso2.strip().upper()
                            batch_docs['countries'].append({'_key': country})
                            translation_country_edges.append({
                                '_from': f"translations/{tkey}",
                                '_to': f"countries/{country}"
                            })
                alt_titles = parse_json_field(item.get('alternative_titles'))
                alt_title_docs = []
                alt_title_edges = []
                alt_title_country_edges = []
                if isinstance(alt_titles, list):
                    for i, alt in enumerate(alt_titles):
                        at_key = self.make_human_key(doc['_key'], alt.get('title'), alt.get('iso_3166_1') or i)
                        atdoc = dict(alt)
                        atdoc['_key'] = at_key
                        atdoc['parent_key'] = doc['_key']
                        batch_docs['alternative_titles'].append(atdoc)
                        alt_title_edges.append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"alternative_titles/{at_key}"
                        })
                        if alt.get('iso_3166_1'):
                            code = alt['iso_3166_1'].strip().upper()
                            batch_docs['countries'].append({'_key': code})
                            alt_title_country_edges.append({
                                '_from': f"alternative_titles/{at_key}",
                                '_to': f"countries/{code}"
                            })
                images = parse_json_field(item.get('images'))
                videos = parse_json_field(item.get('videos'))
                image_docs = []
                image_edges = []
                video_docs = []
                video_edges = []
                if isinstance(images, dict):
                    for img_type, img_list in images.items():
                        for i, img in enumerate(img_list or []):
                            img_key = self.make_human_key(doc['_key'], img_type, img.get('file_path') or i)
                            idoc = dict(img)
                            idoc['_key'] = img_key
                            idoc['type'] = img_type
                            idoc['parent_key'] = doc['_key']
                            batch_docs['images'].append(idoc)
                            image_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"images/{img_key}"
                            })
                if isinstance(videos, dict):
                    for vid_type, vid_list in videos.items():
                        for i, vid in enumerate(vid_list or []):
                            vid_key = self.make_human_key(doc['_key'], vid_type, vid.get('id') or vid.get('key') or i)
                            vdoc = dict(vid)
                            vdoc['_key'] = vid_key
                            vdoc['type'] = vid_type
                            vdoc['parent_key'] = doc['_key']
                            batch_docs['videos'].append(vdoc)
                            video_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"videos/{vid_key}"
                            })
                certs = parse_json_field(item.get('certifications'))
                cert_docs = []
                cert_edges = []
                cert_country_edges = []
                if isinstance(certs, list):
                    for cert in certs:
                        country = cert.get('iso_3166_1')
                        release_dates = cert.get('release_dates', [])
                        for idx, rd in enumerate(release_dates):
                            key_parts = [doc['_key'], country or str(idx), rd.get('release_date') or str(idx), rd.get('certification') or '']
                            ckey = self.make_human_key(*key_parts)
                            cdoc = {
                                '_key': ckey,
                                'parent_key': doc['_key'],
                                'iso_3166_1': country,
                                'release_date': rd.get('release_date'),
                                'certification': rd.get('certification'),
                            }
                            batch_docs['certifications'].append(cdoc)
                            cert_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"certifications/{ckey}"
                            })
                            if country:
                                code = country.strip().upper()
                                batch_docs['countries'].append({'_key': code})
                                cert_country_edges.append({
                                    '_from': f"certifications/{ckey}",
                                    '_to': f"countries/{code}"
                                })
                collection_info = parse_json_field(item.get('collection'))
                collection_doc = None
                collection_edge = None
                if isinstance(collection_info, dict) and collection_info.get('id'):
                    tmdb_id = str(collection_info['id'])
                    name = collection_info.get('name') or ''
                    ckey = self.make_human_key(name, tmdb_id)
                    collection_doc = {
                        '_key': ckey,
                        'name': name,
                        'tmdb_collection_id': tmdb_id,
                        'poster_path': collection_info.get('poster_path'),
                        'backdrop_path': collection_info.get('backdrop_path')
                    }
                    batch_docs['movie_series'].append(collection_doc)
                    collection_edge = {
                        '_from': f"{id_prefix}/{doc['_key']}",
                        '_to': f"movie_series/{ckey}"
                    }
                    edge_collections.add('belongs_to_movie_series')
                    batch_edges.setdefault('belongs_to_movie_series', []).append(collection_edge)
                    doc.pop('collection', None)
                origin_country_codes = parse_json_field(item.get('origin_country_codes'))
                country_edges = []
                if isinstance(origin_country_codes, list):
                    for code in origin_country_codes:
                        code = code.strip().upper()
                        if code:
                            batch_docs['countries'].append({'_key': code})
                            country_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"countries/{code}"
                            })
                orig_lang = item.get('original_language_code')
                orig_lang_edge = None
                if orig_lang:
                    orig_lang = orig_lang.strip().lower()
                    batch_docs['languages'].append({'_key': orig_lang})
                    orig_lang_edge = {
                        '_from': f"{id_prefix}/{doc['_key']}",
                        '_to': f"languages/{orig_lang}"
                    }
                spoken_langs = parse_json_field(item.get('spoken_language_codes'))
                spoken_lang_edges = []
                if isinstance(spoken_langs, list):
                    for code in spoken_langs:
                        code = code.strip().lower()
                        if code:
                            batch_docs['languages'].append({'_key': code})
                            spoken_lang_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"languages/{code}"
                            })
                streaming_country_codes = parse_json_field(item.get('streaming_country_codes'))
                streaming_country_edges = []
                if isinstance(streaming_country_codes, list):
                    for code in streaming_country_codes:
                        code = code.strip().upper()
                        if code:
                            batch_docs['countries'].append({'_key': code})
                            streaming_country_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"countries/{code}"
                            })
                    doc.pop('streaming_country_codes', None)
                streaming_providers = parse_json_field(item.get('streaming_providers'))
                streaming_offer_docs = []
                streaming_offer_edges = []
                provider_edges = []
                offer_country_edges = []
                if isinstance(streaming_providers, dict):
                    for country, offers in streaming_providers.items():
                        country_code = country.strip().upper()
                        batch_docs['countries'].append({'_key': country_code})
                        link = offers.get('link')
                        for offer_type in ['ads', 'flatrate', 'buy', 'rent', 'free']:
                            for prov in offers.get(offer_type, []):
                                pid = str(prov['provider_id'])
                                provider_key = self.make_human_key(prov.get('provider_name'), pid)
                                batch_docs['streaming_services'].append({
                                    '_key': provider_key,
                                    'tmdb_id': pid,
                                    'provider_name': prov.get('provider_name'),
                                    'logo_path': prov.get('logo_path'),
                                    'display_priority': prov.get('display_priority')
                                })
                                offer_key = self.make_human_key(doc['_key'], country_code, offer_type, provider_key)
                                offer_doc = {
                                    '_key': offer_key,
                                    'type': offer_type,
                                    'country': country_code,
                                    'provider_id': provider_key,
                                    'link': link,
                                    'parent_key': doc['_key']
                                }
                                batch_docs['streaming_offers'].append(offer_doc)
                                streaming_offer_edges.append({
                                    '_from': f"{id_prefix}/{doc['_key']}",
                                    '_to': f"streaming_offers/{offer_key}"
                                })
                                provider_edges.append({
                                    '_from': f"streaming_offers/{offer_key}",
                                    '_to': f"streaming_services/{provider_key}"
                                })
                                offer_country_edges.append({
                                    '_from': f"streaming_offers/{offer_key}",
                                    '_to': f"countries/{country_code}"
                                })
                # persons (cast/crew)
                inserted_persons = set()
                genres = normalize_named_list(parse_json_field(item.get('genres')))
                # --- FIX: Add genres to batch_docs['genres'] ---
                for genre in genres:
                    if genre['id']:
                        batch_docs['genres'].append({'_key': genre['id'], 'name': genre['name']})
                # --- Ensure has_genre edges ---
                for genre in genres:
                    if genre['id']:
                        edge_collections.add('has_genre')
                        batch_edges.setdefault('has_genre', []).append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"genres/{genre['id']}"
                        })
                keywords = normalize_named_list(parse_json_field(item.get('keywords')))
                for keyword in keywords:
                    if keyword['id']:
                        batch_docs['keywords'].append({'_key': keyword['id'], 'name': keyword['name']})
                # --- Ensure has_keyword edges ---
                for keyword in keywords:
                    if keyword['id']:
                        edge_collections.add('has_keyword')
                        batch_edges.setdefault('has_keyword', []).append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"keywords/{keyword['id']}"
                        })
                tropes_raw = parse_json_field(item.get('tropes'))
                tropes = []
                for t in tropes_raw:
                    if isinstance(t, dict) and 'name' in t:
                        key = safe_key(t.get('name'))
                        tropes.append({'key': key, 'name': t['name']})
                for trope in tropes:
                    if trope['key']:
                        batch_docs['tropes'].append({'_key': trope['key'], 'name': trope['name']})
                # --- Ensure has_trope edges ---
                for trope in tropes:
                    if trope['key']:
                        edge_collections.add('has_trope')
                        batch_edges.setdefault('has_trope', []).append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"tropes/{trope['key']}"
                        })
                cast = parse_json_field(item.get('cast'))
                crew = parse_json_field(item.get('crew'))
                for cast_member in cast:
                    pname = cast_member.get('name')
                    pid = cast_member.get('id')
                    person_key = self.make_human_key(pname, pid)
                    if person_key in inserted_persons:
                        continue
                    inserted_persons.add(person_key)
                    person_id = f"persons/{person_key}"
                    batch_docs['persons'].append({
                        '_key': person_key,
                        'name': pname,
                        'profile_path': cast_member.get('profile_path')
                    })
                    node_counts['persons'] += 1
                    edge_collections.add('appeared_in')
                    batch_edges.setdefault('appeared_in', []).append({
                        '_from': person_id,
                        '_to': f"{id_prefix}/{doc['_key']}",
                        'character': cast_member.get('character'),
                        'order': cast_member.get('order')
                    })
                for crew_member in crew:
                    pname = crew_member.get('name')
                    pid = crew_member.get('id')
                    person_key = self.make_human_key(pname, pid)
                    if person_key in inserted_persons:
                        continue
                    inserted_persons.add(person_key)
                    person_id = f"persons/{person_key}"
                    batch_docs['persons'].append({
                        '_key': person_key,
                        'name': pname,
                        'profile_path': crew_member.get('profile_path')
                    })
                    node_counts['persons'] += 1
                    edge_collections.add('worked_on')
                    batch_edges.setdefault('worked_on', []).append({
                        '_from': person_id,
                        '_to': f"{id_prefix}/{doc['_key']}",
                        'job': crew_member.get('job'),
                        'department': crew_member.get('department')
                    })
                # Normalize scores/ratings
                score_specs = [
                    # source, url_field, user_original, user_percent, user_count, critics_original, critics_percent, critics_count, combined_percent, combined_count
                    ('tmdb', 'tmdb_url', 'tmdb_user_score_original', 'tmdb_user_score_normalized_percent', 'tmdb_user_score_rating_count', None, None, None, None, None),
                    ('imdb', 'imdb_url', 'imdb_user_score_original', 'imdb_user_score_normalized_percent', 'imdb_user_score_rating_count', None, None, None, None, None),
                    ('metacritic', 'metacritic_url', 'metacritic_user_score_original', 'metacritic_user_score_normalized_percent', 'metacritic_user_score_rating_count', 'metacritic_meta_score_original', 'metacritic_meta_score_normalized_percent', 'metacritic_meta_score_review_count', None, None),
                    ('rotten_tomatoes', 'rotten_tomatoes_url', 'rotten_tomatoes_audience_score_original', 'rotten_tomatoes_audience_score_normalized_percent', 'rotten_tomatoes_audience_score_rating_count', 'rotten_tomatoes_tomato_score_original', 'rotten_tomatoes_tomato_score_normalized_percent', 'rotten_tomatoes_tomato_score_review_count', None, None),
                    ('aggregated', None, None, 'aggregated_user_score_normalized_percent', 'aggregated_user_score_rating_count', None, 'aggregated_official_score_normalized_percent', 'aggregated_official_score_review_count', 'aggregated_overall_score_normalized_percent', 'aggregated_overall_score_voting_count'),
                ]
                score_docs = []
                score_edges = []
                for spec in score_specs:
                    source, url_field, user_orig, user_pct, user_count, critics_orig, critics_pct, critics_count, combined_pct, combined_count = spec
                    url = item.get(url_field) if url_field else None
                    # User score
                    if user_pct and item.get(user_pct) is not None:
                        sdoc = {
                            '_key': self.make_human_key(source, 'user', doc['_key']),
                            'parent_key': doc['_key'],
                            'source': source,
                            'score_type': 'user',
                            'url': url,
                            'score_original': item.get(user_orig),
                            'percent': item.get(user_pct),
                            'rating_count': item.get(user_count)
                        }
                        batch_docs['scores'].append(sdoc)
                        score_edges.append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"scores/{sdoc['_key']}"
                        })
                    # Critics score
                    if critics_pct and item.get(critics_pct) is not None:
                        sdoc = {
                            '_key': self.make_human_key(source, 'critics', doc['_key']),
                            'parent_key': doc['_key'],
                            'source': source,
                            'score_type': 'critics',
                            'url': url,
                            'score_original': item.get(critics_orig),
                            'percent': item.get(critics_pct),
                            'rating_count': item.get(critics_count)
                        }
                        batch_docs['scores'].append(sdoc)
                        score_edges.append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"scores/{sdoc['_key']}"
                        })
                    # Combined score (aggregated only)
                    if combined_pct and item.get(combined_pct) is not None:
                        sdoc = {
                            '_key': self.make_human_key(source, 'combined', doc['_key']),
                            'parent_key': doc['_key'],
                            'source': source,
                            'score_type': 'combined',
                            'url': url,
                            'percent': item.get(combined_pct),
                            'rating_count': item.get(combined_count)
                        }
                        batch_docs['scores'].append(sdoc)
                        score_edges.append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"scores/{sdoc['_key']}"
                        })
                # Normalize seasons for shows
                season_docs = []
                season_edges = []
                if id_prefix == 'shows':
                    seasons = parse_json_field(item.get('seasons'))
                    if isinstance(seasons, list):
                        for s in seasons:
                            tmdb_id = str(s.get('id'))
                            season_number = str(s.get('season_number'))
                            if not tmdb_id or not season_number:
                                continue
                            sid = self.make_human_key(season_number, tmdb_id)
                            sdoc = {
                                '_key': sid,
                                'tmdb_id': tmdb_id,
                                'season_number': int(season_number) if season_number.isdigit() else season_number,
                                'name': s.get('name'),
                                'air_date': s.get('air_date'),
                                'vote_average': s.get('vote_average'),
                                'episode_count': s.get('episode_count'),
                                'parent_show_key': doc['_key']
                            }
                            batch_docs['seasons'].append(sdoc)
                            season_edges.append({
                                '_from': f"shows/{doc['_key']}",
                                '_to': f"seasons/{sid}"
                            })
                        doc.pop('seasons', None)
                main_docs.append(doc)

            # BULK INSERTS for related collections
            if main_docs:
                unique_main_keys = {d['_key'] for d in main_docs if '_key' in d}
                imported_count = len(unique_main_keys)
                try:
                    self.collections[collection_name].import_bulk(main_docs, overwrite=True)
                except Exception as e:
                    print(f"[WARNING] Bulk insert for main docs failed: {e}. Falling back to per-item insert.")
                    for d in main_docs:
                        try:
                            self.collections[collection_name].insert(d, overwrite=True)
                        except Exception as ie:
                            print(f"[ERROR] Failed to insert main doc with _key={d.get('_key')}: {ie}")
            for cname, docs in batch_docs.items():
                if docs:
                    unique_keys = {d['_key'] for d in docs if '_key' in d}
                    node_counts[cname] = len(unique_keys)
                    try:
                        self.collections[cname].import_bulk(docs, overwrite=True)
                    except Exception:
                        # fallback to per-item insert if bulk insert fails
                        for d in docs:
                            self.collections[cname].insert(d, overwrite=True)

            # EDGE INSERTS (count all attempted, since edges are always many-to-many)
            if alt_title_country_edges:
                edge_collections.add('alternative_title_for_country')
                batch_edges.setdefault('alternative_title_for_country', []).extend(alt_title_country_edges)
            if streaming_country_edges:
                edge_collections.add('available_in_country')
                batch_edges.setdefault('available_in_country', []).extend(streaming_country_edges)
            if cert_country_edges:
                edge_collections.add('certification_for_country')
                batch_edges.setdefault('certification_for_country', []).extend(cert_country_edges)
            if alt_title_edges:
                edge_collections.add('has_alternative_title')
                batch_edges.setdefault('has_alternative_title', []).extend(alt_title_edges)
            if cert_edges:
                edge_collections.add('has_certification')
                batch_edges.setdefault('has_certification', []).extend(cert_edges)
            if image_edges:
                edge_collections.add('has_image')
                batch_edges.setdefault('has_image', []).extend(image_edges)
            if orig_lang_edge:
                edge_collections.add('has_original_language')
                batch_edges.setdefault('has_original_language', []).append(orig_lang_edge)
            if score_edges:
                edge_collections.add('has_score')
                batch_edges.setdefault('has_score', []).extend(score_edges)
            if season_edges:
                edge_collections.add('has_season')
                batch_edges.setdefault('has_season', []).extend(season_edges)
            if spoken_lang_edges:
                edge_collections.add('has_spoken_language')
                batch_edges.setdefault('has_spoken_language', []).extend(spoken_lang_edges)
            if streaming_offer_edges:
                edge_collections.add('has_streaming_offer')
                batch_edges.setdefault('has_streaming_offer', []).extend(streaming_offer_edges)
            if translation_edges:
                edge_collections.add('has_translation')
                batch_edges.setdefault('has_translation', []).extend(translation_edges)
            if video_edges:
                edge_collections.add('has_video')
                batch_edges.setdefault('has_video', []).extend(video_edges)
            if provider_edges:
                edge_collections.add('offer_for_streaming_service')
                batch_edges.setdefault('offer_for_streaming_service', []).extend(provider_edges)
            if offer_country_edges:
                edge_collections.add('offer_in_country')
                batch_edges.setdefault('offer_in_country', []).extend(offer_country_edges)
            if country_edges:
                edge_collections.add('originates_from_country')
                batch_edges.setdefault('originates_from_country', []).extend(country_edges)
            if translation_lang_edges:
                edge_collections.add('translation_in_language')
                batch_edges.setdefault('translation_in_language', []).extend(translation_lang_edges)
            if translation_country_edges:
                edge_collections.add('translation_in_country')
                batch_edges.setdefault('translation_in_country', []).extend(translation_country_edges)
            for edge_name, edges in batch_edges.items():
                if edges:
                    node_counts[edge_name] = len(edges)
                    try:
                        self.graph.edge_collection(edge_name).import_bulk(edges)
                    except Exception:
                        for e in edges:
                            self.graph.edge_collection(edge_name).insert(e)

            print(f"Successfully imported/updated {imported_count} {type_label} into ArangoDB.")
            print("[RELATED NODES CREATED]:")
            for k, v in node_counts.items():
                if v > 0:
                    print(f"  {k}: {v}")
        except Exception as e:
            import traceback
            print(f"\n{'='*40}\n[IMPORT ERROR] {type_label.capitalize()}\n{'='*40}")
            print(f"Error: {e}\nType: {type(e).__name__}")
            tb = traceback.format_exc()
            print(f"Traceback (most recent call last):\n{tb}")
            print(f"{'='*40}\n")
        finally:
            elapsed = time.time() - start_time
            print(f"[TIMER] Importing {type_label} took {elapsed:.2f} seconds.")

    def import_movies(self):
        query = '''
            SELECT
              tmdb_id,
              created_at, updated_at,
              title, original_title, alternative_titles,
              tagline, synopsis, translations,
              popularity, status, adult,
              poster_path, backdrop_path,
              images, videos,
              release_date, release_year,
              runtime, budget, revenue,
              genres, keywords, tropes, dna,
              original_language_code,
              spoken_language_codes,
              streaming_providers, streaming_country_codes,
              production_company_ids,
              certifications,
              "cast", crew,
              collection,
              tmdb_recommendation_ids,
              tmdb_similar_ids,
              tmdb_url, tmdb_user_score_original, tmdb_user_score_normalized_percent, tmdb_user_score_rating_count,
              imdb_url, imdb_user_score_original, imdb_user_score_normalized_percent, imdb_user_score_rating_count,
              metacritic_url, metacritic_user_score_original, metacritic_user_score_normalized_percent, metacritic_user_score_rating_count,
                              metacritic_meta_score_original, metacritic_meta_score_normalized_percent, metacritic_meta_score_review_count,
              rotten_tomatoes_url, rotten_tomatoes_audience_score_original, rotten_tomatoes_audience_score_normalized_percent, rotten_tomatoes_audience_score_rating_count,
                              rotten_tomatoes_tomato_score_original, rotten_tomatoes_tomato_score_normalized_percent, rotten_tomatoes_tomato_score_review_count,
              aggregated_user_score_normalized_percent, aggregated_user_score_rating_count,
              aggregated_official_score_normalized_percent, aggregated_official_score_review_count,
              aggregated_overall_score_normalized_percent, aggregated_overall_score_voting_count,
              homepage, wikidata_id, facebook_id, instagram_id, twitter_id,
              tmdb_details_updated_at, tmdb_providers_updated_at, imdb_ratings_updated_at, metacritic_ratings_updated_at, rotten_tomatoes_ratings_updated_at, tvtropes_tags_updated_at, dna_updated_at
            FROM movies
            ORDER BY popularity DESC NULLS LAST
            LIMIT 10;
        '''
        self.import_items(query=query, collection_name='movies', id_prefix='movies', type_label='movies')

    def import_shows(self):
        query = '''
            SELECT
              tmdb_id,
              created_at, updated_at,
              title, original_title, alternative_titles,
              tagline, synopsis, translations,
              popularity, status, in_production, adult,
              poster_path, backdrop_path,
              images, videos,
              release_date, release_year,
              last_air_date, last_air_year,
              number_of_seasons, number_of_episodes, episode_runtime,
              genres, keywords, tropes, dna,
              origin_country_codes,
              original_language_code,
              spoken_language_codes,
              streaming_providers, streaming_country_codes,
              production_company_ids, network_ids,
              certifications,
              "cast", crew,
              seasons,
              tmdb_recommendation_ids,
              tmdb_similar_ids,
              tmdb_url, tmdb_user_score_original, tmdb_user_score_normalized_percent, tmdb_user_score_rating_count,
              imdb_url, imdb_user_score_original, imdb_user_score_normalized_percent, imdb_user_score_rating_count,
              metacritic_url, metacritic_user_score_original, metacritic_user_score_normalized_percent, metacritic_user_score_rating_count,
                              metacritic_meta_score_original, metacritic_meta_score_normalized_percent, metacritic_meta_score_review_count,
              rotten_tomatoes_url, rotten_tomatoes_audience_score_original, rotten_tomatoes_audience_score_normalized_percent, rotten_tomatoes_audience_score_rating_count,
                              rotten_tomatoes_tomato_score_original, rotten_tomatoes_tomato_score_normalized_percent, rotten_tomatoes_tomato_score_review_count,
              aggregated_user_score_normalized_percent, aggregated_user_score_rating_count,
              aggregated_official_score_normalized_percent, aggregated_official_score_review_count,
              aggregated_overall_score_normalized_percent, aggregated_overall_score_voting_count,
              homepage, wikidata_id, facebook_id, instagram_id, twitter_id,
              tmdb_details_updated_at, tmdb_providers_updated_at, imdb_ratings_updated_at, metacritic_ratings_updated_at, rotten_tomatoes_ratings_updated_at, tvtropes_tags_updated_at, dna_updated_at
            FROM tv
            ORDER BY popularity DESC NULLS LAST
            LIMIT 10;
        '''
        self.import_items(query=query, collection_name='shows', id_prefix='shows', type_label='shows')


def main():
    import os
    from dotenv import load_dotenv
    load_dotenv()
    pg_cfg = {
        'host': os.getenv('POSTGRES_HOST'),
        'port': os.getenv('POSTGRES_PORT', 5432),
        'dbname': os.getenv('POSTGRES_DB'),
        'user': os.getenv('POSTGRES_USER'),
        'password': os.getenv('POSTGRES_PASS')
    }
    importer = MovieImporter(pg_cfg)
    importer.connect_arango()
    # Ensure edge_defs are in the correct format for ensure_graph (list of dicts)
    edge_defs = [
        {'edge_collection': 'has_genre', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['genres']},
        {'edge_collection': 'has_keyword', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['keywords']},
        {'edge_collection': 'has_trope', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['tropes']},
        {'edge_collection': 'has_translation', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['translations']},
        {'edge_collection': 'has_image', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['images']},
        {'edge_collection': 'has_video', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['videos']},
        {'edge_collection': 'has_alternative_title', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['alternative_titles']},
        {'edge_collection': 'has_certification', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['certifications']},
        {'edge_collection': 'belongs_to_movie_series', 'from_vertex_collections': ['movies'], 'to_vertex_collections': ['movie_series']},
        {'edge_collection': 'produced_by', 'from_vertex_collections': ['movies'], 'to_vertex_collections': ['production_companies']},
        {'edge_collection': 'appeared_in', 'from_vertex_collections': ['persons'], 'to_vertex_collections': ['movies', 'shows']},
        {'edge_collection': 'worked_on', 'from_vertex_collections': ['persons'], 'to_vertex_collections': ['movies', 'shows']},
        {'edge_collection': 'tmdb_recommends', 'from_vertex_collections': ['movies'], 'to_vertex_collections': ['movies']},
        {'edge_collection': 'tmdb_similar_to', 'from_vertex_collections': ['movies'], 'to_vertex_collections': ['movies']},
        {'edge_collection': 'originates_from_country', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['countries']},
        {'edge_collection': 'has_original_language', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['languages']},
        {'edge_collection': 'has_spoken_language', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['languages']},
        {'edge_collection': 'certification_for_country', 'from_vertex_collections': ['certifications'], 'to_vertex_collections': ['countries']},
        {'edge_collection': 'translation_in_language', 'from_vertex_collections': ['translations'], 'to_vertex_collections': ['languages']},
        {'edge_collection': 'alternative_title_for_country', 'from_vertex_collections': ['alternative_titles'], 'to_vertex_collections': ['countries']},
        {'edge_collection': 'available_in_country', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['countries']},
        {'edge_collection': 'has_streaming_offer', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['streaming_offers']},
        {'edge_collection': 'offer_for_streaming_service', 'from_vertex_collections': ['streaming_offers'], 'to_vertex_collections': ['streaming_services']},
        {'edge_collection': 'offer_in_country', 'from_vertex_collections': ['streaming_offers'], 'to_vertex_collections': ['countries']},
        {'edge_collection': 'has_season', 'from_vertex_collections': ['shows'], 'to_vertex_collections': ['seasons']},
        {'edge_collection': 'has_score', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['scores']},
        {'edge_collection': 'translation_in_country', 'from_vertex_collections': ['translations'], 'to_vertex_collections': ['countries']},
    ]
    importer.ensure_graph('movie_graph', edge_defs)
    if not importer.graph:
        raise Exception("ArangoDB graph was not initialized after ensure_graph().")
    importer.setup_schema()
    importer.connect_postgres()
    try:
        importer.import_movies()
        importer.import_shows()
    finally:
        importer.close_postgres()

if __name__ == '__main__':
    main()
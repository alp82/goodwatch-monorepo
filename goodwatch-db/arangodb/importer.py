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
        try:
            self.pg_cur.execute(query)
            items = self.pg_cur.fetchall()
            print(f'Fetched {len(items)} {type_label} from PostgreSQL.')
            imported_count = 0

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

            # Ensure translations collection and edge
            if 'translations' not in self.collections:
                if not self.db.has_collection('translations'):
                    self.db.create_collection('translations')
                self.collections['translations'] = self.db.collection('translations')
            if not self.graph.has_edge_definition('has_translation'):
                self.graph.create_edge_definition(
                    edge_collection='has_translation',
                    from_vertex_collections=['movies', 'shows'],
                    to_vertex_collections=['translations']
                )

            # Ensure images/videos collections and edges
            if 'images' not in self.collections:
                if not self.db.has_collection('images'):
                    self.db.create_collection('images')
                self.collections['images'] = self.db.collection('images')
            if 'videos' not in self.collections:
                if not self.db.has_collection('videos'):
                    self.db.create_collection('videos')
                self.collections['videos'] = self.db.collection('videos')
            if not self.graph.has_edge_definition('has_image'):
                self.graph.create_edge_definition(
                    edge_collection='has_image',
                    from_vertex_collections=['movies', 'shows'],
                    to_vertex_collections=['images']
                )
            if not self.graph.has_edge_definition('has_video'):
                self.graph.create_edge_definition(
                    edge_collection='has_video',
                    from_vertex_collections=['movies', 'shows'],
                    to_vertex_collections=['videos']
                )

            # Ensure alternative_titles collection and edge
            if 'alternative_titles' not in self.collections:
                if not self.db.has_collection('alternative_titles'):
                    self.db.create_collection('alternative_titles')
                self.collections['alternative_titles'] = self.db.collection('alternative_titles')
            if not self.graph.has_edge_definition('has_alternative_title'):
                self.graph.create_edge_definition(
                    edge_collection='has_alternative_title',
                    from_vertex_collections=['movies', 'shows'],
                    to_vertex_collections=['alternative_titles']
                )

            # Ensure certifications collection and edge
            if 'certifications' not in self.collections:
                if not self.db.has_collection('certifications'):
                    self.db.create_collection('certifications')
                self.collections['certifications'] = self.db.collection('certifications')
            if not self.graph.has_edge_definition('has_certification'):
                self.graph.create_edge_definition(
                    edge_collection='has_certification',
                    from_vertex_collections=['movies', 'shows'],
                    to_vertex_collections=['certifications']
                )

            # Ensure movie_series and production_companies collections and edges
            if 'movie_series' not in self.collections:
                if not self.db.has_collection('movie_series'):
                    self.db.create_collection('movie_series')
                self.collections['movie_series'] = self.db.collection('movie_series')
            if 'production_companies' not in self.collections:
                if not self.db.has_collection('production_companies'):
                    self.db.create_collection('production_companies')
                self.collections['production_companies'] = self.db.collection('production_companies')
            for edge_def in [
                ('belongs_to_movie_series', ['movies'], ['movie_series']),
                ('produced_by', ['movies'], ['production_companies']),
            ]:
                if not self.graph.has_edge_definition(edge_def[0]):
                    self.graph.create_edge_definition(
                        edge_collection=edge_def[0],
                        from_vertex_collections=edge_def[1],
                        to_vertex_collections=edge_def[2]
                    )

            # Ensure countries and languages collections and edges
            if 'countries' not in self.collections:
                if not self.db.has_collection('countries'):
                    self.db.create_collection('countries')
                self.collections['countries'] = self.db.collection('countries')
            if 'languages' not in self.collections:
                if not self.db.has_collection('languages'):
                    self.db.create_collection('languages')
                self.collections['languages'] = self.db.collection('languages')
            for edge_def in [
                ('originates_from_country', ['movies', 'shows'], ['countries']),
                ('has_original_language', ['movies', 'shows'], ['languages']),
                ('has_spoken_language', ['movies', 'shows'], ['languages']),
            ]:
                if not self.graph.has_edge_definition(edge_def[0]):
                    self.graph.create_edge_definition(
                        edge_collection=edge_def[0],
                        from_vertex_collections=edge_def[1],
                        to_vertex_collections=edge_def[2]
                    )

            # Ensure edges for code normalization in subdocs
            for edge_def in [
                ('certification_for_country', ['certifications'], ['countries']),
                ('translation_in_language', ['translations'], ['languages']),
                ('alt_title_for_country', ['alternative_titles'], ['countries']),
            ]:
                if not self.graph.has_edge_definition(edge_def[0]):
                    self.graph.create_edge_definition(
                        edge_collection=edge_def[0],
                        from_vertex_collections=edge_def[1],
                        to_vertex_collections=edge_def[2]
                    )

            # Ensure streaming collections and edges
            if 'streaming_services' not in self.collections:
                if not self.db.has_collection('streaming_services'):
                    self.db.create_collection('streaming_services')
                self.collections['streaming_services'] = self.db.collection('streaming_services')
            if 'streaming_offers' not in self.collections:
                if not self.db.has_collection('streaming_offers'):
                    self.db.create_collection('streaming_offers')
                self.collections['streaming_offers'] = self.db.collection('streaming_offers')
            for edge_def in [
                ('available_in_country', ['movies', 'shows'], ['countries']),
                ('has_streaming_offer', ['movies', 'shows'], ['streaming_offers']),
                ('offer_for_streaming_service', ['streaming_offers'], ['streaming_services']),
                ('offer_in_country', ['streaming_offers'], ['countries']),
            ]:
                if not self.graph.has_edge_definition(edge_def[0]):
                    self.graph.create_edge_definition(
                        edge_collection=edge_def[0],
                        from_vertex_collections=edge_def[1],
                        to_vertex_collections=edge_def[2]
                    )

            # Ensure seasons collection and edge for shows
            if 'seasons' not in self.collections:
                if not self.db.has_collection('seasons'):
                    self.db.create_collection('seasons')
                self.collections['seasons'] = self.db.collection('seasons')
            if not self.graph.has_edge_definition('has_season'):
                self.graph.create_edge_definition(
                    edge_collection='has_season',
                    from_vertex_collections=['shows'],
                    to_vertex_collections=['seasons']
                )

            # Ensure scores collection and has_score edge
            if 'scores' not in self.collections:
                if not self.db.has_collection('scores'):
                    self.db.create_collection('scores')
                self.collections['scores'] = self.db.collection('scores')
            if not self.graph.has_edge_definition('has_score'):
                self.graph.create_edge_definition(
                    edge_collection='has_score',
                    from_vertex_collections=['movies', 'shows'],
                    to_vertex_collections=['scores']
                )

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
                        translation_docs.append(tdoc)
                        translation_edges.append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"translations/{tkey}"
                        })
                alt_titles = parse_json_field(item.get('alternative_titles'))
                alt_title_docs = []
                alt_title_edges = []
                if isinstance(alt_titles, list):
                    for i, alt in enumerate(alt_titles):
                        at_key = self.make_human_key(doc['_key'], alt.get('title'), alt.get('iso_3166_1') or i)
                        atdoc = dict(alt)
                        atdoc['_key'] = at_key
                        atdoc['parent_key'] = doc['_key']
                        alt_title_docs.append(atdoc)
                        alt_title_edges.append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"alternative_titles/{at_key}"
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
                            image_docs.append(idoc)
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
                            video_docs.append(vdoc)
                            video_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"videos/{vid_key}"
                            })
                certs = parse_json_field(item.get('certifications'))
                cert_docs = []
                cert_edges = []
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
                            cert_docs.append(cdoc)
                            cert_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"certifications/{ckey}"
                            })
                collection_info = parse_json_field(item.get('collection'))
                collection_doc = None
                collection_edge = None
                if isinstance(collection_info, dict) and collection_info.get('id'):
                    ckey = str(collection_info['id'])
                    collection_doc = {
                        '_key': ckey,
                        'name': collection_info.get('name'),
                        'poster_path': collection_info.get('poster_path'),
                        'backdrop_path': collection_info.get('backdrop_path')
                    }
                    collection_edge = {
                        '_from': f"{id_prefix}/{doc['_key']}",
                        '_to': f"movie_series/{ckey}"
                    }
                    doc.pop('collection', None)
                origin_country_codes = parse_json_field(item.get('origin_country_codes'))
                country_edges = []
                if isinstance(origin_country_codes, list):
                    for code in origin_country_codes:
                        code = code.strip().upper()
                        if code:
                            if not self.collections['countries'].has(code):
                                self.collections['countries'].insert({'_key': code}, overwrite=True)
                            country_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"countries/{code}"
                            })
                orig_lang = item.get('original_language_code')
                orig_lang_edge = None
                if orig_lang:
                    orig_lang = orig_lang.strip().lower()
                    if not self.collections['languages'].has(orig_lang):
                        self.collections['languages'].insert({'_key': orig_lang}, overwrite=True)
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
                            if not self.collections['languages'].has(code):
                                self.collections['languages'].insert({'_key': code}, overwrite=True)
                            spoken_lang_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"languages/{code}"
                            })
                cert_country_edges = []
                for cdoc in cert_docs:
                    code = cdoc.get('iso_3166_1')
                    if code:
                        code = code.strip().upper()
                        if not self.collections['countries'].has(code):
                            self.collections['countries'].insert({'_key': code}, overwrite=True)
                        cert_country_edges.append({
                            '_from': f"certifications/{cdoc['_key']}",
                            '_to': f"countries/{code}"
                        })
                translation_lang_edges = []
                for tdoc in translation_docs:
                    lang = tdoc.get('language_code')
                    if lang:
                        lang = lang.strip().lower()
                        if not self.collections['languages'].has(lang):
                            self.collections['languages'].insert({'_key': lang}, overwrite=True)
                        translation_lang_edges.append({
                            '_from': f"translations/{tdoc['_key']}",
                            '_to': f"languages/{lang}"
                        })
                alt_title_country_edges = []
                for atdoc in alt_title_docs:
                    code = atdoc.get('iso_3166_1')
                    if code:
                        code = code.strip().upper()
                        if not self.collections['countries'].has(code):
                            self.collections['countries'].insert({'_key': code}, overwrite=True)
                        alt_title_country_edges.append({
                            '_from': f"alternative_titles/{atdoc['_key']}",
                            '_to': f"countries/{code}"
                        })
                streaming_country_codes = parse_json_field(item.get('streaming_country_codes'))
                streaming_country_edges = []
                if isinstance(streaming_country_codes, list):
                    for code in streaming_country_codes:
                        code = code.strip().upper()
                        if code:
                            if not self.collections['countries'].has(code):
                                self.collections['countries'].insert({'_key': code}, overwrite=True)
                            streaming_country_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"countries/{code}"
                            })
                    doc.pop('streaming_country_codes', None)
                streaming_providers = parse_json_field(item.get('streaming_services'))
                streaming_offer_docs = []
                streaming_offer_edges = []
                provider_edges = []
                offer_country_edges = []
                if isinstance(streaming_providers, dict):
                    for country, offers in streaming_providers.items():
                        country_code = country.strip().upper()
                        if not self.collections['countries'].has(country_code):
                            self.collections['countries'].insert({'_key': country_code}, overwrite=True)
                        link = offers.get('link')
                        for offer_type in ['ads', 'flatrate', 'buy', 'rent', 'free']:
                            for prov in offers.get(offer_type, []):
                                pid = str(prov['provider_id'])
                                # Use providername_id as key and tmdb_id as attribute
                                provider_key = self.make_human_key(prov.get('provider_name'), pid)
                                if not self.collections['streaming_services'].has(provider_key):
                                    self.collections['streaming_services'].insert({
                                        '_key': provider_key,
                                        'tmdb_id': pid,
                                        'provider_name': prov.get('provider_name'),
                                        'logo_path': prov.get('logo_path'),
                                        'display_priority': prov.get('display_priority')
                                    }, overwrite=True)
                                # Offer doc
                                offer_key = self.make_human_key(doc['_key'], country_code, offer_type, provider_key)
                                offer_doc = {
                                    '_key': offer_key,
                                    'type': offer_type,
                                    'country': country_code,
                                    'provider_id': provider_key,
                                    'link': link,
                                    'parent_key': doc['_key']
                                }
                                streaming_offer_docs.append(offer_doc)
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
                    doc.pop('streaming_services', None)
                if translation_docs:
                    for tdoc in translation_docs:
                        self.collections['translations'].insert(tdoc, overwrite=True)
                if alt_title_docs:
                    for atdoc in alt_title_docs:
                        self.collections['alternative_titles'].insert(atdoc, overwrite=True)
                if image_docs:
                    for idoc in image_docs:
                        self.collections['images'].insert(idoc, overwrite=True)
                if video_docs:
                    for vdoc in video_docs:
                        self.collections['videos'].insert(vdoc, overwrite=True)
                if cert_docs:
                    for cdoc in cert_docs:
                        self.collections['certifications'].insert(cdoc, overwrite=True)
                if collection_doc:
                    self.collections['movie_series'].insert(collection_doc, overwrite=True)
                self.collections[collection_name].insert(doc, overwrite=True)
                for edge in translation_edges:
                    self.graph.edge_collection('has_translation').insert(edge)
                for edge in alt_title_edges:
                    self.graph.edge_collection('has_alternative_title').insert(edge)
                for edge in image_edges:
                    self.graph.edge_collection('has_image').insert(edge)
                for edge in video_edges:
                    self.graph.edge_collection('has_video').insert(edge)
                for edge in cert_edges:
                    self.graph.edge_collection('has_certification').insert(edge)
                if collection_edge:
                    self.graph.edge_collection('belongs_to_movie_series').insert(collection_edge)
                for edge in country_edges:
                    self.graph.edge_collection('originates_from_country').insert(edge)
                if orig_lang_edge:
                    self.graph.edge_collection('has_original_language').insert(orig_lang_edge)
                for edge in spoken_lang_edges:
                    self.graph.edge_collection('has_spoken_language').insert(edge)
                for edge in cert_country_edges:
                    self.graph.edge_collection('certification_for_country').insert(edge)
                for edge in translation_lang_edges:
                    self.graph.edge_collection('translation_in_language').insert(edge)
                for edge in alt_title_country_edges:
                    self.graph.edge_collection('alt_title_for_country').insert(edge)
                for edge in streaming_country_edges:
                    self.graph.edge_collection('available_in_country').insert(edge)
                for offer_doc in streaming_offer_docs:
                    self.collections['streaming_offers'].insert(offer_doc, overwrite=True)
                for edge in streaming_offer_edges:
                    self.graph.edge_collection('has_streaming_offer').insert(edge)
                for edge in provider_edges:
                    self.graph.edge_collection('offer_for_streaming_service').insert(edge)
                for edge in offer_country_edges:
                    self.graph.edge_collection('offer_in_country').insert(edge)
                item_id = f"{id_prefix}/{doc['_key']}"
                genres = normalize_named_list(parse_json_field(item.get('genres')))
                keywords = normalize_named_list(parse_json_field(item.get('keywords')))
                tropes_raw = parse_json_field(item.get('tropes'))
                tropes = []
                for t in tropes_raw:
                    if isinstance(t, dict) and 'name' in t:
                        key = safe_key(t.get('name'))
                        tropes.append({'key': key, 'name': t['name']})
                cast = parse_json_field(item.get('cast'))
                crew = parse_json_field(item.get('crew'))
                inserted_persons = set()
                for genre_data in genres:
                    genre_id = f"genres/{genre_data['id']}"
                    self.collections['genres'].insert({'_key': genre_data['id'], 'name': genre_data['name']}, overwrite=True)
                    self.graph.edge_collection('has_genre').insert({'_from': item_id, '_to': genre_id})
                for keyword_data in keywords:
                    keyword_id = f"keywords/{keyword_data['id']}"
                    self.collections['keywords'].insert({'_key': keyword_data['id'], 'name': keyword_data['name']}, overwrite=True)
                    self.graph.edge_collection('has_keyword').insert({'_from': item_id, '_to': keyword_id})
                for trope_data in tropes:
                    trope_id = f"tropes/{trope_data['key']}"
                    self.collections['tropes'].insert({'_key': trope_data['key'], 'name': trope_data['name']}, overwrite=True)
                    self.graph.edge_collection('has_trope').insert({'_from': item_id, '_to': trope_id})
                for cast_member in cast:
                    pname = cast_member.get('name')
                    pid = cast_member.get('id')
                    person_key = self.make_human_key(pname, pid)
                    if person_key in inserted_persons:
                        continue
                    inserted_persons.add(person_key)
                    person_id = f"persons/{person_key}"
                    self.collections['persons'].insert({
                        '_key': person_key,
                        'name': pname,
                        'profile_path': cast_member.get('profile_path')
                    }, overwrite=True)
                    self.graph.edge_collection('appeared_in').insert({
                        '_from': person_id,
                        '_to': item_id,
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
                    self.collections['persons'].insert({
                        '_key': person_key,
                        'name': pname,
                        'profile_path': crew_member.get('profile_path')
                    }, overwrite=True)
                    self.graph.edge_collection('worked_on').insert({
                        '_from': person_id,
                        '_to': item_id,
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
                        score_docs.append(sdoc)
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
                        score_docs.append(sdoc)
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
                        score_docs.append(sdoc)
                        score_edges.append({
                            '_from': f"{id_prefix}/{doc['_key']}",
                            '_to': f"scores/{sdoc['_key']}"
                        })
                # Insert scores
                for sdoc in score_docs:
                    self.collections['scores'].insert(sdoc, overwrite=True)
                for edge in score_edges:
                    self.graph.edge_collection('has_score').insert(edge)
                # Normalize seasons for shows
                if id_prefix == 'shows':
                    seasons = parse_json_field(item.get('seasons'))
                    season_docs = []
                    season_edges = []
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
                            season_docs.append(sdoc)
                            season_edges.append({
                                '_from': f"shows/{doc['_key']}",
                                '_to': f"seasons/{sid}"
                            })
                        doc.pop('seasons', None)
                # Insert seasons docs and edges
                if id_prefix == 'shows' and 'season_docs' in locals():
                    for sdoc in season_docs:
                        self.collections['seasons'].insert(sdoc, overwrite=True)
                    for edge in season_edges:
                        self.graph.edge_collection('has_season').insert(edge)
                imported_count += 1
            print(f"Successfully imported/updated {imported_count} {type_label} into ArangoDB.")
        except Exception as e:
            import traceback
            print(f"\n{'='*40}\n[IMPORT ERROR] {type_label.capitalize()}\n{'='*40}")
            print(f"Error: {e}\nType: {type(e).__name__}")
            tb = traceback.format_exc()
            print(f"Traceback (most recent call last):\n{tb}")
            print(f"{'='*40}\n")

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
    vertex_colls = ['movies', 'shows', 'persons', 'genres', 'keywords', 'production_companies', 'movie_series', 'tropes', 'translations', 'images', 'videos', 'alternative_titles', 'certifications', 'countries', 'languages', 'streaming_services', 'streaming_offers', 'seasons', 'scores']
    for coll in vertex_colls:
        importer.ensure_collection(coll)
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
        {'edge_collection': 'alt_title_for_country', 'from_vertex_collections': ['alternative_titles'], 'to_vertex_collections': ['countries']},
        {'edge_collection': 'available_in_country', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['countries']},
        {'edge_collection': 'has_streaming_offer', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['streaming_offers']},
        {'edge_collection': 'offer_for_streaming_service', 'from_vertex_collections': ['streaming_offers'], 'to_vertex_collections': ['streaming_services']},
        {'edge_collection': 'offer_in_country', 'from_vertex_collections': ['streaming_offers'], 'to_vertex_collections': ['countries']},
        {'edge_collection': 'has_season', 'from_vertex_collections': ['shows'], 'to_vertex_collections': ['seasons']},
        {'edge_collection': 'has_score', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['scores']},
    ]
    importer.ensure_graph('movie_graph', edge_defs)
    importer.connect_postgres()
    try:
        importer.import_movies()
        importer.import_shows()
    finally:
        importer.close_postgres()

if __name__ == '__main__':
    main()
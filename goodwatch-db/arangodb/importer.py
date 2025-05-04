import os
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras  # Import DictCursor
from arango import ArangoClient
import datetime  # Import datetime module
from decimal import Decimal # Import Decimal
import json
import re

class MovieImporter:
    def __init__(self, arango_cfg, pg_cfg):
        self.arango_cfg = arango_cfg
        self.pg_cfg = pg_cfg
        self.arango_client = None
        self.db = None
        self.graph = None
        self.collections = {}

    def connect_arango(self):
        self.arango_client = ArangoClient(hosts=self.arango_cfg['host'])
        self.db = self.arango_client.db(
            self.arango_cfg['db'],
            username=self.arango_cfg['user'],
            password=self.arango_cfg['password'],
        )

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
            # Update edge definitions if needed
            current_defs = {ed['edge_collection']: ed for ed in graph.edge_definitions()}
            for ed in edge_defs:
                ecoll = ed['edge_collection']
                froms = set(ed['from_vertex_collections'])
                tos = set(ed['to_vertex_collections'])
                if ecoll in current_defs:
                    cur_froms = set(current_defs[ecoll]['from_vertex_collections'])
                    cur_tos = set(current_defs[ecoll]['to_vertex_collections'])
                    if cur_froms != froms or cur_tos != tos:
                        # Remove and recreate edge definition
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
        import psycopg2
        import psycopg2.extras
        self.pg_conn = psycopg2.connect(**self.pg_cfg)
        self.pg_cur = self.pg_conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    def close_postgres(self):
        if hasattr(self, 'pg_cur'):
            self.pg_cur.close()
        if hasattr(self, 'pg_conn'):
            self.pg_conn.close()

    @staticmethod
    def make_human_key(*args):
        # Join args, lowercase, replace spaces with _, remove non-alphanum/-/_
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

            # Ensure movieseries collection and edge
            if 'movieseries' not in self.collections:
                if not self.db.has_collection('movieseries'):
                    self.db.create_collection('movieseries')
                self.collections['movieseries'] = self.db.collection('movieseries')
            if not self.graph.has_edge_definition('belongs_to_movieseries'):
                self.graph.create_edge_definition(
                    edge_collection='belongs_to_movieseries',
                    from_vertex_collections=['movies'],
                    to_vertex_collections=['movieseries']
                )

            for item in items:
                doc = dict(item)
                for key, value in doc.items():
                    if isinstance(value, datetime.datetime) or isinstance(value, datetime.date):
                        doc[key] = value.isoformat()
                    elif isinstance(value, Decimal):
                        doc[key] = float(value)
                # Human-readable key logic
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
                # Remove inlined fields now covered by nodes/edges
                for redundant_field in [
                    'genres', 'keywords', 'tropes', 'cast', 'crew',
                    'translations', 'images', 'videos', 'alternative_titles', 'certifications', 'collection']:
                    if redundant_field in doc:
                        doc.pop(redundant_field)
                # Extract translations and prepare translation docs and edges
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
                # Extract alternative_titles and prepare docs/edges
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
                # Extract images and videos and prepare docs/edges
                images = parse_json_field(item.get('images'))
                videos = parse_json_field(item.get('videos'))
                image_docs = []
                image_edges = []
                video_docs = []
                video_edges = []
                # Images: flatten all image types
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
                # Videos: flatten all video types
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
                # Extract certifications and prepare docs/edges
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
                            cdoc = dict(rd)
                            cdoc['_key'] = ckey
                            cdoc['parent_key'] = doc['_key']
                            cdoc['iso_3166_1'] = country
                            cert_docs.append(cdoc)
                            cert_edges.append({
                                '_from': f"{id_prefix}/{doc['_key']}",
                                '_to': f"certifications/{ckey}"
                            })
                # Extract collection and prepare doc/edge
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
                        '_to': f"movieseries/{ckey}"
                    }
                # Insert all translations one by one (fail on first error)
                if translation_docs:
                    for tdoc in translation_docs:
                        self.collections['translations'].insert(tdoc, overwrite=True)
                # Insert all alternative_titles one by one (fail on first error)
                if alt_title_docs:
                    for atdoc in alt_title_docs:
                        self.collections['alternative_titles'].insert(atdoc, overwrite=True)
                # Insert all images one by one (fail on first error)
                if image_docs:
                    for idoc in image_docs:
                        self.collections['images'].insert(idoc, overwrite=True)
                # Insert all videos one by one (fail on first error)
                if video_docs:
                    for vdoc in video_docs:
                        self.collections['videos'].insert(vdoc, overwrite=True)
                # Insert all certifications one by one (fail on first error)
                if cert_docs:
                    for cdoc in cert_docs:
                        self.collections['certifications'].insert(cdoc, overwrite=True)
                # Insert collection doc (if any)
                if collection_doc:
                    self.collections['movieseries'].insert(collection_doc, overwrite=True)
                # Insert main doc
                self.collections[collection_name].insert(doc, overwrite=True)
                # Insert all translation edges
                for edge in translation_edges:
                    self.graph.edge_collection('has_translation').insert(edge)
                # Insert all alternative_title edges
                for edge in alt_title_edges:
                    self.graph.edge_collection('has_alternative_title').insert(edge)
                # Insert all image/video edges
                for edge in image_edges:
                    self.graph.edge_collection('has_image').insert(edge)
                for edge in video_edges:
                    self.graph.edge_collection('has_video').insert(edge)
                # Insert all certification edges
                for edge in cert_edges:
                    self.graph.edge_collection('has_certification').insert(edge)
                # Insert collection edge (if any)
                if collection_edge:
                    self.graph.edge_collection('belongs_to_movieseries').insert(collection_edge)
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
                # Genres
                for genre_data in genres:
                    genre_id = f"genres/{genre_data['id']}"
                    self.collections['genres'].insert({'_key': genre_data['id'], 'name': genre_data['name']}, overwrite=True)
                    self.graph.edge_collection('has_genre').insert({'_from': item_id, '_to': genre_id})
                # Keywords
                for keyword_data in keywords:
                    keyword_id = f"keywords/{keyword_data['id']}"
                    self.collections['keywords'].insert({'_key': keyword_data['id'], 'name': keyword_data['name']}, overwrite=True)
                    self.graph.edge_collection('has_keyword').insert({'_from': item_id, '_to': keyword_id})
                # Tropes
                for trope_data in tropes:
                    trope_id = f"tropes/{trope_data['key']}"
                    self.collections['tropes'].insert({'_key': trope_data['key'], 'name': trope_data['name']}, overwrite=True)
                    self.graph.edge_collection('has_trope').insert({'_from': item_id, '_to': trope_id})
                # Cast
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
                # Crew
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
              streaming_providers,
              streaming_country_codes,
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
    arango_cfg = {
        'host': os.getenv('ARANGO_HOST', 'http://localhost:8529'),
        'db': os.getenv('ARANGO_DB', '_system'),
        'user': os.getenv('ARANGO_USER', 'root'),
        'password': os.getenv('ARANGO_PASSWORD', '')
    }
    pg_cfg = {
        'host': os.getenv('POSTGRES_HOST'),
        'port': os.getenv('POSTGRES_PORT', 5432),
        'dbname': os.getenv('POSTGRES_DB'),
        'user': os.getenv('POSTGRES_USER'),
        'password': os.getenv('POSTGRES_PASS')
    }
    importer = MovieImporter(arango_cfg, pg_cfg)
    importer.connect_arango()
    # Define all vertex collections
    vertex_colls = ['movies', 'shows', 'persons', 'genres', 'keywords', 'productioncompanies', 'movieseries', 'tropes', 'translations', 'images', 'videos', 'alternative_titles', 'certifications']
    for coll in vertex_colls:
        importer.ensure_collection(coll)
    # Define edge definitions for the graph
    edge_defs = [
        {'edge_collection': 'has_genre', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['genres']},
        {'edge_collection': 'has_keyword', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['keywords']},
        {'edge_collection': 'has_trope', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['tropes']},
        {'edge_collection': 'has_translation', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['translations']},
        {'edge_collection': 'has_image', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['images']},
        {'edge_collection': 'has_video', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['videos']},
        {'edge_collection': 'has_alternative_title', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['alternative_titles']},
        {'edge_collection': 'has_certification', 'from_vertex_collections': ['movies', 'shows'], 'to_vertex_collections': ['certifications']},
        {'edge_collection': 'belongs_to_movieseries', 'from_vertex_collections': ['movies'], 'to_vertex_collections': ['movieseries']},
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
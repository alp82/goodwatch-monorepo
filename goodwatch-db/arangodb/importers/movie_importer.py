"""
Movie importer for importing movie data from PostgreSQL to ArangoDB.
"""
from importers.base_importer import BaseImporter
from processors.base_processor import BaseProcessor
from processors.media_processor import MediaProcessor
from processors.metadata_processor import MetadataProcessor
from processors.translation_processor import TranslationProcessor
from processors.location_processor import LocationProcessor
from processors.streaming_processor import StreamingProcessor
from processors.score_processor import ScoreProcessor
from processors.person_processor import PersonProcessor
from processors.tag_processor import TagProcessor
from processors.recommendation_processor import RecommendationProcessor
from processors.company_processor import CompanyProcessor
from processors.release_events_processor import ReleaseEventsProcessor
from utils.key_generators import make_human_key, make_title_key
from constants import MOVIES_QUERY
from constants import MOVIES_COLLECTION

class MovieImporter(BaseImporter):
    """
    Importer for movie data.
    """
    
    def __init__(self, pg_config):
        """
        Initialize the movie importer.
        
        Args:
            pg_config: PostgreSQL connection configuration
        """
        super().__init__(pg_config)
        
    def import_movies(self):
        """
        Import movies from PostgreSQL to ArangoDB.
        
        Returns:
            int: Number of imported movies
        """
        # Initialize processors
        movie_processor = MovieProcessor(self.arango_connector)
        
        # Execute import
        return self.execute_import(
            query=MOVIES_QUERY, 
            processor=movie_processor,
            collection_name=MOVIES_COLLECTION,
            id_prefix='movies',
            type_label='movies'
        )


class MovieProcessor(BaseProcessor):
    """
    Processor for movie data.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the movie processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
        # Initialize sub-processors
        self.media_processor = MediaProcessor(arango_connector)
        self.metadata_processor = MetadataProcessor(arango_connector)
        self.translation_processor = TranslationProcessor(arango_connector)
        self.location_processor = LocationProcessor(arango_connector)
        self.streaming_processor = StreamingProcessor(arango_connector)
        self.score_processor = ScoreProcessor(arango_connector)
        self.person_processor = PersonProcessor(arango_connector)
        self.tag_processor = TagProcessor(arango_connector)
        self.recommendation_processor = RecommendationProcessor(arango_connector)
        self.company_processor = CompanyProcessor(arango_connector)
        self.release_events_processor = ReleaseEventsProcessor(arango_connector)
        
        # Initialize batch buffers with all possible collection names
        self.initialize_batch_buffers([
            'movies', 'images', 'videos', 'alternative_titles', 'translations',
            'languages', 'streaming_services', 'streaming_offers', 'scores',
            'persons', 'genres', 'keywords', 'tropes', 'movie_series', 'production_companies'
        ])

        # Initialize batch buffers for all sub-processors
        self.media_processor.initialize_batch_buffers(['images', 'videos'])
        self.metadata_processor.initialize_batch_buffers(['alternative_titles', 'countries'])
        self.release_events_processor.initialize_batch_buffers(['certifications', 'countries'])
        self.translation_processor.initialize_batch_buffers(['translations', 'languages', 'countries'])
        self.location_processor.initialize_batch_buffers(['countries', 'languages'])
        self.streaming_processor.initialize_batch_buffers(['streaming_services', 'streaming_offers', 'countries'])
        self.score_processor.initialize_batch_buffers(['scores'])
        self.person_processor.initialize_batch_buffers(['persons'])
        self.tag_processor.initialize_batch_buffers(['genres', 'keywords', 'tropes'])
        self.recommendation_processor.initialize_batch_buffers([])
        self.company_processor.initialize_batch_buffers(['production_companies', 'movie_series'])
        self.release_events_processor.initialize_batch_buffers([])
        
    def collect_batch_data(self, processors):
        """
        Collect batch data from all sub-processors.
        
        Args:
            processors: List of processor instances
        """
        for processor in processors:
            # Collect documents
            for coll_name, docs in processor.batch_docs.items():
                self.batch_docs.setdefault(coll_name, []).extend(docs)
            
            # Collect edges
            for edge_name, edges in processor.batch_edges.items():
                self.batch_edges.setdefault(edge_name, []).extend(edges)
                
            # Reset processor batches for next item
            processor.initialize_batch_buffers([])
    
    def process_item(self, item, id_prefix):
        """
        Process a movie item from PostgreSQL.
        
        Args:
            item: Dictionary with movie data from PostgreSQL
            id_prefix: Prefix for document IDs
            
        Returns:
            dict: Processed movie document
        """
        if not item.get('tmdb_id'):
            print("Skipping item without tmdb_id")
            return None
            
        # Create human-readable key using title and tmdb_id
        tmdb_id = item.get('tmdb_id')
        title = item.get('title')
        
        # Create movie document with all fields from the SQL query
        doc = {
            '_key': make_title_key(title, tmdb_id),
            'tmdb_id': tmdb_id,
            'created_at': item.get('created_at'),
            'updated_at': item.get('updated_at'),
            'title': title,
            'original_title': item.get('original_title'),
            'tagline': item.get('tagline'),
            'synopsis': item.get('synopsis'),  
            'popularity': item.get('popularity'),
            'status': item.get('status'),
            'adult': item.get('adult'),
            'poster_path': item.get('poster_path'),
            'backdrop_path': item.get('backdrop_path'),
            'release_date': item.get('release_date'),
            'release_year': item.get('release_year'),
            'runtime': item.get('runtime'),
            'budget': item.get('budget'),
            'revenue': item.get('revenue'),
            'original_language_code': item.get('original_language_code'),
            'spoken_language_codes': item.get('spoken_language_codes'),
            'homepage': item.get('homepage'),
            'wikidata_id': item.get('wikidata_id'),
            'facebook_id': item.get('facebook_id'),
            'instagram_id': item.get('instagram_id'),
            'twitter_id': item.get('twitter_id'),
            'imdb_id': item.get('imdb_id'),
            'vote_average': item.get('vote_average'),
            'vote_count': item.get('vote_count'),
            
            # Metadata fields
            'tmdb_details_updated_at': item.get('tmdb_details_updated_at'),
            'tmdb_providers_updated_at': item.get('tmdb_providers_updated_at'),
            'imdb_ratings_updated_at': item.get('imdb_ratings_updated_at'),
            'metacritic_ratings_updated_at': item.get('metacritic_ratings_updated_at'),
            'rotten_tomatoes_ratings_updated_at': item.get('rotten_tomatoes_ratings_updated_at'),
            'tvtropes_tags_updated_at': item.get('tvtropes_tags_updated_at'),
            'dna_updated_at': item.get('dna_updated_at'),
            'dna': item.get('dna'),
            
            # Fields needed for processor methods
            'images': item.get('images'),
            'videos': item.get('videos'),
            'alternative_titles': item.get('alternative_titles'),
            'translations': item.get('translations'),
            'genres': item.get('genres'),
            'keywords': item.get('keywords'),
            'tropes': item.get('tropes'),
            'cast': item.get('cast'),
            'crew': item.get('crew'),
            'collection': item.get('collection'),
            'certifications': item.get('certifications'),
            'production_company_ids': item.get('production_company_ids'),
            'origin_country_codes': item.get('origin_country_codes'),
            'streaming_providers': item.get('streaming_providers'),
            'streaming_country_codes': item.get('streaming_country_codes'),
            'tmdb_recommendation_ids': item.get('tmdb_recommendation_ids'),
            'tmdb_similar_ids': item.get('tmdb_similar_ids'),
            
            # Score fields
            'tmdb_url': item.get('tmdb_url'),
            'tmdb_user_score_original': item.get('tmdb_user_score_original'),
            'tmdb_user_score_normalized_percent': item.get('tmdb_user_score_normalized_percent'),
            'tmdb_user_score_rating_count': item.get('tmdb_user_score_rating_count'),
            
            'imdb_url': item.get('imdb_url'),
            'imdb_user_score_original': item.get('imdb_user_score_original'),
            'imdb_user_score_normalized_percent': item.get('imdb_user_score_normalized_percent'),
            'imdb_user_score_rating_count': item.get('imdb_user_score_rating_count'),
            
            'metacritic_url': item.get('metacritic_url'),
            'metacritic_user_score_original': item.get('metacritic_user_score_original'),
            'metacritic_user_score_normalized_percent': item.get('metacritic_user_score_normalized_percent'),
            'metacritic_user_score_rating_count': item.get('metacritic_user_score_rating_count'),
            'metacritic_meta_score_original': item.get('metacritic_meta_score_original'),
            'metacritic_meta_score_normalized_percent': item.get('metacritic_meta_score_normalized_percent'),
            'metacritic_meta_score_review_count': item.get('metacritic_meta_score_review_count'),
            
            'rotten_tomatoes_url': item.get('rotten_tomatoes_url'),
            'rotten_tomatoes_audience_score_original': item.get('rotten_tomatoes_audience_score_original'),
            'rotten_tomatoes_audience_score_normalized_percent': item.get('rotten_tomatoes_audience_score_normalized_percent'),
            'rotten_tomatoes_audience_score_rating_count': item.get('rotten_tomatoes_audience_score_rating_count'),
            'rotten_tomatoes_tomato_score_original': item.get('rotten_tomatoes_tomato_score_original'),
            'rotten_tomatoes_tomato_score_normalized_percent': item.get('rotten_tomatoes_tomato_score_normalized_percent'),
            'rotten_tomatoes_tomato_score_review_count': item.get('rotten_tomatoes_tomato_score_review_count'),
            
            'aggregated_user_score_normalized_percent': item.get('aggregated_user_score_normalized_percent'),
            'aggregated_user_score_rating_count': item.get('aggregated_user_score_rating_count'),
            'aggregated_official_score_normalized_percent': item.get('aggregated_official_score_normalized_percent'),
            'aggregated_official_score_review_count': item.get('aggregated_official_score_review_count'),
            'aggregated_overall_score_normalized_percent': item.get('aggregated_overall_score_normalized_percent'),
            'aggregated_overall_score_voting_count': item.get('aggregated_overall_score_voting_count')
        }
        
        # Process media (images and videos)
        self.media_processor.process_images(doc, id_prefix)
        self.media_processor.process_videos(doc, id_prefix)
        
        # Process translations and alternative titles
        self.translation_processor.process_translations(doc, id_prefix)
        self.metadata_processor.process_alternative_titles(doc, id_prefix)
        
        # Process release events
        self.release_events_processor.process_release_events(doc, id_prefix)
        
        # Process locations and languages
        self.location_processor.process_countries(doc, id_prefix)
        self.location_processor.process_languages(doc, id_prefix)
        
        # Process streaming providers
        self.streaming_processor.process_streaming_providers(doc, id_prefix)
        
        # Process scores
        self.score_processor.process_scores(doc, id_prefix)
        
        # Process persons (cast and crew)
        self.person_processor.process_persons(doc, id_prefix)
        
        # Process tags (genres, keywords, tropes)
        self.tag_processor.process_genres(doc, id_prefix)
        self.tag_processor.process_keywords(doc, id_prefix)
        self.tag_processor.process_tropes(doc, id_prefix)
        
        # Process recommendations and similar items
        self.recommendation_processor.process_recommendations(doc, id_prefix)
        self.recommendation_processor.process_similar_items(doc, id_prefix)
        
        # Process production companies and movie collection
        self.company_processor.process_production_companies(doc, id_prefix)
        self.company_processor.process_movie_collection(doc)
        
        # Collect batch data from all processors
        self.collect_batch_data([
            self.media_processor,
            self.metadata_processor,
            self.release_events_processor,
            self.translation_processor,
            self.location_processor,
            self.streaming_processor,
            self.score_processor,
            self.person_processor,
            self.tag_processor,
            self.recommendation_processor,
            self.company_processor,
        ])
        
        return doc

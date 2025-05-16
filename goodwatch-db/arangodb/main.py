"""
Main entry point for importing data from PostgreSQL to ArangoDB.
"""
import os
import argparse
import time
from dotenv import load_dotenv
from db.arango_connector import ArangoConnector
from db.schema_manager import SchemaManager
from importers.country_importer import CountryImporter
from importers.language_importer import LanguageImporter
from importers.job_importer import JobImporter
from importers.certification_importer import CertificationImporter
from importers.streaming_provider_importer import StreamingProviderImporter
from importers.network_importer import NetworkImporter
from importers.production_company_importer import ProductionCompanyImporter
from importers.movie_importer import MovieImporter
from importers.show_importer import ShowImporter
from post_processors.dna_post_processor import DNAPostProcessor
from post_processors.streaming_links_post_processor import StreamingLinksPostProcessor
from post_processors.user_preferences_post_processor import UserPreferencesPostProcessor
from post_processors.watch_history_post_processor import WatchHistoryPostProcessor

def main():
    """
    Main entry point for the importer.
    """
    # Load environment variables
    load_dotenv()
    
    # Setup command line arguments
    parser = argparse.ArgumentParser(description='Import data from PostgreSQL to ArangoDB')
    parser.add_argument('--static-data', action='store_true', help='Import static data (countries, languages, jobs, etc.)')
    parser.add_argument('--countries', action='store_true', help='Import countries')
    parser.add_argument('--languages', action='store_true', help='Import languages')
    parser.add_argument('--jobs', action='store_true', help='Import jobs')
    parser.add_argument('--certifications', action='store_true', help='Import certifications')
    parser.add_argument('--streaming-providers', action='store_true', help='Import streaming providers')
    parser.add_argument('--networks', action='store_true', help='Import networks')
    parser.add_argument('--production-companies', action='store_true', help='Import production companies')
    parser.add_argument('--movies', action='store_true', help='Import movies')
    parser.add_argument('--shows', action='store_true', help='Import TV shows')
    parser.add_argument('--all', action='store_true', help='Import all content types')
    parser.add_argument('--skip-indexes', action='store_true', help='Skip index creation')
    parser.add_argument('--skip-dna-vectors', action='store_true', help='Skip DNA vector updates')
    parser.add_argument('--skip-streaming-links', action='store_true', help='Skip streaming links update')
    parser.add_argument('--skip-user-preferences', action='store_true', help='Skip user preferences import')
    parser.add_argument('--skip-watch-history', action='store_true', help='Skip watch history import')
    args = parser.parse_args()
    
    # Determine what to import
    import_static_data = args.static_data or args.all
    import_countries = args.countries or import_static_data or args.all
    import_languages = args.languages or import_static_data or args.all
    import_jobs = args.jobs or import_static_data or args.all
    import_certifications = args.certifications or import_static_data or args.all
    import_streaming_providers = args.streaming_providers or import_static_data or args.all
    import_networks = args.networks or args.all
    import_production_companies = args.production_companies or args.all
    import_movies = args.movies or args.all
    import_shows = args.shows or args.all
    
    if not (import_static_data or import_countries or import_languages or import_jobs or 
            import_certifications or import_streaming_providers or import_networks or 
            import_production_companies or import_movies or import_shows):
        parser.print_help()
        return
    
    # PostgreSQL connection config
    pg_config = {
        'dbname': os.getenv('POSTGRES_DB'),
        'user': os.getenv('POSTGRES_USER'),
        'password': os.getenv('POSTGRES_PASS'),
        'host': os.getenv('POSTGRES_HOST'),
        'port': os.getenv('POSTGRES_PORT')
    }
    
    # Connect to ArangoDB
    arango = ArangoConnector()
    arango.connect()
    
    # Initialize schema manager and setup schema
    schema_manager = SchemaManager(arango)
    schema_manager.setup_schema()
    
    # Ensure indexes if not skipped
    if not args.skip_indexes:
        schema_manager.ensure_indexes()
    
    start_time = time.time()
    country_count = 0
    language_count = 0
    job_count = 0
    cert_system_count = 0
    streaming_provider_count = 0
    network_count = 0
    production_company_count = 0
    movie_count = 0
    show_count = 0
    
    # Import static data first
    if import_countries:
        print("\n" + "="*50)
        print("IMPORTING COUNTRIES")
        print("="*50)
        
        country_importer = CountryImporter(arango)
        country_count = country_importer.import_countries()
        country_importer.print_stats()

    if import_languages:
        print("\n" + "="*50)
        print("IMPORTING LANGUAGES")
        print("="*50)
        
        language_importer = LanguageImporter(arango)
        language_count = language_importer.import_languages()
        language_importer.print_stats()
    
    if import_jobs:
        print("\n" + "="*50)
        print("IMPORTING JOBS")
        print("="*50)
        
        job_importer = JobImporter(arango)
        job_stats = job_importer.import_jobs()
        job_importer.print_stats()
        job_count = job_stats.get('jobs', 0)
    
    if import_certifications:
        print("\n" + "="*50)
        print("IMPORTING CERTIFICATIONS")
        print("="*50)
        
        cert_importer = CertificationImporter(arango)
        cert_stats = cert_importer.import_certifications()
        cert_importer.print_stats()
        cert_system_count = cert_stats.get('certification_systems', 0)
    
    if import_streaming_providers:
        print("\n" + "="*50)
        print("IMPORTING STREAMING PROVIDERS")
        print("="*50)
        
        provider_importer = StreamingProviderImporter(arango)
        streaming_provider_count = provider_importer.import_streaming_providers()
        provider_importer.print_stats()
    
    # Import networks if requested
    if import_networks:
        print("\n" + "="*50)
        print("IMPORTING NETWORKS")
        print("="*50)
        
        network_importer = NetworkImporter(pg_config)
        network_importer.setup()
        
        network_count = network_importer.import_networks()
        network_importer.print_stats()
        network_importer.close()

    # Import production companies if requested
    if import_production_companies:
        print("\n" + "="*50)
        print("IMPORTING PRODUCTION COMPANIES")
        print("="*50)
        
        production_company_importer = ProductionCompanyImporter(pg_config)
        production_company_importer.setup()
        
        production_company_count = production_company_importer.import_production_companies()
        production_company_importer.print_stats()
        production_company_importer.close()
    
    # Import movies if requested
    if import_movies:
        print("\n" + "="*50)
        print("IMPORTING MOVIES")
        print("="*50)
        
        movie_importer = MovieImporter(pg_config)
        movie_importer.setup()
        
        movie_count = movie_importer.import_movies()
        movie_importer.print_stats()
        movie_importer.close()
    
    # Import TV shows if requested
    if import_shows:
        print("\n" + "="*50)
        print("IMPORTING TV SHOWS")
        print("="*50)
        
        show_importer = ShowImporter(pg_config)
        show_importer.setup()
        
        show_count = show_importer.import_shows()
        show_importer.print_stats()
        show_importer.close()
    
    # Update DNA vectors if not skipped
    if not args.skip_dna_vectors and (import_movies or import_shows):
        print("\n" + "="*50)
        print("UPDATING DNA VECTORS")
        print("="*50)
        
        dna_processor = DNAPostProcessor(arango, pg_config)
        dna_processor.update_vectors()
    
    # Update streaming links if not skipped
    if not args.skip_streaming_links and (import_movies or import_shows):
        print("\n" + "="*50)
        print("UPDATING STREAMING LINKS")
        print("="*50)
        
        streaming_links_processor = StreamingLinksPostProcessor(arango, pg_config)
        streaming_links_processor.update_streaming_links()
    
    # Import user preferences if not skipped
    if not args.skip_user_preferences and (import_movies or import_shows):
        print("\n" + "="*50)
        print("IMPORTING USER PREFERENCES")
        print("="*50)
        
        user_preferences_processor = UserPreferencesPostProcessor(arango, pg_config)
        user_preferences_processor.update_user_preferences()
    
    # Import watch history if not skipped
    if not args.skip_watch_history and (import_movies or import_shows):
        print("\n" + "="*50)
        print("IMPORTING WATCH HISTORY")
        print("="*50)
        
        watch_history_processor = WatchHistoryPostProcessor(arango, pg_config)
        watch_history_processor.update_watch_history()
    
    # Print summary
    elapsed = time.time() - start_time
    print("\n" + "="*50)
    print("IMPORT SUMMARY")
    print("="*50)
    print(f"Imported {country_count} countries")
    print(f"Imported {language_count} languages")
    print(f"Imported {job_count} jobs")
    print(f"Imported {cert_system_count} certification systems")
    print(f"Imported {streaming_provider_count} streaming providers")
    print(f"Imported {network_count} networks")
    print(f"Imported {production_company_count} production companies")
    print(f"Imported {movie_count} movies")
    print(f"Imported {show_count} TV shows")
    print(f"Total time: {elapsed:.2f} seconds")
    print("="*50)

if __name__ == "__main__":
    main()

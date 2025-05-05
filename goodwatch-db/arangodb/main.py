"""
Main entry point for importing data from PostgreSQL to ArangoDB.
"""
import os
import argparse
import time
from dotenv import load_dotenv
from importers.movie_importer import MovieImporter
from importers.show_importer import ShowImporter

def main():
    """
    Main entry point for the importer.
    """
    # Load environment variables
    load_dotenv()
    
    # Setup command line arguments
    parser = argparse.ArgumentParser(description='Import data from PostgreSQL to ArangoDB')
    parser.add_argument('--movies', action='store_true', help='Import movies')
    parser.add_argument('--shows', action='store_true', help='Import TV shows')
    parser.add_argument('--all', action='store_true', help='Import all content types')
    args = parser.parse_args()
    
    # Determine what to import
    import_movies = args.movies or args.all
    import_shows = args.shows or args.all
    
    if not import_movies and not import_shows:
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
    
    start_time = time.time()
    movie_count = 0
    show_count = 0
    
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
    
    # Print summary
    elapsed = time.time() - start_time
    print("\n" + "="*50)
    print("IMPORT COMPLETE")
    print("="*50)
    print(f"Imported {movie_count} movies and {show_count} TV shows.")
    print(f"Total time: {elapsed:.2f} seconds ({elapsed/60:.2f} minutes)")
    print("="*50)

if __name__ == "__main__":
    main()

"""
Importer for production company data from PostgreSQL to ArangoDB.
"""
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from constants import PRODUCTION_COMPANIES_QUERY, BATCH_SIZE, PRODUCTION_COMPANIES_COLLECTION
from db.arango_connector import ArangoConnector
from db.schema_manager import SchemaManager
from utils.key_generators import make_title_key
from utils.batch_utils import batch_insert, deduplicate_docs

class ProductionCompanyImporter:
    """
    Handles importing production company data from PostgreSQL to ArangoDB.
    """
    
    def __init__(self, pg_config):
        """
        Initialize the production company importer.
        
        Args:
            pg_config: PostgreSQL connection configuration dictionary
        """
        self.pg_config = pg_config
        self.pg_conn = None
        self.arango = ArangoConnector()
        self.schema_manager = None
        
        # Statistics
        self.production_company_count = 0
        self.country_count = 0
        self.batch_countries = []
        self.country_edges = []
        
    def setup(self):
        """
        Setup database connections.
        """
        # Connect to PostgreSQL
        self.pg_conn = psycopg2.connect(**self.pg_config)
        
        # Connect to ArangoDB
        self.arango.connect()
        
        # Setup schema including collections and graph
        self.schema_manager = SchemaManager(self.arango)
        self.schema_manager.setup_schema()
        
        # Ensure collections exist
        self.arango.ensure_collection(PRODUCTION_COMPANIES_COLLECTION)
        self.arango.ensure_collection('countries')
        
    def close(self):
        """
        Close database connections.
        """
        if self.pg_conn:
            self.pg_conn.close()
            
    def import_production_companies(self):
        """
        Import production companies from PostgreSQL to ArangoDB.
        
        Returns:
            int: Count of imported production companies
        """
        if not self.pg_conn:
            self.setup()
            
        # Create cursor
        cursor = self.pg_conn.cursor(cursor_factory=RealDictCursor)
        
        # Execute query
        cursor.execute(PRODUCTION_COMPANIES_QUERY)
        print(f"Fetched production company data from PostgreSQL.")
        
        # Process production companies in batches
        batch = []
        self.batch_countries = []
        self.country_edges = []
        
        for row in cursor:
            # Convert row to dictionary
            company = dict(row)
            
            # Set document key and ensure tmdb_id field
            pg_id = str(company['id'])
            # Make sure tmdb_id is properly set in ArangoDB document
            company['tmdb_id'] = pg_id
            name = company.get('name', '')
            company['_key'] = make_title_key(name, pg_id)
            
            # Add to batch
            batch.append(company)
            
            # Process origin country
            origin_country = company.get('origin_country')
            if origin_country:
                country_code = origin_country.strip().upper()
                if country_code:
                    # Add country node
                    self.batch_countries.append({'_key': country_code})
                    self.country_count += 1
                    
                    # Add edge from production company to country
                    edge = {
                        '_from': f"{PRODUCTION_COMPANIES_COLLECTION}/{company['_key']}",
                        '_to': f"countries/{country_code}"
                    }
                    self.country_edges.append(edge)
            
            # If batch is full, insert
            if len(batch) >= BATCH_SIZE:
                self._insert_batch(batch)
                batch = []
                
        # Insert any remaining production companies
        if batch:
            self._insert_batch(batch)
            
        # Insert countries
        if self.batch_countries:
            unique_countries = deduplicate_docs(self.batch_countries)
            print(f"Inserting {len(unique_countries)} countries...")
            batch_insert(
                'countries',
                unique_countries,
                self.arango.db.collection('countries').insert_many,
                overwrite=True,
                overwrite_mode='ignore'
            )
        
        # Insert country edges
        if self.country_edges:
            print(f"Inserting {len(self.country_edges)} country edges...")
            # Make sure we have a valid graph for edge collections
            if not self.arango.graph:
                print("Initializing graph for edge insertion...")
                self.schema_manager.setup_schema()
                
            # Now insert edges
            batch_insert(
                'originates_from_country',
                self.country_edges,
                self.arango.graph.edge_collection('originates_from_country').insert_many,
                overwrite=True,
                overwrite_mode='ignore'
            )
            
        cursor.close()
        return self.production_company_count
        
    def _insert_batch(self, batch):
        """
        Insert a batch of production companies into ArangoDB.
        
        Args:
            batch: List of production company dictionaries
        """
        if not batch:
            return
            
        # Insert production companies
        batch_insert(
            PRODUCTION_COMPANIES_COLLECTION,
            batch,
            self.arango.db.collection(PRODUCTION_COMPANIES_COLLECTION).insert_many,
            overwrite=True,
            overwrite_mode='update'
        )
        inserted = len(batch)
        self.production_company_count += inserted

    def print_stats(self):
        """
        Print import statistics.
        """
        print(f"\nProduction company import complete:")
        print(f"Imported {self.production_company_count} production companies")
        print(f"Created {self.country_count} country relationships")

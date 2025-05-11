"""
Importer for network data from PostgreSQL to ArangoDB.
"""
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from constants import NETWORKS_QUERY, BATCH_SIZE, NETWORKS_COLLECTION, EDGE_DEFINITIONS
from db.arango_connector import ArangoConnector
from db.schema_manager import SchemaManager
from utils.key_generators import make_title_key
from utils.batch_utils import batch_insert, deduplicate_docs

class NetworkImporter:
    """
    Handles importing network data from PostgreSQL to ArangoDB.
    """
    
    def __init__(self, pg_config):
        """
        Initialize the network importer.
        
        Args:
            pg_config: PostgreSQL connection configuration dictionary
        """
        self.pg_config = pg_config
        self.pg_conn = None
        self.arango = ArangoConnector()
        self.schema_manager = None
        
        # Statistics
        self.network_count = 0
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
        self.arango.ensure_collection(NETWORKS_COLLECTION)
        self.arango.ensure_collection('countries')
        
    def close(self):
        """
        Close database connections.
        """
        if self.pg_conn:
            self.pg_conn.close()
            
    def import_networks(self):
        """
        Import networks from PostgreSQL to ArangoDB.
        
        Returns:
            int: Count of imported networks
        """
        if not self.pg_conn:
            self.setup()
            
        # Create cursor
        cursor = self.pg_conn.cursor(cursor_factory=RealDictCursor)
        
        # Execute query
        cursor.execute(NETWORKS_QUERY)
        print(f"Fetched network data from PostgreSQL.")
        
        # Process networks in batches
        batch = []
        self.batch_countries = []
        self.country_edges = []
        
        for row in cursor:
            # Convert row to dictionary
            network = dict(row)
            
            # Set document key and ensure tmdb_id field
            pg_id = str(network['id'])
            # Make sure tmdb_id is properly set in ArangoDB document
            network['tmdb_id'] = pg_id
            name = network.get('name', '')
            network['_key'] = make_title_key(name, pg_id)
            
            # Add to batch
            batch.append(network)
            
            # Process origin country
            origin_country = network.get('origin_country')
            if origin_country:
                country_code = origin_country.strip().upper()
                if country_code:
                    # Add country node
                    self.batch_countries.append({'_key': country_code})
                    self.country_count += 1
                    
                    # Add edge from network to country
                    edge = {
                        '_from': f"{NETWORKS_COLLECTION}/{network['_key']}",
                        '_to': f"countries/{country_code}"
                    }
                    self.country_edges.append(edge)
            
            # If batch is full, insert
            if len(batch) >= BATCH_SIZE:
                self._insert_batch(batch)
                batch = []
                
        # Insert any remaining networks
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
        return self.network_count
        
    def _insert_batch(self, batch):
        """
        Insert a batch of networks into ArangoDB.
        
        Args:
            batch: List of network dictionaries
        """
        if not batch:
            return
            
        # Insert networks
        batch_insert(
            NETWORKS_COLLECTION,
            batch,
            self.arango.db.collection(NETWORKS_COLLECTION).insert_many,
            overwrite=True,
            overwrite_mode='update'
        )
        inserted = len(batch)
        self.network_count += inserted

    def print_stats(self):
        """
        Print import statistics.
        """
        print(f"\nNetwork import complete:")
        print(f"Imported {self.network_count} networks")
        print(f"Created {self.country_count} country relationships")

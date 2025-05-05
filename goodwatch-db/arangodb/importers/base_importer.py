"""
Base importer class with common functionality for all importers.
"""
import os
import time
from db.postgres_connector import PostgresConnector
from db.arango_connector import ArangoConnector
from db.schema_manager import SchemaManager
from utils.batch_utils import batch_insert, deduplicate_docs

class BaseImporter:
    """
    Base class for all importers with common functionality.
    """
    
    def __init__(self, pg_config):
        """
        Initialize the base importer.
        
        Args:
            pg_config: PostgreSQL connection configuration
        """
        self.pg_config = pg_config
        self.pg_connector = PostgresConnector(pg_config)
        self.arango_connector = ArangoConnector()
        self.schema_manager = None
        
        # Collection tracking
        self.node_counts = {}
        self.edge_counts = {}
        
    def setup(self):
        """
        Set up database connections and schema.
        """
        # Connect to databases
        self.pg_connector.connect()
        self.arango_connector.connect()
        
        # Setup schema
        self.schema_manager = SchemaManager(self.arango_connector)
        self.schema_manager.setup_schema()
        
    def execute_import(self, query, processor, collection_name, id_prefix, type_label):
        """
        Execute the import process for a specific entity type.
        
        Args:
            query: SQL query to fetch data from PostgreSQL
            processor: Entity processor instance
            collection_name: Name of the main collection
            id_prefix: Prefix for document IDs
            type_label: Label for the entity type (for logging)
            
        Returns:
            int: Number of imported items
        """
        start_time = time.time()
        try:
            # Fetch data from PostgreSQL
            items = self.pg_connector.execute_query(query)
            print(f'Fetched {len(items)} {type_label} from PostgreSQL.')
            
            # Process items
            processed_docs = []
            batch_docs = {}
            batch_edges = {}
            
            # Process each item
            for item in items:
                processed_doc = processor.process_item(item, id_prefix)
                if processed_doc:
                    processed_docs.append(processed_doc)
                    
                # Collect batch documents and edges
                for coll_name, docs in processor.batch_docs.items():
                    batch_docs.setdefault(coll_name, []).extend(docs)
                    
                for edge_name, edges in processor.batch_edges.items():
                    batch_edges.setdefault(edge_name, []).extend(edges)
                    
                # Reset processor batches for next item
                processor.initialize_batch_buffers([])
            
            # Deduplicate documents
            unique_main_docs = deduplicate_docs(processed_docs)
            import_count = len(unique_main_docs)
            
            # Insert main documents
            print(f"Inserting {import_count} {type_label} into ArangoDB...")
            batch_insert(
                collection_name,
                unique_main_docs,
                self.arango_connector.collections[collection_name].insert_many,
                overwrite=True,
                overwrite_mode='update'
            )
            
            # Insert related documents
            for cname, docs in batch_docs.items():
                if docs:
                    unique_docs = deduplicate_docs(docs)
                    self.node_counts[cname] = len(unique_docs)
#                     print(f"Inserting {len(unique_docs)} {cname}...")
                    
                    batch_insert(
                        cname,
                        unique_docs,
                        self.arango_connector.collections[cname].insert_many,
                        overwrite=True,
                        overwrite_mode='ignore'
                    )
            
            # Insert edges
            for edge_name, edges in batch_edges.items():
                if edges:
                    self.edge_counts[edge_name] = len(edges)
#                     print(f"Inserting {len(edges)} {edge_name} edges...")
                    
                    batch_insert(
                        edge_name,
                        edges,
                        self.arango_connector.graph.edge_collection(edge_name).insert_many,
                        overwrite=True,
                        overwrite_mode='ignore'
                    )
            
            print(f"Successfully imported/updated {import_count} {type_label} into ArangoDB.")
            return import_count
            
        except Exception as e:
            import traceback
            print(f"\n{'='*40}\n[IMPORT ERROR] {type_label.capitalize()}\n{'='*40}")
            print(f"Error: {e}\nType: {type(e).__name__}")
            tb = traceback.format_exc()
            print(f"Traceback (most recent call last):\n{tb}")
            print(f"{'='*40}\n")
            return 0
            
        finally:
            elapsed = time.time() - start_time
            print(f"[TIMER] Importing {type_label} took {elapsed:.2f} seconds.")
            
    def close(self):
        """
        Close all database connections.
        """
        self.pg_connector.close()
        
    def print_stats(self):
        """
        Print import statistics.
        """
        print("\n" + "="*50)
        print("IMPORT STATISTICS")
        print("="*50)
        
        print("\nNODES:")
        for coll, count in sorted(self.node_counts.items()):
            print(f"  {coll}: {count:,}")
            
        print("\nEDGES:")
        for edge, count in sorted(self.edge_counts.items()):
            print(f"  {edge}: {count:,}")
            
        print("="*50)

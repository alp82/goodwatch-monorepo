"""
Base importer for static data from JSON files.
"""
import json
import os
from importers.base_importer import BaseImporter

class StaticDataImporter(BaseImporter):
    """
    Base class for importing static data from JSON files.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the static data importer.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        self.arango = arango_connector
        self.batch_docs = {}
        self.batch_edges = {}
        self.stats = {
            'documents': {},
            'edges': {}
        }
        
    def _init_batch_buffers(self, collections, edge_collections=None):
        """
        Initialize batch buffers for documents and edges.
        
        Args:
            collections: List of document collection names
            edge_collections: List of edge collection names
        """
        # Initialize document batch buffers
        for collection in collections:
            self.batch_docs[collection] = []
            self.stats['documents'][collection] = 0
            
        # Initialize edge batch buffers if provided
        if edge_collections:
            for edge in edge_collections:
                self.batch_edges[edge] = []
                self.stats['edges'][edge] = 0
    
    def _load_json_data(self, filename):
        """
        Load data from a JSON file.
        
        Args:
            filename: Name of the JSON file to load (without path)
            
        Returns:
            list: Data from the JSON file
        """
        data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', filename)
        with open(data_path, 'r', encoding='utf-8') as file:
            return json.load(file)
    
    def _commit_batch(self, collection_name, batch, is_edge=False):
        """
        Commit a batch of documents or edges to ArangoDB.
        
        Args:
            collection_name: Name of the collection
            batch: List of documents or edges to insert
            is_edge: Whether the batch contains edges
        """
        if not batch:
            return
            
        db = self.arango.db
        collection = db.collection(collection_name)
        
        # Insert documents in batch
        if is_edge:
            collection.insert_many(batch)
            self.stats['edges'][collection_name] += len(batch)
        else:
            collection.insert_many(batch)
            self.stats['documents'][collection_name] += len(batch)
            
        # Clear the batch
        batch.clear()
    
    def _ensure_collections_exist(self, collections, edge_collections=None):
        """
        Ensure collections exist before importing data.
        
        Args:
            collections: List of document collection names
            edge_collections: List of edge collection names
        """
        db = self.arango.db
        
        # Ensure document collections exist
        for collection in collections:
            if not db.has_collection(collection):
                db.create_collection(collection)
                print(f"Created {collection} collection")
                
        # Ensure edge collections exist
        if edge_collections:
            for edge in edge_collections:
                if not db.has_collection(edge):
                    db.create_collection(edge, edge=True)
                    print(f"Created {edge} edge collection")
    
    def print_stats(self):
        """
        Print import statistics.
        """
        print("\nImport Statistics:")
        
        # Print document stats
        if self.stats['documents']:
            print("Documents:")
            for collection, count in self.stats['documents'].items():
                print(f"  - {collection}: {count}")
                
        # Print edge stats
        if self.stats['edges']:
            print("Edges:")
            for edge, count in self.stats['edges'].items():
                print(f"  - {edge}: {count}")

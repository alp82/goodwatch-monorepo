"""
Schema manager for setting up ArangoDB collections and graphs.
"""
from constants import VERTEX_COLLECTIONS, EDGE_DEFINITIONS

class SchemaManager:
    """
    Manages the database schema setup for the ArangoDB database.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the schema manager.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        self.arango = arango_connector
        
    def setup_schema(self, graph_name="goodwatch"):
        """
        Set up the full graph schema with all collections and edge definitions.
        
        Args:
            graph_name: Name of the graph to create/update
            
        Raises:
            Exception: If graph is not initialized
        """
        print(f"Setting up schema with {len(VERTEX_COLLECTIONS)} collections and {len(EDGE_DEFINITIONS)} edge types...")
        
        # Ensure all collections exist
        for name in VERTEX_COLLECTIONS:
            self.arango.ensure_collection(name)
        
        # Create edge collections
        for edge, _, _ in EDGE_DEFINITIONS:
            self.arango.ensure_collection(edge, edge=True)
            
        # Prepare edge definitions for graph
        edge_defs = []
        for edge, froms, tos in EDGE_DEFINITIONS:
            edge_defs.append({
                'edge_collection': edge,
                'from_vertex_collections': froms,
                'to_vertex_collections': tos
            })
            
        # Create/update graph with edge definitions
        self.arango.ensure_graph(graph_name, edge_defs)
        
        print(f"Schema setup complete for graph '{graph_name}'.")
        return self.arango.graph

    def ensure_indexes(self):
        """
        Create indexes for all collections.
        """
        print("Ensuring indexes for collections...")
        db = self.arango.db
        
        # DNA collection indexes
        dna_col = db.collection('dna')
        try:
            dna_col.add_index({'type': 'persistent', 'fields': ['category', 'label'], 'unique': False})
            print("Created persistent index on dna(category, label)")
        except Exception as e:
            print(f"Warning: Could not create index on dna(category, label): {e}")
        
        # Movies and shows indexes
        for collection_name in ['movies', 'shows']:
            collection = db.collection(collection_name)
            try:
                collection.add_index({'type': 'persistent', 'fields': ['tmdb_id'], 'unique': True})
                print(f"Created persistent index on {collection_name}(tmdb_id)")
            except Exception as e:
                print(f"Warning: Could not create index on {collection_name}(tmdb_id): {e}")
                
            try:
                collection.add_index({'type': 'persistent', 'fields': ['title'], 'unique': False})
                print(f"Created persistent index on {collection_name}(title)")
            except Exception as e:
                print(f"Warning: Could not create index on {collection_name}(title): {e}")
        
        # Streaming availability indexes
        try:
            streaming_col = db.collection('streaming_availability')
            streaming_col.add_index({'type': 'persistent', 'fields': ['country', 'provider_id'], 'unique': False})
            print("Created persistent index on streaming_availability(country, provider_id)")
            
            streaming_col.add_index({'type': 'persistent', 'fields': ['type'], 'unique': False})
            print("Created persistent index on streaming_availability(type)")
        except Exception as e:
            print(f"Warning: Could not create streaming availability indexes: {e}")
        
        print("Index creation complete.")

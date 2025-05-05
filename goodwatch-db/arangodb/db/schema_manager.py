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

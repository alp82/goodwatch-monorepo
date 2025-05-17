"""
ArangoDB database connector.
"""
from config import get_arango_client, get_arango_db, get_arango_sys_db, ARANGO_DB, ARANGO_USER, ARANGO_PASSWORD

class ArangoConnector:
    """
    Connector for ArangoDB database operations.
    """
    
    def __init__(self):
        """Initialize the ArangoDB connector."""
        self.client = None
        self.db = None
        self.collections = {}
        self.graph = None
    
    def connect(self):
        """
        Connect to ArangoDB and return the database.
        
        Returns:
            ArangoDB database object
        """
        print(f"Connecting to ArangoDB database '{ARANGO_DB}'...")
        self.client = get_arango_client()
        sys_db = get_arango_sys_db(self.client)
        
        # Create database if it doesn't exist
        if not sys_db.has_database(ARANGO_DB):
#             print(f"Creating database '{ARANGO_DB}'...")
            sys_db.create_database(ARANGO_DB, users=[
                {'username': ARANGO_USER, 'password': ARANGO_PASSWORD, 'active': True}
            ])
        
        self.db = get_arango_db(self.client)
        self.collections = {}
#         print(f"Connected to ArangoDB database '{ARANGO_DB}'.")
        return self.db
        
    def ensure_collection(self, name, **kwargs):
        """
        Ensure a collection exists and store it in self.collections.
        
        Args:
            name: Collection name
            **kwargs: Additional collection creation parameters
            
        Returns:
            ArangoDB collection object
        """
        if self.db.has_collection(name):
            coll = self.db.collection(name)
        else:
#             print(f"Creating collection '{name}'...")
            coll = self.db.create_collection(name, **kwargs)
        self.collections[name] = coll
        return coll
    
    def ensure_graph(self, graph_name, edge_defs):
        """
        Ensure a graph with edge definitions exists.
        
        Args:
            graph_name: Name of the graph
            edge_defs: List of edge definitions
            
        Returns:
            ArangoDB graph object
            
        Raises:
            Exception: If graph initialization fails
        """
        if self.db.has_graph(graph_name):
            graph = self.db.graph(graph_name)
            print(f"Using existing graph '{graph_name}'")
            
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
                        print(f"Updating edge definition for '{ecoll}'")
                        graph.delete_edge_definition(ecoll)
                        graph.create_edge_definition(**ed)
                else:
                    print(f"Adding new edge definition for '{ecoll}'")
                    graph.create_edge_definition(**ed)
        else:
            print(f"Creating new graph '{graph_name}'")
            graph = self.db.create_graph(graph_name)
            for ed in edge_defs:
#                 print(f"Creating edge definition for '{ed['edge_collection']}'")
                graph.create_edge_definition(**ed)
                
        self.graph = graph
        return graph

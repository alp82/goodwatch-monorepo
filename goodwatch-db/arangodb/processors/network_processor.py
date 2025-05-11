"""
Processor for network data.
"""
import json
from processors.base_processor import BaseProcessor
from utils.key_generators import make_title_key
from utils.parsers import parse_json_field
from constants import NETWORKS_COLLECTION
from db.schema_manager import SchemaManager

class NetworkProcessor(BaseProcessor):
    """
    Processor for network data.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the network processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        # Ensure collections exist
        self.arango.ensure_collection(NETWORKS_COLLECTION)
        
        # Make sure graph is initialized for edge operations
        if not self.arango.graph:
            schema_manager = SchemaManager(self.arango)
            schema_manager.setup_schema()
        
    def process_networks(self, doc, id_prefix):
        """
        Process networks for a TV show and create corresponding edges.
        
        Args:
            doc: Document containing network_ids
            id_prefix: Prefix for document IDs (e.g., 'shows')
            
        Returns:
            int: Number of networks processed
        """
        # If no network_ids, nothing to process
        network_ids = parse_json_field(doc.get('network_ids', []))
        if not network_ids:
            return 0
            
        count = 0
        
        # Process each network ID
        for network_id in network_ids:
            if not network_id:
                continue
                
            tmdb_id = str(network_id)
            
            # Create edge from show to network
            # Since networks are imported separately, we need to make the key match
            # what would be created by the NetworkImporter
            # The actual key format is "{name}_{tmdb_id}" but we don't have the name here,
            # so we'll use a query to find the network by tmdb_id
            query = f"""
            FOR network IN {NETWORKS_COLLECTION}
                FILTER network.tmdb_id == "{tmdb_id}"
                LIMIT 1
                RETURN network._key
            """
            
            cursor = self.arango.db.aql.execute(query)
            results = [doc for doc in cursor]
            
            if results:
                network_key = results[0]
                # Add edge using BaseProcessor method
                self.add_edge('network_for', 
                             f"{id_prefix}/{doc['_key']}", 
                             f"{NETWORKS_COLLECTION}/{network_key}")
                count += 1
                
        return count

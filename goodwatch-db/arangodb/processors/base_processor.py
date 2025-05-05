"""
Base processor class with common functionality for all entity processors.
"""
from utils.key_generators import make_human_key, safe_key
from utils.parsers import parse_json_field

class BaseProcessor:
    """
    Base class for all entity processors with common functionality.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the base processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        self.arango = arango_connector
        self.batch_docs = {}
        self.batch_edges = {}
        
    def initialize_batch_buffers(self, collection_names):
        """
        Initialize batch document and edge buffers.
        
        Args:
            collection_names: List of collection names to initialize
        """
        self.batch_docs = {name: [] for name in collection_names}
        self.batch_edges = {}
        
    def add_to_batch(self, collection, doc):
        """
        Add a document to a batch.
        
        Args:
            collection: Collection name
            doc: Document to add
        """
        self.batch_docs.setdefault(collection, []).append(doc)
        
    def add_edge(self, edge_name, from_id, to_id, **attributes):
        """
        Add an edge to the batch.
        
        Args:
            edge_name: Edge collection name
            from_id: Source document ID
            to_id: Target document ID
            **attributes: Additional edge attributes
        """
        edge = {'_from': from_id, '_to': to_id}
        edge.update(attributes)
        self.batch_edges.setdefault(edge_name, []).append(edge)
        
    def get_collection_name(self, collection):
        """
        Get a specific collection by name.
        
        Args:
            collection: Collection name
            
        Returns:
            ArangoDB collection
        """
        return self.arango.collections.get(collection)
        
    def clean_redundant_fields(self, doc, fields_to_remove=None):
        """
        Remove redundant fields from a document.
        
        Args:
            doc: Document to clean
            fields_to_remove: Set of field names to remove
            
        Returns:
            dict: Cleaned document
        """
        from constants import REDUNDANT_FIELDS
        
        fields = fields_to_remove or REDUNDANT_FIELDS
        for field in list(doc.keys()):
            if field in fields:
                doc.pop(field, None)
                
        return doc

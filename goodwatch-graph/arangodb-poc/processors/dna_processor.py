"""
Processor for DNA data.
"""
from utils.key_generators import make_dna_key
from processors.base_processor import BaseProcessor

class DNAProcessor(BaseProcessor):
    """
    Processor for DNA data.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the DNA processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        self.dna_pairs = set()  # Track unique (category, label) pairs
    
    def process_dna(self, doc, dna_data=None, source_collection=None):
        """
        Process DNA data for a document and create related nodes and edges.
        
        Args:
            doc: Document containing the DNA data or document key
            dna_data: DNA data dictionary if not in doc
            source_collection: Source collection name (e.g., 'movies', 'shows')
            
        Returns:
            set: Set of processed (category, label) pairs
        """
        if source_collection is None:
            raise ValueError("source_collection must be specified")
            
        # If no explicit dna_data provided, try to get it from doc
        if dna_data is None:
            if isinstance(doc, dict):
                dna_data = doc.get('dna')
            else:
                raise ValueError("Either doc must be a dictionary with 'dna' or dna_data must be provided")
        
        # If no DNA data, nothing to process
        if not dna_data:
            return set()
            
        # Get document key
        doc_key = doc['_key'] if isinstance(doc, dict) else doc
        
        # Process each category and label
        local_pairs = set()
        for category, labels in dna_data.items():
            for label in labels:
                # Generate key for DNA node
                key = make_dna_key(category, label)
                
                # Create DNA document if not already tracked
                self.dna_pairs.add((category, label))
                local_pairs.add((category, label))
                
                dna_doc = {
                    '_key': key,
                    'category': category,
                    'label': label
                }
                
                # Add DNA document to batch
                self.add_to_batch('dna', dna_doc)
                
                # Create edge from source to DNA node
                self.add_edge('has_dna', f"{source_collection}/{doc_key}", f"dna/{key}")
                
        return local_pairs

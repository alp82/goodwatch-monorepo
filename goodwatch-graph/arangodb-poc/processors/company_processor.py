"""
Processor for handling production companies and movie collections.
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key, safe_key

class CompanyProcessor(BaseProcessor):
    """
    Processor for handling production companies and movie collections.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the company processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_production_companies(self, doc, id_prefix):
        """
        Process production companies for a document and create related edges.
        
        Args:
            doc: Main document with production company data
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (company_docs, company_edges)
        """
        company_ids = parse_json_field(doc.get('production_company_ids'))
        company_docs = []
        company_edges = []
        
        if not isinstance(company_ids, list):
            return company_docs, company_edges
            
        for cid in company_ids:
            if not cid:
                continue
                
            # Use numeric ID as key
            company_key = str(cid)
            
            # Create production company document
            company_doc = {
                '_key': company_key
            }
            
            company_docs.append(company_doc)
            self.add_to_batch('production_companies', company_doc)
            
            # Create edge from movie to production company
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"production_companies/{company_key}"
            }
            company_edges.append(edge)
            self.add_edge('produced_by', f"{id_prefix}/{doc['_key']}", f"production_companies/{company_key}")
            
        return company_docs, company_edges
        
    def process_movie_collection(self, doc):
        """
        Process movie collection for a document and create related edges.
        
        Args:
            doc: Main document with collection data
            
        Returns:
            tuple: (collection_doc, collection_edge)
        """
        collection_data = parse_json_field(doc.get('collection'))
        
        if not isinstance(collection_data, dict) or not collection_data.get('id'):
            return None, None
            
        coll_id = str(collection_data.get('id'))
        coll_name = collection_data.get('name', '')
        
        # Create movie collection document
        collection_doc = {
            '_key': coll_id,
            'name': coll_name
        }
        
        self.add_to_batch('movie_series', collection_doc)
        
        # Create edge from movie to movie series
        edge = {
            '_from': f"movies/{doc['_key']}",
            '_to': f"movie_series/{coll_id}"
        }
        
        self.add_edge('belongs_to_movie_series', f"movies/{doc['_key']}", f"movie_series/{coll_id}")
        
        return collection_doc, edge

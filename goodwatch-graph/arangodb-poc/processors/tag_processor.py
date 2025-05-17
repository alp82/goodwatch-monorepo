"""
Processor for handling tags like genres, keywords, and tropes.
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field, normalize_named_list
from utils.key_generators import safe_key

class TagProcessor(BaseProcessor):
    """
    Processor for handling taxonomies like genres, keywords, and tropes.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the tag processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_genres(self, doc, id_prefix):
        """
        Process genres for a document and create related edges.
        
        Args:
            doc: Main document with genres data
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (genre_docs, genre_edges)
        """
        genres = normalize_named_list(parse_json_field(doc.get('genres')))
        genre_docs = []
        genre_edges = []
        
        for genre in genres:
            if not genre['id']:
                continue
                
            # Create genre document
            genre_doc = {
                '_key': genre['id'],
                'name': genre['name']
            }
            
            genre_docs.append(genre_doc)
            self.add_to_batch('genres', genre_doc)
            
            # Create edge from document to genre
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"genres/{genre['id']}"
            }
            genre_edges.append(edge)
            self.add_edge('has_genre', f"{id_prefix}/{doc['_key']}", f"genres/{genre['id']}")
            
        return genre_docs, genre_edges
        
    def process_keywords(self, doc, id_prefix):
        """
        Process keywords for a document and create related edges.
        
        Args:
            doc: Main document with keywords data
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (keyword_docs, keyword_edges)
        """
        keywords = normalize_named_list(parse_json_field(doc.get('keywords')))
        keyword_docs = []
        keyword_edges = []
        
        for keyword in keywords:
            if not keyword['id']:
                continue
                
            # Create keyword document
            keyword_doc = {
                '_key': keyword['id'],
                'name': keyword['name']
            }
            
            keyword_docs.append(keyword_doc)
            self.add_to_batch('keywords', keyword_doc)
            
            # Create edge from document to keyword
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"keywords/{keyword['id']}"
            }
            keyword_edges.append(edge)
            self.add_edge('has_keyword', f"{id_prefix}/{doc['_key']}", f"keywords/{keyword['id']}")
            
        return keyword_docs, keyword_edges
        
    def process_tropes(self, doc, id_prefix):
        """
        Process tropes for a document and create related edges.
        
        Args:
            doc: Main document with tropes data
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (trope_docs, trope_edges)
        """
        tropes_raw = parse_json_field(doc.get('tropes'))
        trope_docs = []
        trope_edges = []
        
        # Convert tropes to normalized format
        tropes = []
        for t in tropes_raw:
            if isinstance(t, dict) and 'name' in t:
                key = safe_key(t.get('name'))
                tropes.append({'key': key, 'name': t['name']})
        
        for trope in tropes:
            if not trope['key']:
                continue
                
            # Create trope document
            trope_doc = {
                '_key': trope['key'],
                'name': trope['name']
            }
            
            trope_docs.append(trope_doc)
            self.add_to_batch('tropes', trope_doc)
            
            # Create edge from document to trope
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"tropes/{trope['key']}"
            }
            trope_edges.append(edge)
            self.add_edge('has_trope', f"{id_prefix}/{doc['_key']}", f"tropes/{trope['key']}")
            
        return trope_docs, trope_edges

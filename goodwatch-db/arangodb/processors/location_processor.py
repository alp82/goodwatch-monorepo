"""
Processor for handling locations (countries and languages).
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key

class LocationProcessor(BaseProcessor):
    """
    Processor for handling countries, languages, and related data.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the location processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_countries(self, doc, id_prefix):
        """
        Process origin countries for a document and create related edges.
        
        Args:
            doc: Main document with origin_country_codes
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            list: Country edges
        """
        origin_country_codes = parse_json_field(doc.get('origin_country_codes'))
        country_edges = []
        
        if not isinstance(origin_country_codes, list):
            return country_edges
            
        for code in origin_country_codes:
            if not code:
                continue
                
            code = code.strip().upper()
            self.add_to_batch('countries', {'_key': code})
            
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"countries/{code}"
            }
            country_edges.append(edge)
            self.add_edge('originates_from_country', f"{id_prefix}/{doc['_key']}", f"countries/{code}")
            
        return country_edges
        
    def process_languages(self, doc, id_prefix):
        """
        Process original and spoken languages for a document and create related edges.
        
        Args:
            doc: Main document with language codes
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (original_language_edge, spoken_language_edges)
        """
        orig_lang = doc.get('original_language_code')
        spoken_langs = parse_json_field(doc.get('spoken_language_codes'))
        
        orig_lang_edge = None
        spoken_lang_edges = []
        
        # Process original language
        if orig_lang:
            orig_lang = orig_lang.strip().lower()
            self.add_to_batch('languages', {'_key': orig_lang})
            
            orig_lang_edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"languages/{orig_lang}"
            }
            self.add_edge('has_original_language', f"{id_prefix}/{doc['_key']}", f"languages/{orig_lang}")
        
        # Process spoken languages
        if isinstance(spoken_langs, list):
            for code in spoken_langs:
                if not code:
                    continue
                    
                code = code.strip().lower()
                self.add_to_batch('languages', {'_key': code})
                
                edge = {
                    '_from': f"{id_prefix}/{doc['_key']}",
                    '_to': f"languages/{code}"
                }
                spoken_lang_edges.append(edge)
                self.add_edge('has_spoken_language', f"{id_prefix}/{doc['_key']}", f"languages/{code}")
                
        return orig_lang_edge, spoken_lang_edges
    
    def process_streaming_countries(self, doc, id_prefix):
        """
        Process streaming countries for a document and create related edges.
        
        Args:
            doc: Main document with streaming_country_codes
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            list: Streaming country edges
        """
        streaming_country_codes = parse_json_field(doc.get('streaming_country_codes'))
        streaming_country_edges = []
        
        if not isinstance(streaming_country_codes, list):
            return streaming_country_edges
            
        for code in streaming_country_codes:
            if not code:
                continue
                
            code = code.strip().upper()
            self.add_to_batch('countries', {'_key': code})
            
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"countries/{code}"
            }
            streaming_country_edges.append(edge)
            self.add_edge('available_in_country', f"{id_prefix}/{doc['_key']}", f"countries/{code}")
            
        return streaming_country_edges

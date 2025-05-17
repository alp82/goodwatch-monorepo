"""
Processor for handling translations and associated data.
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key

class TranslationProcessor(BaseProcessor):
    """
    Processor for handling translations, including related languages and countries.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the translation processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_translations(self, doc, id_prefix):
        """
        Process translations for a document and create related edges.
        
        Args:
            doc: Main document with translations
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (translation_docs, translation_edges, lang_edges, country_edges)
        """
        translations = parse_json_field(doc.get('translations'))
        translation_docs = []
        translation_edges = []
        translation_lang_edges = []
        translation_country_edges = []
        
        if not translations:
            return translation_docs, translation_edges, translation_lang_edges, translation_country_edges
            
        for t in translations:
            iso1 = t.get('iso_639_1') or 'xx'
            iso2 = t.get('iso_3166_1') or 'xx'
            tkey = make_human_key(doc['_key'], iso1, iso2)
            
            # Create translation document
            tdoc = {
                '_key': tkey,
                'parent_key': doc['_key'],
                'iso_639_1': iso1,
                'iso_3166_1': iso2,
                'name': t.get('name'),
                'english_name': t.get('english_name'),
            }
            
            # Add translation data if available
            if 'data' in t and isinstance(t['data'], dict):
                tdoc.update(t['data'])
                
            translation_docs.append(tdoc)
            self.add_to_batch('translations', tdoc)
            
            # Create edge from main doc to translation
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"translations/{tkey}"
            }
            translation_edges.append(edge)
            self.add_edge('has_translation', f"{id_prefix}/{doc['_key']}", f"translations/{tkey}")
            
            # Create language node and edge if language code is available
            if iso1 and iso1 != 'xx':
                lang = iso1.strip().lower()
                self.add_to_batch('languages', {'_key': lang})
                
                lang_edge = {
                    '_from': f"translations/{tkey}",
                    '_to': f"languages/{lang}"
                }
                translation_lang_edges.append(lang_edge)
                self.add_edge('translation_in_language', f"translations/{tkey}", f"languages/{lang}")
            
            # Create country node and edge if country code is available
            if iso2 and iso2 != 'xx':
                country = iso2.strip().upper()
                self.add_to_batch('countries', {'_key': country})
                
                country_edge = {
                    '_from': f"translations/{tkey}",
                    '_to': f"countries/{country}"
                }
                translation_country_edges.append(country_edge)
                self.add_edge('translation_in_country', f"translations/{tkey}", f"countries/{country}")
                
        return translation_docs, translation_edges, translation_lang_edges, translation_country_edges

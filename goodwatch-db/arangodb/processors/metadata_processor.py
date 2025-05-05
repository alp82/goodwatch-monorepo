"""
Processor for handling metadata like alternative titles and certifications.
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key

class MetadataProcessor(BaseProcessor):
    """
    Processor for handling alternative titles, certifications, and other metadata.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the metadata processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_alternative_titles(self, doc, id_prefix):
        """
        Process alternative titles for a document and create related edges.
        
        Args:
            doc: Main document with alternative titles
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (alt_title_docs, alt_title_edges, country_edges)
        """
        alt_titles = parse_json_field(doc.get('alternative_titles'))
        alt_title_docs = []
        alt_title_edges = []
        alt_title_country_edges = []
        
        if not isinstance(alt_titles, list):
            return alt_title_docs, alt_title_edges, alt_title_country_edges
            
        for i, alt in enumerate(alt_titles):
            at_key = make_human_key(doc['_key'], alt.get('title'), alt.get('iso_3166_1') or i)
            
            # Create alternative title document
            atdoc = dict(alt)
            atdoc['_key'] = at_key
            atdoc['parent_key'] = doc['_key']
            
            alt_title_docs.append(atdoc)
            self.add_to_batch('alternative_titles', atdoc)
            
            # Create edge from main doc to alternative title
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"alternative_titles/{at_key}"
            }
            alt_title_edges.append(edge)
            self.add_edge('has_alternative_title', f"{id_prefix}/{doc['_key']}", f"alternative_titles/{at_key}")
            
            # Create country node and edge if country code is available
            if alt.get('iso_3166_1'):
                code = alt['iso_3166_1'].strip().upper()
                self.add_to_batch('countries', {'_key': code})
                
                country_edge = {
                    '_from': f"alternative_titles/{at_key}",
                    '_to': f"countries/{code}"
                }
                alt_title_country_edges.append(country_edge)
                self.add_edge('alternative_title_for_country', f"alternative_titles/{at_key}", f"countries/{code}")
                
        return alt_title_docs, alt_title_edges, alt_title_country_edges
        
    def process_movie_series(self, doc, id_prefix):
        """
        Process movie series (collection) data for a document.
        
        Args:
            doc: Main document with collection data
            id_prefix: Prefix for document IDs (e.g., 'movies')
            
        Returns:
            tuple: (collection_doc, collection_edge)
        """
        collection_info = parse_json_field(doc.get('collection'))
        collection_doc = None
        collection_edge = None
        
        if not isinstance(collection_info, dict) or not collection_info.get('id'):
            return collection_doc, collection_edge
            
        tmdb_id = str(collection_info['id'])
        name = collection_info.get('name') or ''
        ckey = make_human_key(name, tmdb_id)
        
        # Create collection document
        collection_doc = {
            '_key': ckey,
            'name': name,
            'tmdb_collection_id': tmdb_id,
            'poster_path': collection_info.get('poster_path'),
            'backdrop_path': collection_info.get('backdrop_path')
        }
        
        self.add_to_batch('movie_series', collection_doc)
        
        # Create edge from movie to collection
        collection_edge = {
            '_from': f"{id_prefix}/{doc['_key']}",
            '_to': f"movie_series/{ckey}"
        }
        
        self.add_edge('belongs_to_movie_series', f"{id_prefix}/{doc['_key']}", f"movie_series/{ckey}")
        
        return collection_doc, collection_edge

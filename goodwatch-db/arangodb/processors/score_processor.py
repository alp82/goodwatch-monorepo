"""
Processor for handling scores and ratings.
"""
from processors.base_processor import BaseProcessor
from utils.key_generators import make_human_key
from constants import SCORE_SPECS

class ScoreProcessor(BaseProcessor):
    """
    Processor for handling scores and ratings from various sources.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the score processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_scores(self, doc, id_prefix):
        """
        Process scores for a document and create related edges.
        
        Args:
            doc: Main document with score data
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (score_docs, score_edges)
        """
        score_docs = []
        score_edges = []
        
        for spec in SCORE_SPECS:
            source, url_field, user_orig, user_pct, user_count, critics_orig, critics_pct, critics_count, combined_pct, combined_count = spec
            url = doc.get(url_field) if url_field else None
            
            # Process user score
            if user_pct and doc.get(user_pct) is not None:
                sdoc = {
                    '_key': make_human_key(source, 'user', doc['_key']),
                    'parent_key': doc['_key'],
                    'source': source,
                    'score_type': 'user',
                    'url': url,
                    'score_original': doc.get(user_orig),
                    'percent': doc.get(user_pct),
                    'rating_count': doc.get(user_count)
                }
                score_docs.append(sdoc)
                self.add_to_batch('scores', sdoc)
                
                edge = {
                    '_from': f"{id_prefix}/{doc['_key']}",
                    '_to': f"scores/{sdoc['_key']}"
                }
                score_edges.append(edge)
                self.add_edge('has_score', f"{id_prefix}/{doc['_key']}", f"scores/{sdoc['_key']}")
                
            # Process critics score
            if critics_pct and doc.get(critics_pct) is not None:
                sdoc = {
                    '_key': make_human_key(source, 'critics', doc['_key']),
                    'parent_key': doc['_key'],
                    'source': source,
                    'score_type': 'critics',
                    'url': url,
                    'score_original': doc.get(critics_orig),
                    'percent': doc.get(critics_pct),
                    'rating_count': doc.get(critics_count)
                }
                score_docs.append(sdoc)
                self.add_to_batch('scores', sdoc)
                
                edge = {
                    '_from': f"{id_prefix}/{doc['_key']}",
                    '_to': f"scores/{sdoc['_key']}"
                }
                score_edges.append(edge)
                self.add_edge('has_score', f"{id_prefix}/{doc['_key']}", f"scores/{sdoc['_key']}")
                
            # Process combined score (aggregated only)
            if combined_pct and doc.get(combined_pct) is not None:
                sdoc = {
                    '_key': make_human_key(source, 'combined', doc['_key']),
                    'parent_key': doc['_key'],
                    'source': source,
                    'score_type': 'combined',
                    'url': url,
                    'percent': doc.get(combined_pct),
                    'rating_count': doc.get(combined_count)
                }
                score_docs.append(sdoc)
                self.add_to_batch('scores', sdoc)
                
                edge = {
                    '_from': f"{id_prefix}/{doc['_key']}",
                    '_to': f"scores/{sdoc['_key']}"
                }
                score_edges.append(edge)
                self.add_edge('has_score', f"{id_prefix}/{doc['_key']}", f"scores/{sdoc['_key']}")
                
        return score_docs, score_edges

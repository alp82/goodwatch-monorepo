"""
Processor for handling recommendations and similar items.
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field

class RecommendationProcessor(BaseProcessor):
    """
    Processor for handling recommendations and similar items.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the recommendation processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_recommendations(self, doc, id_prefix):
        """
        Process recommendations for a document and create related edges.
        
        Args:
            doc: Main document with recommendation data
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            list: Recommendation edges
        """
        rec_ids = parse_json_field(doc.get('tmdb_recommendation_ids'))
        recommendation_edges = []
        
        if not isinstance(rec_ids, list):
            return recommendation_edges
            
        for rec_id in rec_ids:
            if not rec_id:
                continue
                
            rec_id = str(rec_id)
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"{id_prefix}/{rec_id}"
            }
            recommendation_edges.append(edge)
            self.add_edge('tmdb_recommends', f"{id_prefix}/{doc['_key']}", f"{id_prefix}/{rec_id}")
            
        return recommendation_edges
        
    def process_similar_items(self, doc, id_prefix):
        """
        Process similar items for a document and create related edges.
        
        Args:
            doc: Main document with similar items data
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            list: Similar item edges
        """
        similar_ids = parse_json_field(doc.get('tmdb_similar_ids'))
        similar_edges = []
        
        if not isinstance(similar_ids, list):
            return similar_edges
            
        for sim_id in similar_ids:
            if not sim_id:
                continue
                
            sim_id = str(sim_id)
            edge = {
                '_from': f"{id_prefix}/{doc['_key']}",
                '_to': f"{id_prefix}/{sim_id}"
            }
            similar_edges.append(edge)
            self.add_edge('tmdb_similar_to', f"{id_prefix}/{doc['_key']}", f"{id_prefix}/{sim_id}")
            
        return similar_edges

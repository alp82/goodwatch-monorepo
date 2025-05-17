"""
Processor for handling TV show seasons.
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key, safe_key

class SeasonProcessor(BaseProcessor):
    """
    Processor for handling TV show seasons.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the season processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_seasons(self, doc):
        """
        Process seasons for a TV show and create related edges.
        
        Args:
            doc: Main show document with seasons data
            
        Returns:
            tuple: (season_docs, season_edges)
        """
        seasons = parse_json_field(doc.get('seasons'))
        season_docs = []
        season_edges = []
        
        if not isinstance(seasons, list):
            return season_docs, season_edges
            
        for s in seasons:
            tmdb_id = str(s.get('id'))
            season_number = str(s.get('season_number'))
            
            if not tmdb_id or not season_number:
                continue
                
            sid = make_human_key(season_number, tmdb_id)
            
            # Create season document
            sdoc = {
                '_key': sid,
                'tmdb_id': tmdb_id,
                'season_number': int(season_number) if season_number.isdigit() else season_number,
                'name': s.get('name'),
                'air_date': s.get('air_date'),
                'vote_average': s.get('vote_average'),
                'episode_count': s.get('episode_count'),
                'parent_show_key': doc['_key']
            }
            
            season_docs.append(sdoc)
            self.add_to_batch('seasons', sdoc)
            
            # Create edge from show to season
            edge = {
                '_from': f"shows/{doc['_key']}",
                '_to': f"seasons/{sid}"
            }
            season_edges.append(edge)
            self.add_edge('has_season', f"shows/{doc['_key']}", f"seasons/{sid}")
            
        return season_docs, season_edges

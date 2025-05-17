"""
Processor for production company data.
"""
import json
from processors.base_processor import BaseProcessor
from utils.key_generators import make_title_key
from utils.parsers import parse_json_field
from constants import PRODUCTION_COMPANIES_COLLECTION
from db.schema_manager import SchemaManager

class ProductionCompanyProcessor(BaseProcessor):
    """
    Processor for production company data.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the production company processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        # Ensure collections exist
        self.arango.ensure_collection(PRODUCTION_COMPANIES_COLLECTION)
        
        # Make sure graph is initialized for edge operations
        if not self.arango.graph:
            schema_manager = SchemaManager(self.arango)
            schema_manager.setup_schema()
        
    def process_production_companies(self, doc, id_prefix):
        """
        Process production companies for a movie or show and create corresponding edges.
        
        Args:
            doc: Document containing production_company_ids
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            int: Number of production companies processed
        """
        # If no production_company_ids, nothing to process
        company_ids = parse_json_field(doc.get('production_company_ids', []))
        if not company_ids:
            return 0
            
        count = 0
        
        # Process each production company ID
        for company_id in company_ids:
            if not company_id:
                continue
                
            tmdb_id = str(company_id)
            
            # Create edge from movie/show to production company
            # Since production companies are imported separately, we need to make the key match
            # what would be created by the ProductionCompanyImporter
            # The actual key format is "{name}_{tmdb_id}" but we don't have the name here,
            # so we'll use a query to find the production company by tmdb_id
            query = f"""
            FOR company IN {PRODUCTION_COMPANIES_COLLECTION}
                FILTER company.tmdb_id == "{tmdb_id}"
                LIMIT 1
                RETURN company._key
            """
            
            cursor = self.arango.db.aql.execute(query)
            results = [doc for doc in cursor]
            
            if results:
                company_key = results[0]
                # Add edge using BaseProcessor method
                self.add_edge('produced_by', 
                             f"{id_prefix}/{doc['_key']}", 
                             f"{PRODUCTION_COMPANIES_COLLECTION}/{company_key}")
                count += 1
                
        return count

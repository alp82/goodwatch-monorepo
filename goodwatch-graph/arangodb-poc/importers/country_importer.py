"""
Country importer for importing country data from JSON.
"""
from importers.static_data_importer import StaticDataImporter
from utils.key_generators import make_human_key

class CountryImporter(StaticDataImporter):
    """
    Importer for country data from countries.json.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the country importer.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        self.collections = ['countries']
        self._init_batch_buffers(self.collections)
        
    def import_countries(self):
        """
        Import countries from the countries.json file.
        
        Returns:
            int: Number of imported countries
        """
        print("\nImporting countries...")
        
        # Ensure collections exist
        self._ensure_collections_exist(self.collections)
        
        # Load country data
        countries_data = self._load_json_data('countries.json')
        
        # Process countries
        for country in countries_data:
            self._process_country(country)
            
        # Commit any remaining batch items
        for collection in self.collections:
            self._commit_batch(collection, self.batch_docs[collection])
            
        # Print stats
        total_countries = self.stats['documents']['countries']
        print(f"Imported {total_countries} countries")
        
        return total_countries
        
    def _process_country(self, country_data):
        """
        Process a country item from the JSON data.
        
        Args:
            country_data: Dictionary with country data
        """
        iso_code = country_data.get('iso_3166_1')
        english_name = country_data.get('english_name')
        native_name = country_data.get('native_name')
        
        if not iso_code or not english_name:
            print(f"Skipping country without required fields: {country_data}")
            return
            
        # Create country document
        country_doc = {
            '_key': iso_code,
            'iso_code': iso_code,
            'english_name': english_name,
            'native_name': native_name or english_name
        }
        
        # Add to batch
        self.batch_docs['countries'].append(country_doc)
        
        # Commit batch if needed
        if len(self.batch_docs['countries']) >= 100:
            self._commit_batch('countries', self.batch_docs['countries'])

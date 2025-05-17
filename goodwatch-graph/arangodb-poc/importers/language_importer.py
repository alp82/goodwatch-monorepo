"""
Language importer for importing language data from JSON.
"""
from importers.static_data_importer import StaticDataImporter

class LanguageImporter(StaticDataImporter):
    """
    Importer for language data from languages.json.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the language importer.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        self.collections = ['languages']
        self._init_batch_buffers(self.collections)
        
    def import_languages(self):
        """
        Import languages from the languages.json file.
        
        Returns:
            int: Number of imported languages
        """
        print("\nImporting languages...")
        
        # Ensure collections exist
        self._ensure_collections_exist(self.collections)
        
        # Load language data
        languages_data = self._load_json_data('languages.json')
        
        # Process languages
        for language in languages_data:
            self._process_language(language)
            
        # Commit any remaining batch items
        for collection in self.collections:
            self._commit_batch(collection, self.batch_docs[collection])
            
        # Print stats
        total_languages = self.stats['documents']['languages']
        print(f"Imported {total_languages} languages")
        
        return total_languages
        
    def _process_language(self, language_data):
        """
        Process a language item from the JSON data.
        
        Args:
            language_data: Dictionary with language data
        """
        iso_code = language_data.get('iso_639_1')
        english_name = language_data.get('english_name')
        native_name = language_data.get('name')
        
        if not iso_code or not english_name:
            print(f"Skipping language without required fields: {language_data}")
            return
            
        # Create language document
        language_doc = {
            '_key': iso_code,
            'iso_code': iso_code,
            'english_name': english_name,
            'native_name': native_name if native_name else english_name
        }
        
        # Add to batch
        self.batch_docs['languages'].append(language_doc)
        
        # Commit batch if needed
        if len(self.batch_docs['languages']) >= 100:
            self._commit_batch('languages', self.batch_docs['languages'])

"""
Streaming Provider importer for importing streaming service data from JSON.
"""
from importers.static_data_importer import StaticDataImporter
from utils.key_generators import make_human_key

class StreamingProviderImporter(StaticDataImporter):
    """
    Importer for streaming provider data from streaming_providers_*.json files.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the streaming provider importer.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        self.collections = ['streaming_services']
        self.edge_collections = ['streaming_service_in_country']
        self._init_batch_buffers(self.collections, self.edge_collections)
        
    def import_streaming_providers(self):
        """
        Import streaming providers from JSON files.
        
        Returns:
            int: Number of imported streaming providers
        """
        print("\nImporting streaming providers...")
        
        # Ensure collections exist
        self._ensure_collections_exist(self.collections, self.edge_collections)
        
        # Load streaming provider data for movies and shows
        movie_providers = self._load_json_data('streaming_providers_movies.json')
        show_providers = self._load_json_data('streaming_providers_shows.json')
        
        # Process streaming providers from both sources
        unique_providers = {}
        
        # Process movie providers
        for country_code, providers in movie_providers.items():
            self._process_country_providers(country_code, providers, unique_providers, 'movie')
            
        # Process show providers
        for country_code, providers in show_providers.items():
            self._process_country_providers(country_code, providers, unique_providers, 'show')
            
        # Commit any remaining batch items
        for collection in self.collections:
            self._commit_batch(collection, self.batch_docs[collection])
            
        for edge in self.edge_collections:
            self._commit_batch(edge, self.batch_edges[edge], is_edge=True)
            
        # Print stats
        total_providers = self.stats['documents']['streaming_services']
        total_country_providers = self.stats['edges']['streaming_service_in_country']
        print(f"Imported {total_providers} streaming providers with {total_country_providers} country availabilities")
        
        return total_providers
        
    def _process_country_providers(self, country_code, providers, unique_providers, media_type):
        """
        Process streaming providers for a country.
        
        Args:
            country_code: ISO code of the country
            providers: List of provider data for the country
            unique_providers: Dictionary of already processed providers
            media_type: Type of media (movie or show)
        """
        if not country_code or not providers:
            return
            
        for provider in providers:
            provider_id = provider.get('provider_id')
            provider_name = provider.get('provider_name')
            logo_path = provider.get('logo_path')
            
            if not provider_id or not provider_name:
                continue
                
            # Create or update provider in unique providers dictionary
            provider_key = str(provider_id)
            
            if provider_key not in unique_providers:
                unique_providers[provider_key] = {
                    '_key': provider_key,
                    'id': provider_id,
                    'name': provider_name,
                    'logo_path': logo_path,
                    'supports_movies': media_type == 'movie',
                    'supports_shows': media_type == 'show',
                    'countries': [country_code]
                }
            else:
                # Update existing provider
                if media_type == 'movie':
                    unique_providers[provider_key]['supports_movies'] = True
                elif media_type == 'show':
                    unique_providers[provider_key]['supports_shows'] = True
                    
                if country_code not in unique_providers[provider_key]['countries']:
                    unique_providers[provider_key]['countries'].append(country_code)
            
            # Create edge from provider to country
            provider_country_edge = {
                '_from': f'streaming_services/{provider_key}',
                '_to': f'countries/{country_code}'
            }
            
            # Check if this edge already exists in the batch
            edge_exists = False
            for edge in self.batch_edges['streaming_service_in_country']:
                if edge['_from'] == provider_country_edge['_from'] and edge['_to'] == provider_country_edge['_to']:
                    edge_exists = True
                    break
                    
            if not edge_exists:
                self.batch_edges['streaming_service_in_country'].append(provider_country_edge)
        
        # Add unique providers to the batch
        for provider_key, provider_data in unique_providers.items():
            if provider_key not in [p.get('_key') for p in self.batch_docs['streaming_services']]:
                # Remove countries from provider data before adding to collection
                provider_doc = {k: v for k, v in provider_data.items() if k != 'countries'}
                self.batch_docs['streaming_services'].append(provider_doc)
        
        # Commit batches if needed
        if len(self.batch_docs['streaming_services']) >= 100:
            self._commit_batch('streaming_services', self.batch_docs['streaming_services'])
            
        if len(self.batch_edges['streaming_service_in_country']) >= 100:
            self._commit_batch('streaming_service_in_country', self.batch_edges['streaming_service_in_country'], is_edge=True)

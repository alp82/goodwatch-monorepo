"""
Processor for handling streaming services and offers.
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key

class StreamingProcessor(BaseProcessor):
    """
    Processor for handling streaming services, offers, and related data.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the streaming processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_streaming_providers(self, doc, id_prefix):
        """
        Process streaming providers for a document and create related edges.
        
        Args:
            doc: Main document with streaming_providers
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (offer_docs, offer_edges, provider_edges, country_edges)
        """
        streaming_providers = parse_json_field(doc.get('streaming_providers'))
        
        offer_docs = []
        offer_edges = []
        provider_edges = []
        offer_country_edges = []
        
        if not isinstance(streaming_providers, dict):
            return offer_docs, offer_edges, provider_edges, offer_country_edges
            
        for country, offers in streaming_providers.items():
            country_code = country.strip().upper()
            self.add_to_batch('countries', {'_key': country_code})
            
            link = offers.get('link')
            
            for offer_type in ['ads', 'flatrate', 'buy', 'rent', 'free']:
                for prov in offers.get(offer_type, []):
                    # Create streaming service document
                    pid = str(prov['provider_id'])
                    provider_key = make_human_key(prov.get('provider_name'), pid)
                    
                    service_doc = {
                        '_key': provider_key,
                        'tmdb_id': pid,
                        'provider_name': prov.get('provider_name'),
                        'logo_path': prov.get('logo_path'),
                        'display_priority': prov.get('display_priority')
                    }
                    self.add_to_batch('streaming_services', service_doc)
                    
                    # Create streaming offer document
                    offer_key = make_human_key(doc['_key'], country_code, offer_type, provider_key)
                    
                    offer_doc = {
                        '_key': offer_key,
                        'type': offer_type,
                        'country': country_code,
                        'provider_id': provider_key,
                        'link': link,
                        'parent_key': doc['_key']
                    }
                    
                    offer_docs.append(offer_doc)
                    self.add_to_batch('streaming_offers', offer_doc)
                    
                    # Create edges
                    offer_edge = {
                        '_from': f"{id_prefix}/{doc['_key']}",
                        '_to': f"streaming_offers/{offer_key}"
                    }
                    offer_edges.append(offer_edge)
                    self.add_edge('has_streaming_offer', f"{id_prefix}/{doc['_key']}", f"streaming_offers/{offer_key}")
                    
                    provider_edge = {
                        '_from': f"streaming_offers/{offer_key}",
                        '_to': f"streaming_services/{provider_key}"
                    }
                    provider_edges.append(provider_edge)
                    self.add_edge('offer_for_streaming_service', f"streaming_offers/{offer_key}", f"streaming_services/{provider_key}")
                    
                    country_edge = {
                        '_from': f"streaming_offers/{offer_key}",
                        '_to': f"countries/{country_code}"
                    }
                    offer_country_edges.append(country_edge)
                    self.add_edge('offer_in_country', f"streaming_offers/{offer_key}", f"countries/{country_code}")
                    
        return offer_docs, offer_edges, provider_edges, offer_country_edges

"""
Processor for handling streaming services and availability.
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key

class StreamingProcessor(BaseProcessor):
    """
    Processor for handling streaming services, availability, and related data.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the streaming processor.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        
    def process_streaming_availability(self, doc, id_prefix):
        """
        Process streaming availability for a document and create related edges.
        
        Args:
            doc: Main document with streaming_availability
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')
            
        Returns:
            tuple: (availability_docs, availability_edges, provider_edges, country_edges)
        """
        streaming_availability = parse_json_field(doc.get('streaming_providers'))
        
        availability_docs = []
        availability_edges = []
        provider_edges = []
        country_edges = []
        
        if not isinstance(streaming_availability, dict):
            return availability_docs, availability_edges, provider_edges, country_edges
            
        for country, availability in streaming_availability.items():
            country_code = country.strip().upper()
            self.add_to_batch('countries', {'_key': country_code})
            
            link = availability.get('link')

            # TODO : Add flatrate_and_buy and others...
            for availability_type in ['ads', 'flatrate', 'buy', 'rent', 'free']:
                for prov in availability.get(availability_type, []):
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
                    
                    # Create streaming availability document
                    availability_key = make_human_key(doc['_key'], country_code, availability_type, provider_key)
                    
                    availability_doc = {
                        '_key': availability_key,
                        'type': availability_type,
                        'country': country_code,
                        'provider_id': provider_key,
                        'link': link,
                        'start_date': availability.get('start_date'),
                        'end_date': availability.get('end_date'),
                        'parent_key': doc['_key']
                    }
                    
                    availability_docs.append(availability_doc)
                    self.add_to_batch('streaming_availability', availability_doc)
                    
                    # Create edges
                    availability_edge = {
                        '_from': f"{id_prefix}/{doc['_key']}",
                        '_to': f"streaming_availability/{availability_key}"
                    }
                    availability_edges.append(availability_edge)
                    self.add_edge('has_streaming_availability', f"{id_prefix}/{doc['_key']}", f"streaming_availability/{availability_key}")
                    
                    provider_edge = {
                        '_from': f"streaming_availability/{availability_key}",
                        '_to': f"streaming_services/{provider_key}"
                    }
                    provider_edges.append(provider_edge)
                    self.add_edge('availability_on_streaming_service', f"streaming_availability/{availability_key}", f"streaming_services/{provider_key}")
                    
                    country_edge = {
                        '_from': f"streaming_availability/{availability_key}",
                        '_to': f"countries/{country_code}"
                    }
                    country_edges.append(country_edge)
                    self.add_edge('availability_in_country', f"streaming_availability/{availability_key}", f"countries/{country_code}")
                    
        return availability_docs, availability_edges, provider_edges, country_edges

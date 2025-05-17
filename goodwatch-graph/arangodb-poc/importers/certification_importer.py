"""
Certification importer for importing content rating data from JSON.
"""
from importers.static_data_importer import StaticDataImporter
from utils.key_generators import make_human_key

class CertificationImporter(StaticDataImporter):
    """
    Importer for certification data from certifications.json.
    """
    
    def __init__(self, arango_connector):
        """
        Initialize the certification importer.
        
        Args:
            arango_connector: ArangoConnector instance
        """
        super().__init__(arango_connector)
        self.collections = ['certification_systems', 'age_classifications']
        self.edge_collections = ['certification_for_country', 'classification_from_system', 'age_classification_for_country']
        self._init_batch_buffers(self.collections, self.edge_collections)
        
    def import_certifications(self):
        """
        Import certifications from the certifications.json file.
        
        Returns:
            dict: Statistics of imported data
        """
        print("\nImporting certification systems and age classifications...")
        
        # Ensure collections exist
        self._ensure_collections_exist(self.collections, self.edge_collections)
        
        # Load certification data
        cert_data = self._load_json_data('certifications.json')
        
        # The certifications.json structure has a 'certifications' object with country codes as keys
        if 'certifications' not in cert_data:
            print("Warning: No certifications found in the data file")
            return {
                'certification_systems': 0,
                'age_classifications': 0
            }
            
        certifications = cert_data['certifications']
        
        # Process certification systems by country
        for country_code, certification_data in certifications.items():
            self._process_country_certification(country_code, certification_data)
            
        # Commit any remaining batch items
        for collection in self.collections:
            self._commit_batch(collection, self.batch_docs[collection])
            
        for edge in self.edge_collections:
            self._commit_batch(edge, self.batch_edges[edge], is_edge=True)
            
        # Print stats
        total_systems = self.stats['documents']['certification_systems']
        total_classifications = self.stats['documents']['age_classifications']
        print(f"Imported {total_systems} certification systems and {total_classifications} age classifications")
        
        return {
            'certification_systems': total_systems,
            'age_classifications': total_classifications
        }
        
    def _process_country_certification(self, country_code, certification_data):
        """
        Process a country's certification system from the JSON data.
        
        Args:
            country_code: ISO 3166-1 country code
            certification_data: List of certifications for this country
        """
        if not country_code or not certification_data:
            return
            
        # Create certification system document
        system_name = f"{country_code} Rating System"
        system_key = make_human_key(f"cert_system_{country_code}")
        
        system_doc = {
            '_key': system_key,
            'name': system_name,
            'country_code': country_code
        }
        
        # Add system to batch
        self.batch_docs['certification_systems'].append(system_doc)
        
        # Create edge from system to country
        system_country_edge = {
            '_from': f'certification_systems/{system_key}',
            '_to': f'countries/{country_code}'
        }
        self.batch_edges['certification_for_country'].append(system_country_edge)
        
        # Process certifications for this system
        for cert in certification_data:
            self._process_classification(cert, system_key, country_code)
            
        # Commit batches if needed
        if len(self.batch_docs['certification_systems']) >= 100:
            self._commit_batch('certification_systems', self.batch_docs['certification_systems'])
            
        if len(self.batch_edges['certification_for_country']) >= 100:
            self._commit_batch('certification_for_country', self.batch_edges['certification_for_country'], is_edge=True)
            
    def _process_classification(self, cert_data, system_key, country_code):
        """
        Process a classification from the certification system.
        
        Args:
            cert_data: Dictionary with certification data
            system_key: Key of the certification system
            country_code: ISO code of the country
        """
        certification = cert_data.get('certification')
        order = cert_data.get('order')
        meaning = cert_data.get('meaning')
        
        if not certification:
            return
            
        # Create classification document
        cert_key = make_human_key(f"{country_code}_{certification}")
        cert_doc = {
            '_key': cert_key,
            'certification': certification,
            'order': order,
            'meaning': meaning,
            'country_code': country_code
        }
        
        # Add classification to batch
        self.batch_docs['age_classifications'].append(cert_doc)
        
        # Create edge from classification to system
        cert_system_edge = {
            '_from': f'age_classifications/{cert_key}',
            '_to': f'certification_systems/{system_key}'
        }
        self.batch_edges['classification_from_system'].append(cert_system_edge)
        
        # Create edge from classification to country
        cert_country_edge = {
            '_from': f'age_classifications/{cert_key}',
            '_to': f'countries/{country_code}'
        }
        self.batch_edges['age_classification_for_country'].append(cert_country_edge)
        
        # Commit batches if needed
        if len(self.batch_docs['age_classifications']) >= 100:
            self._commit_batch('age_classifications', self.batch_docs['age_classifications'])
            
        if len(self.batch_edges['classification_from_system']) >= 100:
            self._commit_batch('classification_from_system', self.batch_edges['classification_from_system'], is_edge=True)

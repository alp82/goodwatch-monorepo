"""
Processor for handling release events and age classifications (formerly certifications).
"""
from processors.base_processor import BaseProcessor
from utils.parsers import parse_json_field
from utils.key_generators import make_human_key

class ReleaseEventsProcessor(BaseProcessor):
    """
    Processor for handling release events and age classifications, including linking to country nodes.
    """

    def __init__(self, arango_connector):
        super().__init__(arango_connector)

    def _get_certification_label(self, cert_type, descriptors):
        """
        Map TMDB certification type numbers to readable labels
        TMDB types:
        1 = Premiere
        2 = Theatrical (limited)
        3 = Theatrical
        4 = Digital
        5 = Physical
        6 = TV
        Args:
            cert_type: The numeric certification type
            descriptors: List of additional descriptors
        Returns:
            str: Human-readable certification label
        """
        type_labels = {
            1: "Premiere",
            2: "Theatrical (Limited)",
            3: "Theatrical",
            4: "Digital",
            5: "Physical",
            6: "TV"
        }
        base_label = type_labels.get(cert_type, f"Type {cert_type}")
        if descriptors and len(descriptors) > 0:
            return f"{base_label} ({', '.join(descriptors)})"
        return base_label

    def process_release_events(self, doc, id_prefix):
        """
        Process release events and age classifications for a document and create related edges.

        Args:
            doc: Main document with release_dates data (from TMDb)
            id_prefix: Prefix for document IDs (e.g., 'movies' or 'shows')

        Returns:
            tuple: (release_event_docs, release_event_edges, age_class_docs, age_class_edges, country_edges)
        """
        release_info = parse_json_field(doc.get('certifications'))
        if not isinstance(release_info, list):
            return [], [], [], [], []

        release_event_docs = []
        release_event_edges = []
        age_class_docs = []
        age_class_edges = []
        country_edges = []
        age_classifications_by_country = {}

        for rel in release_info:
            country = rel.get('iso_3166_1')
            releases = rel.get('release_dates', [])
            country_classes = set()
            for idx, rd in enumerate(releases):
                event_key = make_human_key(doc['_key'], country or idx, rd.get('release_date') or idx, rd.get('type') or '')
                # ReleaseEvent node
                label = self._get_certification_label(rd.get('type'), rd.get('descriptors', []))
                revent = {
                    '_key': event_key,
                    'parent_key': doc['_key'],
                    'iso_3166_1': country,
                    'release_date': rd.get('release_date'),
                    'type': rd.get('type'),
                    'descriptors': rd.get('descriptors', []),
                    'note': rd.get('note'),
                    'label': label
                }
                release_event_docs.append(revent)
                self.add_to_batch('release_events', revent)
                # Edge: Movie/Show -> ReleaseEvent
                self.add_edge('has_release_event', f"{id_prefix}/{doc['_key']}", f"release_events/{event_key}")
                # AgeClassification node (if present)
                cert = rd.get('certification')
                if cert:
                    class_key = make_human_key(event_key, cert)
                    aclass = {
                        '_key': class_key,
                        'event_key': event_key,
                        'value': cert,
                        'system': None,  # Optionally infer from country
                        'iso_3166_1': country
                    }
                    age_class_docs.append(aclass)
                    self.add_to_batch('age_classifications', aclass)
                    # Edge: ReleaseEvent -> AgeClassification
                    self.add_edge('has_age_classification', f"release_events/{event_key}", f"age_classifications/{class_key}")
                    # For denormalized lookup
                    try:
                        age_num = int(cert)
                        country_classes.add(age_num)
                    except Exception:
                        pass
                    # Edge: AgeClassification -> Country
                    if country:
                        code = country.strip().upper()
                        self.add_to_batch('countries', {'_key': code})
                        self.add_edge('age_classification_for_country', f"age_classifications/{class_key}", f"countries/{code}")
                # Edge: ReleaseEvent -> Country
                if country:
                    code = country.strip().upper()
                    self.add_to_batch('countries', {'_key': code})
                    self.add_edge('release_event_for_country', f"release_events/{event_key}", f"countries/{code}")
            if country and country_classes:
                # Use strictest (highest) classification for denormalized lookup
                age_classifications_by_country[country] = max(country_classes)
        # Store denormalized lookup
        if age_classifications_by_country:
            doc['age_classifications_by_country'] = age_classifications_by_country
        return release_event_docs, release_event_edges, age_class_docs, age_class_edges, country_edges

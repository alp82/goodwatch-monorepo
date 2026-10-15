"""Read-only named-vector candidate retrieval; every result still faces the LLM gate."""
import requests
from threading import Lock


class VectorCandidates:
    def __init__(self, settings):
        self.settings = settings
        self.encoder = None
        self.encode_lock = Lock()

    def __call__(self, text):
        # Shared production model/pooling/normalization contract (ADR 0002).
        from f.search.text_encoder import TextEncoder, MULTILINGUAL_E5_SMALL
        with self.encode_lock:
            if self.encoder is None:
                self.encoder = TextEncoder(MULTILINGUAL_E5_SMALL)
            vector = self.encoder.encode(['query: ' + text])[0].tolist()
        base = self.settings['QDRANT_URL'].rstrip('/').replace(':6334', ':6333')
        response = requests.post(base + '/collections/media_fingerprint_v1/points/query',
                                 headers={'api-key': self.settings.get('QDRANT_API_KEY', '')},
                                 json={'query': vector, 'using': 'text_multi_v1', 'limit': 8,
                                       'with_payload': ['tmdb_id', 'media_type']}, timeout=60)
        response.raise_for_status()
        out = []
        for point in response.json()['result']['points']:
            payload = point['payload']
            kind = 'tv' if payload['media_type'] in ('tv', 'show') else 'movie'
            out.append({'key': kind + ':' + str(payload['tmdb_id']), 'tmdb_id': payload['tmdb_id'],
                        'media_type': kind, 'retrieval': 'vector_context', 'score': point['score']})
        return out


def main():
    return {'library': True}

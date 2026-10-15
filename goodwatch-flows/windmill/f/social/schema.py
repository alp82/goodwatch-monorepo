"""Social-owned tables, also registered in the repository's central Crate schema."""
SOCIAL_SCHEMAS = {
    'social_relevance': {
        'columns': {
            'media_type': 'TEXT', 'media_tmdb_id': 'BIGINT', 'post_id': 'TEXT',
            'version': 'TEXT', 'content_hash': 'TEXT',
            'status': "TEXT CHECK (status IN ('keep','drop'))",
            'kind': "TEXT CHECK (kind IN ('official_video','review','news','interview','social'))",
            'score': 'DOUBLE', 'dup_group': 'TEXT', 'reasons': 'ARRAY(TEXT)', 'judged_at': 'TIMESTAMP',
        },
        'primary_key': ['media_type', 'media_tmdb_id', 'post_id'], 'shards': 1, 'replicas': '0-1', 'timestamps': False,
    },
    'social_content_quality': {
        'columns': {
            'post_id': 'TEXT', 'content_hash': 'TEXT', 'version': 'TEXT',
            'status': "TEXT CHECK (status IN ('pass','reject'))", 'reasons': 'TEXT',
            'evidence': 'TEXT', 'checked_at': 'TIMESTAMP WITH TIME ZONE',
        },
        'primary_key': ['post_id'], 'shards': 1, 'replicas': '0-1', 'timestamps': False,
    },
    'social_post': {
        'columns': {
            'post_id': 'TEXT', 'source': "TEXT CHECK (source IN ('youtube','rss','bluesky','mastodon'))",
            'source_id': 'TEXT', 'url': 'TEXT', 'author_id': 'TEXT', 'author': 'TEXT',
            'published_at': 'TIMESTAMP WITH TIME ZONE', 'discovered_at': 'TIMESTAMP WITH TIME ZONE',
            'last_seen_at': 'TIMESTAMP WITH TIME ZONE', 'checked_at': 'TIMESTAMP WITH TIME ZONE',
            'text': 'TEXT', 'context': 'TEXT', 'provenance': 'TEXT', 'content_hash': 'TEXT',
            'processed_hash': 'TEXT', 'matcher_version': 'TEXT',
            'deleted_at': 'TIMESTAMP WITH TIME ZONE', 'deletion_reason': 'TEXT',
        },
        'primary_key': ['post_id'], 'shards': 1, 'replicas': '0-1', 'timestamps': False,
    },
    'social_title_link': {
        'columns': {
            'media_type': "TEXT CHECK (media_type IN ('movie','tv'))", 'media_tmdb_id': 'INTEGER', 'post_id': 'TEXT',
            'lane': 'TEXT', 'confidence': 'DOUBLE PRECISION', 'confidence_basis': 'TEXT', 'reason': 'TEXT',
            'matcher_version': 'TEXT', 'content_hash': 'TEXT', 'duplicate_group': 'TEXT',
            'created_at': 'TIMESTAMP WITH TIME ZONE', 'hidden_at': 'TIMESTAMP WITH TIME ZONE', 'hidden_reason': 'TEXT',
        },
        'primary_key': ['media_type', 'media_tmdb_id', 'post_id'], 'shards': 1, 'replicas': '0-1', 'timestamps': False,
    },
    'social_link_report': {
        'columns': {
            'report_id': 'TEXT', 'media_type': "TEXT CHECK (media_type IN ('movie','tv'))", 'media_tmdb_id': 'INTEGER',
            'post_id': 'TEXT', 'reason': 'TEXT', 'status': "TEXT CHECK (status IN ('open','confirmed','dismissed'))",
            'created_at': 'TIMESTAMP WITH TIME ZONE',
        },
        'primary_key': ['report_id'], 'shards': 1, 'replicas': '0-1', 'timestamps': False,
    },
    'social_ingest_run': {
        'columns': {
            'run_id': 'TEXT', 'source': 'TEXT', 'started_at': 'TIMESTAMP WITH TIME ZONE',
            'finished_at': 'TIMESTAMP WITH TIME ZONE', 'window_start': 'TIMESTAMP WITH TIME ZONE',
            'window_end': 'TIMESTAMP WITH TIME ZONE', 'status': 'TEXT', 'collected': 'INTEGER',
            'processed': 'INTEGER', 'published': 'INTEGER', 'details': 'TEXT',
            'inference_cost_usd': 'DOUBLE PRECISION', 'matcher_version': 'TEXT',
        },
        'primary_key': ['run_id'], 'shards': 1, 'replicas': '0-1', 'timestamps': False,
    },
}


def main():
    return {'tables': list(SOCIAL_SCHEMAS)}

"""Read only named flow secrets; local driver explicitly loads its env file."""
import os

KEYS = ('CRATE_HOSTS', 'CRATE_PORT', 'CRATE_USER', 'CRATE_PASS', 'OPENROUTER_API_KEY',
        'YOUTUBE_API_KEY', 'QDRANT_URL', 'QDRANT_API_KEY')


def load():
    settings = {key: os.environ[key] for key in KEYS if os.environ.get(key)}
    if os.environ.get('WM_JOB_ID'):
        import wmill
        for key in KEYS:
            if key in settings:
                continue
            try:
                value = wmill.get_variable('u/Alp/' + key)
                if value:
                    settings[key] = value
            except Exception:
                if key in ('CRATE_HOSTS', 'CRATE_USER', 'CRATE_PASS'):
                    raise
    return settings


def main():
    return {'library': True}

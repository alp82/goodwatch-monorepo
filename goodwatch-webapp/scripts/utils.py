import re

def slugify(text: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', text)
    return slug.lower().strip('-')

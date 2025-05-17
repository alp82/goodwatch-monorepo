"""
Utility functions for generating keys for database documents.
"""
import re
from constants import HUMAN_KEY_PATTERN_STRING, SAFE_KEY_PATTERN_STRING

# Pre-compiled regex patterns
_HUMAN_KEY_PATTERN = re.compile(HUMAN_KEY_PATTERN_STRING)
_SAFE_KEY_PATTERN = re.compile(SAFE_KEY_PATTERN_STRING)
_MULTIPLE_UNDERSCORES = re.compile(r'_+')

def make_human_key(*args):
    """
    Create a human-readable database key from the given arguments.
    
    Args:
        *args: Values to combine into a key
        
    Returns:
        str: A sanitized key string
    """
    raw = '_'.join(str(a) for a in args if a is not None)
    key = raw.lower().replace(' ', '_')
    key = _HUMAN_KEY_PATTERN.sub('', key)
    # Replace multiple consecutive underscores with a single one
    key = _MULTIPLE_UNDERSCORES.sub('_', key)
    return key[:128]

def make_title_key(title, id_value):
    """
    Create a key that combines a title with an ID.
    
    Args:
        title: The title to use as prefix for the key
        id_value: The ID to append to the key
        
    Returns:
        str: A sanitized key string with format "clean_title_id"
    """
    if not title:
        return str(id_value)
        
    # Clean the title: lowercase, replace spaces and special chars with underscores
    clean_title = title.lower().replace(' ', '_')
    clean_title = _HUMAN_KEY_PATTERN.sub('', clean_title)
    # Replace multiple consecutive underscores with a single one
    clean_title = _MULTIPLE_UNDERSCORES.sub('_', clean_title)
    
    # Limit the title part to keep total key length reasonable
    title_part = clean_title[:50]
    if title_part.endswith('_'):
        title_part = title_part[:-1]
        
    # Combine title with ID
    return f"{title_part}_{id_value}"

def make_dna_key(category, label):
    """Generate a unique key for a DNA node."""
    from re import sub
    cat = sub(r'[^a-zA-Z0-9]', '_', str(category)).lower()
    lbl = sub(r'[^a-zA-Z0-9]', '_', str(label)).lower()
    return f"{cat}__{lbl}"

def safe_key(val):
    """
    Create a safe key for database use.
    
    Args:
        val: Value to convert to a safe key
        
    Returns:
        str: A sanitized key string
    """
    return _SAFE_KEY_PATTERN.sub('', str(val).replace(' ', '_')).lower()[:128]

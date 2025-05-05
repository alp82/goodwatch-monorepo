"""
Utility functions for generating keys for database documents.
"""
import re
from constants import HUMAN_KEY_PATTERN_STRING, SAFE_KEY_PATTERN_STRING

# Pre-compiled regex patterns
_HUMAN_KEY_PATTERN = re.compile(HUMAN_KEY_PATTERN_STRING)
_SAFE_KEY_PATTERN = re.compile(SAFE_KEY_PATTERN_STRING)

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
    return key[:128]

def safe_key(val):
    """
    Create a safe key for database use.
    
    Args:
        val: Value to convert to a safe key
        
    Returns:
        str: A sanitized key string
    """
    return _SAFE_KEY_PATTERN.sub('', str(val).replace(' ', '_')).lower()[:128]

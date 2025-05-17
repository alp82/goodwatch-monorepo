"""
Utility functions for parsing and normalizing data.
"""
import json
import datetime
from decimal import Decimal
from utils.key_generators import safe_key

class DateTimeEncoder(json.JSONEncoder):
    """
    JSON encoder that handles datetime.date and datetime.datetime objects.
    """
    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        return super().default(obj)

def json_serialize(obj):
    """
    Serialize an object to JSON, handling datetime objects.

    Args:
        obj: The object to serialize

    Returns:
        str: JSON string
    """
    return json.dumps(obj, cls=DateTimeEncoder)

def parse_json_field(field):
    """
    Parse a JSON field, returning an empty list if parsing fails.
    
    Args:
        field: The field to parse (string or already parsed object)
        
    Returns:
        list or dict: The parsed JSON data or empty list if parsing fails
    """
    if isinstance(field, str):
        try:
            return json.loads(field)
        except Exception:
            return []
    return field if field else []

def normalize_named_list(lst):
    """
    Normalize a list of items with names to a consistent format.
    
    Args:
        lst: List of items that may be dicts with 'name' or strings
        
    Returns:
        list: Normalized list of dicts with 'id' and 'name' keys
    """
    norm = []
    for item in lst:
        if isinstance(item, dict):
            if 'id' in item and 'name' in item:
                norm.append({'id': safe_key(item['name']), 'name': item['name']})
            elif 'name' in item:
                norm.append({'id': safe_key(item['name']), 'name': item['name']})
        elif isinstance(item, str):
            norm.append({'id': safe_key(item), 'name': item})
    return norm

def serialize_for_json(doc):
    """
    Convert Python objects in a document to JSON-serializable types.
    
    Args:
        doc: Dictionary possibly containing datetime or Decimal objects
        
    Returns:
        dict: Dictionary with all values converted to JSON-serializable types
    """
    result = {}
    for key, value in doc.items():
        if isinstance(value, (datetime.datetime, datetime.date)):
            result[key] = value.isoformat()
        elif isinstance(value, Decimal):
            result[key] = float(value)
        else:
            result[key] = value
    return result

def trim_val(val):
    """
    Trim a value for display purposes.
    
    Args:
        val: Any value to be trimmed
        
    Returns:
        str: Trimmed string representation of the value
    """
    try:
        if isinstance(val, list):
            preview = val[:2]
            return f"{preview}... (+{len(val)-2} more)" if len(val) > 2 else str(preview)
        s = str(val)
        return s[:200] + ('...' if len(s) > 200 else '')
    except Exception:
        return str(val)

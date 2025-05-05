"""
Utility functions for batch processing database operations.
"""
import time
import datetime
from decimal import Decimal
import json
import traceback

def preprocess_value(value):
    """
    Preprocess a value to ensure it's JSON serializable.
    
    Args:
        value: Value to preprocess
        
    Returns:
        Preprocessed JSON-serializable value
    """
    # Handle None
    if value is None:
        return None
        
    # Handle date and datetime objects
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    
    # Handle Decimal objects
    elif isinstance(value, Decimal):
        return float(value)
    
    # Handle lists/tuples by preprocessing each item
    elif isinstance(value, (list, tuple)):
        return [preprocess_value(item) for item in value]
    
    # Handle dictionaries by preprocessing each value
    elif isinstance(value, dict):
        return {k: preprocess_value(v) for k, v in value.items()}
    
    # For other types, return as is (assumes they are serializable)
    return value

def preprocess_docs(docs):
    """
    Preprocess documents to ensure they can be serialized to JSON,
    handling nested structures with non-serializable types.

    Args:
        docs: List of documents to preprocess

    Returns:
        list: Preprocessed documents
    """
    processed_docs = []
    for doc in docs:
        processed_doc = {}
        for key, value in doc.items():
            processed_doc[key] = preprocess_value(value)
        processed_docs.append(processed_doc)
    return processed_docs

def batch_insert(collection, docs, insert_fn, batch_size=1000, **kwargs):
    """
    Insert documents in batches to avoid memory issues.

    Args:
        collection: Name of the collection for logging
        docs: List of documents to insert
        insert_fn: Function to call for insertion
        batch_size: Size of each batch
        **kwargs: Additional arguments to pass to insert_fn
    """
    start_time = time.time()
    total_docs = len(docs)

    # Preprocess documents to handle date serialization
    try:
        preprocessed_docs = preprocess_docs(docs)
    except Exception as e:
        print(f"[ERROR] Preprocessing documents for {collection} failed: {e}")
        return

    for i in range(0, total_docs, batch_size):
        batch = preprocessed_docs[i:i+batch_size]
        batch_num = i//batch_size + 1
        try:
            insert_fn(batch, **kwargs)
            if batch_num % 10 == 0 or i + batch_size >= total_docs:
                elapsed = time.time() - start_time
                print(f"Processed {min(i+batch_size, total_docs)}/{total_docs} {collection} " 
                      f"({(min(i+batch_size, total_docs)/total_docs*100):.1f}%) in {elapsed:.2f}s")
        except Exception as e:
            print(f"[WARNING] Bulk insert failed for {collection}: {e} (batch {batch_num})")
            # Provide more context about the error
            try:
                # Try to identify the problematic document
                for idx, doc in enumerate(batch):
                    try:
                        # Test serialization of each document individually
                        json.dumps(doc)
                    except Exception as doc_error:
                        error_type = type(doc_error).__name__
                        # Get the document keys to help identify the issue
                        doc_keys = list(doc.keys())[:10]  # Show first 10 keys to avoid excessive output
                        if len(doc_keys) < len(doc):
                            doc_keys.append("... and more")
                            
                        # Print detailed error information
                        print(f"  Document #{idx} contains fields: {doc_keys}")
                        print(f"  Error with document #{idx}: {error_type}: {str(doc_error)}")
                        
                        # Try to identify the problematic field
                        for field, value in doc.items():
                            try:
                                json.dumps({field: value})
                            except Exception:
                                value_type = type(value).__name__
                                value_repr = str(value)[:50] + "..." if len(str(value)) > 50 else str(value)
                                print(f"  Problematic field: '{field}' with {value_type} value: {value_repr}")
                                break
                        break
            except Exception as debug_error:
                print(f"  [ERROR] While debugging: {debug_error}")

def deduplicate_docs(docs):
    """
    Deduplicate documents by _key.
    
    Args:
        docs: List of documents potentially containing duplicates
        
    Returns:
        list: Deduplicated list of documents
    """
    return list({doc['_key']: doc for doc in docs if '_key' in doc}.values())

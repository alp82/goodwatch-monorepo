# requirements:
# python-arango
# wmill

from datetime import datetime, timezone
import time
import re

from arango import ArangoClient, DocumentInsertError
from requests import Timeout
import wmill


REQUEST_TIMEOUT = 900
RETRY_COUNT = 20
RETRY_DELAY_SEC = 10
UPSERT_ERRORS_TO_RETRY = [3, 4, 1200, 1227]


class ArangoConnector:
    def __init__(self):
        print(f"Initializing ArangoDB...")
        db_hosts = wmill.get_variable("u/Alp/ARANGO_HOSTS").split(",")
        db_name = wmill.get_variable("u/Alp/ARANGO_DB")
        db_user = wmill.get_variable("u/Alp/ARANGO_USER")
        db_pass = wmill.get_variable("u/Alp/ARANGO_PASS")
    
        self.client = ArangoClient(
            hosts=db_hosts,
            request_timeout=REQUEST_TIMEOUT,
        )
        
        sys_db = self.client.db("_system", username=db_user, password=db_pass)
        if not sys_db.has_database(db_name):
            print(f"Creating database '{db_name}'...")
            sys_db.create_database(db_name, users=[
                {'username': db_user, 'password': db_pass, 'active': True}
            ])
        
        self.db = self.client.db(db_name, username=db_user, password=db_pass)
        print(f"Successfully initialized ArangoDB")

    def ensure_collection(self, name, **kwargs):
        """
        Ensure a collection exists
        
        Args:
            name: Collection name
            **kwargs: Additional collection creation parameters
            
        Returns:
            ArangoDB collection object
        """
        if self.db.has_collection(name):
            collection = self.db.collection(name)
        else:
            print(f"Creating {'edge' if kwargs.get('edge') else 'collection'} '{name}'...")
            collection = self.db.create_collection(name, **kwargs)
        return collection
    
    def ensure_graph(self, graph_name, edges):
        """
        Ensure a graph with edge definitions exists.
        
        Args:
            graph_name: Name of the graph
            edge_defs: List of edge definitions
            
        Returns:
            ArangoDB graph object
            
        Raises:
            Exception: If graph initialization fails
        """
        if self.db.has_graph(graph_name):
            graph = self.db.graph(graph_name)
            print(f"Using existing graph '{graph_name}'")
            
            # Update edge definitions if needed
            current_defs = {ed['edge_collection']: ed for ed in graph.edge_definitions()}
            for edge in edges:
                name = edge['name']
                from_vertex_collections = edge['from']
                to_vertex_collections = edge['to']
                edge_definition = {
                    "edge_collection": name,
                    "from_vertex_collections": from_vertex_collections,
                    "to_vertex_collections": to_vertex_collections,
                }
                
                if name in current_defs:
                    cur_froms = set(current_defs[name]['from_vertex_collections'])
                    cur_tos = set(current_defs[name]['to_vertex_collections'])
                    
                    if cur_froms != from_vertex_collections or cur_tos != to_vertex_collections:
                        print(f"Updating edge definition for '{name}'")
                        graph.delete_edge_definition(name)
                        graph.create_edge_definition(**edge_definition)
                else:
                    print(f"Adding new edge definition for '{name}'")
                    graph.create_edge_definition(**edge_definition)

        else:
            print(f"Creating new graph '{graph_name}'")
            graph = self.db.create_graph(graph_name)
            for edge in edges:
                name = edge['name']
                from_vertex_collections = edge['from']
                to_vertex_collections = edge['to']
                edge_definition = {
                    "edge_collection": name,
                    "from_vertex_collections": from_vertex_collections,
                    "to_vertex_collections": to_vertex_collections,
                }
                graph.create_edge_definition(**edge_definition)
                
        self.graph = graph
        return graph

    def ensure_index(self, collection_name: str, index_def: dict):
        """
        Ensures a specific index exists on a collection.
        Creates it if it does not exist.

        Args:
            collection_name (str): The name of the collection.
            index_def (dict): The definition of the index to ensure.
                              Must include 'type', 'fields', and optionally 'unique' and 'name'.
        """
        collection = self.db.collection(collection_name)
        
        # Generate a string representation of fields for logging
        field_str = ", ".join(index_def['fields'])
        index_type = index_def['type']
        is_unique = index_def.get('unique', False) # Default to False if not specified
        index_name = index_def.get('name') # Optional: use ArangoDB's auto-name if not provided

        # Get existing indexes
        try:
            existing_indexes = collection.indexes()
        except Exception as e:
            print(f"Error: Could not retrieve indexes for collection {collection_name}: {e}")
            return

        # Check if this specific index already exists
        # We compare based on fields, type, and uniqueness.
        # ArangoDB also considers 'name' for uniqueness if provided during creation.
        # If a name is in index_def, we can also check by name.
        
        found_existing = False
        for existing_idx in existing_indexes:
            # Primary index has type 'primary' and no explicit fields list in the same way
            if existing_idx['type'] == 'primary': 
                continue

            # Compare essential properties
            fields_match = sorted(existing_idx.get('fields', [])) == sorted(index_def['fields'])
            type_match = existing_idx.get('type') == index_def['type']
            unique_match = existing_idx.get('unique', False) == is_unique
            
            # If a name is provided in our definition, we can be more specific
            name_match = True
            if index_name and 'name' in existing_idx:
                name_match = existing_idx['name'] == index_name
            elif index_name and 'name' not in existing_idx:
                name_match = False

            if fields_match and type_match and unique_match and name_match:
                found_existing = True
                break
        
        if not found_existing:
            try:
                create_params = {
                    'type': index_type,
                    'fields': index_def['fields'],
                    'unique': is_unique
                }
                if index_name:
                    create_params['name'] = index_name
                """
                TODO attempt to get vector indexes working

                endpoint = "/_api/index"
                params = {"collection": collection_name}
                data = create_params
                response = self.db.post(endpoint, params=params, data=data)
                
                if response.status_code >= 400:
                    raise IndexCreateError(response)
                """    
                collection.add_index(create_params)
                print(f"Created {index_type} index on {collection_name}({field_str}) "
                      f"[unique: {is_unique}{', name: ' + index_name if index_name else ''}]")
            except Exception as e:
                print(f"Warning: Could not create index on {collection_name}({field_str}) "
                      f"[type: {index_type}, unique: {is_unique}"
                      f"{', name: ' + index_name if index_name else ''}]: {e}")

    def ensure_view(self, name, params):
        try:
            self.db.view(name)
            self.db.replace_arangosearch_view(
                name=name,
                properties=params,
            )
            print(f"Replaced view {name}")
        except Exception:
            self.db.create_arangosearch_view(
                name=name,
                properties=params,
            )
            print(f"Created view {name}")

    def delete_all_collections_and_graphs(self):
        """
        Deletes all collections and graphs from the database.
        """
        # Delete all graphs
        for graph in self.db.graphs():
            graph_name = graph['name']
            print(f"Deleting graph '{graph_name}'...")
            self.db.delete_graph(graph_name, drop_collections=True)

        # Delete all collections
        for collection in self.db.collections():
            collection_name = collection['name']
            if not collection_name.startswith('_'):  # Skip system collections
                print(f"Deleting collection '{collection_name}'...")
                self.db.delete_collection(collection_name)
    
    def close(self):
        try:
            if hasattr(self, 'client') and self.client:
                self.client.close()
                print("ArangoDB connection closed successfully")
        except Exception as e:
            print(f"Error closing ArangoDB connection: {e}")
        finally:
            self.client = None
            self.db = None

    def upsert_many(self, collection, documents, retry_attempt = 0):
        current_ts = datetime.now(timezone.utc).timestamp()

        docs_to_upsert: list[dict] = []
        original_keys_for_batch = []

        unique_documents = {}

        for i, document_model in enumerate(documents):
            doc_dict = document_model.model_dump(by_alias=True, exclude_none=True)
            original_key_before_sanitize = doc_dict.get("_key", f"NO_KEY_at_index_{i}")
            
            sanitized_key = self._sanitize_key(str(doc_dict.get("_key")), edge=False) if "_key" in doc_dict and doc_dict["_key"] is not None else None
            
            if sanitized_key in unique_documents:
                # Log the skipped duplicate and continue to the next document
                continue
            unique_documents[sanitized_key] = (document_model, original_key_before_sanitize)

        for doc_key, (document_model, original_key) in unique_documents.items():
            original_keys_for_batch.append(str(original_key))

            doc_dict = document_model.model_dump(by_alias=True, exclude_none=True)
            doc_dict.pop('created_at', None)
            doc_dict['updated_at'] = current_ts

            if "_key" in doc_dict and doc_dict["_key"] is not None:
                doc_dict["_key"] = self._sanitize_key(str(doc_dict["_key"]), edge=False)
            if "_from" in doc_dict and doc_dict["_from"] is not None:
                doc_dict["_from"] = self._sanitize_key(str(doc_dict["_from"]), edge=True)
            if "_to" in doc_dict and doc_dict["_to"] is not None:
                doc_dict["_to"] = self._sanitize_key(str(doc_dict["_to"]), edge=True)
            
            docs_to_upsert.append(doc_dict)

        try:
            result_stats = collection.import_bulk(
                docs_to_upsert,
                on_duplicate='update',
                details=True,
                sync=True,
            )
            return result_stats
        except Timeout as e:
            final_error_message = f"Timeout: {e}"
            if e.error_code in UPSERT_ERRORS_TO_RETRY and retry_attempt < RETRY_COUNT:
                print(final_error_message)
                print(f"Retrying ({retry_attempt + 1}/{RETRY_COUNT})...")
                time.sleep(RETRY_DELAY_SEC) 
                return self.upsert_many(collection, documents, retry_attempt + 1)
            else:
                raise Timeout(final_error_message) from e
        except DocumentInsertError as e:
            error_messages = [
                f"Error during bulk operation for collection '{collection.name}'.",
                f"ArangoDB Error Code: {e.error_code}, HTTP Code: {e.http_code}, Server Message: '{e.error_message}'"
            ]

            if e.error_code == 1210: # Unique constraint violated
                error_messages.insert(1, "*** TYPE: Unique constraint violated ***")
                error_messages.append("\n--- Attempting to identify conflicting documents for unique constraint: ---")
                try:
                    indexes = collection.indexes()
                    found_potential_conflict = False
                    for idx_info in indexes:
                        if idx_info.get('unique') and idx_info.get('type') != 'primary':
                            fields = idx_info.get('fields')
                            if not fields: continue

                            idx_name_str = idx_info.get('name', str(fields))
                            # This example focuses on single-field unique indexes for simplicity
                            if len(fields) == 1:
                                unique_field_name = fields[0]
                                error_messages.append(f"Checking unique index '{idx_name_str}' on field: '{unique_field_name}'")

                                # Collect values from the current batch for this unique field
                                batch_values_map = {} # value -> list of batch_doc _keys with this value
                                for i, doc in enumerate(docs_to_upsert):
                                    val = doc.get(unique_field_name)
                                    if val is not None:
                                        if val not in batch_values_map:
                                            batch_values_map[val] = []
                                        batch_values_map[val].append(doc.get("_key", f"batch_index_{i}"))
                                
                                # Check for duplicates within the batch itself
                                for val, keys_in_batch in batch_values_map.items():
                                    if len(keys_in_batch) > 1:
                                        found_potential_conflict = True
                                        error_messages.append(
                                            f"  ERROR (within batch): Value '{val}' for unique field '{unique_field_name}' "
                                            f"is duplicated in batch documents (keys/identifiers: {keys_in_batch})."
                                        )

                                # Query DB for existing values from the batch
                                if batch_values_map:
                                    query = f"""
                                        FOR db_doc IN @@collection_name
                                            FILTER db_doc.`{unique_field_name}` IN @batch_values
                                            RETURN {{ 
                                                key_in_db: db_doc._key, 
                                                value_in_db: db_doc.`{unique_field_name}`,
                                                field_checked: @unique_field_name_str
                                            }}
                                    """
                                    try:
                                        cursor = self.db.aql.execute(
                                            query,
                                            bind_vars={
                                                "@collection_name": collection.name,
                                                "batch_values": list(batch_values_map.keys()),
                                                "unique_field_name_str": unique_field_name
                                            }
                                        )
                                        for existing_doc_info in cursor:
                                            db_val = existing_doc_info['value_in_db']
                                            db_key = existing_doc_info['key_in_db']
                                            
                                            # Check if this conflicts with a document in our batch
                                            # that is NOT the same document (i.e., different _key)
                                            for batch_doc_key_with_this_val in batch_values_map.get(db_val, []):
                                                if str(batch_doc_key_with_this_val) != str(db_key): # Critical: Conflict with a *different* doc
                                                   error_messages.append(
                                                        f"  CONFLICT: Batch doc (key/identifier: '{batch_doc_key_with_this_val}') "
                                                        f"has value '{db_val}' for unique field '{unique_field_name}'. "
                                                        f"This value already exists in DB for document _key '{db_key}'."
                                                    )
                                    except Exception as check_ex:
                                        error_messages.append(f"  Error during DB check for unique field '{unique_field_name}': {check_ex}")
                except Exception as idx_check_ex:
                    error_messages.append(f"  Error during unique constraint conflict check: {idx_check_ex}")

            elif e.error_code == 1221:
                error_messages.insert(1, "*** TYPE: Illegal document key ***")
                error_messages.append("\n--- Inspecting keys in the batch that was sent to ArangoDB: ---")
                
                if not docs_to_upsert:
                    error_messages.append("  The batch of documents prepared for upsert was empty.")
                else:
                    is_possibly_edge_collection = collection.type() == "edge" if hasattr(collection, 'type') else False

                    for i, processed_doc_dict in enumerate(docs_to_upsert):
                        sanitized_key = processed_doc_dict.get("_key")
                        original_key = original_keys_for_batch[i] if i < len(original_keys_for_batch) else "UNKNOWN_ORIGINAL"
                        
                        msg_prefix = f"  Batch doc (original _key approx: '{original_key}', sanitized to: '{sanitized_key}')"

                        if sanitized_key is None:
                            error_messages.append(f"{msg_prefix} - resulted in a None/missing _key.")
                        elif not sanitized_key: # Empty string
                            error_messages.append(f"{msg_prefix} - resulted in an EMPTY _key string.")
                        else:
                            # Check for common invalid characters not handled or mis-handled by sanitizer for DOC keys
                            if not is_possibly_edge_collection and "/" in sanitized_key:
                                error_messages.append(f"{msg_prefix} - contains '/' which is illegal for DOCUMENT keys.")
                            # Add other checks if needed, e.g., length (though hard to check exact byte length here)
                            # You could re-validate against a stricter regex pattern for ArangoDB keys here if desired.
                            # For now, printing the key is the main goal.
                            error_messages.append(f"{msg_prefix} - (this key was sent).")
                error_messages.append("  Hint: Check if the _sanitize_key method (with edge=False for document collections) produced an empty key, a key with '/', or if the key is too long (max 254 bytes). The server's JSON response above might pinpoint the exact key.")

            elif e.error_code == 1233:
                error_messages.insert(1, "*** TYPE: Malformed edge document (_from/_to missing or invalid format) ***")
                error_messages.append("\n--- Inspecting _from and _to attributes in the batch sent to ArangoDB: ---")
                if not docs_to_upsert:
                    error_messages.append("  The batch of documents prepared for upsert was empty.")
                else:
                    found_edge_format_issue = False
                    for i, processed_doc_dict in enumerate(docs_to_upsert):
                        edge_key = processed_doc_dict.get("_key", f"NO_KEY_at_batch_index_{i}")
                        original_edge_key = original_keys_for_batch[i] if i < len(original_keys_for_batch) else "UNKNOWN_ORIGINAL"
                        
                        from_val = processed_doc_dict.get("_from")
                        to_val = processed_doc_dict.get("_to")
                        
                        doc_error_msgs = []

                        # Check _from
                        if from_val is None:
                            doc_error_msgs.append("'_from' attribute is missing or None.")
                        elif not isinstance(from_val, str):
                            doc_error_msgs.append(f"'_from' attribute is not a string (type: {type(from_val)}, value: '{from_val}').")
                        elif from_val.count("/") != 1:
                            doc_error_msgs.append(f"'_from' attribute ('{from_val}') does not have the format '<collectionName>/<vertexKey>' (expected one '/' delimiter).")
                        
                        # Check _to
                        if to_val is None:
                            doc_error_msgs.append("'_to' attribute is missing or None.")
                        elif not isinstance(to_val, str):
                            doc_error_msgs.append(f"'_to' attribute is not a string (type: {type(to_val)}, value: '{to_val}').")
                        elif to_val.count("/") != 1:
                            doc_error_msgs.append(f"'_to' attribute ('{to_val}') does not have the format '<collectionName>/<vertexKey>' (expected one '/' delimiter).")

                        if doc_error_msgs:
                            found_edge_format_issue = True
                            error_messages.append(f"  Problematic edge document (original _key approx: '{original_edge_key}', sanitized _key: '{edge_key}'):")
                            for msg in doc_error_msgs:
                                error_messages.append(f"    - {msg}")
                    
                    if not found_edge_format_issue:
                        error_messages.append("  No obvious _from/_to formatting issues detected in the batch by this check. The problem might be subtle (e.g., invalid collection name or vertex key within the format) or the server response (JSON above) may have more specific details.")
                error_messages.append("  Hint: Ensure _from and _to are strings like 'vertex_collection_name/vertex_document_key'. Check sanitization of these values.")
                
            else: # Other ArangoDB errors
                error_messages.insert(1, f"*** TYPE: Other ArangoDB error (code {e.error_code}) ***")
                # e fields: 'add_note', 'args', 'error_code', 'error_message', 'http_code', 'http_headers', 'http_method', 'message', 'request', 'response', 'source', 'url', 'with_traceback'

            final_error_message = "\n".join(error_messages)
            
            if e.error_code in UPSERT_ERRORS_TO_RETRY and retry_attempt < RETRY_COUNT:
                print(final_error_message)
                print(f"Retrying ({retry_attempt + 1}/{RETRY_COUNT})...")
                time.sleep(RETRY_DELAY_SEC) 
                return self.upsert_many(collection, documents, retry_attempt + 1)
            else:
                raise ValueError(final_error_message) from e

    def _sanitize_key(self, input_string: str, edge=False):
        allowed = r"a-zA-Z0-9_.\-@()+,=;$!*'%:" + (r"/" if edge else r"")
        pattern = rf"[^{allowed}]"
        return re.sub(pattern, "_", input_string)[:250]


def main():
    pass
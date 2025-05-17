"""
Streaming Links post-processor for post-import operations.
Handles updating streaming availability nodes with additional data from streaming_provider_links.
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from constants import BATCH_SIZE, BATCH_LIMIT

class StreamingLinksPostProcessor:
    """
    Processes streaming links post-import operations.
    Updates streaming availability documents with additional information.
    """
    def __init__(self, arango_connector, pg_config):
        """
        Initialize the streaming links post-processor.
        
        Args:
            arango_connector: ArangoConnector instance
            pg_config: PostgreSQL connection config
        """
        self.arango = arango_connector
        self.pg_config = pg_config
        
    def update_streaming_links(self, batch_size=BATCH_SIZE):
        """
        Update streaming availability nodes with additional data from streaming_provider_links.
        
        Args:
            batch_size: Size of batches for update operations
            
        Returns:
            int: Number of updated streaming availability nodes
        """
        print("\nUpdating streaming availability links...")
        
        # Process streaming availability docs in batches
        total_updated = self._process_by_batch(batch_size)
        print(f"Updated {total_updated} streaming availability nodes with additional data.")
        
        return total_updated
        
    def _process_by_batch(self, batch_size):
        """
        Process streaming availability docs in batches, fetching only matching links.
        
        Args:
            batch_size: Size of batches for operations
            
        Returns:
            int: Number of updated streaming availability documents
        """
        db = self.arango.db
        availability_col = db.collection('streaming_availability')
        
        # Initialize variables for tracking and updates
        batch_num = 0
        total_updated = 0
        cursor_batch_size = 1000  # Size for cursor batches
        
        # Process documents in batches using a cursor to reduce memory usage
        total_docs = db.aql.execute("""
            RETURN COUNT(
                FOR avail IN streaming_availability
                    FILTER avail.link != null && avail.link != ""
                    RETURN 1
            )
        """).next()
        
        print(f"Found {total_docs} streaming availability documents with links in ArangoDB.")
        
        # Set up PostgreSQL connection for reuse
        conn = psycopg2.connect(**self.pg_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Use AQL to fetch documents in batches
            offset = 0
            while offset < total_docs:
                batch_num += 1
                
                # Fetch a batch of documents with links
                query = f"""
                FOR avail IN streaming_availability
                    FILTER avail.link != null && avail.link != ""
                    LIMIT {offset}, {cursor_batch_size}
                    RETURN avail
                """
                cursor = db.aql.execute(query)
                docs = list(cursor)
                
                if not docs:
                    break
                    
                #print(f"Processing batch {batch_num} with {len(docs)} documents (offset: {offset})")
                
                # Extract links from this batch
                batch_links = []
                for doc in docs:
                    link = doc.get('link')
                    if link:
                        batch_links.append(link)
                
                # Fetch only the provider links that match documents in this batch
                provider_links = self._fetch_provider_links_for_batch(batch_links, cur)
                #print(f"Found {len(provider_links)} matching provider links in PostgreSQL for this batch")
                
                # Process this batch
                update_batch = []
                updated_in_batch = 0
                
                for doc in docs:
                    link = doc.get('link')
                    if not link or link not in provider_links:
                        continue
                        
                    # Get the first matching provider link data
                    link_data = provider_links[link][0]
                    
                    # Update document with additional fields from provider links
                    doc['stream_url'] = link_data.get('stream_url')
                    doc['price_dollar'] = link_data.get('price_dollar')
                    doc['quality'] = link_data.get('quality')
                    #doc['display_priority'] = link_data.get('display_priority')
                    
                    # Convert any date fields from link_data to timestamps if present
                    if 'start_date' in link_data and link_data['start_date']:
                        try:
                            start_date = datetime.fromisoformat(link_data['start_date'].replace('Z', '+00:00'))
                            doc['startTimestamp'] = int(start_date.timestamp() * 1000)  # Convert to milliseconds
                        except (ValueError, TypeError, AttributeError):
                            pass
                            
                    if 'end_date' in link_data and link_data['end_date']:
                        try:
                            end_date = datetime.fromisoformat(link_data['end_date'].replace('Z', '+00:00'))
                            doc['endTimestamp'] = int(end_date.timestamp() * 1000)  # Convert to milliseconds
                        except (ValueError, TypeError, AttributeError):
                            pass
                    
                    # Check if provider ID matches
                    if str(link_data.get('provider_id')) == str(doc.get('provider_id')):
                        doc['type'] = link_data.get('stream_type', doc.get('type'))
                    
                    update_batch.append(doc)
                    updated_in_batch += 1
                    
                    # Update in smaller sub-batches for better performance
                    if len(update_batch) >= BATCH_LIMIT:
                        availability_col.update_many(update_batch)
                        update_batch = []
                
                # Update any remaining docs in the batch
                if update_batch:
                    availability_col.update_many(update_batch)
                    
                total_updated += updated_in_batch
                print(f"Updated {updated_in_batch} documents in batch {batch_num} (total updated: {total_updated})")
                
                # Move to next batch
                offset += cursor_batch_size
        finally:
            cur.close()
            conn.close()
            
        return total_updated
     
    def _fetch_provider_links_for_batch(self, links, cur):
        """
        Fetch only the provider links that match the given links.
        
        Args:
            links: List of TMDB URLs to match
            cur: PostgreSQL cursor
            
        Returns:
            dict: Dictionary mapping links to provider links data
        """
        if not links:
            return {}
            
        # Prepare query with parameters for each link
        placeholders = []
        for i in range(len(links)):
            placeholders.append(f"%s")
            
        # Execute query to get only matching links
        sql = f"""
        SELECT * FROM streaming_provider_links 
        WHERE tmdb_url IN ({', '.join(placeholders)})
        """
        
        cur.execute(sql, links)
        
        # Group results by TMDB URL
        results = {}
        for row in cur.fetchall():
            tmdb_url = row['tmdb_url']
            if tmdb_url not in results:
                results[tmdb_url] = []
            results[tmdb_url].append(dict(row))
            
        return results

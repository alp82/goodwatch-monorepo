"""
Watch History post-processor for post-import operations.
Handles updating ArangoDB with user watch history from PostgreSQL.
Provides enhanced tracking capabilities beyond simple watched/not watched.
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from constants import BATCH_SIZE, BATCH_LIMIT, WATCH_STATUS

class WatchHistoryPostProcessor:
    """
    Processes user watch history post-import operations.
    Creates watch history records and relates them to movies and shows.
    Adds enhanced tracking capabilities like progress, status, and episode tracking.
    """
    def __init__(self, arango_connector, pg_config):
        """
        Initialize the watch history post-processor.
        
        Args:
            arango_connector: ArangoConnector instance
            pg_config: PostgreSQL connection config
        """
        self.arango = arango_connector
        self.pg_config = pg_config
        self.user_count = 0
        self.watch_history_count = 0
        
    def update_watch_history(self, batch_size=BATCH_SIZE):
        """
        Update ArangoDB with watch history data from PostgreSQL.
        
        Args:
            batch_size: Size of batches for update operations
            
        Returns:
            dict: Statistics of imported data
        """
        print("\nUpdating user watch history...")
        
        # Ensure collections exist
        self._ensure_collections_exist()
        
        # Process watch history
        print("\nProcessing user watch history...")
        self._process_watch_history(batch_size)
        
        # Print summary
        print(f"\nWatch history import summary:")
        print(f"- Users with watch history: {self.user_count}")
        print(f"- Watch history entries: {self.watch_history_count}")
        
        return {
            "users": self.user_count,
            "watch_history": self.watch_history_count
        }
        
    def _ensure_collections_exist(self):
        """
        Ensure all required collections exist in ArangoDB.
        """
        db = self.arango.db
        
        # Check and create users collection if needed
        if not db.has_collection('users'):
            db.create_collection('users')
            print("Created users collection")
            
        # Check and create watch history collection if needed
        if not db.has_collection('user_watch_history'):
            db.create_collection('user_watch_history')
            print("Created user_watch_history collection")
        
        # Check and create edge collection if needed
        if not db.has_collection('watched_by'):
            db.create_collection('watched_by', edge=True)
            print("Created watched_by edge collection")
        
    def _process_watch_history(self, batch_size):
        """
        Process user watch history from PostgreSQL and update ArangoDB.
        
        Args:
            batch_size: Size of batches for operations
        """
        conn = psycopg2.connect(**self.pg_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get total count
            cur.execute("SELECT COUNT(*) FROM user_watch_history")
            total_count = cur.fetchone()['count']
            print(f"Found {total_count} watch history entries in PostgreSQL")
            
            if total_count == 0:
                return
            
            # Process in batches
            offset = 0
            batch_num = 0
            
            while offset < total_count:
                batch_num += 1
                
                # Fetch a batch of watch history
                cur.execute(f"""
                    SELECT user_id, tmdb_id, media_type, watched_at, updated_at
                    FROM user_watch_history
                    ORDER BY user_id, tmdb_id
                    LIMIT {batch_size} OFFSET {offset}
                """)
                
                batch_data = cur.fetchall()
                if not batch_data:
                    break
                    
                batch_size_actual = len(batch_data)
                print(f"Processing watch history batch {batch_num} with {batch_size_actual} items (offset: {offset})")
                
                # Process this batch
                processed = self._process_watch_history_batch(batch_data)
                self.watch_history_count += processed
                
                print(f"Processed {processed} watch history entries in batch {batch_num} (total: {self.watch_history_count})")
                
                # Move to next batch
                offset += batch_size
                
        finally:
            cur.close()
            conn.close()
            
    def _process_watch_history_batch(self, batch_data):
        """
        Process a batch of watch history entries.
        
        Args:
            batch_data: List of watch history data from PostgreSQL
            
        Returns:
            int: Number of processed entries
        """
        db = self.arango.db
        users_col = db.collection('users')
        watch_history_col = db.collection('user_watch_history')
        watched_by_col = db.collection('watched_by')
        
        # Group by user for more efficient processing
        user_watch_history = {}
        for row in batch_data:
            user_id = row['user_id']
            if user_id not in user_watch_history:
                user_watch_history[user_id] = []
            user_watch_history[user_id].append(row)
        
        processed_count = 0
        
        # Process each user's watch history
        for user_id, history in user_watch_history.items():
            # Ensure user exists
            if not users_col.has(user_id):
                users_col.insert({
                    "_key": user_id,
                    "id": user_id
                })
                self.user_count += 1
            
            # Process each history entry
            history_batch = []
            edge_batch = []
            
            for entry in history:
                tmdb_id = entry['tmdb_id']
                media_type = entry['media_type']
                watched_at = entry['watched_at'].isoformat() if entry['watched_at'] else None
                updated_at = entry['updated_at'].isoformat() if entry['updated_at'] else None
                
                # Create history document
                history_key = f"{user_id}_{media_type}_{tmdb_id}"
                
                # Map from PostgreSQL to enhanced watch status in ArangoDB
                # In PostgreSQL, all entries are implicitly "completed"
                # In ArangoDB, we set explicit status and allow for additional metadata
                history_doc = {
                    "_key": history_key,
                    "user_id": user_id,
                    "tmdb_id": tmdb_id,
                    "media_type": media_type,
                    "status": WATCH_STATUS['COMPLETED'],  # Default to completed for imported data
                    "progress": 100.0,  # Default to 100% for completed items
                    "watched_at": watched_at,
                    "updated_at": updated_at
                }
                
                # Add show-specific fields if it's a show
                if media_type == 'tv':
                    # For imported data, we don't have episode/season info,
                    # but we set up the structure for future use
                    history_doc.update({
                        "current_season": None,
                        "current_episode": None,
                        "seasons_completed": [],  # Will store season numbers that are completed
                        "episodes_watched": [],   # Will store episode IDs that are watched
                    })
                
                history_batch.append(history_doc)
                
                # Find the movie/show document
                collection = 'movies' if media_type == 'movie' else 'shows'
                item_key = str(tmdb_id)
                
                # Only create edge if the movie/show exists
                if db.collection(collection).has(item_key):
                    edge = {
                        "_from": f"{collection}/{item_key}",
                        "_to": f"users/{user_id}",
                        "status": WATCH_STATUS['COMPLETED'],
                        "progress": 100.0,
                        "watched_at": watched_at,
                        "updated_at": updated_at
                    }
                    edge_batch.append(edge)
                
                processed_count += 1
                
                # Insert in batches
                if len(history_batch) >= BATCH_LIMIT:
                    watch_history_col.import_bulk(history_batch, on_duplicate="update")
                    history_batch = []
                
                if len(edge_batch) >= BATCH_LIMIT:
                    watched_by_col.import_bulk(edge_batch, on_duplicate="update")
                    edge_batch = []
            
            # Insert any remaining documents
            if history_batch:
                watch_history_col.import_bulk(history_batch, on_duplicate="update")
            
            if edge_batch:
                watched_by_col.import_bulk(edge_batch, on_duplicate="update")
        
        return processed_count

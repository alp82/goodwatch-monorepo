"""
User Preferences post-processor for post-import operations.
Handles updating ArangoDB with user favorites, scores, and wishlists from PostgreSQL.
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from constants import BATCH_SIZE, BATCH_LIMIT

class UserPreferencesPostProcessor:
    """
    Processes user preferences post-import operations.
    Creates user nodes and relates them to movies and shows.
    """
    def __init__(self, arango_connector, pg_config):
        """
        Initialize the user preferences post-processor.
        
        Args:
            arango_connector: ArangoConnector instance
            pg_config: PostgreSQL connection config
        """
        self.arango = arango_connector
        self.pg_config = pg_config
        self.user_count = 0
        self.favorites_count = 0
        self.wishlist_count = 0
        self.scores_count = 0
        
    def update_user_preferences(self, batch_size=BATCH_SIZE):
        """
        Update ArangoDB with user data from PostgreSQL.
        
        Args:
            batch_size: Size of batches for update operations
            
        Returns:
            dict: Statistics of imported data
        """
        print("\nUpdating user preferences...")
        
        # Ensure users collection exists
        self._ensure_collections_exist()
        
        # Process user favorites
        print("\nProcessing user favorites...")
        self._process_user_favorites(batch_size)
        
        # Process user scores
        print("\nProcessing user scores...")
        self._process_user_scores(batch_size)
        
        # Process user wishlist
        print("\nProcessing user wishlist...")
        self._process_user_wishlist(batch_size)
        
        # Print summary
        print(f"\nUser preferences import summary:")
        print(f"- Users: {self.user_count}")
        print(f"- Favorites: {self.favorites_count}")
        print(f"- Scores: {self.scores_count}")
        print(f"- Wishlist items: {self.wishlist_count}")
        
        return {
            "users": self.user_count,
            "favorites": self.favorites_count,
            "scores": self.scores_count,
            "wishlist": self.wishlist_count
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
            
        # Check and create user-related collections if needed
        for collection in ['user_favorites', 'user_scores', 'user_wishlist']:
            if not db.has_collection(collection):
                db.create_collection(collection)
                print(f"Created {collection} collection")
        
        # Check and create edge collections if needed
        for edge in ['favorited_by', 'scored_by', 'wishlisted_by']:
            if not db.has_collection(edge):
                db.create_collection(edge, edge=True)
                print(f"Created {edge} edge collection")
        
    def _process_user_favorites(self, batch_size):
        """
        Process user favorites from PostgreSQL and update ArangoDB.
        
        Args:
            batch_size: Size of batches for operations
        """
        conn = psycopg2.connect(**self.pg_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get total count
            cur.execute("SELECT COUNT(*) FROM user_favorites")
            total_count = cur.fetchone()['count']
            print(f"Found {total_count} user favorites in PostgreSQL")
            
            if total_count == 0:
                return
            
            # Process in batches
            offset = 0
            batch_num = 0
            
            while offset < total_count:
                batch_num += 1
                
                # Fetch a batch of user favorites
                cur.execute(f"""
                    SELECT user_id, tmdb_id, media_type, updated_at
                    FROM user_favorites
                    ORDER BY user_id, tmdb_id
                    LIMIT {batch_size} OFFSET {offset}
                """)
                
                batch_data = cur.fetchall()
                if not batch_data:
                    break
                    
                batch_size_actual = len(batch_data)
                print(f"Processing user favorites batch {batch_num} with {batch_size_actual} items (offset: {offset})")
                
                # Process this batch
                processed = self._process_favorites_batch(batch_data)
                self.favorites_count += processed
                
                print(f"Processed {processed} favorites in batch {batch_num} (total: {self.favorites_count})")
                
                # Move to next batch
                offset += batch_size
                
        finally:
            cur.close()
            conn.close()
            
    def _process_favorites_batch(self, batch_data):
        """
        Process a batch of user favorites.
        
        Args:
            batch_data: List of user favorites data from PostgreSQL
            
        Returns:
            int: Number of processed favorites
        """
        db = self.arango.db
        users_col = db.collection('users')
        favorites_col = db.collection('user_favorites')
        favorited_by_col = db.collection('favorited_by')
        
        # Group by user for more efficient processing
        user_favorites = {}
        for row in batch_data:
            user_id = row['user_id']
            if user_id not in user_favorites:
                user_favorites[user_id] = []
            user_favorites[user_id].append(row)
        
        processed_count = 0
        
        # Process each user's favorites
        for user_id, favorites in user_favorites.items():
            # Ensure user exists
            if not users_col.has(user_id):
                users_col.insert({
                    "_key": user_id,
                    "id": user_id
                })
                self.user_count += 1
            
            # Process each favorite
            user_batch = []
            edge_batch = []
            
            for fav in favorites:
                tmdb_id = fav['tmdb_id']
                media_type = fav['media_type']
                updated_at = fav['updated_at'].isoformat() if fav['updated_at'] else None
                
                # Create favorite document
                fav_key = f"{user_id}_{media_type}_{tmdb_id}"
                
                favorite_doc = {
                    "_key": fav_key,
                    "user_id": user_id,
                    "tmdb_id": tmdb_id,
                    "media_type": media_type,
                    "updated_at": updated_at
                }
                user_batch.append(favorite_doc)
                
                # Find the movie/show document
                collection = 'movies' if media_type == 'movie' else 'shows'
                item_key = str(tmdb_id)
                
                # Only create edge if the movie/show exists
                if db.collection(collection).has(item_key):
                    edge = {
                        "_from": f"{collection}/{item_key}",
                        "_to": f"users/{user_id}",
                        "created_at": updated_at
                    }
                    edge_batch.append(edge)
                
                processed_count += 1
                
                # Insert in batches
                if len(user_batch) >= BATCH_LIMIT:
                    favorites_col.import_bulk(user_batch, on_duplicate="update")
                    user_batch = []
                
                if len(edge_batch) >= BATCH_LIMIT:
                    favorited_by_col.import_bulk(edge_batch, on_duplicate="update")
                    edge_batch = []
            
            # Insert any remaining documents
            if user_batch:
                favorites_col.import_bulk(user_batch, on_duplicate="update")
            
            if edge_batch:
                favorited_by_col.import_bulk(edge_batch, on_duplicate="update")
        
        return processed_count
        
    def _process_user_scores(self, batch_size):
        """
        Process user scores from PostgreSQL and update ArangoDB.
        
        Args:
            batch_size: Size of batches for operations
        """
        conn = psycopg2.connect(**self.pg_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get total count
            cur.execute("SELECT COUNT(*) FROM user_scores")
            total_count = cur.fetchone()['count']
            print(f"Found {total_count} user scores in PostgreSQL")
            
            if total_count == 0:
                return
            
            # Process in batches
            offset = 0
            batch_num = 0
            
            while offset < total_count:
                batch_num += 1
                
                # Fetch a batch of user scores
                cur.execute(f"""
                    SELECT user_id, tmdb_id, media_type, score, review, created_at, updated_at
                    FROM user_scores
                    ORDER BY user_id, tmdb_id
                    LIMIT {batch_size} OFFSET {offset}
                """)
                
                batch_data = cur.fetchall()
                if not batch_data:
                    break
                    
                batch_size_actual = len(batch_data)
                print(f"Processing user scores batch {batch_num} with {batch_size_actual} items (offset: {offset})")
                
                # Process this batch
                processed = self._process_scores_batch(batch_data)
                self.scores_count += processed
                
                print(f"Processed {processed} scores in batch {batch_num} (total: {self.scores_count})")
                
                # Move to next batch
                offset += batch_size
                
        finally:
            cur.close()
            conn.close()
            
    def _process_scores_batch(self, batch_data):
        """
        Process a batch of user scores.
        
        Args:
            batch_data: List of user scores data from PostgreSQL
            
        Returns:
            int: Number of processed scores
        """
        db = self.arango.db
        users_col = db.collection('users')
        scores_col = db.collection('user_scores')
        scored_by_col = db.collection('scored_by')
        
        # Group by user for more efficient processing
        user_scores = {}
        for row in batch_data:
            user_id = row['user_id']
            if user_id not in user_scores:
                user_scores[user_id] = []
            user_scores[user_id].append(row)
        
        processed_count = 0
        
        # Process each user's scores
        for user_id, scores in user_scores.items():
            # Ensure user exists
            if not users_col.has(user_id):
                users_col.insert({
                    "_key": user_id,
                    "id": user_id
                })
                self.user_count += 1
            
            # Process each score
            user_batch = []
            edge_batch = []
            
            for score_data in scores:
                tmdb_id = score_data['tmdb_id']
                media_type = score_data['media_type']
                score = score_data['score']
                review = score_data['review']
                created_at = score_data['created_at'].isoformat() if score_data['created_at'] else None
                updated_at = score_data['updated_at'].isoformat() if score_data['updated_at'] else None
                
                # Create score document
                score_key = f"{user_id}_{media_type}_{tmdb_id}"
                
                score_doc = {
                    "_key": score_key,
                    "user_id": user_id,
                    "tmdb_id": tmdb_id,
                    "media_type": media_type,
                    "score": score,
                    "review": review,
                    "created_at": created_at,
                    "updated_at": updated_at
                }
                user_batch.append(score_doc)
                
                # Find the movie/show document
                collection = 'movies' if media_type == 'movie' else 'shows'
                item_key = str(tmdb_id)
                
                # Only create edge if the movie/show exists
                if db.collection(collection).has(item_key):
                    edge = {
                        "_from": f"{collection}/{item_key}",
                        "_to": f"users/{user_id}",
                        "score": score,
                        "review": review,
                        "created_at": created_at,
                        "updated_at": updated_at
                    }
                    edge_batch.append(edge)
                
                processed_count += 1
                
                # Insert in batches
                if len(user_batch) >= BATCH_LIMIT:
                    scores_col.import_bulk(user_batch, on_duplicate="update")
                    user_batch = []
                
                if len(edge_batch) >= BATCH_LIMIT:
                    scored_by_col.import_bulk(edge_batch, on_duplicate="update")
                    edge_batch = []
            
            # Insert any remaining documents
            if user_batch:
                scores_col.import_bulk(user_batch, on_duplicate="update")
            
            if edge_batch:
                scored_by_col.import_bulk(edge_batch, on_duplicate="update")
        
        return processed_count
        
    def _process_user_wishlist(self, batch_size):
        """
        Process user wishlist from PostgreSQL and update ArangoDB.
        
        Args:
            batch_size: Size of batches for operations
        """
        conn = psycopg2.connect(**self.pg_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get total count
            cur.execute("SELECT COUNT(*) FROM user_wishlist")
            total_count = cur.fetchone()['count']
            print(f"Found {total_count} user wishlist items in PostgreSQL")
            
            if total_count == 0:
                return
            
            # Process in batches
            offset = 0
            batch_num = 0
            
            while offset < total_count:
                batch_num += 1
                
                # Fetch a batch of user wishlist items
                cur.execute(f"""
                    SELECT user_id, tmdb_id, media_type, updated_at
                    FROM user_wishlist
                    ORDER BY user_id, tmdb_id
                    LIMIT {batch_size} OFFSET {offset}
                """)
                
                batch_data = cur.fetchall()
                if not batch_data:
                    break
                    
                batch_size_actual = len(batch_data)
                print(f"Processing user wishlist batch {batch_num} with {batch_size_actual} items (offset: {offset})")
                
                # Process this batch
                processed = self._process_wishlist_batch(batch_data)
                self.wishlist_count += processed
                
                print(f"Processed {processed} wishlist items in batch {batch_num} (total: {self.wishlist_count})")
                
                # Move to next batch
                offset += batch_size
                
        finally:
            cur.close()
            conn.close()
            
    def _process_wishlist_batch(self, batch_data):
        """
        Process a batch of user wishlist items.
        
        Args:
            batch_data: List of user wishlist data from PostgreSQL
            
        Returns:
            int: Number of processed wishlist items
        """
        db = self.arango.db
        users_col = db.collection('users')
        wishlist_col = db.collection('user_wishlist')
        wishlisted_by_col = db.collection('wishlisted_by')
        
        # Group by user for more efficient processing
        user_wishlist = {}
        for row in batch_data:
            user_id = row['user_id']
            if user_id not in user_wishlist:
                user_wishlist[user_id] = []
            user_wishlist[user_id].append(row)
        
        processed_count = 0
        
        # Process each user's wishlist
        for user_id, wishlist in user_wishlist.items():
            # Ensure user exists
            if not users_col.has(user_id):
                users_col.insert({
                    "_key": user_id,
                    "id": user_id
                })
                self.user_count += 1
            
            # Process each wishlist item
            user_batch = []
            edge_batch = []
            
            for wish in wishlist:
                tmdb_id = wish['tmdb_id']
                media_type = wish['media_type']
                updated_at = wish['updated_at'].isoformat() if wish['updated_at'] else None
                
                # Create wishlist document
                wish_key = f"{user_id}_{media_type}_{tmdb_id}"
                
                wishlist_doc = {
                    "_key": wish_key,
                    "user_id": user_id,
                    "tmdb_id": tmdb_id,
                    "media_type": media_type,
                    "updated_at": updated_at
                }
                user_batch.append(wishlist_doc)
                
                # Find the movie/show document
                collection = 'movies' if media_type == 'movie' else 'shows'
                item_key = str(tmdb_id)
                
                # Only create edge if the movie/show exists
                if db.collection(collection).has(item_key):
                    edge = {
                        "_from": f"{collection}/{item_key}",
                        "_to": f"users/{user_id}",
                        "created_at": updated_at
                    }
                    edge_batch.append(edge)
                
                processed_count += 1
                
                # Insert in batches
                if len(user_batch) >= BATCH_LIMIT:
                    wishlist_col.import_bulk(user_batch, on_duplicate="update")
                    user_batch = []
                
                if len(edge_batch) >= BATCH_LIMIT:
                    wishlisted_by_col.import_bulk(edge_batch, on_duplicate="update")
                    edge_batch = []
            
            # Insert any remaining documents
            if user_batch:
                wishlist_col.import_bulk(user_batch, on_duplicate="update")
            
            if edge_batch:
                wishlisted_by_col.import_bulk(edge_batch, on_duplicate="update")
        
        return processed_count

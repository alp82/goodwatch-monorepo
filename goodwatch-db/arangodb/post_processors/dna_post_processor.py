"""
DNA post-processor for post-import operations.
Handles updating DNA nodes with vector attributes.
"""
import psycopg2
from constants import BATCH_SIZE, BATCH_LIMIT
from utils.key_generators import make_dna_key

class DNAPostProcessor:
    """
    Processes DNA post-import operations.
    """
    def __init__(self, arango_connector, pg_config):
        """
        Initialize the DNA post-processor.
        
        Args:
            arango_connector: ArangoConnector instance
            pg_config: PostgreSQL connection config
        """
        self.arango = arango_connector
        self.pg_config = pg_config
    
    def update_vectors(self, movie_dna_pairs=None, show_dna_pairs=None, batch_size=BATCH_SIZE):
        """
        Update DNA nodes with vector attributes from PostgreSQL.
        
        Args:
            movie_dna_pairs: Set of (category, label) pairs from MovieProcessor
            show_dna_pairs: Set of (category, label) pairs from ShowProcessor
            batch_size: Size of batches for update operations
            
        Returns:
            int: Number of updated DNA nodes
        """
        print("\nUpdating DNA vectors...")
        
        # Combine DNA pairs if provided
        all_pairs = set()
        if movie_dna_pairs:
            all_pairs.update(movie_dna_pairs)
        if show_dna_pairs:
            all_pairs.update(show_dna_pairs)
        
        # If no pairs provided, get all DNA nodes from ArangoDB
        if not all_pairs:
            all_pairs = self._get_dna_pairs_from_arango()
            
        print(f"Found {len(all_pairs)} unique DNA (category, label) pairs.")
        if not all_pairs:
            print("No DNA nodes to update.")
            return 0
            
        # Fetch vectors from PostgreSQL and update ArangoDB in batches
        updated_count = self._process_dna_batches(all_pairs, batch_size)
        print(f"Updated {updated_count} DNA nodes with vectors.")
        
        return updated_count
        
    def _get_dna_pairs_from_arango(self):
        """
        Get all unique (category, label) pairs from ArangoDB.
        
        Returns:
            set: Set of (category, label) tuples
        """
        db = self.arango.db
        cursor = db.aql.execute('FOR d IN dna RETURN {category: d.category, label: d.label}')
        return set((d['category'], d['label']) for d in cursor)
    
    def _process_dna_batches(self, pairs, batch_size):
        """
        Process DNA pairs in batches, fetching vectors and updating nodes.
        
        Args:
            pairs: Set of (category, label) tuples
            batch_size: Size of batches for operations
            
        Returns:
            int: Number of updated DNA nodes
        """
        pairs_list = list(pairs)
        total_pairs = len(pairs_list)
        total_updated = 0
        conn = psycopg2.connect(**self.pg_config)
        
        try:
            # Process in batches
            for i in range(0, total_pairs, batch_size):
                batch_pairs = pairs_list[i:i+batch_size]
                batch_size_actual = len(batch_pairs)
                print(f"Processing DNA batch {i//batch_size + 1} with {batch_size_actual} pairs (total: {total_pairs})")
                
                # Fetch vectors for current batch
                batch_vectors = self._fetch_vectors_from_postgres(batch_pairs, conn)
                print(f"Fetched {len(batch_vectors)} DNA vectors in this batch")
                
                # Update DNA nodes with vectors
                batch_updated = self._update_dna_nodes(batch_vectors, BATCH_LIMIT)
                total_updated += batch_updated
                print(f"Updated {batch_updated} DNA nodes in this batch (total: {total_updated})")
        finally:
            conn.close()
            
        return total_updated
    
    def _fetch_vectors_from_postgres(self, pairs, conn=None):
        """
        Fetch vectors from PostgreSQL for specified (category, label) pairs.
        
        Args:
            pairs: List of (category, label) tuples
            conn: Existing PostgreSQL connection (optional)
            
        Returns:
            list: List of (category, label, vector) tuples
        """
        close_conn = False
        if conn is None:
            conn = psycopg2.connect(**self.pg_config)
            close_conn = True
            
        cur = conn.cursor()
        
        # Prepare query with tuple list
        params = []
        where_clauses = []
        for i, (cat, lbl) in enumerate(pairs):
            params += [cat, lbl]
            where_clauses.append(f"(category = %s AND label = %s)")
            
        # Execute query
        sql = f"SELECT category, label, label_vector_v2 FROM dna WHERE {' OR '.join(where_clauses)}"
        cur.execute(sql, params)
        results = []
        
        # Process results to ensure vectors are proper arrays, not stringified
        for row in cur.fetchall():
            category = row[0]
            label = row[1]
            vector = row[2]
            
            # Add to results
            results.append((category, label, vector))
        
        cur.close()
        if close_conn:
            conn.close()
            
        return results
    
    def _update_dna_nodes(self, vectors, batch_size):
        """
        Update DNA nodes with vector attributes in batches.
        
        Args:
            vectors: List of (category, label, vector) tuples
            batch_size: Size of batches for update operations
            
        Returns:
            int: Number of updated DNA nodes
        """
        db = self.arango.db
        dna_col = db.collection('dna')
        batch = []
        updated_count = 0
        
        for cat, lbl, vec in vectors:
            key = make_dna_key(cat, lbl)
            doc = dna_col.get(key)
            if doc is not None:
                # Convert vector to list of floats using helper function
                parsed_vector = self._parse_vector(vec)
                doc['vector'] = parsed_vector
                batch.append(doc)
                updated_count += 1
                
            if len(batch) >= batch_size:
                dna_col.update_many(batch)
                batch = []
                
        if batch:
            dna_col.update_many(batch)
            
        return updated_count
        
    def _parse_vector(self, vector):
        """
        Parse vector data into a list of floats, handling various formats.
        
        Args:
            vector: Vector data in various possible formats
            
        Returns:
            list: List of float values
        """
        if not isinstance(vector, str):
          return []

        vector = vector.strip('[]')
        return [float(x.strip()) for x in vector.split(',') if x.strip()]

"""
DNA post-processor for post-import operations.
Handles updating DNA nodes with vector attributes.
"""
import psycopg2
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
    
    def update_vectors(self, movie_dna_pairs=None, show_dna_pairs=None, batch_size=1000):
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
            
        # Fetch vectors from PostgreSQL
        vectors = self._fetch_vectors_from_postgres(all_pairs)
        print(f"Fetched {len(vectors)} DNA vectors from PostgreSQL.")
        
        # Update DNA nodes in ArangoDB
        updated_count = self._update_dna_nodes(vectors, batch_size)
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
    
    def _fetch_vectors_from_postgres(self, pairs):
        """
        Fetch vectors from PostgreSQL for specified (category, label) pairs.
        
        Args:
            pairs: Set of (category, label) tuples
            
        Returns:
            list: List of (category, label, vector) tuples
        """
        conn = psycopg2.connect(**self.pg_config)
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
            
            # Convert PostgreSQL array to Python list if needed
            # This is moved to the _parse_vector helper function
            results.append((category, label, vector))
        
        cur.close()
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
                batch.clear()
                
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

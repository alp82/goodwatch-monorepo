"""
PostgreSQL database connector.
"""
import psycopg2
import psycopg2.extras
import time

class PostgresConnector:
    """
    Connector for PostgreSQL database operations.
    """
    
    def __init__(self, config):
        """
        Initialize the PostgreSQL connector.
        
        Args:
            config: Dictionary with PostgreSQL connection parameters
        """
        self.config = config
        self.conn = None
        self.cursor = None
    
    def connect(self):
        """
        Connect to PostgreSQL database.
        
        Returns:
            cursor: Database cursor
        """
        print(f"Connecting to PostgreSQL database at {self.config.get('host')}...")
        self.conn = psycopg2.connect(**self.config)
        self.cursor = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
#         print("Connected to PostgreSQL database.")
        return self.cursor
    
    def execute_query(self, query):
        """
        Execute a query and return results.
        
        Args:
            query: SQL query string
            
        Returns:
            list: Query results as dictionaries
        """
        start_time = time.time()
#         print(f"Executing query on PostgreSQL...")
        self.cursor.execute(query)
        results = self.cursor.fetchall()
        # Convert DictRow objects to regular dictionaries
        dict_results = [dict(row) for row in results]
        elapsed = time.time() - start_time
        print(f"Query returned {len(dict_results)} results in {elapsed:.2f}s")
        return dict_results
    
    def close(self):
        """
        Close database connection.
        """
        if hasattr(self, 'cursor') and self.cursor:
            self.cursor.close()
            print("PostgreSQL cursor closed.")
        if hasattr(self, 'conn') and self.conn:
            self.conn.close()
            print("PostgreSQL connection closed.")

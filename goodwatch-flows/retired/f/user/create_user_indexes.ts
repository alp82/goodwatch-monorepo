import * as wmill from 'windmill-client';
import { Client } from 'pg';

// Define the resource type as specified
type Postgresql = {
  host: string,
  port: number,
  user: string,
  dbname: string,
  sslmode: string,
  password: string,
  root_certificate_pem: string
}

// The main function that will execute a query on a Postgresql database
export async function main(db: Postgresql) {
  // Initialize the PostgreSQL client with SSL configuration disabled for strict certificate validation
  const client = new Client({
    host: db.host,
    port: db.port,
    user: db.user,
    password: db.password,
    database: db.dbname,
    ssl: db.ssl,
  });

  try {
    // Connect to the database
    await client.connect();

    // Execute the query
    const query = `
      CREATE INDEX IF NOT EXISTS idx_user_scores_user_id ON user_scores(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_scores_tmdb_id ON user_scores(tmdb_id);
      CREATE INDEX IF NOT EXISTS idx_user_scores_media_type ON user_scores(media_type);
      CREATE INDEX IF NOT EXISTS idx_user_scores_user_id_tmdb_id_media_type ON user_scores(user_id, tmdb_id, media_type);

      CREATE INDEX IF NOT EXISTS idx_user_wishlist_user_id ON user_wishlist(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_wishlist_tmdb_id ON user_wishlist(tmdb_id);
      CREATE INDEX IF NOT EXISTS idx_user_wishlist_media_type ON user_wishlist(media_type);
      CREATE INDEX IF NOT EXISTS idx_user_wishlist_user_id_tmdb_id_media_type ON user_wishlist(user_id, tmdb_id, media_type);

      CREATE INDEX IF NOT EXISTS idx_user_watch_history_user_id ON user_watch_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_watch_history_tmdb_id ON user_watch_history(tmdb_id);
      CREATE INDEX IF NOT EXISTS idx_user_watch_history_media_type ON user_watch_history(media_type);
      CREATE INDEX IF NOT EXISTS idx_user_watch_history_user_id_tmdb_id_media_type ON user_watch_history(user_id, tmdb_id, media_type);

      CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_tmdb_id ON user_favorites(tmdb_id);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_media_type ON user_favorites(media_type);
      CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id_tmdb_id_media_type ON user_favorites(user_id, tmdb_id, media_type);

      CREATE INDEX IF NOT EXISTS idx_user_skipped_user_id ON user_skipped(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_skipped_tmdb_id ON user_skipped(tmdb_id);
      CREATE INDEX IF NOT EXISTS idx_user_skipped_media_type ON user_skipped(media_type);
      CREATE INDEX IF NOT EXISTS idx_user_skipped_user_id_tmdb_id_media_type ON user_skipped(user_id, tmdb_id, media_type);
    `
    const res = await client.query(query);

    // Close the connection
    await client.end();

    // Return the query result
    return res.rows;
  } catch (error) {
    console.error('Database query failed:', error);
    // Rethrow the error to handle it outside or log it appropriately
    throw error;
  }
}
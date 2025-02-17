import {
  pgClient,
  type Sql,
} from "https://deno.land/x/windmill@v1.88.1/mod.ts";

type Postgresql = {
  host: string;
  port: number;
  user: string;
  dbname: string;
  sslmode: string;
  password: string;
};

export async function main(db: Postgresql) {
  const queries = [
    'CREATE EXTENSION IF NOT EXISTS pg_trgm;',
    `CREATE INDEX IF NOT EXISTS idx_movies_popularity ON "movies"(popularity DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_movies_popularity_tmdb_id ON "movies"(popularity DESC, tmdb_id DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_movies_release_date_year ON "movies"(release_date DESC, release_year);`,
    `CREATE INDEX IF NOT EXISTS idx_movies_title_trgm ON "movies" USING gin (title gin_trgm_ops);`,
    `CREATE INDEX IF NOT EXISTS idx_movies_original_title_trgm ON "movies" USING gin (original_title gin_trgm_ops);`,
    `CREATE INDEX IF NOT EXISTS idx_movies_alternative_titles_text_trgm ON "movies" USING gin(alternative_titles_text gin_trgm_ops);`,
    `CREATE INDEX IF NOT EXISTS idx_movies_title_full_text ON movies USING GIN (to_tsvector('simple', title));`,
    `CREATE INDEX IF NOT EXISTS idx_movies_original_title_full_text ON movies USING GIN (to_tsvector('simple', original_title));`,
    `CREATE INDEX IF NOT EXISTS idx_movies_alternative_titles_full_text ON movies USING GIN (to_tsvector('simple', alternative_titles_text));`,
    `CREATE INDEX IF NOT EXISTS idx_movies_genres ON "movies" USING gin("genres");`,
    `CREATE INDEX IF NOT EXISTS idx_movies_keywords ON "movies" USING gin("keywords");`,
    `CREATE INDEX IF NOT EXISTS idx_movies_trope_names ON "movies" USING gin("trope_names");`,
    `CREATE INDEX IF NOT EXISTS idx_movies_crew ON "movies" USING gin("crew");`,
    `CREATE INDEX IF NOT EXISTS idx_movies_cast ON "movies" USING gin("cast");`,
    `CREATE INDEX IF NOT EXISTS idx_movies_dna ON "movies" USING gin("dna");`,
    `CREATE INDEX IF NOT EXISTS idx_movies_streaming_providers ON "movies" USING gin("streaming_providers");`,
    `CREATE INDEX IF NOT EXISTS idx_movies_aggregated_scores_and_votes ON "movies"(aggregated_overall_score_normalized_percent DESC, aggregated_overall_score_voting_count);`,
  ];

  const results = [];
  for (const query of queries) {
    console.log(`executing: ${query}`);
    const result = await pgClient(db).queryObject(query);
    results.push(result);
  }
  return results;
}

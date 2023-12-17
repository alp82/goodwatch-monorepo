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
    `CREATE INDEX IF NOT EXISTS idx_tv_popularity ON "tv"(popularity DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_tv_popularity_tmdb_id ON "tv"(popularity DESC, tmdb_id DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_tv_release_date_year ON "tv"(release_date DESC, release_year);`,
    `CREATE INDEX IF NOT EXISTS idx_tv_genres ON "tv" USING gin("genres");`,
    `CREATE INDEX IF NOT EXISTS idx_tv_keywords ON "tv" USING gin("keywords");`,
    `CREATE INDEX IF NOT EXISTS idx_tv_trope_names ON "tv" USING gin("trope_names");`,
    `CREATE INDEX IF NOT EXISTS idx_tv_crew ON "tv" USING gin("crew");`,
    `CREATE INDEX IF NOT EXISTS idx_tv_cast ON "tv" USING gin("cast");`,
    `CREATE INDEX IF NOT EXISTS idx_tv_streaming_providers ON "tv" USING gin("streaming_providers");`,
    `CREATE INDEX IF NOT EXISTS idx_tv_aggregated_scores_and_votes ON "tv"(aggregated_overall_score_normalized_percent DESC, aggregated_overall_score_voting_count);`,
  ];

  const results = [];
  for (const query of queries) {
    console.log(`executing: ${query}`);
    const result = await pgClient(db).queryObject(query);
    results.push(result);
  }
  return results;
}

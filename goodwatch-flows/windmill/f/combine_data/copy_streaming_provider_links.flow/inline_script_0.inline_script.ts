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
    `CREATE INDEX IF NOT EXISTS idx_streaming_provider_links_tmdb_id ON streaming_provider_links (tmdb_id);`,
    `CREATE INDEX IF NOT EXISTS idx_streaming_provider_links_on_tmdb_id_media_type_country_code ON streaming_provider_links (tmdb_id, media_type, country_code);`,
    `CREATE INDEX IF NOT EXISTS idx_streaming_provider_links_discover_filter ON streaming_provider_links (media_type, country_code, stream_type, provider_id);`,
  ];

  const results = [];
  for (const query of queries) {
    console.log(`executing: ${query}`);
    const result = await pgClient(db).queryObject(query);
    results.push(result);
  }
  return results;
}

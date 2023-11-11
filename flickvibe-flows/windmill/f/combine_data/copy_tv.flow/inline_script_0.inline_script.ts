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
    `CREATE INDEX IF NOT EXISTS idx_tv_crew ON "tv" USING gin("crew");`,
    `CREATE INDEX IF NOT EXISTS idx_tv_cast ON "tv" USING gin("cast");`,
  ];

  const results = [];
  for (const query of queries) {
    console.log(`executing: ${query}`);
    const result = await pgClient(db).queryObject(query);
    results.push(result);
  }
  return results;
}

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
    `CREATE INDEX IF NOT EXISTS idx_crew_id ON "crew"(id);`,
    `CREATE INDEX IF NOT EXISTS idx_crew_popularity ON "crew"(popularity DESC);`,
  ];

  const results = [];
  for (const query of queries) {
    console.log(`executing: ${query}`);
    const result = await pgClient(db).queryObject(query);
    results.push(result);
  }
  return results;
}

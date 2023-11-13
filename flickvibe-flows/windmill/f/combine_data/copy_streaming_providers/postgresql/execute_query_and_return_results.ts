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
  const query = "CREATE INDEX IF NOT EXISTS idx_streaming_providers_name ON streaming_providers(name);"
  const { rows } = await pgClient(db).queryObject(query);
  return rows;
}

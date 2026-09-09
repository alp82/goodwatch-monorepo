import { Client } from 'pg';

type Postgresql = {
  host: string,
  port: number,
  user: string,
  password: string,
  dbname: string,
  ssl: boolean,
  sslmode: string,
  root_certificate_pem: string
}

export async function doQuery(pg_resource: Postgresql, query: string) {
  try {
    // Initialize the PostgreSQL client with SSL configuration disabled for strict certificate validation
    const client = new Client({
      host: pg_resource.host,
      port: pg_resource.port,
      user: pg_resource.user,
      password: pg_resource.password,
      database: pg_resource.dbname,
      ssl: pg_resource.ssl,
    });

    // Connect to the database
    await client.connect();

    // Execute the query
    const res = await client.query(query);

    // Close the connection
    await client.end();

    // Return the query result
    console.log(res)
    return res.rows;
  } catch (error) {
    console.error('Database query failed:', error);
    // Rethrow the error to handle it outside or log it appropriately
    throw error;
  }
}

export async function main(pg_resource: Postgresql) {
  await doQuery(pg_resource, `CREATE TABLE IF NOT EXISTS streaming_provider (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_path VARCHAR(255),

    -- metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`)

  await doQuery(pg_resource, `CREATE TABLE IF NOT EXISTS streaming_provider_rank (
    streaming_provider_id INTEGER NOT NULL,
    media_type VARCHAR(5) NOT NULL,
    country VARCHAR(2) NOT NULL,
    rank INTEGER NOT NULL,

    -- metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (streaming_provider_id, media_type, country)
  )`)
}

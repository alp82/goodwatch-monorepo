import * as dotenv from 'dotenv'
import { Pool, QueryResult } from 'pg'
import {getCircularReplacer} from "../utils/helpers";
import fs from "fs";

dotenv.config()

export const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASS,
  database: process.env.POSTGRES_DB,
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
})

type ColumnDataType = 'TEXT' | 'NUMERIC' | 'BOOLEAN' | 'TIMESTAMP' | 'TIMESTAMP WITH TIME ZONE' | 'JSONB'

const getColumnDataType = (value: any): ColumnDataType => {
  if (typeof value === 'number') {
    return 'NUMERIC'
  } else if (typeof value === 'boolean') {
    return 'BOOLEAN'
  } else if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/)) {
      return 'TIMESTAMP'
    }
  } else if (value instanceof Date) {
    return 'TIMESTAMP WITH TIME ZONE'
  } else if (Array.isArray(value)) {
    return 'JSONB'
  } else if (typeof value === 'object' && value !== null) {
    return 'JSONB'
  }
  return 'TEXT'
}

export async function executeSqlFromFile(filename: string): Promise<void> {
  const sql = fs.readFileSync(filename, 'utf8');
  try {
    await pool.query(sql);
  } catch (error) {
    console.error(error)
  }
}

export const upsertData = async (
  tableName: string,
  data: Record<string, unknown>,
  conflictColumns: string[],
  returnColumns: string[]
): Promise<QueryResult | undefined> => {
  const columns = Object.keys(data)
  const columnNames = columns.map((c) => `"${c}"`).join(', ')
  const conflictColumnNames = conflictColumns.map((c) => `"${c}"`).join(', ')
  const returnColumnNames = returnColumns.map((c) => `"${c}"`).join(', ')

  const placeholders = columns.map((_, index) => `$${index + 1}`)

  const setColumns = columns
    .filter((c) => !conflictColumns.includes(c))
    .map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
  const conflictClause = setColumns.length > 0 ? `UPDATE SET ${setColumns}` : 'NOTHING'

  const query = `
    INSERT INTO ${tableName} (${columnNames})
    VALUES (${placeholders})
    ON CONFLICT (${conflictColumnNames}) DO ${conflictClause}
    RETURNING ${returnColumnNames}
  `

  try {
    return await pool.query(query, Object.values(data))
  } catch (error) {
    console.error(error)
  }
}

export interface BulkUpsertResult {
  all: Record<string, unknown>[]
  existing: Record<string, unknown>[]
  inserted: Record<string, unknown>[]
}

export const bulkUpsertData = async (
  tableName: string,
  data: Record<string, unknown[]>,
  conflictColumns: string[],
  returnColumns: string[]
): Promise<BulkUpsertResult | undefined> => {
  // query parts
  const columns = Object.keys(data)
  const columnNames = columns.map((c) => `"${c}"`).join(', ')
  const conflictColumnNames = conflictColumns.map((c) => `"${c}"`).join(', ')
  const returnColumnNames = returnColumns.map((c) => `"${c}"`).join(', ')

  const placeholders = columns.map((column, index) => {
    const value = data[column][0]
    const dataType = getDataType(value)
    return `$${index + 1}::${dataType}[]`
  })
  const inConditions = conflictColumns.map((column, index) => {
    const value = data[column][0]
    const dataType = getDataType(value)
    return `"${column}" = ANY($${index + 1}::${dataType}[])`
  })
  const notInConditions = conflictColumns.map((column, index) => {
    const value = data[column][0]
    const dataType = getDataType(value)
    return `"${column}" NOT IN (SELECT ${column} FROM ${tableName} WHERE "${column}" = ANY($${index + 1}::${dataType}[]))`
  })
  const fromWhereClause = `
    FROM unnest(${placeholders}) AS data(${columnNames})
    WHERE ${notInConditions.join(' AND ')}
  `

  const setColumns = columns
    .filter((c) => !conflictColumns.includes(c))
    .map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
  const conflictClause = setColumns.length > 0 ? `UPDATE SET ${setColumns}` : 'NOTHING'

  // build and run queries
  const selectQuery = `
    SELECT ${returnColumnNames}
    FROM ${tableName}
    WHERE ${inConditions.join(' AND ')}
    ORDER BY ${returnColumnNames}
    FOR UPDATE;
  `

  const upsertQuery = `
    INSERT INTO ${tableName} (${columnNames})
    SELECT ${columnNames}
    ${fromWhereClause}
    ON CONFLICT (${conflictColumnNames}) DO ${conflictClause}
    RETURNING ${returnColumnNames}
  `

  const selectParams = conflictColumns.map((column) => data[column])
  const upsertParams = Object.values(data)
  const results = await performTransaction([
    { text: selectQuery, params: selectParams },
    { text: upsertQuery, params: upsertParams },
  ])
  const selectResult = results?.[0]
  const upsertResult = results?.[1]

  // return results
  // TODO update would duplicate id's
  const existing = selectResult?.rows || []
  const inserted = upsertResult?.rows || []
  const all = [
    ...existing,
    ...inserted,
  ]

  return {
    all,
    existing,
    inserted,
  }
}

export interface Query {
  text: string
  params?: unknown[]
}

const getDataType = (value: any): string => {
  if (typeof value === 'number') {
    return 'numeric'
  } else if (typeof value === 'boolean') {
    return 'boolean'
  } else if (typeof value === 'string') {
    if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/)) {
      return 'timestamp'
    }
    return 'text'
  } else if (value instanceof Date) {
    return 'timestamp'
  } else if (Array.isArray(value)) {
    return 'json'
  } else if (typeof value === 'object' && value !== null) {
    return 'json'
  }
  return 'text'
}

export const performTransaction = async (queries: Query[]): Promise<QueryResult[] | undefined> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = await Promise.all(queries.map((query) => client.query(query.text, query.params || [])))
    await client.query('COMMIT');
    return results
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

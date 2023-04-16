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

type DataType = 'TEXT' | 'NUMERIC' | 'BOOLEAN' | 'TIMESTAMP' | 'TIMESTAMP WITH TIME ZONE' | 'JSONB'

function getDataType(value: any): DataType {
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

export const upsertData = async (tableName: string, data: Record<string, unknown>, conflictColumns: string[], returnColumns: string[]): Promise<QueryResult | undefined> => {
  const columns = Object.keys(data)
  const placeholders = columns.map((_, index) => `$${index + 1}`)

  const setColumns = columns
    .filter((c) => !conflictColumns.includes(c))
    .map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
  const conflictClause = conflictColumns.length > 0 ? `ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${setColumns}` : ''

  const query = `
    INSERT INTO ${tableName} (${columns.map((c) => `"${c}"`).join(', ')})
    VALUES (${placeholders})
    ${conflictClause}
    RETURNING ${returnColumns.join(', ')}
  `

  try {
    return await pool.query(query, Object.values(data))
  } catch (error) {
    console.error(error)
  }
}
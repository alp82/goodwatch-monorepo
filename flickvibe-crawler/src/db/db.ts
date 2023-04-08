import * as dotenv from 'dotenv'
import { Pool, QueryResult } from 'pg'
import {getCircularReplacer} from "../utils/helpers";

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

async function createTableIfNotExists(tableName: string, jsonData: any, additionalColumnDefs: string[] = []): Promise<void> {
  const columnDefs = Object.entries(jsonData).map(([columnName, value]) => {
    const dataType = columnName === 'id' ? 'INTEGER PRIMARY KEY' : getDataType(value)
    return `"${columnName}" ${dataType}`
  })

  const query = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnDefs.concat(additionalColumnDefs).join(',\n')}
    )
  `
  await pool.query(query)
}

export const upsertJson = async (tableName: string, json: any, additionalColumnDefs: string[] = [], conflictColumns: string[] = ['id']): Promise<QueryResult | undefined> => {
  const columns = Object.keys(json)

  const setColumns = columns.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ')
  const conflictClause = conflictColumns.length > 0 ? `ON CONFLICT (${conflictColumns.join(', ')}) DO UPDATE SET ${setColumns}` : ''

  const query = `
    INSERT INTO ${tableName} (${columns.map((c) => `"${c}"`).join(', ')})
    SELECT * FROM jsonb_populate_record(null::${tableName}, $1::jsonb)
    ${conflictClause}
  `

  try {
    return await pool.query(query, [JSON.stringify(json, getCircularReplacer)])
  } catch (error) {
    const tableDoesNotExist = (error as Record<string, unknown>).code === '42P01'
    if (tableDoesNotExist) {
      await createTableIfNotExists(tableName, json, additionalColumnDefs)
      return await upsertJson(tableName, json, conflictColumns)
    } else {
      console.error(error)
    }
  }
}
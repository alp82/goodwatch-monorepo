import axios from "axios"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

const MAX_RETRIES = 2

export interface VectorParams {
	queryText: string
}

export interface VectorResult {
	normalizedQuery: string
	queryVectorParam: string
}

export const generateVectorResults = async (params: VectorParams) => {
	return await cached<VectorParams, VectorResult>({
		name: "vector-results",
		target: _generateVectorResults,
		params,
		ttlMinutes: 60 * 2,
		// ttlMinutes: 0,
	})
}

async function _generateVectorResults(
	{ queryText }: VectorParams,
	retryCount = 0,
): Promise<VectorResult> {
	const normalizedQuery = normalizeQuery(queryText)

	// Check if the query exists
	const checkQuery = `
      SELECT query_vector 
      FROM vectors_query 
      WHERE query_text = $1
      FOR UPDATE
    `
	const checkResults = await executeQuery<{ query_vector: string }>(
		checkQuery,
		[normalizedQuery],
	)

	if (checkResults.rows.length > 0) {
		// Embedding exists
		console.log(`[Cache Hit] Vector query for: "${normalizedQuery}"`)
		const queryVectorParam = checkResults.rows[0].query_vector
		return { normalizedQuery, queryVectorParam }
	}

	// Embedding does not exist, create and store it
	console.time(`Embedding Generation for: "${normalizedQuery}"`)
	const embedding = await createEmbedding(normalizedQuery)
	const queryVectorParam = vectorToSqlParam(embedding)
	console.timeEnd(`Embedding Generation for: "${normalizedQuery}"`)

	const insertQuery = `
      INSERT INTO vectors_query (query_text, query_vector) 
      VALUES ($1, $2)
      RETURNING query_vector
    `
	try {
		await executeQuery<{ query_vector: string }>(insertQuery, [
			normalizedQuery,
			queryVectorParam,
		])
	} catch (err: any) {
		if (err.code === "23505") {
			console.warn(
				`Duplicate key error for query: "${normalizedQuery}". Attempting to retrieve existing embedding.`,
			)

			if (retryCount < MAX_RETRIES) {
				await new Promise((res) => setTimeout(res, 50))
				return await _generateVectorResults({ queryText }, retryCount + 1)
			}
			console.error(
				`Max retries reached for query: "${normalizedQuery}". Unable to retrieve or insert embedding.`,
			)
			throw err
		}
		console.error(
			`Error inserting embedding for query: "${normalizedQuery}"`,
			err,
		)
		throw err
	}
	console.log(
		`[Cache Miss] Query: "${normalizedQuery}" - Embedding Generated and Stored`,
	)
	return { normalizedQuery, queryVectorParam }
}

async function createEmbedding(text: string): Promise<string[]> {
	try {
		const response = await axios.post("http://157.90.157.44:7997/embedding", {
			text,
		})
		const data = response.data

		if (data && Array.isArray(data.embedding)) {
			return data.embedding
		}

		throw new Error("Embedding is not a valid value")
	} catch (error) {
		throw new Error(`Request failed: ${error}`)
	}
}

function normalizeQuery(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[.,\/#!$%^&*;{}=\-_`~()]/g, " ") // Replace punctuation with space
		.replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
}

function vectorToSqlParam(vector: number[] | string[]): string {
	return JSON.stringify(vector.map((value) => Number(value)))
}

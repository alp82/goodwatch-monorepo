import type { CatalogRead } from "../profile/tropes-data.ts"

/** Independent serial lane; a failed query must release the next read. */
export function candidateCatalogReader(read: CatalogRead): CatalogRead {
	let tail: Promise<unknown> = Promise.resolve()
	return <T extends {}>(sql: string, params: (string | number | Date)[]) => {
		const result = tail.then(() => read<T>(sql, params))
		tail = result.then(
			() => {},
			() => {},
		)
		return result
	}
}

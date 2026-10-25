import { query } from "~/utils/crate"

const QUERY_CONCURRENCY = 4

/** Runs tasks with at most `n` at a time, in the order they came. */
function queueOf(n: number) {
	let active = 0
	const waiting: (() => void)[] = []
	return <T>(task: () => Promise<T>) =>
		new Promise<T>((resolve, reject) => {
			const run = () => {
				active++
				task()
					.then(resolve, reject)
					.finally(() => {
						active--
						waiting.shift()?.()
					})
			}
			if (active < n) run()
			else waiting.push(run)
		})
}
const queued = queueOf(QUERY_CONCURRENCY)
export const readProfileCatalog = <T extends {}>(
	sql: string,
	params: (string | number | Date)[],
) => queued(() => query<T>(sql, params))

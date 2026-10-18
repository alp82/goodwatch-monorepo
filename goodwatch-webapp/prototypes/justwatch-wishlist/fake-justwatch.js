// A fake JustWatch `titleListV2` endpoint with offset cursors and injectable faults.
import { lateAddition, negativeControls, watchlist } from "./fixture.js"

const cursorOf = (offset) => Buffer.from(`arrayconnection:${offset}`).toString("base64")
const offsetOf = (cursor) => (cursor ? Number(Buffer.from(cursor, "base64").toString().split(":")[1]) + 1 : 0)

/**
 * faults: { repeatCursorAtPage, missingCursorAtPage, graphqlErrorAtPage, httpErrorAtPage,
 *           authAtPage, insertAfterPage, removeAfterPage, swapAfterPage, emptyPageAt, contaminateAtPage, extraTotal }
 * Page numbers count from 1.
 */
export function fakeJustWatch(faults = {}) {
	let list = watchlist.map(([node]) => structuredClone(node))
	const seen = [
		...watchlist.filter(([node]) => node.seenlistEntry).map(([node]) => structuredClone(node)),
		...negativeControls.filter((node) => node.seenlistEntry || node.seenState?.progress === 1).map((node) => structuredClone(node)),
	]
	const served = { WATCHLIST: 0, SEENLIST: 0 }
	let edited = false
	const log = []
	async function request({ variables }) {
		const listType = variables.listType
		const served_ = ++served[listType]
		const start = offsetOf(variables.after)
		// Faults attach to the page position, so a retry of the same page meets the same fault.
		const page = Math.floor(start / variables.first) + 1
		log.push({ listType, page, request: served_, after: variables.after ?? null })
		const source = listType === "WATCHLIST" ? list : listType === "SEENLIST" ? seen : []
		if (listType === "WATCHLIST") {
			if (faults.httpErrorAtPage === page) return { status: 500, body: null }
			if (faults.authAtPage === page) return { status: 401, body: null }
		}
		let nodes = source.slice(start, start + variables.first).map((node) => structuredClone(node))
		const end = start + nodes.length
		let hasNextPage = end < source.length
		let endCursor = nodes.length ? cursorOf(end - 1) : null
		const errors = []
		if (listType === "WATCHLIST") {
			if (faults.repeatCursorAtPage === page) endCursor = variables.after
			if (faults.missingCursorAtPage === page) endCursor = null
			if (faults.emptyPageAt === page) {
				nodes = []
				hasNextPage = true
			}
			if (faults.contaminateAtPage === page) {
				const intruder = structuredClone(negativeControls[0])
				nodes.splice(1, 0, intruder)
			}
			if (faults.graphqlErrorAtPage === page) {
				for (const node of nodes) if (node.content) node.content.externalIds = null
				errors.push({ message: "Internal error resolving externalIds", path: ["titleListV2", "edges", 0, "node", "content", "externalIds"], extensions: { code: "INTERNAL_SERVER_ERROR" } })
			}
		}
		const body = {
			data: {
				titleListV2: {
					totalCount: source.length + (listType === "WATCHLIST" ? (faults.extraTotal ?? 0) : 0),
					pageInfo: { endCursor, hasNextPage },
					edges: nodes.map((node) => ({ node })),
				},
			},
			...(errors.length ? { errors } : {}),
		}
		// List edits happen once, during the first run.
		if (listType === "WATCHLIST" && !edited) {
			if (faults.insertAfterPage === page) list = [structuredClone(lateAddition[0]), ...list]
			if (faults.removeAfterPage === page) list = list.filter((_, index) => index !== 0)
			if (faults.swapAfterPage === page) list = [structuredClone(lateAddition[0]), ...list.slice(1)]
			if ([faults.insertAfterPage, faults.removeAfterPage, faults.swapAfterPage].includes(page)) edited = true
		}
		return { status: 200, body }
	}
	return { request, log }
}

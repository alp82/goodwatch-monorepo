// A fake MDBList /watchlist/items route for tests. Its envelope follows the published schema.
// Cursor and has-more placement are options, because the real placement is unproven.

const bucketOf = { movie: "movies", show: "shows", season: "seasons", episode: "episodes" }

export function fakeMdblist(rows, options = {}) {
	const {
		key = "test-key",
		cursorAt = "top", // "top" | "pagination"
		hasMoreHeader = true,
		hasMoreField = false,
		total = false, // false | "right" | "wrong"
		faults = {}, // request number (1-based) -> fault
		dropCursorOnPage = null,
		repeatCursor = false,
		skipInFilteredRead = null, // a mediatype whose filtered read loses one row
		extraPagination = null, // (pageIndex, rowCount) -> extra pagination fields
		countHeaders = false, // false | true | (filter, total, pageRows) -> { total, matched } overrides
	} = options
	const log = []
	let requestNumber = 0

	const fetchImpl = async (input, init = {}) => {
		requestNumber++
		const url = new URL(input)
		log.push({
			path: url.pathname,
			params: Object.fromEntries([...url.searchParams].filter(([name]) => name !== "apikey")),
			headers: Object.fromEntries(Object.entries(init.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value])),
		})
		const fault = faults[requestNumber]
		if (fault === "network") throw new TypeError("fetch failed")
		if (fault?.status) {
			return new Response(fault.body ?? JSON.stringify({ error: fault.error ?? "Error" }), {
				status: fault.status,
				headers: fault.retryAfter !== undefined ? { "retry-after": String(fault.retryAfter) } : {},
			})
		}
		if (fault?.json) {
			return new Response(JSON.stringify(fault.json), { status: 200, headers: { "x-has-more": "false" } })
		}
		if (fault === "html") return new Response("<html>maintenance</html>", { status: 200 })
		if (fault === "envelope") return new Response(JSON.stringify({ items: [] }), { status: 200 })
		if (url.pathname !== "/watchlist/items") return new Response("{}", { status: 404 })
		if (url.searchParams.get("apikey") !== key) return new Response(JSON.stringify({ error: "Invalid API key!" }), { status: 401 })

		const filter = url.searchParams.get("mediatype")
		let selected = filter ? rows.filter((entry) => entry.bucket === bucketOf[filter]) : rows
		if (filter && filter === skipInFilteredRead) selected = selected.slice(1)
		const limit = Number(url.searchParams.get("limit") ?? 100)
		const cursor = url.searchParams.get("cursor")
		const offset = cursor ? Number(Buffer.from(cursor, "base64url").toString().split(":")[1]) : 0
		const page = selected.slice(offset, offset + limit)
		const more = offset + limit < selected.length
		const pageIndex = Math.floor(offset / limit)

		const body = { movies: [], shows: [] }
		for (const entry of page) (body[entry.bucket] ??= []).push(entry.row)
		const pagination = {}
		let next = more ? Buffer.from(`c:${offset + limit}`).toString("base64url") : null
		if (repeatCursor && more && pageIndex >= 1) next = Buffer.from(`c:${offset}`).toString("base64url")
		if (dropCursorOnPage === pageIndex) next = null
		if (next) cursorAt === "top" ? (body.next_cursor = next) : (pagination.next_cursor = next)
		if (hasMoreField) pagination.has_more = more
		if (total) pagination.total = total === "right" ? selected.length : selected.length + 1
		if (extraPagination) Object.assign(pagination, extraPagination(pageIndex, selected.length))
		body.pagination = pagination

		const headers = { "content-type": "application/json", "x-ratelimit-limit": "1000", "x-ratelimit-remaining": String(1000 - requestNumber), "x-ratelimit-reset": "1792368000" }
		if (hasMoreHeader) headers["x-has-more"] = more ? "true" : "false"
		if (countHeaders) {
			// The real API sends the whole read's total and the current page's row count.
			const counts = { total: selected.length, matched: page.length, ...(typeof countHeaders === "function" ? countHeaders(filter, selected.length, page.length) : {}) }
			headers["x-total-items"] = String(counts.total)
			headers["x-matched-items"] = String(counts.matched)
		}
		return new Response(JSON.stringify(body), { status: 200, headers })
	}
	return { fetchImpl, log }
}

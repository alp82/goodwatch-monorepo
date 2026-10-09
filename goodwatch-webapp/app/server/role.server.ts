// What this process is, from WEBAPP_ROLE. One image starts as a page instance, as a search role, or as both.
//
// - page: no query models, no search index, no people index, no reading connections. The search route answers busy
//   and the command palette answers from TMDB.
// - search: everything, with the search role's encoder default (see search-runtime/limits.server.ts). The proxy sends
//   it only the search route and the command palette.
// - both: the default, and the webapp as it was before roles.
//
// The setting is read on every call, and nothing here imports the app, so every search module can ask.
// The decision is docs/adr/0011-search-runs-as-a-role-of-the-webapp-image.md, the settings are in docs/search-role.md.
export type ProcessRole = "page" | "search" | "both"

type Env = Record<string, string | undefined>

export function processRole(env: Env = process.env): ProcessRole {
	const role = env.WEBAPP_ROLE?.trim().toLowerCase()
	return role === "page" || role === "search" ? role : "both"
}

/** Whether this process loads the search and serves it. False only for a page instance. */
export function runsSearch(env: Env = process.env): boolean {
	return processRole(env) !== "page"
}

/** The startup log line. An unknown value is named as such, without repeating it. */
export function roleStartupLine(env: Env = process.env): string {
	const role = env.WEBAPP_ROLE?.trim().toLowerCase()
	if (role && role !== "page" && role !== "search" && role !== "both")
		return "Process role: both (WEBAPP_ROLE isn't one of page, search, both; running as both)"
	return `Process role: ${processRole(env)}`
}

const key = Symbol.for("goodwatch.role.logged")
const shared = globalThis as typeof globalThis & { [key]?: boolean }

/** Writes the role once per process, including across Vite module reloads. */
export function logProcessRole(): void {
	if (shared[key]) return
	shared[key] = true
	console.info(roleStartupLine())
}

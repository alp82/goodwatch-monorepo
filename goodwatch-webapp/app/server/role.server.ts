type Env = Record<string, string | undefined>;
export type ProcessRole = "page" | "search" | "both";
let logged = false;

export function processRole(env: Env = process.env): ProcessRole {
	const role = env.WEBAPP_ROLE === "page" || env.WEBAPP_ROLE === "search"
		? env.WEBAPP_ROLE : "both";
	if (!logged) {
		logged = true;
		console.info(`Role: ${role}${role === "page" ? `, searches ${env.SEARCH_ROLE_URL?.trim() ? "go to the search role" : "are disabled"}` : ""}`);
	}
	return role;
}

export function runsSearch(env: Env = process.env): boolean {
	return processRole(env) !== "page";
}

export function searchRoleUrl(env: Env = process.env): string | null {
	return processRole(env) === "page"
		? env.SEARCH_ROLE_URL?.trim().replace(/\/+$/, "") || null : null;
}

export function searchRoleKey(env: Env = process.env): string | null {
	return env.SEARCH_ROLE_KEY || null;
}

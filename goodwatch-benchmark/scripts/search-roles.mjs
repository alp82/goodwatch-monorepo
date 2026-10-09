// What the smoke check knows about search roles beyond their requests and their log: how SMOKE_SEARCH_ROLES names
// their containers, and whether a role's commit is behind the page instances' commit in code that a role runs.
// The roles are deployed by hand (goodwatch-search/deploy.sh), so an older commit is normal and only matters when
// one of the paths in smoke/search-role-paths.json differs.
import { execFileSync } from "node:child_process"

/**
 * The entries of SMOKE_SEARCH_ROLES: "host:container", separated by commas. A container that ends in a hyphen is the
 * start of a name (a Coolify application's id), anything else is the whole name, such as goodwatch-search-a.
 */
export function parseSearchRoles(text) {
	return (text || "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => {
			const [host, container, ...rest] = item.split(":")
			return { item, host, container, valid: Boolean(host && container) && rest.length === 0 }
		})
}

/** The `docker ps --filter name=` pattern for --container-prefix: a prefix when it ends in a hyphen, else the whole name. */
export function containerNamePattern(prefix) {
	return `^${prefix.replace(/\./g, "\\.")}${prefix.endsWith("-") ? "" : "$"}`
}

/** Runs git in a checkout. Returns the exit status and the output, and never throws for a failed command. */
export function gitIn(repo) {
	return (...args) => {
		try {
			return { status: 0, stdout: execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() }
		} catch (error) {
			return { status: error.status ?? 1, stdout: "" }
		}
	}
}

/**
 * Compares the commit of a search role with the commit of the page instances over the files that a role runs.
 * Returns { result: "pass" | "warn", detail }. It warns when the role is behind and a file differs, and when the
 * comparison can't be made. `git` is gitIn(repo), `set` is smoke/search-role-paths.json.
 */
export function compareSearchCode({ git, roleCommit, pageCommit, set }) {
	const short = (commit) => commit.slice(0, 8)
	if (!roleCommit || roleCommit === "unknown") return { result: "warn", detail: "the role doesn't name its commit (SOURCE_COMMIT), so it can't be compared with the page instances" }
	const resolve = (commit) => git("rev-parse", "--verify", "--quiet", `${commit}^{commit}`)
	const [role, page] = [resolve(roleCommit), resolve(pageCommit)]
	if (page.status === 0 && role.status === 0 && page.stdout === role.stdout) return { result: "pass", detail: `the role runs the page instances' commit, ${short(page.stdout)}` }
	const missing = [role.status !== 0 && roleCommit, page.status !== 0 && pageCommit].filter(Boolean)
	if (missing.length)
		return {
			result: "warn",
			detail: `the role runs ${short(roleCommit)} and the page instances run ${short(pageCommit)}, and this checkout doesn't have ${missing.map(short).join(" and ")}: run "git fetch" and check again`,
		}
	const isAncestor = (older, newer) => git("merge-base", "--is-ancestor", older, newer).status === 0
	const count = (from, to) => {
		const commits = git("rev-list", "--count", `${from}..${to}`).stdout
		return `${commits} ${commits === "1" ? "commit" : "commits"}`
	}
	if (isAncestor(page.stdout, role.stdout))
		return { result: "pass", detail: `the role runs ${short(role.stdout)}, ${count(page.stdout, role.stdout)} ahead of the page instances (${short(page.stdout)})` }
	const behind = isAncestor(role.stdout, page.stdout)
	const where = behind ? `${count(role.stdout, page.stdout)} behind the page instances (${short(page.stdout)})` : `on another branch than the page instances (${short(page.stdout)})`
	const diff = git("diff", "--name-only", role.stdout, page.stdout, "--", ...set.paths, ...(set.exclude ?? []).map((pattern) => `:(exclude,glob)${pattern}`))
	if (diff.status !== 0) return { result: "warn", detail: `the role runs ${short(role.stdout)}, ${where}, and "git diff" failed, so the files weren't compared` }
	const files = diff.stdout.split("\n").filter(Boolean)
	if (!files.length) return { result: "pass", detail: `the role runs ${short(role.stdout)}, ${where}: no file that a search role runs differs` }
	const names = files.slice(0, 4).map((file) => file.replace(/^goodwatch-webapp\//, ""))
	return {
		result: "warn",
		detail: `the role runs ${short(role.stdout)}, ${where}, and ${files.length} ${files.length === 1 ? "file" : "files"} that a search role runs ${files.length === 1 ? "differs" : "differ"}: ${names.join(", ")}${files.length > names.length ? ", ..." : ""}. Deploy the roles on their host: ./deploy.sh ${page.stdout} in goodwatch-search/`,
	}
}

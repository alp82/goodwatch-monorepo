// Tests search-roles.mjs: the names in SMOKE_SEARCH_ROLES, and the comparison of a search role's commit with the page
// instances' commit. The comparison runs against a throwaway repository in the temp directory, with the real path
// list in smoke/search-role-paths.json. Run: node --test scripts/search-roles.test.mjs
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, test } from "node:test"
import { compareSearchCode, containerNamePattern, gitIn, parseSearchRoles } from "./search-roles.mjs"

const set = JSON.parse(readFileSync(new URL("../smoke/search-role-paths.json", import.meta.url), "utf8"))
const repo = mkdtempSync(join(tmpdir(), "gw-search-roles-"))
after(() => rmSync(repo, { recursive: true, force: true }))
const env = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" }
const run = (...args) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", env }).trim()
/** Writes the files and commits them. Returns the commit. */
function commit(files) {
	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(repo, path)), { recursive: true })
		writeFileSync(join(repo, path), text)
	}
	run("add", "-A")
	run("commit", "-q", "-m", "change")
	return run("rev-parse", "HEAD")
}
run("init", "-q", "-b", "main")
const first = commit({
	"goodwatch-webapp/app/server/search-ranking/ranking.server.ts": "1",
	"goodwatch-webapp/app/server/search-ranking/ranking.test.ts": "1",
	"goodwatch-webapp/app/routes/movie.tsx": "1",
	"goodwatch-webapp/Dockerfile": "1",
})
const pagesOnly = commit({ "goodwatch-webapp/app/routes/movie.tsx": "2", "docs/note.md": "2" })
const testOnly = commit({ "goodwatch-webapp/app/server/search-ranking/ranking.test.ts": "3" })
const ranking = commit({ "goodwatch-webapp/app/server/search-ranking/ranking.server.ts": "4" })
const dockerfile = commit({ "goodwatch-webapp/Dockerfile": "5", "goodwatch-webapp/package-lock.json": "5", "goodwatch-webapp/app/routes/api.command-palette.ts": "5" })
const compare = (roleCommit, pageCommit) => compareSearchCode({ git: gitIn(repo), roleCommit, pageCommit, set })

test("every listed path exists in this repository", () => {
	const root = new URL("../../", import.meta.url)
	for (const path of set.paths) assert(existsSync(new URL(path, root)), `${path} is in smoke/search-role-paths.json and not in the repository`)
})

test("a role on the page instances' commit passes", () => {
	assert.deepEqual(compare(ranking, ranking), { result: "pass", detail: `the role runs the page instances' commit, ${ranking.slice(0, 8)}` })
	// The app's metric names the first 8 characters only.
	assert.equal(compare(ranking.slice(0, 8), ranking).result, "pass")
})

test("a role that is behind in pages, docs, and tests only passes", () => {
	const result = compare(first, testOnly)
	assert.equal(result.result, "pass")
	assert.match(result.detail, /2 commits behind the page instances \([0-9a-f]{8}\): no file that a search role runs differs/)
	assert.equal(compare(first, pagesOnly).result, "pass")
})

test("a role that is behind in a file that it runs gets a warning with the file and the deploy command", () => {
	const result = compare(first, ranking)
	assert.equal(result.result, "warn")
	assert.match(result.detail, /3 commits behind the page instances/)
	assert.match(result.detail, /1 file that a search role runs differs: app\/server\/search-ranking\/ranking\.server\.ts\./)
	assert(result.detail.endsWith(`./deploy.sh ${ranking} in goodwatch-search/`))
})

test("the Dockerfile, the lock file, and the command palette route count", () => {
	const result = compare(ranking, dockerfile)
	assert.equal(result.result, "warn")
	assert.match(result.detail, /1 commit behind .* 3 files that a search role runs differ: Dockerfile, app\/routes\/api\.command-palette\.ts, package-lock\.json\./)
})

test("a role that is ahead of the page instances passes", () => {
	const result = compare(dockerfile, first)
	assert.equal(result.result, "pass")
	assert.match(result.detail, /4 commits ahead of the page instances/)
})

test("a commit that the checkout doesn't have gives a warning, not a failure", () => {
	const unknown = "f".repeat(40)
	const result = compare(first, unknown)
	assert.equal(result.result, "warn")
	assert.match(result.detail, /this checkout doesn't have ffffffff: run "git fetch"/)
	assert.equal(compare("unknown", ranking).result, "warn")
	assert.equal(compare("", ranking).result, "warn")
})

test("a role on another branch is compared by its files", () => {
	run("checkout", "-q", "-b", "side", first)
	const side = commit({ "goodwatch-webapp/app/server/role.server.ts": "side" })
	run("checkout", "-q", "main")
	const result = compare(side, pagesOnly)
	assert.equal(result.result, "warn")
	assert.match(result.detail, /on another branch than the page instances .* app\/server\/role\.server\.ts/)
})

test("SMOKE_SEARCH_ROLES entries are host:container pairs", () => {
	assert.deepEqual(parseSearchRoles(""), [])
	assert.deepEqual(parseSearchRoles(undefined), [])
	assert.deepEqual(
		parseSearchRoles("vector1:goodwatch-search-a, vector1:goodwatch-search-b,").map(({ host, container, valid }) => [host, container, valid]),
		[["vector1", "goodwatch-search-a", true], ["vector1", "goodwatch-search-b", true]],
	)
	assert.deepEqual(parseSearchRoles("vector1,:name,a:b:c").map((entry) => entry.valid), [false, false, false])
})

test("a container value is a prefix when it ends in a hyphen, and the whole name otherwise", () => {
	assert.equal(containerNamePattern("gk4owk8-"), "^gk4owk8-")
	assert.equal(containerNamePattern("goodwatch-search-a"), "^goodwatch-search-a$")
	assert(new RegExp(containerNamePattern("gk4owk8-")).test("gk4owk8-20261009T105807"))
	assert(!new RegExp(containerNamePattern("goodwatch-search-a")).test("goodwatch-search-ab"))
	assert(!new RegExp(containerNamePattern("a.b")).test("axb"))
})

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import test from "node:test"
import {
	baselineIncreases,
	countDiagnostics,
	isManagedFile,
	newDiagnostics,
	parseTypeScript,
	root,
} from "./code-quality.mjs"

function run(cwd, command, args, overrides = {}) {
	const env = { ...process.env, SKIP_GIT_HOOKS: "", ...overrides }
	for (const key of [
		"GIT_DIR",
		"GIT_WORK_TREE",
		"GIT_INDEX_FILE",
		"GIT_COMMON_DIR",
		"QUALITY_BASE",
	])
		delete env[key]
	return spawnSync(command, args, { cwd, encoding: "utf8", env, maxBuffer: 8 * 1024 * 1024 })
}

function ok(result) {
	assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${result.error ?? ""}`)
	return result.stdout
}

function fixture(t) {
	const directory = mkdtempSync(resolve(tmpdir(), "goodwatch-quality-test-"))
	t.after(() => rmSync(directory, { recursive: true, force: true }))
	const write = (file, contents) => {
		const path = resolve(directory, file)
		mkdirSync(dirname(path), { recursive: true })
		writeFileSync(path, contents)
	}
	for (const file of [
		"scripts/code-quality.mjs",
		"scripts/code-quality-hooks.mjs",
		".oxfmtrc.json",
		".oxlintrc.json",
		"goodwatch-webapp/.oxlintrc.json",
		"lint-staged.config.mjs",
		".githooks/pre-commit",
	]) {
		write(file, readFileSync(resolve(root, file)))
	}
	symlinkSync(resolve(root, "node_modules"), resolve(directory, "node_modules"), "dir")
	symlinkSync(
		resolve(root, "goodwatch-webapp/node_modules"),
		resolve(directory, "goodwatch-webapp/node_modules"),
		"dir",
	)
	write(".gitignore", "node_modules/\n")
	write("package.json", '{"private":true,"type":"module"}\n')
	write(
		"goodwatch-webapp/tsconfig.json",
		JSON.stringify({
			compilerOptions: {
				strict: true,
				noEmit: true,
				skipLibCheck: true,
				types: [],
				target: "ES2022",
				module: "ESNext",
				moduleResolution: "Bundler",
			},
			include: ["app/**/*.ts"],
		}),
	)
	write(
		"goodwatch-webapp/app/example.ts",
		"export const first = { value: 1 }\n\nexport const second = 2\n",
	)
	write(
		"scripts/code-quality-baseline.json",
		JSON.stringify({ version: 1, lint: {}, typecheck: {} }),
	)
	const git = (...args) => ok(run(directory, "git", args))
	const cli = (...args) => run(directory, process.execPath, ["scripts/code-quality.mjs", ...args])
	git("init", "-q")
	git("config", "user.name", "Quality test")
	git("config", "user.email", "quality-test@example.invalid")
	git("config", "commit.gpgsign", "false")
	git("add", ".")
	ok(run(directory, "git", ["commit", "-qm", "fixture"], { SKIP_GIT_HOOKS: "1" }))
	// Install the actual chaining hook in the disposable Git repository, never the parent checkout.
	ok(run(directory, process.execPath, ["scripts/code-quality-hooks.mjs"]))
	return { directory, write, git, cli }
}

test("scope includes new webapp source and excludes dependencies, output, lockfiles and Expo", () => {
	for (const file of [
		"goodwatch-webapp/app/new.tsx",
		"goodwatch-webapp/scripts/task.mjs",
		"goodwatch-webapp/packages/auth-stack/api.js",
		"scripts/code-quality.mjs",
	]) {
		assert.equal(isManagedFile(file), true, file)
	}
	for (const file of [
		"goodwatch-webapp/scripts/.venv/vendor.js",
		"goodwatch-webapp/public/bundle.js",
		"goodwatch-webapp/node_modules/vendor.js",
		"goodwatch-webapp/scripts/auth/results/result.json",
		"goodwatch-webapp/package-lock.json",
		"yepwatch-app/src/app/index.tsx",
		"docs/evidence.json",
	]) {
		assert.equal(isManagedFile(file), false, file)
	}
})

test("baseline tolerates line moves but rejects added occurrences, changed messages and new files", () => {
	const original = { file: "a.ts", code: "rule", message: "problem", line: 1 }
	const baseline = countDiagnostics([original])
	assert.deepEqual(newDiagnostics([{ ...original, line: 90 }], baseline), [])
	assert.equal(newDiagnostics([original, original], baseline).length, 1)
	assert.equal(newDiagnostics([{ ...original, message: "different" }], baseline).length, 1)
	assert.equal(newDiagnostics([{ ...original, file: "b.ts" }], baseline).length, 1)
	assert.deepEqual(
		baselineIncreases({ lint: {}, typecheck: {} }, { lint: baseline, typecheck: {} }),
		[],
	)
	assert.equal(
		baselineIncreases({ lint: baseline, typecheck: {} }, { lint: {}, typecheck: {} }).length,
		1,
	)
})

test("TypeScript parser preserves explanatory messages and rejects global/config failures", () => {
	const parsed = parseTypeScript(
		"app/a.ts(2,4): error TS2322: Wrong type.\n  Expected string.\n    Got number.\n",
	)
	assert.equal(parsed[0].message, "Wrong type.\n  Expected string.\n    Got number.")
	assert.equal(parsed[0].file, "goodwatch-webapp/app/a.ts")
	assert.throws(() => parseTypeScript("error TS5023: Unknown compiler option."), /Unexpected/)
})

test("real pre-commit formats staged paths with spaces and preserves unstaged hunks", (t) => {
	const f = fixture(t)
	const path = "goodwatch-webapp/app/space $name.ts"
	f.write(path, "export const first = { value: 1 }\n\nexport const second = 2\n")
	f.git("add", path)
	ok(run(f.directory, "git", ["commit", "-qm", "initial spaced path"]))
	f.write(path, "export const first={value:3};\n\nexport const second = 2\n")
	f.git("add", path)
	f.write(path, "export const first={value:3};\n\nexport const second = 99\n")
	ok(run(f.directory, "git", ["commit", "-qm", "format staged hunk"]))
	const committed = f.git("show", `HEAD:${path}`)
	assert.match(committed, /first = \{ value: 3 \}/)
	assert.match(committed, /second = 2/)
	assert.match(readFileSync(resolve(f.directory, path), "utf8"), /second = 99/)
	assert.equal(f.git("diff", "--cached", "--name-only"), "")
	assert.match(f.git("diff", "--", path), /second = 99/)
})

test("real pre-commit rejects new lint errors and restores the index and working file", (t) => {
	const f = fixture(t)
	const path = "goodwatch-webapp/app/example.ts"
	f.write(path, "export const duplicate={value:1,value:2};\n")
	f.git("add", path)
	const index = f.git("show", `:${path}`)
	const working = readFileSync(resolve(f.directory, path), "utf8")
	const head = f.git("rev-parse", "HEAD")
	const result = run(f.directory, "git", ["commit", "-qm", "must fail"])
	assert.notEqual(result.status, 0)
	assert.match(result.stdout + result.stderr, /no-dupe-keys|Duplicate key/)
	assert.equal(f.git("rev-parse", "HEAD"), head)
	assert.equal(f.git("show", `:${path}`), index)
	assert.equal(readFileSync(resolve(f.directory, path), "utf8"), working)
})

test("format check covers committed branch changes and untracked files without writing", (t) => {
	const f = fixture(t)
	const base = f.git("rev-parse", "HEAD").trim()
	f.write("goodwatch-webapp/app/example.ts", "export const first={value:3};\n")
	f.git("add", "goodwatch-webapp/app/example.ts")
	ok(run(f.directory, "git", ["commit", "-qm", "unformatted history"], { SKIP_GIT_HOOKS: "1" }))
	const before = readFileSync(resolve(f.directory, "goodwatch-webapp/app/example.ts"), "utf8")
	assert.equal(f.cli("format:check").status, 0)
	assert.equal(f.cli("format:check", "--base", base).status, 1)
	assert.equal(
		readFileSync(resolve(f.directory, "goodwatch-webapp/app/example.ts"), "utf8"),
		before,
	)
	ok(f.cli("format", "--base", base))
	ok(f.cli("format:check", "--base", base))
	f.write("goodwatch-webapp/app/untracked.ts", "export const added={a:1};\n")
	assert.equal(f.cli("format:check").status, 1)
	assert.equal(f.cli("format:check", "--base", "nonexistent-reference").status, 1)
})

test("type regression and baseline tampering fail even when lint is clean", (t) => {
	const f = fixture(t)
	ok(f.cli("typecheck"))
	f.write("goodwatch-webapp/app/example.ts", 'export const first: number = "wrong"\n')
	const result = f.cli("typecheck")
	assert.equal(result.status, 1)
	assert.match(result.stderr, /TS2322/)
	const base = f.git("rev-parse", "HEAD").trim()
	f.write(
		"scripts/code-quality-baseline.json",
		JSON.stringify({ version: 1, lint: { "new allowance": 1 }, typecheck: {} }),
	)
	const tampered = f.cli("lint", "--base", base)
	assert.equal(tampered.status, 1)
	assert.match(tampered.stderr, /baseline increased/)
	assert.equal(f.cli("baseline").status, 1)
})

test("broken linter config fails closed rather than appearing as a clean run", (t) => {
	const f = fixture(t)
	f.write("goodwatch-webapp/.oxlintrc.json", '{"rules":{"not-a-rule":"error"}}')
	const result = f.cli("lint")
	assert.equal(result.status, 1)
	assert.match(result.stderr, /Oxlint/)
})

test("the official TanStack plugin rejects a missing query-key dependency", (t) => {
	const f = fixture(t)
	const path = "goodwatch-webapp/app/query.ts"
	const source = `import { useQuery } from "@tanstack/react-query"
export function useEntry(id: string) {
  return useQuery({ queryKey: ["entry"], queryFn: () => Promise.resolve(id) })
}
`
	f.write(path, source)
	const result = f.cli("lint", path)
	assert.equal(result.status, 1)
	assert.match(result.stderr, /@tanstack\/query\(exhaustive-deps\)/)
	f.write(path, source.replace('["entry"]', '["entry", id]'))
	ok(f.cli("lint", path))
})

test("lint:fix defaults to changed files and does not reformat unrelated history", (t) => {
	const f = fixture(t)
	const legacy = "goodwatch-webapp/app/legacy.ts"
	f.write(legacy, "export const legacy={value:1};\n")
	f.git("add", legacy)
	ok(run(f.directory, "git", ["commit", "-qm", "legacy formatting"], { SKIP_GIT_HOOKS: "1" }))
	f.write("goodwatch-webapp/app/new.ts", "export const added={value:2};\n")
	ok(f.cli("lint:fix"))
	assert.equal(
		readFileSync(resolve(f.directory, legacy), "utf8"),
		"export const legacy={value:1};\n",
	)
	assert.match(
		readFileSync(resolve(f.directory, "goodwatch-webapp/app/new.ts"), "utf8"),
		/added = \{ value: 2 \}/,
	)
})

test("installer chains existing hooks, keeps other hooks intact, and is idempotent", (t) => {
	const f = fixture(t)
	const old = "#!/usr/bin/env sh\necho legacy-hook-ran\nexit 9\n"
	// Replacing the fixture dispatcher simulates a contributor's original executable hook.
	f.write(".git/hooks/pre-commit", old)
	f.write(".git/hooks/commit-msg", "original commit-message hook\n")
	const install = () => run(f.directory, process.execPath, ["scripts/code-quality-hooks.mjs"])
	ok(install())
	assert.equal(
		readFileSync(resolve(f.directory, ".git/hooks/pre-commit.goodwatch-previous"), "utf8"),
		old,
	)
	const dispatcher = readFileSync(resolve(f.directory, ".git/hooks/pre-commit"), "utf8")
	ok(install())
	assert.equal(readFileSync(resolve(f.directory, ".git/hooks/pre-commit"), "utf8"), dispatcher)
	assert.equal(
		readFileSync(resolve(f.directory, ".git/hooks/commit-msg"), "utf8"),
		"original commit-message hook\n",
	)
	const result = run(f.directory, "git", ["commit", "--allow-empty", "-qm", "must run old hook"])
	assert.notEqual(result.status, 0)
	assert.match(result.stdout + result.stderr, /legacy-hook-ran/)
	// Older worktrees do not have the versioned quality hook yet; the original still runs.
	rmSync(resolve(f.directory, ".githooks/pre-commit"))
	const older = run(f.directory, "git", ["commit", "--allow-empty", "-qm", "old checkout"])
	assert.notEqual(older.status, 0)
	assert.match(older.stdout + older.stderr, /legacy-hook-ran/)
	assert.equal(run(f.directory, "git", ["config", "--get", "core.hooksPath"]).stdout, "")
})

test("installer preserves a custom hooks path and tells the contributor how to chain it", (t) => {
	const f = fixture(t)
	f.git("config", "core.hooksPath", ".custom-hooks")
	f.write(".custom-hooks/pre-commit", "original custom hook\n")
	const result = run(f.directory, process.execPath, ["scripts/code-quality-hooks.mjs"])
	assert.equal(result.status, 1)
	assert.match(result.stderr, /was preserved/)
	assert.equal(f.git("config", "--get", "core.hooksPath").trim(), ".custom-hooks")
	assert.equal(
		readFileSync(resolve(f.directory, ".custom-hooks/pre-commit"), "utf8"),
		"original custom hook\n",
	)
})

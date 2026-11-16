import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, readFileSync, renameSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const marker = "# goodwatch-code-quality pre-commit dispatcher v1"

function git(args) {
	const result = spawnSync("git", args, { cwd: root, encoding: "utf8" })
	if (result.error || (result.status !== 0 && !(args[0] === "config" && result.status === 1))) {
		throw new Error(result.error?.message || result.stderr)
	}
	return result.stdout.trim()
}

try {
	if (process.env.SKIP_GIT_HOOKS === "1") {
		console.log("Skipping Git hook installation (SKIP_GIT_HOOKS=1).")
	} else {
		// Do not change a shared core.hooksPath or disable hooks in other worktrees.
		const configured = git(["config", "--get", "core.hooksPath"])
		if (configured) {
			throw new Error(
				`Existing core.hooksPath=${configured} was preserved. Install with SKIP_GIT_HOOKS=1 and call sh .githooks/pre-commit from your existing hook.`,
			)
		}
		const hooks = resolve(root, git(["rev-parse", "--git-path", "hooks"]))
		mkdirSync(hooks, { recursive: true })
		const hook = resolve(hooks, "pre-commit")
		const previous = resolve(hooks, "pre-commit.goodwatch-previous")
		if (existsSync(hook) && readFileSync(hook, "utf8").includes(marker)) {
			console.log("Code-quality pre-commit hook is already installed.")
		} else {
			if (existsSync(previous))
				throw new Error(`Preserved hook already exists: ${previous}. Refusing to overwrite it.`)
			if (existsSync(hook)) renameSync(hook, previous)
			writeFileSync(
				hook,
				`#!/usr/bin/env sh
${marker}
# Preserve local hooks such as git-secrets, including in older worktrees.
previous="$(dirname "$0")/pre-commit.goodwatch-previous"
if [ -x "$previous" ]; then
  "$previous" "$@" || exit $?
fi
checkout="$(git rev-parse --show-toplevel)" || exit $?
if [ -f "$checkout/.githooks/pre-commit" ]; then
  (cd "$checkout" && sh .githooks/pre-commit "$@")
fi
`,
			)
			chmodSync(hook, 0o755)
			console.log("Installed code-quality pre-commit hook; previous hooks preserved.")
		}
	}
} catch (error) {
	console.error(error.message)
	process.exitCode = 1
}

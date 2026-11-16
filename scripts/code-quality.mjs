import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const webapp = resolve(root, "goodwatch-webapp")
const baselinePath = resolve(root, "scripts/code-quality-baseline.json")
const sourceExtension = /\.(?:[cm]?[jt]sx?)$/
const formatExtension = /\.(?:[cm]?[jt]sx?|jsonc?|css|html|mdx?)$/
const generated = /(?:^|\/)(?:node_modules|\.venv|build|dist|public|results|artifacts)(?:\/|$)/
const toolingFiles = new Set([
	"package.json",
	"lint-staged.config.mjs",
	".oxfmtrc.json",
	".oxlintrc.json",
	".vscode/settings.json",
	".vscode/extensions.json",
	"scripts/code-quality.mjs",
	"scripts/code-quality-hooks.mjs",
	"scripts/code-quality.test.mjs",
])

function run(command, args, cwd = root) {
	const result = spawnSync(command, args, {
		cwd,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
		env: { ...process.env, NO_COLOR: "1" },
	})
	if (result.error || result.signal) {
		throw new Error(`${command}: ${result.error?.message ?? result.signal}`)
	}
	return result
}

function git(args) {
	const result = run("git", args)
	if (result.status !== 0) throw new Error(result.stderr || result.stdout)
	return result.stdout
}

function binary(name, directory = root) {
	const path = resolve(directory, "node_modules/.bin", name)
	if (!existsSync(path)) {
		throw new Error(
			`Missing ${name}. Run npm ci in ${relative(root, directory) || "the repository root"}.`,
		)
	}
	return path
}

export function isManagedFile(path) {
	return (
		!generated.test(path) &&
		!path.endsWith("package-lock.json") &&
		formatExtension.test(path) &&
		(path.startsWith("goodwatch-webapp/") || toolingFiles.has(path))
	)
}

export function selectFiles({ base, all = false, files = [] } = {}) {
	let paths
	if (files.length) {
		paths = files.map((file) => relative(root, resolve(file)))
	} else if (all) {
		paths = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0")
	} else {
		// A base is a commit, never a shell expression. Include working/index changes too.
		const ref = git(["rev-parse", "--verify", `${base || "HEAD"}^{commit}`]).trim()
		paths = [
			...git(["diff", "--name-only", "-z", "--diff-filter=ACMR", ref, "--"]).split("\0"),
			...git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0"),
		]
	}
	return [...new Set(paths)]
		.filter((file) => isManagedFile(file) && existsSync(resolve(root, file)))
		.sort()
}

function format(files, write) {
	if (!files.length) {
		console.log("Formatting: no changed files in scope.")
		return true
	}
	// Chunk argument lists so a large mechanical cleanup cannot exceed ARG_MAX.
	let passed = true
	for (let i = 0; i < files.length; i += 100) {
		const result = run(binary("oxfmt"), [
			"--config",
			resolve(root, ".oxfmtrc.json"),
			write ? "--write" : "--check",
			...files.slice(i, i + 100).map((file) => resolve(root, file)),
		])
		process.stdout.write(result.stdout)
		process.stderr.write(result.stderr)
		passed = result.status === 0 && passed
	}
	return passed
}

// Baselines are per file, rule/code, and complete message, with occurrence counts.
// Positions are intentionally omitted: formatting must not invalidate existing debt.
export function diagnosticKey(diagnostic) {
	return JSON.stringify([diagnostic.file, diagnostic.code, diagnostic.message])
}

export function countDiagnostics(diagnostics) {
	const counts = Object.create(null)
	for (const diagnostic of diagnostics) {
		const key = diagnosticKey(diagnostic)
		counts[key] = (counts[key] || 0) + 1
	}
	return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

export function newDiagnostics(diagnostics, known) {
	const remaining = { ...known }
	return diagnostics.filter((diagnostic) => {
		const key = diagnosticKey(diagnostic)
		if (remaining[key] > 0) {
			remaining[key]--
			return false
		}
		return true
	})
}

export function baselineIncreases(current, previous) {
	return ["lint", "typecheck"].flatMap((kind) =>
		Object.entries(current[kind])
			.filter(([key, count]) => count > (previous[kind][key] || 0))
			.map(([key]) => `${kind}: ${key}`),
	)
}

function verifyBaseline(baseline, base) {
	if (!base) return
	const ref = git(["rev-parse", "--verify", `${base}^{commit}`]).trim()
	const path = "scripts/code-quality-baseline.json"
	// The first migration has no baseline in its parent. Subsequent changes may only reduce it.
	if (!git(["ls-tree", "--name-only", ref, "--", path]).trim()) return
	const previous = JSON.parse(git(["show", `${ref}:${path}`]))
	const increases = baselineIncreases(baseline, previous)
	if (increases.length)
		throw new Error(`Quality baseline increased relative to ${base}:\n${increases.join("\n")}`)
}

function lint(files, fix = false) {
	const sourceFiles = files.filter((file) => sourceExtension.test(file))
	const diagnostics = []
	for (const directory of [webapp, root]) {
		const selected = sourceFiles.filter(
			(file) => file.startsWith("goodwatch-webapp/") === (directory === webapp),
		)
		if (!selected.length) continue
		const config = resolve(directory, ".oxlintrc.json")
		for (let i = 0; i < selected.length; i += 100) {
			const result = run(
				binary("oxlint"),
				[
					"--config",
					config,
					"--format",
					"json",
					"--deny-warnings",
					...(fix ? ["--fix"] : []),
					...selected.slice(i, i + 100).map((file) => resolve(root, file)),
				],
				directory,
			)
			let report
			try {
				report = JSON.parse(result.stdout)
			} catch {
				throw new Error(`Oxlint did not return diagnostics:\n${result.stderr}\n${result.stdout}`)
			}
			if (
				!Array.isArray(report.diagnostics) ||
				(result.status !== 0 && report.diagnostics.length === 0)
			) {
				throw new Error(`Oxlint failed: ${result.stderr || result.stdout}`)
			}
			if (result.stderr) process.stderr.write(result.stderr)
			for (const item of report.diagnostics) {
				// Syntax/configuration failures are never accepted into a debt baseline.
				if (!item.code || !item.filename) throw new Error(`Oxlint failure: ${JSON.stringify(item)}`)
				const absolute = isAbsolute(item.filename)
					? item.filename
					: resolve(directory, item.filename)
				diagnostics.push({
					file: relative(root, absolute),
					code: item.code,
					message: item.message,
					line: item.labels?.[0]?.span?.line ?? 1,
				})
			}
		}
	}
	return diagnostics
}

export function parseTypeScript(output) {
	const diagnostics = []
	for (const line of output.trimEnd().split(/\r?\n/)) {
		const match = /^(.+)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line)
		if (match) {
			diagnostics.push({
				file: `goodwatch-webapp/${match[1]}`,
				line: Number(match[2]),
				code: match[4],
				message: match[5],
			})
		} else if (/^\s+\S/.test(line) && diagnostics.length) {
			diagnostics.at(-1).message += `\n${line}`
		} else if (line.trim()) {
			throw new Error(`Unexpected TypeScript output (not baselined): ${line}`)
		}
	}
	return diagnostics
}

function typecheck() {
	const result = run(binary("tsc", webapp), ["--pretty", "false"], webapp)
	if (result.stderr) throw new Error(result.stderr)
	const diagnostics = parseTypeScript(result.stdout)
	if (result.status !== 0 && diagnostics.length === 0)
		throw new Error("TypeScript failed without diagnostics.")
	return diagnostics
}

function checkDiagnostics(label, diagnostics, baseline) {
	const added = newDiagnostics(diagnostics, baseline)
	for (const diagnostic of added) {
		console.error(`${diagnostic.file}:${diagnostic.line} ${diagnostic.code}: ${diagnostic.message}`)
	}
	console.log(
		`${label}: ${added.length} new; ${diagnostics.length - added.length} existing diagnostics in the baseline.`,
	)
	return added.length === 0
}

export function main(args) {
	const command = args.shift()
	const options = { files: [], base: process.env.QUALITY_BASE }
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--base") {
			if (!args[i + 1] || args[i + 1].startsWith("--"))
				throw new Error("--base requires a commit reference")
			options.base = args[++i]
		} else if (args[i] === "--all") options.all = true
		else if (args[i] === "--") continue
		else if (args[i].startsWith("--")) throw new Error(`Unknown option: ${args[i]}`)
		else options.files.push(args[i])
	}
	if (command === "format" || command === "format:check") {
		return format(selectFiles(options), command === "format") ? 0 : 1
	}
	if (command === "baseline") {
		if (existsSync(baselinePath))
			throw new Error(
				"Baseline already exists. Fix diagnostics; do not refresh the baseline to pass checks.",
			)
		writeFileSync(
			baselinePath,
			`${JSON.stringify(
				{
					version: 1,
					sourceCommit: git(["rev-parse", "HEAD"]).trim(),
					lint: countDiagnostics(lint(selectFiles({ all: true }))),
					typecheck: countDiagnostics(typecheck()),
				},
				null,
				2,
			)}\n`,
		)
		return 0
	}
	if (!["lint", "lint:fix", "typecheck", "check", "staged"].includes(command)) {
		throw new Error(
			"Usage: code-quality.mjs format|format:check|lint|lint:fix|typecheck|check [--base COMMIT] [--all] [files...]",
		)
	}
	const baseline = JSON.parse(readFileSync(baselinePath, "utf8"))
	if (baseline.version !== 1 || !baseline.lint || !baseline.typecheck)
		throw new Error("Invalid quality baseline")
	verifyBaseline(baseline, options.base)
	let passed = true
	if (command === "check" || command === "staged") {
		passed = format(selectFiles(options), command === "staged") && passed
	}
	if (command !== "typecheck") {
		const files =
			command === "staged" || command === "lint:fix" || options.files.length
				? selectFiles(options)
				: selectFiles({ all: true })
		passed = checkDiagnostics("Lint", lint(files, command === "lint:fix"), baseline.lint) && passed
		if (command === "lint:fix") passed = format(files, true) && passed
	}
	if (command === "check" || command === "typecheck") {
		passed = checkDiagnostics("Typecheck", typecheck(), baseline.typecheck) && passed
	}
	return passed ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		process.exitCode = main(process.argv.slice(2))
	} catch (error) {
		console.error(error.message)
		process.exitCode = 1
	}
}

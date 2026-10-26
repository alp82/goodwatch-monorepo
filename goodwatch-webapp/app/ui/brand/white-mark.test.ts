// The white G mark asks for its file one way on every page (white-mark.ts).
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const sources = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) return sources(path)
		return /\.tsx?$/.test(entry.name) ? [path] : []
	})

test("only white-mark.ts imports the white G's file", () => {
	// An image of it that asks with credentials while the others ask without fetches the file twice (#236).
	const importers = sources("app").filter((file) =>
		/from\s+["']~\/img\/goodwatch-logo-white\.svg["']/.test(
			readFileSync(file, "utf8"),
		),
	)
	assert.deepEqual(importers, ["app/ui/brand/white-mark.ts"])
})

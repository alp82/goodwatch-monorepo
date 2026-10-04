import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"
import { separateEntryUrl } from "./separate-entry.server.ts"

const root = mkdtempSync(join(tmpdir(), "separate-entry-"))
mkdirSync(join(root, "assets"))
writeFileSync(join(root, "worker.js"), "")

test("finds the file next to the module that asks for it", () => {
	const base = pathToFileURL(join(root, "index.js"))
	assert.equal(separateEntryUrl("worker.js", base).href, pathToFileURL(join(root, "worker.js")).href)
})

test("finds the file one directory up from a chunk in assets/", () => {
	const base = pathToFileURL(join(root, "assets", "server-build-abc.js"))
	assert.equal(separateEntryUrl("worker.js", base).href, pathToFileURL(join(root, "worker.js")).href)
})

test("falls back to the sibling path when the file is missing, so the error names it", () => {
	const base = pathToFileURL(join(root, "assets", "server-build-abc.js"))
	assert.equal(separateEntryUrl("missing.js", base).href, pathToFileURL(join(root, "assets", "missing.js")).href)
})

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { mcpServerInfo } from "./identity.ts"

test("Registry and initialize advertise the same identity and real PNG sizes", () => {
	const registry = JSON.parse(
		readFileSync(new URL("../../../server.json", import.meta.url), "utf8"),
	)
	assert.equal(registry.name, "app.goodwatch/mcp")
	assert.equal(registry.packages, undefined)
	assert.deepEqual(registry.remotes, [
		{ type: "streamable-http", url: "https://goodwatch.app/mcp" },
	])
	for (const field of [
		"title",
		"description",
		"version",
		"websiteUrl",
		"icons",
	] as const) {
		assert.deepEqual(registry[field], mcpServerInfo[field])
	}
	for (const icon of mcpServerInfo.icons) {
		const url = new URL(icon.src)
		assert.equal(url.origin, "https://goodwatch.app")
		assert.equal(icon.mimeType, "image/png")
		const png = readFileSync(
			new URL(`../../../public${url.pathname}`, import.meta.url),
		)
		assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
		assert.deepEqual(icon.sizes, [
			`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,
		])
	}
})

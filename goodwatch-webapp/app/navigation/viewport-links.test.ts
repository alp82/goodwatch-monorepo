import assert from "node:assert/strict"
import { test } from "node:test"
import { nearestLinks } from "./viewport-links.ts"

const rect = (top: number, left = 0, size = 100) => ({
	top,
	left,
	bottom: top + size,
	right: left + size,
	width: size,
	height: size,
})
const VIEWPORT = { width: 400, height: 800 }

test("fully visible links nearest the center, one per URL, at most four", () => {
	const links = [
		{ href: "/movie/top", rect: rect(0) },
		{ href: "/movie/center", rect: rect(350, 150) },
		{ href: "/movie/center", rect: rect(360, 0) },
		{ href: "/movie/cut", rect: rect(750) },
		{ href: "/movie/above", rect: rect(-50) },
		{ href: "/movie/hidden", rect: { ...rect(300), width: 0 } },
		{ href: "/movie/a", rect: rect(200) },
		{ href: "/movie/b", rect: rect(470) },
		{ href: "/movie/c", rect: rect(600) },
	]
	assert.deepEqual(nearestLinks(links, VIEWPORT), [
		"/movie/center",
		"/movie/b",
		"/movie/a",
		"/movie/c",
	])
})

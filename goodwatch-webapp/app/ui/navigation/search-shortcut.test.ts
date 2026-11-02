import assert from "node:assert/strict"
import { test } from "node:test"
import { isSearchShortcut } from "./search-shortcut.ts"

const page = { closest: () => null } as unknown as EventTarget
const field = { closest: () => ({}) } as unknown as EventTarget

function keydown(
	key: string | undefined,
	{ metaKey = false, ctrlKey = false, target = page } = {},
) {
	return { key, metaKey, ctrlKey, target } as unknown as KeyboardEvent
}

test("⌘K and Ctrl K open search, also from a text field", () => {
	assert.equal(isSearchShortcut(keydown("k", { metaKey: true })), true)
	assert.equal(isSearchShortcut(keydown("K", { ctrlKey: true })), true)
	assert.equal(
		isSearchShortcut(keydown("k", { ctrlKey: true, target: field })),
		true,
	)
})

test('"/" opens search outside text fields only', () => {
	assert.equal(isSearchShortcut(keydown("/")), true)
	assert.equal(isSearchShortcut(keydown("/", { target: field })), false)
	assert.equal(isSearchShortcut(keydown("/", { metaKey: true })), false)
})

test("typing in a field, such as an email address, is no shortcut", () => {
	for (const key of ["k", "a", "@", ".", "Enter", "Tab"])
		assert.equal(isSearchShortcut(keydown(key, { target: field })), false)
})

test("a keydown without a key, as Chrome's autofill sends, is ignored", () => {
	assert.equal(isSearchShortcut(keydown(undefined, { target: field })), false)
	assert.equal(isSearchShortcut(keydown(undefined, { ctrlKey: true })), false)
	assert.equal(isSearchShortcut(new Event("keydown") as KeyboardEvent), false)
})

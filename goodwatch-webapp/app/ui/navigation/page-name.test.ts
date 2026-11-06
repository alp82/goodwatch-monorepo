import assert from "node:assert/strict"
import { test } from "node:test"
import { pageNameOf, titlePageName } from "./page-name.ts"

const trail = [
	{ label: "Movies", path: "/movies" },
	{ label: "Action", path: "/movies/genres/action" },
]
const titleData = {
	media: { details: { title: "Furiosa" } },
	breadcrumb: trail,
}

test("a title page is named by its title, under its hub and genre", () => {
	assert.deepEqual(titlePageName(titleData), { name: "Furiosa", trail })
	assert.deepEqual(titlePageName({ media: { details: { title: "X" } } }), {
		name: "X",
		trail: [],
	})
	assert.equal(titlePageName(undefined), null)
	assert.equal(titlePageName({ media: {} }), null)
})

test("the deepest route with a namer names the page", () => {
	const root = { handle: undefined, data: {} }
	const title = {
		handle: { scripts: "after-paint", pageName: titlePageName },
		data: titleData,
	}
	assert.deepEqual(pageNameOf([root, title]), { name: "Furiosa", trail })
	assert.equal(pageNameOf([root, { handle: { scripts: "after-paint" } }]), null)
	assert.equal(pageNameOf([]), null)
})

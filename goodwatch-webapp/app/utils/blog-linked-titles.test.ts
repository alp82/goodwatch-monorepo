import assert from "node:assert/strict"
import test from "node:test"
import { linkedTitle, linkedTitles } from "./blog-linked-titles.js"

test("a title page's address names its title", () => {
	assert.equal(linkedTitle("/movie/129-spirited-away"), "movie/129")
	assert.equal(linkedTitle("/movie/129"), "movie/129")
	assert.equal(
		linkedTitle("https://goodwatch.app/show/1399-got/tropes"),
		"show/1399",
	)
	assert.equal(linkedTitle("/tv/1399"), "show/1399")
	for (const url of [
		"/movies/best",
		"/movie/0",
		"/movie/12x",
		"https://example.com/movie/1",
		"/person/5",
	])
		assert.equal(linkedTitle(url), null, url)
})

test("a post's titles come in the order the text links them, each once", () => {
	const link = (url: string) => ({ type: "link", url, children: [] })
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [link("/about"), link("/movie/129-spirited-away")],
			},
			{
				type: "list",
				children: [
					{
						type: "listItem",
						children: [link("/show/1399"), link("/movie/129")],
					},
				],
			},
		],
	}
	assert.deepEqual(linkedTitles(tree), ["movie/129", "show/1399"])
})

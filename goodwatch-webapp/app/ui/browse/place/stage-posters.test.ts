import assert from "node:assert/strict"
import { test } from "node:test"
import { stagePosterPreloads } from "./stage-posters.ts"

const title = (poster_path?: string) => ({ card: { poster_path } })

test("preload only the first visible posters, once, with mutually exclusive phone and wide sources", () => {
	const links = stagePosterPreloads([title("/a.jpg"), title(), title("/a.jpg"), title("/b.jpg")])
	assert.equal(links.length, 2)
	const [phone, wide] = links
	assert.equal(wide.media, `not all and ${phone.media}`)
	assert.equal(phone.imageSizes, wide.imageSizes)
	assert.match(phone.imageSrcSet, /w185\/a.jpg 185w$/)
	assert.match(wide.imageSrcSet, /w342\/a.jpg 342w/)
	assert.equal(phone.href, undefined)
	assert.equal(wide.href, undefined)
})

test("single-source artwork has one preload and absent artwork has none", () => {
	const photo = "https://artworks.thetvdb.com/banners/poster.jpg"
	const links = stagePosterPreloads([title(), title(photo)])
	assert.equal(links.length, 1)
	assert.equal(links[0].href, photo)
	assert.equal(links[0].imageSrcSet, undefined)
})

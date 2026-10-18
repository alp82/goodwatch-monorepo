// A title page's hero picture in its 103 Early Hints response (hero-hints.ts).
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createHeroHints } from "./hero-hints.ts"

const files = (name: string) => ({
	phone: `https://image.tmdb.org/t/p/w780/${name}.jpg`,
	desktop: `https://image.tmdb.org/t/p/w1280/${name}.jpg`,
})
const request = (url: string, mobile?: string) => ({
	url,
	headers: mobile === undefined ? {} : { "sec-ch-ua-mobile": mobile },
})

describe("createHeroHints", () => {
	it("names a rendered page's phone file for a phone and its desktop file for any other", () => {
		const hints = createHeroHints()
		hints.remember("/movie/157336-interstellar", files("interstellar"))
		assert.equal(
			hints.link(request("/movie/157336-interstellar?country=DE", "?1")),
			"<https://image.tmdb.org/t/p/w780/interstellar.jpg>; rel=preload; as=image; crossorigin",
		)
		assert.equal(
			hints.link(request("/movie/157336-interstellar", "?0")),
			"<https://image.tmdb.org/t/p/w1280/interstellar.jpg>; rel=preload; as=image; crossorigin",
		)
	})

	it("names nothing for a page it hasn't rendered, or for a browser that doesn't say what it is", () => {
		const hints = createHeroHints()
		hints.remember("/movie/157336-interstellar", files("interstellar"))
		assert.equal(
			hints.link(request("/show/1396-breaking-bad", "?1")),
			undefined,
		)
		assert.equal(hints.link(request("/movie/157336-interstellar")), undefined)
	})

	it("keeps the most recent pages and forgets the oldest", () => {
		const hints = createHeroHints(2)
		hints.remember("/a", files("a"))
		hints.remember("/b", files("b"))
		hints.remember("/a", files("a2"))
		hints.remember("/c", files("c"))
		assert.equal(hints.size, 2)
		assert.equal(hints.link(request("/b", "?1")), undefined)
		assert.match(hints.link(request("/a", "?1")) ?? "", /a2\.jpg/)
		assert.match(hints.link(request("/c", "?1")) ?? "", /c\.jpg/)
	})
})

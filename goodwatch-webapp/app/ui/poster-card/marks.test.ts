import { describe, expect, it } from "vitest"
import { pillMark } from "./marks"

describe("pillMark", () => {
	it("puts a show status other than Seen first", () => {
		expect(pillMark({ score: 8, want: true, status: "watching" })).toBe("watching")
		expect(pillMark({ score: null, want: false, status: "on_hold" })).toBe("on_hold")
	})
	it("shows the Wishlist bookmark unless the list is the Wishlist", () => {
		expect(pillMark({ score: null, want: true, status: null })).toBe("want")
		expect(pillMark({ score: null, want: true, status: null }, true)).toBeNull()
	})
	it("marks Seen only without a score", () => {
		expect(pillMark({ score: null, want: false, status: "seen" })).toBe("seen")
		expect(pillMark({ score: 7, want: false, status: "seen" })).toBeNull()
		expect(pillMark({ score: null, want: false, status: null })).toBeNull()
	})
})

import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import "./title-filter/test-alias.ts"

const { getFeatureMode, isEnabled, isEnabledForRequest } = await import(
	"./features.server.ts"
)

const saved = {
	flag: process.env.REC_TALKED_ABOUT_NOW,
	users: process.env.REC_PREVIEW_USERS,
}
afterEach(() => {
	for (const [name, value] of [
		["REC_TALKED_ABOUT_NOW", saved.flag],
		["REC_PREVIEW_USERS", saved.users],
	] as const)
		if (value === undefined) Reflect.deleteProperty(process.env, name)
		else process.env[name] = value
})

test("unset, empty or unknown is off", () => {
	Reflect.deleteProperty(process.env, "REC_TALKED_ABOUT_NOW")
	assert.equal(getFeatureMode("talkedAboutNow"), "off")
	process.env.REC_TALKED_ABOUT_NOW = ""
	assert.equal(getFeatureMode("talkedAboutNow"), "off")
	process.env.REC_TALKED_ABOUT_NOW = "yes"
	assert.equal(getFeatureMode("talkedAboutNow"), "off")
	assert.equal(isEnabled("talkedAboutNow", { userId: "u1" }), false)
})

test("on is everyone's, in any case and with spaces", () => {
	process.env.REC_TALKED_ABOUT_NOW = " On "
	assert.equal(getFeatureMode("talkedAboutNow"), "on")
	assert.equal(isEnabled("talkedAboutNow", null), true)
	assert.equal(isEnabled("talkedAboutNow", { userId: "u1" }), true)
})

test("preview is only the listed members'", () => {
	process.env.REC_TALKED_ABOUT_NOW = "preview"
	process.env.REC_PREVIEW_USERS = "u1, u2\nu3"
	assert.equal(isEnabled("talkedAboutNow", { userId: "u2" }), true)
	assert.equal(isEnabled("talkedAboutNow", { userId: "u3" }), true)
	assert.equal(isEnabled("talkedAboutNow", { userId: "u9" }), false)
	assert.equal(isEnabled("talkedAboutNow", { userId: null }), false)
	assert.equal(isEnabled("talkedAboutNow", null), false)
})

test("off and on answer a request without asking who sent it", async () => {
	// A request whose auth would throw: neither mode may look at it.
	const request = new Proxy(new Request("https://goodwatch.app/"), {
		get() {
			throw new Error("the request was read")
		},
	})
	process.env.REC_TALKED_ABOUT_NOW = "off"
	assert.equal(await isEnabledForRequest("talkedAboutNow", request), false)
	process.env.REC_TALKED_ABOUT_NOW = "on"
	assert.equal(await isEnabledForRequest("talkedAboutNow", request), true)
})

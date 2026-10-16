// Release flags: unset or unknown values mean off, so a page behind a flag stays hidden until it is turned on.
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { getFeatureMode, isEnabled } from "./features.server.ts"

const saved = process.env.REC_CONNECTOR
afterEach(() => {
	if (saved === undefined) Reflect.deleteProperty(process.env, "REC_CONNECTOR")
	else process.env.REC_CONNECTOR = saved
})

test("the connector is off while REC_CONNECTOR is unset", () => {
	Reflect.deleteProperty(process.env, "REC_CONNECTOR")
	assert.equal(getFeatureMode("connector"), "off")
	assert.equal(isEnabled("connector"), false)
})

test("REC_CONNECTOR=on turns the connector on, whatever its case and spaces", () => {
	process.env.REC_CONNECTOR = " On "
	assert.equal(isEnabled("connector"), true)
})

test("an unknown value means off", () => {
	process.env.REC_CONNECTOR = "preview"
	assert.equal(getFeatureMode("connector"), "off")
})

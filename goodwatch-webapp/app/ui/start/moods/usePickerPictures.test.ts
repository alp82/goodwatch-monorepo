// The tiles' pictures follow the picker's open state: a failed request is asked again when the picker reopens, and an
// answer is kept for the page's life.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../test-dom.ts"

const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { usePickerPictures } = await import("./usePickerPictures.ts")

test("a failed request asks again on the next open; an answer is kept", async (t) => {
	const answers: (() => Response)[] = [
		() => ({ ok: false, status: 500 }) as Response,
		() =>
			({
				ok: true,
				status: 200,
				json: async () => ({ pictures: { g1: "/a.jpg" } }),
			}) as Response,
	]
	let asked = 0
	t.mock.method(globalThis, "fetch", async () => answers[asked++]())
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	let seen: Record<string, string> = {}
	function Probe({ open }: { open: boolean }) {
		seen = usePickerPictures(open)
		return null
	}
	const render = (open: boolean) =>
		act(async () => {
			root.render(createElement(Probe, { open }))
			for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
		})
	await render(false)
	assert.equal(asked, 0, "nothing until the picker opens")
	await render(true)
	assert.equal(asked, 1)
	assert.deepEqual(seen, {})
	await render(false)
	await render(true)
	assert.equal(asked, 2, "reopening asks again after a failure")
	assert.deepEqual(seen, { g1: "/a.jpg" })
	await render(false)
	await render(true)
	assert.equal(asked, 2, "an answer is kept")
	assert.deepEqual(seen, { g1: "/a.jpg" })
	await act(async () => root.unmount())
})

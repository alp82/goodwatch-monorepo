// The room's grade in a browser-like DOM, with frames run by hand: a grade's new layers commit at opacity 0 and fade in
// only after a paint, and a change of target is the only thing that cancels that wait.
import assert from "node:assert/strict"
import { test } from "node:test"
import { manualFrames } from "../test-dom.ts"

const frames = manualFrames()
const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { RoomGrade } = await import("./RoomGrade.tsx")
const { layersOf } = await import("./grades.ts")
type Grade = Parameters<typeof RoomGrade>[0]["grade"]

/** Runs one frame: the callbacks asked for before it. */
async function frame() {
	await act(async () => frames.runFrame())
}

function setup() {
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	const wrapper = () => container.firstElementChild as HTMLElement
	return {
		render: (grade: Grade) =>
			act(async () => root.render(createElement(RoomGrade, { grade }))),
		on: () => wrapper().dataset.grade,
		/** The opacities of a grade's layers, as the DOM has them now. */
		opacities: (count: number, from: number) =>
			[...wrapper().children]
				.slice(from, from + count)
				.map((el) => Number((el as HTMLElement).style.opacity)),
		root,
	}
}

test("a grade's first use commits its layers at 0 and fades them in two frames later", async () => {
	const room = setup()
	await room.render(null)
	assert.equal(room.on(), "none")
	await room.render("funny")
	const n = layersOf("funny").length
	// The rest dim's layers come first.
	const rest = 2
	assert.equal(room.on(), "none", "nothing activates in the commit that mounts")
	assert.deepEqual(room.opacities(n, rest), Array(n).fill(0))
	await frame()
	assert.equal(room.on(), "none", "the layers haven't painted at 0 yet")
	await frame()
	assert.equal(room.on(), "funny")
	assert.deepEqual(
		room.opacities(n, rest),
		layersOf("funny").map((l) => l.o),
	)
	// Going back to a grade that has painted is a crossfade at once.
	await room.render(null)
	assert.equal(room.on(), "none")
	await room.render("funny")
	assert.equal(room.on(), "funny")
	assert.equal(frames.pending(), 0)
	await act(async () => room.root.unmount())
})

test("only a new target cancels a pending fade; the grade on show stays until the new one's layers have painted", async () => {
	const room = setup()
	await room.render("funny")
	await frame()
	await frame()
	assert.equal(room.on(), "funny")
	await room.render("scary")
	await frame()
	await room.render("action")
	assert.equal(room.on(), "funny")
	await frame()
	await frame()
	assert.equal(room.on(), "action", "scary's cancelled wait never lands")
	await frame()
	assert.equal(room.on(), "action")
	// Undefined keeps the last grade (a search's reading is on its way).
	await room.render(undefined)
	assert.equal(room.on(), "action")
	await act(async () => room.root.unmount())
})

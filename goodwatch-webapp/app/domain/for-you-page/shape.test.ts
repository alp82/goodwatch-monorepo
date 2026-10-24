import assert from "node:assert/strict"
import { test } from "node:test"
import "../../server/title-filter/test-alias.ts"

const { LIBRARY, ownRecipes } = await import("./recipes.ts")
const {
	FLAT,
	RING,
	STEP,
	shapeOf,
	drift,
	keeps,
	nearDup,
	leadOf,
	attrsOf,
	summaryOf,
	snapLevel,
	familyPushes,
	steerOf,
} = await import("./shape.ts")
const { drawerOrder, pinned, DRAWER_SIZE, DESK_SIZE } = await import(
	"./rail.ts"
)
const { FP_KEYS } = await import("./contract.ts")

test("library contains 24 distinct recipes with valid title analysis keys", () => {
	assert.equal(LIBRARY.length, 24)
	assert.equal(new Set(LIBRARY.map((r) => r.id)).size, 24)
	for (const r of LIBRARY) {
		for (const key of Object.keys(r.attrs))
			assert.ok(FP_KEYS.includes(key as (typeof FP_KEYS)[number]))
		assert.deepEqual(
			steerOf(
				r,
				r.shape,
				familyPushes({
					subject: "sample",
					attributes: [],
					groups: [],
					loved: {},
				}),
			).attrs,
			r.attrs,
		)
	}
	assert.deepEqual(STEP, { alone: 1, mood: 1.8, deep: 4.5 })
})

test("lead family drift costs double and retains a recipe through tolerance", () => {
	const shape = shapeOf({ feel: 2, humor: 1 })
	assert.equal(drift(shapeOf({ feel: 1, humor: 1 }), shape), 2)
	assert.ok(keeps(shapeOf({ feel: 1, humor: 1 }), shape))
	assert.ok(!keeps(shapeOf({ feel: 1 }), shape))
	assert.equal(leadOf({ ...LIBRARY[0], shape }), "feel")
	for (const level of [-1, 0, 1, 2] as const)
		assert.equal(snapLevel(RING[level]), level)
	assert.equal(summaryOf(undefined, FLAT), null)
	assert.equal(
		summaryOf(undefined, shapeOf({ humor: 2 })),
		"Lots more Humor than usual",
	)
})

test("own recipes retain group IDs, sort by count, and infer shapes from families", () => {
	const groups = [
		{
			id: "side-1",
			name: "Quiet stories",
			keys: ["character_depth", "acting", "slow_burn"],
			count: 4,
		},
		{
			id: "side-2",
			name: "Funny worlds",
			keys: ["wit_wordplay", "fantasy"],
			count: 8,
		},
	]
	const recipes = ownRecipes(groups)
	assert.deepEqual(
		recipes.map((r) => r.id),
		["side-2", "side-1"],
	)
	assert.deepEqual(recipes[1].shape, shapeOf({ story: 2, craft: 1 }))
	assert.deepEqual(recipes[1].attrs, {
		character_depth: 0.95,
		acting: 0.8,
		slow_burn: 0.8,
	})
	assert.equal(groups[0].id, "side-1")
})

test("family pushes normalize, exclude avoided attributes, and clamp handle changes", () => {
	const taste: import("./contract.ts").ForYouTaste = {
		subject: "member",
		groups: [],
		loved: {},
		attributes: [
			{
				key: "adrenaline",
				label: "Adrenaline",
				family: "feel",
				edge: 1,
				tier: 2,
				carriers: [],
			},
			{
				key: "tension",
				label: "Tension",
				family: "feel",
				edge: 0.5,
				tier: 1,
				carriers: [],
			},
			{
				key: "scare",
				label: "Scare",
				family: "feel",
				edge: -1,
				tier: -2,
				carriers: [],
			},
		],
	}
	const pushes = familyPushes(taste)
	for (const bundle of [pushes.feel.wide, pushes.feel.peak]) {
		assert.ok(
			Math.abs(Object.values(bundle).reduce((s, w) => s + w * w, 0) - 1) <
				1e-12,
		)
	}
	assert.equal(pushes.feel.wide.scare, undefined)
	const attrs = attrsOf(undefined, shapeOf({ feel: 2 }), pushes)
	assert.ok(Object.values(attrs).every((w) => w >= -3 && w <= 3))
	assert.equal(Math.max(...Object.values(attrs)), 3)
	assert.deepEqual(attrsOf(undefined, FLAT, pushes), {})
})

test("drawer spreads recipes, keeps own recipes first, and avoids near duplicates", () => {
	const own = ownRecipes([
		{
			id: "side-1",
			name: "Sharp minds",
			keys: ["wit_wordplay", "complexity"],
			count: 10,
		},
	])
	const library = [...LIBRARY, ...own]
	const ids = drawerOrder(library, FLAT, own[0], { count: {}, like: {} })
	assert.ok(ids.length <= DRAWER_SIZE)
	assert.equal(ids[0], "side-1")
	assert.equal(new Set(ids).size, ids.length)
	const selected = ids.map((id) => library.find((r) => r.id === id))
	for (let i = 0; i < selected.length; i++)
		for (let j = i + 1; j < selected.length; j++) {
			const a = selected[i]
			const b = selected[j]
			assert.ok(a && b)
			assert.ok(!nearDup(a, b))
		}
	const picked = LIBRARY[5]
	assert.ok(
		drawerOrder(LIBRARY, FLAT, picked, { count: {}, like: {} }).includes(
			picked.id,
		),
	)
})

test("pin keeps a selected tile at its slot and respects desktop capacity", () => {
	const ids = LIBRARY.slice(0, DESK_SIZE).map((r) => r.id)
	const result = pinned(ids, { id: "side-1", index: 3 })
	assert.equal(result[3], "side-1")
	assert.equal(result.length, DESK_SIZE)
	assert.equal(new Set(result).size, DESK_SIZE)
	assert.deepEqual(
		ids,
		LIBRARY.slice(0, DESK_SIZE).map((r) => r.id),
	)
	assert.equal(pinned(ids, null), ids)
})

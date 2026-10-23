import assert from "node:assert/strict"
import { test } from "node:test"
import {
	routeInteraction,
	type Dependencies,
	type Interaction,
} from "./router.server.ts"
import {
	type Component,
	type GuestTitle,
	componentCount,
	titleCard,
	EPHEMERAL,
} from "./cards.ts"
import { linkPrompt, rateModal, writeConfirmation } from "./member-cards.ts"
import { createDiscordWriter } from "./writes.server.ts"
import { commands } from "./commands.ts"
import { scoreLabels, getVibeColorValue } from "../../utils/ratings.ts"
import { parseUndoId } from "./custom-id.ts"
const title: GuestTitle = {
	id: "movie:42",
	name: "A title",
	year: 2024,
	poster_url: "https://example.test/poster.jpg",
	match: 95,
	match_label: "95% taste match",
}
function fixture(overrides: Partial<Dependencies> = {}) {
	let finish!: (body: unknown) => void
	const edited = new Promise<unknown>((resolve) => {
		finish = resolve
	})
	const deps: Partial<Dependencies> = {
		linkedUser: async () => "member",
		getGuild: async () => null,
		memberRead: async () => ({
			title,
			member: { score: 9, want_to_see: true },
			country: "DE",
		}),
		read: async () => ({ title, items: [title] }),
		take: async () => ({ allowed: true, store: "memory" }),
		edit: async (_app, _token, body) => {
			finish(body)
		},
		log: () => {},
		...overrides,
	}
	const run = (
		type: number,
		data: Interaction["data"],
		extra: Partial<Interaction> = {},
	) =>
		routeInteraction(
			{
				type,
				id: "123456789",
				application_id: "app",
				token: "token",
				user: { id: "discord-user" },
				data,
				...extra,
			},
			deps,
		)
	return { run, edited }
}
function flatten(components: Component[]): Component[] {
	return components.flatMap((c) => [
		c,
		...flatten(c.components ?? []),
		...(c.accessory ? flatten([c.accessory]) : []),
	])
}
test("Rate opens a real modal as its initial response and submits the selected integer", async () => {
	const modal = await fixture().run(3, { custom_id: "gw1:rate:movie:42" })
	assert.equal(modal.type, 9)
	const payload = modal.data as ReturnType<typeof rateModal>["data"]
	assert.equal(payload.title, "Rate A title")
	assert.equal(payload.components[0].type, 10)
	const label = payload.components[1]
	assert.equal(label.type, 18)
	const select = label.component!
	assert.equal(select.type, 3)
	assert.equal(select.required, true)
	assert.deepEqual(
		select.options!.map((o) => o.description),
		scoreLabels.slice(1),
	)
	assert.equal(select.options!.find((o) => o.value === "9")?.default, true)
	assert.ok(
		rateModal({ ...title, name: "Very long title ".repeat(50) }).data.title
			.length <= 45,
	)
	const calls: unknown[] = []
	const f = fixture({
		write: async (...args) => {
			calls.push(args)
			return { outcome: "applied", batch_id: "123456789" }
		},
	})
	assert.equal(
		(
			await f.run(5, {
				custom_id: payload.custom_id,
				components: [
					{ type: 18, component: { custom_id: "score", values: ["8"] } },
				],
			})
		).type,
		5,
	)
	assert.match(JSON.stringify(await f.edited), /Great|Undo/)
	assert.deepEqual(calls, [
		[
			"member",
			"https://goodwatch.app",
			"rate_title",
			{ action_id: "123456789", items: [{ title_id: title.id, score: 8 }] },
		],
	])
})
for (const name of ["rate", "seen", "want"] as const) {
	test(`/${name} registers title autocomplete and guests get the benefit link card`, async () => {
		const command = commands.find((c) => c.name === name)!
		assert.deepEqual(command.integration_types, [0, 1])
		assert.deepEqual(command.contexts, [0, 1, 2])
		assert.ok("autocomplete" in command.options[0])
		assert.equal(command.options[0].autocomplete, true)
		if (name === "rate")
			assert.deepEqual(command.options[1], {
				name: "score",
				description: "Your score from 1 to 10",
				type: 4,
				required: true,
				min_value: 1,
				max_value: 10,
			})
		const f = fixture({
			linkedUser: async () => null,
			write: async () => {
				assert.fail("guest write")
			},
		})
		assert.equal(
			(await f.run(2, { name, options: [{ name: "title", value: title.id }] }))
				.type,
			5,
		)
		const body = JSON.stringify(await f.edited)
		assert.match(body, /Link GoodWatch/)
		assert.match(body, /Your taste match/)
		assert.match(body, /Picks from your own services/)
		assert.match(body, /https:\/\/goodwatch.app\/discord\/link/)
	})
	test(`${name} autocomplete uses catalog search`, async () => {
		const f = fixture()
		const result = await f.run(4, {
			name,
			options: [{ name: "title", value: "title", focused: true }],
		})
		assert.equal(result.type, 8)
		assert.match(JSON.stringify(result.data), /movie:42/)
	})
}
test("Want button toggles off; public presses stay private; Seen logs today's date", async () => {
	for (const action of ["want", "seen"] as const) {
		for (const publicMessage of [false, true]) {
			let written: unknown
			const f = fixture({
				memberRead: async () => ({ title, member: { want_to_see: true } }),
				write: async (...args) => {
					written = args
					return { outcome: "applied", batch_id: "123456789" }
				},
			})
			const response = await f.run(
				3,
				{ custom_id: `gw1:${action}:movie:42` },
				{ message: { flags: publicMessage ? 0 : EPHEMERAL } },
			)
			assert.equal(response.type, publicMessage ? 5 : 6)
			if (publicMessage)
				assert.equal((response.data as { flags: number }).flags, EPHEMERAL)
			assert.match(JSON.stringify(await f.edited), /Undo/)
			assert.deepEqual(written, [
				"member",
				"https://goodwatch.app",
				action === "want" ? "set_want_to_see" : "log_watch",
				{
					action_id: "123456789",
					items: [
						{
							title_id: title.id,
							...(action === "want"
								? { want_to_see: false }
								: { date: new Date().toISOString().slice(0, 10) }),
						},
					],
				},
			])
		}
	}
})
test("budget denial and tool refusal produce explanatory cards", async () => {
	const writer = createDiscordWriter({
		receipt: async () => null,
		take: async () => ({
			allowed: false,
			store: "memory",
			retryAfterSeconds: 42,
		}),
		write: async () => {
			assert.fail("budget-denied write")
		},
	})
	const f = fixture({ write: writer })
	await f.run(2, {
		name: "seen",
		options: [{ name: "title", value: title.id }],
	})
	assert.match(JSON.stringify(await f.edited), /Try again in 42 seconds/)
	const refused = fixture({
		memberRead: async () => ({ title, member: {} }),
		write: async () => ({
			outcome: "not_applied",
			items: [{ status: "error", message: "This change is not allowed." }],
		}),
	})
	await refused.run(3, { custom_id: "gw1:seen:movie:42" })
	assert.match(
		JSON.stringify(await refused.edited),
		/This change is not allowed/,
	)
})
test("foreign undo never reaches writer and replies with the ownership message", async () => {
	const writer = createDiscordWriter({
		receipt: async () => null,
		take: async () => {
			assert.fail("foreign undo budget")
		},
		write: async () => {
			assert.fail("foreign undo")
		},
	})
	const f = fixture({ write: writer })
	await f.run(
		3,
		{ custom_id: "gw1:undo:123456789:movie:42" },
		{ message: { flags: 0 } },
	)
	assert.match(
		JSON.stringify(await f.edited),
		/Only the person who made this change can undo it\./,
	)
})
test("undo refreshes the personal card, preserving Undone; partial undo explains the result", async () => {
	const f = fixture({
		write: async (_user, _origin, name, args) => {
			assert.equal(name, "undo_watch")
			assert.equal(args.batch_id, "123456789")
			return { outcome: "applied", summary: { undone: 1 } }
		},
	})
	await f.run(3, { custom_id: "gw1:undo:123456789:movie:42" })
	const body = JSON.stringify(await f.edited)
	assert.match(body, /Undone\./)
	assert.match(body, /95% taste match/)
	const partial = fixture({
		write: async () => ({
			outcome: "applied",
			summary: { partly_undone: 1 },
			message: "Only part of this change could be undone.",
		}),
	})
	await partial.run(3, { custom_id: "gw1:undo:123456789:movie:42" })
	assert.match(JSON.stringify(await partial.edited), /Only part/)
})
test("member blocks and mini confirmations respect limits, unchanged labels, and member score colors", () => {
	const personal = titleCard(title, "DE", {
		member: { score: 9, want_to_see: true, watch_count: 1 },
	})
	assert.equal(personal.components.length, 2)
	assert.equal(personal.components[0].type, 17)
	assert.equal(personal.components[1].type, 17)
	assert.deepEqual(personal.components[0], titleCard(title, "DE").components[0])
	const buttons = flatten(personal.components[1].components!).filter(
		(c) => c.type === 2,
	)
	assert.deepEqual(
		buttons.map((c) => [c.label, c.style]),
		[
			["Want to see", 3],
			["Seen", 3],
			["Rate", 3],
		],
	)
	for (const score of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
		const card = writeConfirmation(title, "123456789", "rate", score)
		assert.equal(
			card.components[0].accent_color,
			Number.parseInt(getVibeColorValue(score).slice(1), 16),
		)
		assert.match(JSON.stringify(card), new RegExp(scoreLabels[score]))
		assert.ok(componentCount(card.components) <= 40)
		const undo = flatten(card.components).find((c) => c.label === "Undo")!
		assert.deepEqual(parseUndoId(String(undo.custom_id)), {
			batchId: "123456789",
			titleId: title.id,
		})
	}
	assert.ok(componentCount(personal.components) <= 40)
	assert.ok(
		componentCount(linkPrompt("https://goodwatch.app").components) <= 40,
	)
	const shared = JSON.stringify(
		titleCard(title, "DE", {
			share: true,
			member: { score: 9, want_to_see: true },
		}),
	)
	assert.doesNotMatch(shared, /taste match|Rated|gw1:rate:|gw1:want:|gw1:seen:/)
})

test("show Seen dates only its own native watch group and surfaces refusals", async () => {
	const { logShowWatch } = await import("./writes.server.ts")
	const calls: unknown[] = []
	const result = await logShowWatch(
		async (user, action) => {
			calls.push([user, action])
			return { status: "applied", refused: null, rows: [{}] }
		},
		"member",
		42,
		"group-123456789",
		"2026-10-23",
	)
	assert.deepEqual(result, { removedWatchId: null, event: "pressSeen" })
	assert.deepEqual(calls, [
		[
			"member",
			{
				id: 42,
				actionId: "group-123456789",
				event: { type: "pressSeen", today: "2026-10-23" },
			},
		],
		[
			"member",
			{
				id: 42,
				event: {
					type: "setGroupDate",
					group: "group-123456789",
					day: "2026-10-23",
				},
			},
		],
	])
	const refused = await logShowWatch(
		async () => ({
			status: "refused",
			refused: "No aired episodes.",
			rows: [],
		}),
		"member",
		42,
		"group-123456789",
		"2026-10-23",
	)
	assert.deepEqual(refused, { refused: "No aired episodes." })
	let n = 0
	await assert.rejects(
		logShowWatch(
			async () => ({
				status: ++n === 1 ? "applied" : "refused",
				refused: null,
				rows: [{}],
			}),
			"member",
			42,
			"group-123456789",
			"2026-10-23",
		),
		/Could not date/,
	)
})

for (const marks of [{ score: 9 }, { watch_count: 1 }, { status: "seen" }]) {
	test(`Seen button refuses another movie watch for ${JSON.stringify(marks)}; /seen logs a rewatch`, async () => {
		let writes = 0
		const overrides: Partial<Dependencies> = {
			memberRead: async () => ({ title, member: marks }),
			write: async () => {
				writes++
				return { outcome: "applied", batch_id: "123456789" }
			},
		}
		const button = fixture(overrides)
		await button.run(3, { custom_id: "gw1:seen:movie:42" })
		assert.match(
			JSON.stringify(await button.edited),
			/Already seen\. Use Undo on the earlier confirmation, or \/seen to log a rewatch\./,
		)
		assert.equal(writes, 0)
		const command = fixture(overrides)
		await command.run(2, {
			name: "seen",
			options: [{ name: "title", value: title.id }],
		})
		assert.match(JSON.stringify(await command.edited), /Undo/)
		assert.equal(writes, 1)
	})
}

test("Undo charges the receipt item count and receipt replays spend no budget", async () => {
	for (const size of [1, 3]) {
		const costs: number[] = []
		const receipt = {
			outcome: "applied",
			items: Array.from({ length: size }, () => ({ status: "applied" })),
		}
		let writes = 0
		const writer = createDiscordWriter({
			receipt: async () => receipt,
			take: async (_user, _windows, cost) => {
				costs.push(cost)
				return { allowed: true, store: "memory" }
			},
			write: async () => {
				writes++
				return { outcome: "applied" }
			},
		})
		await writer("member", "https://goodwatch.app", "undo_watch", {
			action_id: "undo",
			batch_id: "batch",
		})
		assert.deepEqual(costs, [size])
		assert.equal(writes, 1)
		assert.deepEqual(
			await writer("member", "https://goodwatch.app", "rate_title", {
				action_id: "batch",
				items: [{ title_id: title.id, score: 8 }],
			}),
			receipt,
		)
		assert.deepEqual(costs, [size])
		assert.equal(writes, 1)
	}
})

test("write UI keeps identifiers and underscores out of visible text", async () => {
	const unusual = {
		...title,
		name: "A_title",
		synopsis: "A_movie",
		match_label: "Great_fit",
	}
	const cards = [
		titleCard(unusual, "DE", { member: {} }),
		writeConfirmation(unusual, "123456789", "want"),
	]
	const modal = rateModal(unusual).data
	assert.doesNotMatch(modal.title, /_/)
	assert.doesNotMatch(String(modal.components[0].content), /_/)
	for (const card of cards) {
		for (const c of flatten(card.components)) {
			for (const field of ["label", "content", "description"]) {
				if (typeof c[field] === "string")
					assert.doesNotMatch(c[field], /_|movie:42|123456789/)
			}
		}
	}
	for (const command of commands) {
		assert.doesNotMatch(command.name, /_/)
		for (const option of command.options) {
			assert.doesNotMatch(option.name, /_/)
			if ("choices" in option)
				for (const choice of option.choices)
					assert.doesNotMatch(choice.name, /_/)
		}
	}
	const f = fixture({
		write: async () => ({
			outcome: "refused",
			message: "title_id movie:42 action_id 123456789012345678",
		}),
	})
	await f.run(2, {
		name: "want",
		options: [{ name: "title", value: title.id }],
	})
	const body = (await f.edited) as { components: Component[] }
	assert.doesNotMatch(
		String(body.components[0].content),
		/_|movie:42|123456789012345678/,
	)
})

test("Undo refresh keeps the guest place and catalog in the top block", async () => {
	const guest = {
		...title,
		name: "Guest catalog",
		match: undefined,
		match_label: undefined,
	}
	const f = fixture({
		getGuild: async () => null,
		memberRead: async (_member, name) =>
			name === "get_settings"
				? { country: "FR", service_ids: [] }
				: { title: { ...title, name: "Member catalog" }, member: { score: 9 } },
		read: async () => ({ title: guest }),
		write: async () => ({ outcome: "applied", summary: { undone: 1 } }),
	})
	await f.run(3, { custom_id: "gw1:undo:123456789:movie:42" }, { locale: "de" })
	const body = (await f.edited) as { components: Component[] }
	assert.equal(body.components[0].content, "Undone.")
	assert.deepEqual(
		body.components[1],
		titleCard(guest, "DE", { allServices: true }).components[0],
	)
	assert.match(
		JSON.stringify(body.components[2]),
		/95% taste match|On every service in France/,
	)
	assert.doesNotMatch(
		JSON.stringify(body.components[1]),
		/Member catalog|France|You rated/,
	)
})

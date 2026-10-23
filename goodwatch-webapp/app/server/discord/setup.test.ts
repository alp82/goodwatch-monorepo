import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { canManageGuild, setup, setupAutocomplete } from "./setup.server.ts"
import {
	createGuildStore,
	type GuildSettings,
	type GuildStorage,
} from "./guild.server.ts"
import { resolveViewerPlace } from "./place.server.ts"
import { routeInteraction, type Interaction } from "./router.server.ts"
const guild: GuildSettings = {
	guild_id: "guild",
	country: "DE",
	service_ids: [8, 9],
	digest_channel_id: null,
	updated_by: "admin",
	updated_at: 1,
}
const interaction: Interaction = {
	type: 2,
	guild_id: "guild",
	member: { user: { id: "admin" }, permissions: "32" },
	locale: "fr",
	application_id: "app",
	token: "token",
	data: { name: "setup" },
}
function fixture() {
	let current = { ...guild, service_ids: [...guild.service_ids] }
	const writes: GuildSettings[] = []
	const reads: unknown[] = []
	const deps = {
		linkedUser: async () => null,
		getGuild: async () => current,
		saveGuild: async (s: GuildSettings) => {
			writes.push(s)
			current = s
			return true
		},
		guildAvailable: () => true,
		countries: async () => [
			{ code: "DE", name: "Germany" },
			{ code: "FR", name: "France" },
		],
		read: async (viewer: unknown) => {
			reads.push(viewer)
			return {
				providers: [
					{ id: 8, name: "Netflix" },
					{ id: 10, name: "Prime Video" },
				],
			}
		},
	}
	return { deps, writes, reads }
}
test("permission parsing accepts Manage Server and Administrator, including large bitfields", () => {
	for (const permissions of ["32", "8", "40", "9007199254741024"])
		assert.equal(
			canManageGuild({ ...interaction, member: { permissions } }),
			true,
		)
	for (const permissions of [
		undefined,
		"0",
		"16",
		"invalid",
		"-1",
		"0x20",
		"32.0",
		"",
	])
		assert.equal(
			canManageGuild({ ...interaction, member: { permissions } }),
			false,
		)
	assert.equal(canManageGuild({ ...interaction, guild_id: undefined }), false)
})
test("Remove and Clear re-check permissions at the router and handler", async () => {
	for (const custom_id of ["setup:remove:8", "setup:clear"]) {
		const f = fixture()
		const denied = {
			...interaction,
			type: 3,
			member: { permissions: "0", user: { id: "other" } },
			data: { custom_id },
		}
		assert.match(JSON.stringify(await setup(denied, f.deps)), /Manage Server/)
		const response = await routeInteraction(denied, {
			...f.deps,
			take: async () => ({ allowed: true, store: "memory" }),
			log: () => {},
		})
		assert.equal(response.type, 4)
		assert.match(JSON.stringify(response), /Manage Server/)
		assert.equal(f.writes.length, 0)
		await setup({ ...interaction, type: 3, data: { custom_id } }, f.deps)
		assert.deepEqual(
			f.writes[0].service_ids,
			custom_id.endsWith("clear") ? [] : [9],
		)
	}
})
test("country order uses member, guild, locale, fallback and preserves services", async () => {
	const deps = {
		getGuild: async () => guild,
		resolveMemberPlace: async () => ({ country: "GB", services: [10] }),
	}
	assert.deepEqual(await resolveViewerPlace(interaction, deps), {
		country: "GB",
		services: [10],
	})
	assert.deepEqual(
		await resolveViewerPlace(interaction, { getGuild: deps.getGuild }),
		{ country: "DE", services: [8, 9] },
	)
	assert.deepEqual(
		await resolveViewerPlace(
			{ ...interaction, guild_id: undefined },
			{ getGuild: async () => null },
		),
		{ country: "FR" },
	)
	assert.deepEqual(
		await resolveViewerPlace({ type: 2, locale: "unknown" }, {}),
		{ country: "US" },
	)
})
test("setup shows settings, adds services once, validates and prunes on country change", async () => {
	const f = fixture()
	assert.match(
		JSON.stringify(await setup(interaction, f.deps)),
		/Remove Netflix/,
	)
	assert.equal(f.writes.length, 0)
	await setup(
		{
			...interaction,
			data: {
				options: [
					{ name: "country", value: "FR" },
					{ name: "service", value: "10" },
				],
			},
		},
		f.deps,
	)
	assert.deepEqual(f.writes[0].service_ids, [8, 10])
	await setup(
		{ ...interaction, data: { options: [{ name: "service", value: "10" }] } },
		f.deps,
	)
	assert.deepEqual(f.writes[1].service_ids, [8, 10])
	assert.equal(f.writes[1].updated_by, "admin")
	await setup(
		{ ...interaction, data: { options: [{ name: "service", value: "999" }] } },
		f.deps,
	)
	assert.equal(f.writes.length, 2)
	assert.match(
		JSON.stringify(
			await setup(interaction, { ...f.deps, guildAvailable: () => false }),
		),
		/Server setup isn't available yet/,
	)
})
test("autocomplete uses supported countries and the selected country's provider IDs", async () => {
	const f = fixture()
	assert.deepEqual(
		await setupAutocomplete(
			{
				...interaction,
				data: { options: [{ name: "country", value: "ger", focused: true }] },
			},
			f.deps,
		),
		[{ name: "Germany", value: "DE" }],
	)
	assert.deepEqual(
		await setupAutocomplete(
			{
				...interaction,
				data: {
					options: [
						{ name: "country", value: "FR" },
						{ name: "service", value: "net", focused: true },
					],
				},
			},
			f.deps,
		),
		[{ name: "Netflix", value: "8" }],
	)
	assert.deepEqual(f.reads, [{ country: "FR" }])
	assert.deepEqual(
		await setupAutocomplete(
			{ ...interaction, member: { permissions: "0" } },
			f.deps,
		),
		[],
	)
})
test("guild cache resets after a write and missing table reads log once and return null", async () => {
	let stored = guild,
		cached: GuildSettings | null | undefined
	const events: string[] = [],
		logs: string[] = []
	const storage: GuildStorage = {
		read: async (id) => {
			assert.equal(id, "guild")
			events.push("read")
			return stored
		},
		write: async (s) => {
			events.push("write")
			stored = s
		},
		cached: async (_id, target) =>
			cached === undefined ? (cached = await target()) : cached,
		reset: async (id) => {
			assert.equal(id, "guild")
			events.push("reset")
			cached = undefined
			return true
		},
		log: (line) => logs.push(line),
	}
	const store = createGuildStore(storage)
	await store.get("guild")
	await store.get("guild")
	assert.deepEqual(events, ["read"])
	assert.equal(await store.save({ ...guild, country: "FR" }), true)
	assert.equal((await store.get("guild"))?.country, "FR")
	assert.deepEqual(events, ["read", "write", "reset", "read"])
	storage.cached = async (_id, target) => target()
	storage.read = async () => {
		throw new Error("RelationUnknown[Relation 'doc.discord_guild' unknown]")
	}
	assert.equal(await store.get("guild"), null)
	assert.equal(await store.get("guild"), null)
	assert.equal(store.available(), false)
	assert.equal(logs.length, 1)
})
test("registration dry-run includes guild-only setup with Manage Server permission", async (t) => {
	const output: string[] = []
	const log = t.mock.method(console, "log", (line: string) => output.push(line))
	const exit = t.mock.method(process, "exit", () => undefined as never)
	const originalArgs = process.argv
	try {
		process.argv = [...process.argv, "--dry-run"]
		await import("../../../scripts/discord-register.ts")
	} finally {
		process.argv = originalArgs
		log.mock.restore()
		exit.mock.restore()
	}
	const commands = JSON.parse(output[0])
	const command = commands.find((c: { name: string }) => c.name === "setup")
	assert.equal(command.default_member_permissions, "32")
	assert.deepEqual(command.contexts, [0])
	assert.deepEqual(command.integration_types, [0])
	assert.ok(
		command.options.every((o: { autocomplete: boolean }) => o.autocomplete),
	)
})

test("commands and title buttons share guild country and services, with an all-services note only when needed", async () => {
	for (const name of [
		"search",
		"similar",
		"person",
		"hot",
		"discover",
		"button",
	]) {
		for (const services of [[8], []]) {
			const readers: { viewer: unknown; args: unknown }[] = []
			let done!: () => void
			const finished = new Promise<void>((resolve) => {
				done = resolve
			})
			const edits: unknown[] = []
			let state: import("./discover-state.server.ts").DiscoverState = {
				args: {},
			}
			const response = await routeInteraction(
				{
					...interaction,
					type: name === "button" ? 3 : 2,
					data:
						name === "button"
							? { custom_id: "gw1:watch:movie:42" }
							: {
									name,
									options: [
										{
											name: name === "person" ? "name" : "title",
											value: name === "person" ? "12" : "movie:42",
										},
									],
								},
				},
				{
					linkedUser: async () => null,
					getGuild: async () => ({ ...guild, service_ids: services }),
					take: async () => ({ allowed: true, store: "memory" }),
					log: () => done(),
					edit: async (_a, _t, body) => {
						edits.push(body)
					},
					read: async (viewer, _origin, _tool, args) => {
						readers.push({ viewer, args })
						return {
							title: { id: "movie:42", name: "Title", year: 2024 },
							items: [],
							person: {
								person_id: 12,
								name: "Person",
								url: "https://goodwatch.app/person/12",
							},
						}
					},
					hot: async () => [],
					displays: async () => new Map(),
					saveState: async (value) => {
						state = value
						return "iabc"
					},
					loadState: async () => state,
				},
			)
			assert.ok([5, 6].includes(response.type), `${name} deferred`)
			await finished
			assert.equal(edits.length, 1)
			for (const reader of readers)
				assert.deepEqual(reader.viewer, { country: "DE", services })
			// /hot isn't filtered by services, so it never names them.
			assert.equal(
				/every service in Germany/i.test(JSON.stringify(edits)),
				services.length === 0 && !["hot", "button", "search"].includes(name),
			)
		}
	}
})

test("setup autocomplete caps choices and long service lists paginate within component limits", async () => {
	const f = fixture()
	const providers = Array.from({ length: 50 }, (_, i) => ({
		id: i + 1,
		name: `Service ${i}`,
	}))
	const deps = {
		...f.deps,
		read: async () => ({ providers }),
		getGuild: async () => ({
			...guild,
			service_ids: providers.map((p) => p.id),
		}),
	}
	const choices = await setupAutocomplete(
		{
			...interaction,
			data: { options: [{ name: "service", value: "", focused: true }] },
		},
		deps,
	)
	assert.equal(choices.length, 25)
	const first = await setup(interaction, deps)
	const second = await setup(
		{ ...interaction, type: 3, data: { custom_id: "setup:page:1" } },
		deps,
	)
	assert.match(JSON.stringify(first), /setup:remove:1"/)
	assert.match(JSON.stringify(second), /setup:remove:16"/)
	assert.equal(f.writes.length, 0)
})

test("setup Remove, Clear and Next defer updates to the setup message", async () => {
	for (const custom_id of ["setup:remove:8", "setup:clear", "setup:page:1"]) {
		const f = fixture()
		let done!: () => void
		const finished = new Promise<void>((resolve) => {
			done = resolve
		})
		const edits: unknown[] = []
		const response = await routeInteraction(
			{ ...interaction, type: 3, data: { custom_id } },
			{
				...f.deps,
				take: async () => ({ allowed: true, store: "memory" }),
				edit: async (_app, _token, body) => {
					edits.push(body)
				},
				log: () => done(),
			},
		)
		assert.deepEqual(response, { type: 6 })
		await finished
		assert.equal(edits.length, 1)
	}
})

test("guild save succeeds after a committed write when cache reset fails or times out", async () => {
	for (const reset of [
		async () => false,
		async () => {
			throw new Error("Redis unavailable")
		},
		() => new Promise<boolean>(() => {}),
	]) {
		const logs: string[] = []
		let writes = 0
		const store = createGuildStore({
			read: async () => guild,
			write: async () => {
				writes++
			},
			cached: async (_id, target) => target(),
			reset,
			log: (line) => logs.push(line),
		})
		assert.equal(await store.save(guild), true)
		assert.equal(writes, 1)
		assert.equal(store.available(), true)
		assert.deepEqual(logs, ["DISCORD: guild settings cache reset failed"])
	}
})

test("title cards: the top block uses the guild place for everyone, members see their own place below", async () => {
	for (const linked of [false, true]) {
		let done!: () => void
		const finished = new Promise<void>((resolve) => {
			done = resolve
		})
		const edits: unknown[] = [],
			reads: unknown[] = [],
			logs: string[] = []
		let guildReads = 0
		const response = await routeInteraction(
			{
				...interaction,
				data: {
					name: "search",
					options: [{ name: "title", value: "movie:42" }],
				},
			},
			{
				linkedUser: async () => (linked ? "member-id" : null),
				memberRead: async (_id, name) =>
					name === "get_settings"
						? { country: "GB", service_ids: [10] }
						: {
								title: { id: "movie:42", name: "Member title" },
								member: { score: 9 },
							},
				getGuild: async () => {
					guildReads++
					return { ...guild, service_ids: [] }
				},
				read: async (viewer) => {
					reads.push(viewer)
					return { title: { id: "movie:42", name: "Guest title" } }
				},
				take: async () => ({ allowed: true, store: "memory" }),
				edit: async (_app, _token, body) => {
					edits.push(body)
				},
				log: (line) => {
					logs.push(line)
					done()
				},
			},
		)
		assert.equal(response.type, 5)
		await finished
		// The top block is what Share posts: the guild's place for everyone. The member's place only fills the block below.
		assert.equal(guildReads, 1)
		assert.match(
			JSON.stringify(edits),
			/Not on a subscription service in Germany/,
		)
		assert.deepEqual(reads, [{ country: "DE", services: [] }])
		if (linked) {
			const [top, member] = (
				edits[0] as { components: { components: unknown[] }[] }
			).components
			assert.match(JSON.stringify(top), /Guest title/)
			assert.equal(
				(top as { components: unknown[] }).components.length > 0,
				true,
			)
			assert.match(JSON.stringify(member), /You rated/)
			assert.match(logs[0], /"viewer":"member"/)
		} else
			assert.equal((edits[0] as { components: unknown[] }).components.length, 1)
	}
})

test("member saved services reach discovery reads before guild defaults", async () => {
	let done!: () => void
	const finished = new Promise<void>((resolve) => {
		done = resolve
	})
	const reads: unknown[] = []
	await routeInteraction(
		{
			...interaction,
			data: {
				name: "similar",
				options: [{ name: "title", value: "movie:42" }],
			},
		},
		{
			linkedUser: async () => "member-id",
			memberRead: async () => ({ country: "GB", service_ids: [10] }),
			getGuild: async () => {
				assert.fail("member place must win over guild")
			},
			read: async (viewer) => {
				reads.push(viewer)
				return { items: [] }
			},
			take: async () => ({ allowed: true, store: "memory" }),
			edit: async () => {},
			log: () => done(),
		},
	)
	await finished
	assert.deepEqual(reads, [{ country: "GB", services: [10] }])
})

import { appOrigin } from "./oauth.server.ts"
import { commands } from "./commands.ts"
import {
	type GuestTitle,
	type GuestPerson,
	type MemberMarks,
	message,
	EPHEMERAL,
	textCard,
	titleCard,
	titleListCard,
	personCard,
} from "./cards.ts"
import {
	isTitleId,
	parseCustomId,
	parseListId,
	listCustomId,
} from "./custom-id.ts"
import { localeCountry } from "./country.ts"
import { defer, within } from "./respond.server.ts"
import { discordRest } from "./rest.server.ts"
import type { DiscoverState } from "./discover-state.server.ts"
import type { readGuestTool } from "../mcp/guest.server.ts"
import type { RateVerdict } from "../rate-limit.server.ts"
export interface Interaction {
	type: number
	application_id?: string
	token?: string
	locale?: string
	context?: number
	guild_id?: string
	message?: { flags?: number }
	user?: { id: string }
	member?: { user?: { id: string } }
	data?: {
		name?: string
		custom_id?: string
		values?: string[]
		options?: { name: string; value?: string; focused?: boolean }[]
	}
}
export interface Dependencies {
	linkedUser: (discordId: string) => Promise<string | null>
	unlink: (target: { byDiscordUserId: string }) => Promise<void>
	memberRead: (
		userId: string,
		name: "get_title" | "get_settings",
		args: Parameters<typeof readGuestTool>[3],
	) => Promise<Record<string, unknown>>

	read: typeof readGuestTool
	take: (user: string) => Promise<RateVerdict>
	edit: (app: string, token: string, body: unknown) => Promise<void>
	log: (line: string) => void
	hot?: () => Promise<GuestTitle[]>
	saveState?: (state: DiscoverState) => Promise<string>
	loadState?: (key: string) => Promise<DiscoverState | null>
}
const defaults: Required<Dependencies> = {
	linkedUser: async (id) =>
		(await import("./link.server.ts")).getLinkedUserId(id),
	unlink: async (target) => (await import("./link.server.ts")).unlink(target),
	memberRead: async (userId, name, args) => {
		const data = await (await import("../mcp/data.server.ts")).readMemberTool(
			userId,
			"https://goodwatch.app",
			name,
			args,
		)
		return name === "get_title"
			? (await import("../mcp/title-results.server.ts")).enrichTitleResults(
					userId,
					data,
					{ posters: true },
				)
			: data
	},
	read: async (...args) =>
		(await import("../mcp/guest.server.ts")).readGuestTool(...args),
	take: async (user) =>
		(await import("./limits.server.ts")).takeDiscordLimit(user),
	edit: (...args) => discordRest().editOriginal(...args),
	log: (line) => console.info(line),
	hot: async () => {
		const row = await (
			await import("../talked-about-now/start-row.server.ts")
		).getHotOnSocials()
		return (row?.titles ?? []).slice(0, 10).map((t) => ({
			id: `${t.mediaType}:${t.tmdbId}`,
			name: t.title,
			year: t.year,
		}))
	},
	saveState: async (state) =>
		(await import("./discover-state.server.ts")).saveDiscoverState(state),
	loadState: async (key) =>
		(await import("./discover-state.server.ts")).loadDiscoverState(key),
}
export async function routeInteraction(
	interaction: Interaction,
	overrides: Partial<Dependencies> = {},
) {
	const deps = { ...defaults, ...overrides }
	const start = Date.now()
	let logged = false
	let memberId: string | null = null
	const customId =
		typeof interaction.data?.custom_id === "string"
			? interaction.data.custom_id
			: ""
	const parsed = parseCustomId(customId),
		list = parseListId(customId)
	const finish = (outcome: string) => {
		if (logged) return
		logged = true
		deps.log(
			`DISCORD interaction: ${JSON.stringify({
				kind: interaction.type,
				...(interaction.type === 3
					? { action: parsed?.action ?? list?.action ?? "unknown" }
					: {
							command: commands.some((c) => c.name === interaction.data?.name)
								? interaction.data?.name
								: "unknown",
						}),
				context:
					interaction.context === 2
						? "private"
						: interaction.context === 0 || interaction.guild_id
							? "guild"
							: "dm",
				viewer: memberId ? "member" : "guest",
				duration_ms: Date.now() - start,
				outcome,
			})}`,
		)
	}
	const reply = (data: unknown, outcome = "ok", type = 4) => {
		finish(outcome)
		return { type, data }
	}
	const country = localeCountry(interaction.locale)
	const read = (
		name: Parameters<typeof readGuestTool>[2],
		args: Parameters<typeof readGuestTool>[3],
	) => deps.read({ country }, "https://goodwatch.app", name, args)
	const card = async (id: string, share = false, offers = false) => {
		// Shared copies always come from a fresh guest read, with no member context or fields.
		let personal = !share ? memberId : null
		let cardCountry = localeCountry(interaction.locale)
		let result: Awaited<ReturnType<typeof deps.read>> | null = null
		if (personal) {
			try {
				const settings = await deps.memberRead(personal, "get_settings", {})
				if (typeof settings.country === "string") cardCountry = settings.country
				result = await deps.memberRead(personal, "get_title", { title_id: id })
			} catch {
				// A failed member read falls back to the guest card.
				personal = null
				cardCountry = localeCountry(interaction.locale)
			}
		}
		result ??= await deps.read(
			{ country: cardCountry },
			"https://goodwatch.app",
			"get_title",
			{ title_id: id },
		)
		return result.title
			? titleCard(result.title as GuestTitle, cardCountry, {
					share,
					offers,
					member: personal ? (result.member as MemberMarks) : undefined,
				})
			: textCard("No matching title found. Try /search again.")
	}
	const similar = async (id: string, share = false) => {
		const result = await read("get_similar_titles", {
			title_id: id,
			limit: 10,
		})
		return titleListCard(
			"Similar titles",
			(result.items ?? []) as GuestTitle[],
			{ share, shareId: listCustomId("similar-share", id) },
		)
	}
	const person = async (id: number, share = false) => {
		const result = await read("get_person", { person_id: id, limit: 10 })
		return result.person
			? personCard(result.person as GuestPerson, share)
			: textCard("No matching person found.")
	}
	const hot = async (share = false) =>
		titleListCard("Hot on socials", await deps.hot(), {
			share,
			shareId: listCustomId("hot-share", "now"),
			url: "https://goodwatch.app/hot-on-socials",
		})
	const discover = async (key: string, page: number, share = false) => {
		const state = await deps.loadState(key)
		if (!state)
			return textCard("This discovery expired. Start again with /discover.")
		const result = await deps.read(
			{ country: state.country },
			"https://goodwatch.app",
			"discover_titles",
			{ ...state.args, cursor: `offset:${page * 10}`, limit: 10 },
		)
		return titleListCard(
			`Discover · ${state.country}`,
			(result.items ?? []) as GuestTitle[],
			{
				share,
				stateKey: key,
				page,
				next: !!result.next_cursor,
				shareId: listCustomId("discover-share", `${key}:${page}`),
			},
		)
	}
	const options = Object.fromEntries(
		(interaction.data?.options ?? []).map((o) => [o.name, o.value ?? ""]),
	)
	const resolveTitle = async (input?: string) => {
		const value = (input ?? "").trim().slice(0, 120)
		if (!value) return undefined
		if (isTitleId(value)) return value
		const result = await read("search_titles", { query: value, limit: 25 })
		const items = (result.items ?? []) as GuestTitle[]
		return (
			items.find((t) => t.name.toLowerCase() === value.trim().toLowerCase()) ??
			items[0]
		)?.id
	}
	try {
		if (interaction.type === 1) {
			finish("ok")
			return { type: 1 }
		}
		const user = interaction.member?.user?.id ?? interaction.user?.id
		if (!user)
			return reply(textCard("This interaction has no user."), "invalid")
		const verdict = await within<RateVerdict | null>(deps.take(user), 300, null)
		if (verdict === null) finish("limit_timeout")
		if (verdict && !verdict.allowed) {
			if (interaction.type === 4) return reply({ choices: [] }, "limited", 8)
			return reply(
				textCard(
					`**Slow down**\nTry again in ${verdict.retryAfterSeconds} seconds.`,
				),
				"limited",
			)
		}
		if (interaction.type === 4) {
			if (interaction.data?.name === "discover") {
				const focused = interaction.data.options?.find((o) => o.focused)
				if (!focused || !["genre", "service"].includes(focused.name))
					return reply({ choices: [] }, "unsupported", 8)
				const query = (focused.value ?? "").trim().slice(0, 120).toLowerCase()
				const filters = await within<Record<string, unknown>>(
					read("get_discover_filters", {}),
					2000,
					{},
				).catch((): Record<string, unknown> => ({}))
				const entries =
					focused.name === "genre"
						? ((filters.genres ?? []) as string[]).map((id) => ({
								name: id,
								value: id,
							}))
						: ((filters.providers ?? []) as { id: number; name: string }[]).map(
								(p) => ({ name: p.name, value: String(p.id) }),
							)
				return reply(
					{
						choices: entries
							.filter(
								(c) => query.length < 2 || c.name.toLowerCase().includes(query),
							)
							.slice(0, 25)
							.map((c) => ({ ...c, name: c.name.slice(0, 100) })),
					},
					"ok",
					8,
				)
			}
			const isPerson = interaction.data?.name === "person"
			if (
				!["search", "similar", "person"].includes(interaction.data?.name ?? "")
			)
				return reply({ choices: [] }, "unsupported", 8)
			const query = (
				interaction.data?.options?.find(
					(o) => o.name === (isPerson ? "name" : "title") && o.focused,
				)?.value ?? ""
			)
				.trim()
				.slice(0, 120)
			if (query.length < 2) return reply({ choices: [] }, "ok", 8)
			const identity = within(deps.linkedUser(user), 300, null).catch(
				() => null,
			)
			const result = await within(
				read(isPerson ? "search_people" : "search_titles", {
					query,
					limit: 25,
				}),
				2000,
				{ items: [] },
			).catch(() => ({ items: [] }))
			memberId = await identity
			const items = (result.items ?? []) as (GuestTitle & GuestPerson)[]
			return reply(
				{
					choices: items.slice(0, 25).map((t) => ({
						name: `${t.name}${t.year ? ` (${t.year})` : ""} · ${
							isPerson
								? "Person"
								: t.id.startsWith("movie:")
									? "Movie"
									: "TV show"
						}`.slice(0, 100),
						value: isPerson ? String(t.person_id) : t.id,
					})),
				},
				"ok",
				8,
			)
		}
		if (
			(interaction.type === 2 &&
				["link", "unlink"].includes(interaction.data?.name ?? "")) ||
			(interaction.type === 3 &&
				["gw:unlink:ask", "gw:unlink:yes", "gw:unlink:keep"].includes(
					interaction.data?.custom_id ?? "",
				))
		) {
			const { application_id: applicationId, token } = interaction
			if (!applicationId || !token)
				return reply(textCard("Invalid interaction."), "invalid")
			return defer(
				async () => {
					memberId = await within(deps.linkedUser(user), 300, null).catch(
						() => null,
					)
					const action = interaction.data?.custom_id
					if (action === "gw:unlink:yes") {
						await deps.unlink({ byDiscordUserId: user })
						return textCard("Your Discord account is unlinked from GoodWatch.")
					}
					if (action === "gw:unlink:keep")
						return textCard("Your GoodWatch account stays linked.")
					if (!memberId)
						return message([
							{ type: 10, content: "Link GoodWatch for personal title cards." },
							{
								type: 1,
								components: [
									{
										type: 2,
										style: 5,
										label: "Link GoodWatch",
										url: new URL("/discord/link", appOrigin()).href,
									},
								],
							},
						])
					const confirming =
						interaction.data?.name === "unlink" || action === "gw:unlink:ask"
					return message([
						{
							type: 10,
							content: confirming
								? "Unlink your GoodWatch account?"
								: "Linked to GoodWatch",
						},
						{
							type: 1,
							components: confirming
								? [
										{
											type: 2,
											style: 4,
											label: "Unlink",
											custom_id: "gw:unlink:yes",
										},
										{
											type: 2,
											style: 2,
											label: "Keep",
											custom_id: "gw:unlink:keep",
										},
									]
								: [
										{
											type: 2,
											style: 2,
											label: "Unlink",
											custom_id: "gw:unlink:ask",
										},
									],
						},
					])
				},
				(body) => deps.edit(applicationId, token, body),
				finish,
			)
		}
		if (
			interaction.type === 2 &&
			commands.some((c) => c.name === interaction.data?.name)
		) {
			if (!interaction.application_id || !interaction.token)
				return reply(textCard("Invalid interaction."), "invalid")
			return defer(
				async () => {
					memberId = await within(deps.linkedUser(user), 300, null).catch(
						() => null,
					)
					switch (interaction.data?.name) {
						case "search":
						case "similar": {
							const id = await resolveTitle(options.title ?? "")
							return id
								? interaction.data.name === "similar"
									? similar(id)
									: card(id)
								: textCard("No matching title found. Try another title.")
						}
						case "person": {
							const name = (options.name ?? "").trim().slice(0, 120)
							if (!name) return textCard("No matching person found.")
							let id = /^[1-9]\d{0,9}$/.test(name) ? Number(name) : 0
							if (!id) {
								const result = await read("search_people", {
									query: name,
									limit: 25,
								})
								const people = (result.items ?? []) as GuestPerson[]
								id =
									(
										people.find(
											(p) => p.name.toLowerCase() === name.toLowerCase(),
										) ?? people[0]
									)?.person_id ?? 0
							}
							return id ? person(id) : textCard("No matching person found.")
						}
						case "hot":
							return hot()
						case "discover": {
							const args: Parameters<typeof readGuestTool>[3] = {
								for_you: false,
							}
							if (options.type && options.type !== "any")
								args.type = options.type as "movie" | "show"
							if (options.mood)
								args.moods = [
									options.mood as NonNullable<typeof args.moods>[number],
								]
							if (options.genre) args.genres = [options.genre]
							if (options.sort) args.order = options.sort as typeof args.order
							if (options.genre || options.service) {
								const filters = await read("get_discover_filters", {})
								if (filters.status === "data_unavailable")
									return textCard(
										"Discover is starting up. Try again in a minute.",
									)
								if (
									options.genre &&
									!(filters.genres as string[] | undefined)?.includes(
										options.genre,
									)
								)
									return textCard(
										`That genre is unavailable in ${country}. Choose a genre from /discover autocomplete.`,
									)
								if (options.service) {
									const provider = (
										filters.providers as
											| { id: number; name: string }[]
											| undefined
									)?.find((p) => String(p.id) === options.service)
									if (!provider)
										return textCard(
											`That service is unavailable in ${country}. Choose a service from /discover autocomplete.`,
										)
									args.providers = [provider.id]
								}
							}
							const key = await deps.saveState({ country, args })
							return discover(key, 0)
						}
						default:
							return textCard("Unsupported command.")
					}
				},
				(body) =>
					deps.edit(interaction.application_id ?? "", interaction.token ?? "", body),
				finish,
			)
		}
		if (interaction.type === 3 && (parsed || list)) {
			if (!interaction.application_id || !interaction.token)
				return reply(textCard("Invalid interaction."), "invalid")
			const share =
				parsed?.action === "share" || list?.action.endsWith("-share")
			const publicMessage =
				interaction.message != null &&
				!((interaction.message.flags ?? 0) & EPHEMERAL)
			return defer(
				async () => {
					memberId = await within(deps.linkedUser(user), 300, null).catch(
						() => null,
					)
					if (parsed) {
						if (parsed.action === "similar") return similar(parsed.titleId)
						return card(parsed.titleId, !!share, parsed.action === "watch")
					}
					if (list?.action === "open") {
						const id = interaction.data?.values?.[0] ?? ""
						return isTitleId(id)
							? card(id)
							: textCard("Invalid title selection.")
					}
					if (list?.action === "similar-share") return similar(list.value, true)
					if (list?.action === "person-share")
						return person(Number(list.value), true)
					if (list?.action === "hot-share") return hot(true)
					if (
						list?.action === "discover" ||
						list?.action === "discover-share"
					) {
						const [key, page] = list.value.split(":")
						return discover(key, Number(page), !!share)
					}
					return textCard("Unsupported action.")
				},
				(body) =>
					deps.edit(interaction.application_id ?? "", interaction.token ?? "", body),
				finish,
				{
					type: share || publicMessage ? 5 : 6,
					ephemeral: !share && publicMessage,
				},
			)
		}
		return reply(
			textCard(
				interaction.type === 5
					? "This form is no longer supported. Try /search."
					: "This interaction is not supported. Try /search.",
			),
			"unsupported",
		)
	} catch {
		if (interaction.type === 4) return reply({ choices: [] }, "error", 8)
		return reply(textCard("Something went wrong. Please try again."), "error")
	}
}

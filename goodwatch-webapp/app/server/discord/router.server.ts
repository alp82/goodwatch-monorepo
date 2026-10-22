import { commands } from "./commands.ts"
import { type GuestTitle, EPHEMERAL, textCard, titleCard } from "./cards.ts"
import { isTitleId, parseCustomId } from "./custom-id.ts"
import { localeCountry } from "./country.ts"
import { defer, within } from "./respond.server.ts"
import { discordRest } from "./rest.server.ts"
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
		options?: { name: string; value?: string; focused?: boolean }[]
	}
}
export interface Dependencies {
	read: typeof readGuestTool
	take: (user: string) => Promise<RateVerdict>
	edit: (app: string, token: string, body: unknown) => Promise<void>
	log: (line: string) => void
}
const defaults: Dependencies = {
	read: async (...args) =>
		(await import("../mcp/guest.server.ts")).readGuestTool(...args),
	take: async (user) =>
		(await import("./limits.server.ts")).takeDiscordLimit(user),
	edit: (...args) => discordRest().editOriginal(...args),
	log: (line) => console.info(line),
}
export async function routeInteraction(
	interaction: Interaction,
	overrides: Partial<Dependencies> = {},
) {
	const deps = { ...defaults, ...overrides }
	const start = Date.now()
	let logged = false
	const parsed = parseCustomId(
		typeof interaction.data?.custom_id === "string"
			? interaction.data.custom_id
			: "",
	)
	const finish = (outcome: string) => {
		if (logged) return
		logged = true
		deps.log(
			`DISCORD interaction: ${JSON.stringify({ kind: interaction.type, ...(interaction.type === 3 ? { action: parsed?.action ?? "unknown" } : { command: commands.some((c) => c.name === interaction.data?.name) ? interaction.data?.name : "unknown" }), context: interaction.context === 2 ? "private" : interaction.context === 0 || interaction.guild_id ? "guild" : "dm", viewer: "guest", duration_ms: Date.now() - start, outcome })}`,
		)
	}
	const reply = (data: unknown, outcome = "ok", type = 4) => {
		finish(outcome)
		return { type, data }
	}
	const country = localeCountry(interaction.locale)
	const read = (
		name: "search_titles" | "get_title",
		args: Parameters<typeof readGuestTool>[3],
	) => deps.read({ country }, "https://goodwatch.app", name, args)
	const card = async (id: string, share = false, offers = false) => {
		const result = await read("get_title", { title_id: id })
		return result.title
			? titleCard(result.title as GuestTitle, country, { share, offers })
			: textCard("No matching title found. Try /search again.")
	}
	try {
		if (interaction.type === 1) {
			finish("ok")
			return { type: 1 }
		}
		const user = interaction.member?.user?.id ?? interaction.user?.id
		if (!user)
			return reply(textCard("This interaction has no user."), "invalid")
		const verdict = await within(deps.take(user), 300, {
			allowed: false,
			store: "memory",
			retryAfterSeconds: 1,
		} as RateVerdict)
		if (!verdict.allowed) {
			if (interaction.type === 4) return reply({ choices: [] }, "limited", 8)
			return reply(
				textCard(
					`**Slow down**\nTry again in ${verdict.retryAfterSeconds} seconds.`,
				),
				"limited",
			)
		}
		if (interaction.type === 4) {
			if (interaction.data?.name !== commands[0].name)
				return reply({ choices: [] }, "unsupported", 8)
			const query =
				interaction.data.options?.find((o) => o.name === "title" && o.focused)
					?.value ?? ""
			const result = await within(
				read("search_titles", { query, limit: 25 }),
				2000,
				{ items: [] },
			).catch(() => ({ items: [] }))
			const items = (result.items ?? []) as GuestTitle[]
			return reply(
				{
					choices: items.slice(0, 25).map((t) => ({
						name: `${t.name}${t.year ? ` (${t.year})` : ""} · ${t.id.startsWith("movie:") ? "Movie" : "TV show"}`.slice(
							0,
							100,
						),
						value: t.id,
					})),
				},
				"ok",
				8,
			)
		}
		if (interaction.type === 2 && interaction.data?.name === commands[0].name) {
			if (!interaction.application_id || !interaction.token)
				return reply(textCard("Invalid interaction."), "invalid")
			const value =
				interaction.data.options?.find((o) => o.name === "title")?.value ?? ""
			return defer(
				async () => {
					let id = value
					if (!isTitleId(id)) {
						const result = await read("search_titles", {
							query: value,
							limit: 25,
						})
						const items = (result.items ?? []) as GuestTitle[]
						id =
							(
								items.find(
									(t) => t.name.toLowerCase() === value.trim().toLowerCase(),
								) ?? items[0]
							)?.id ?? ""
					}
					return id
						? card(id)
						: textCard("No matching title found. Try another title.")
				},
				(body) =>
					deps.edit(interaction.application_id!, interaction.token!, body),
				finish,
			)
		}
		if (interaction.type === 3 && parsed) {
			const result = await within(
				card(
					parsed.titleId,
					parsed.action === "share" ||
						(interaction.message != null &&
							!((interaction.message.flags ?? 0) & EPHEMERAL)),
					parsed.action === "watch",
				),
				2000,
				null,
			)
			if (!result)
				return reply(
					textCard("The search took too long. Please try again."),
					"timeout",
				)
			return reply(result, "ok", parsed.action === "watch" ? 7 : 4)
		}
		if (interaction.type === 5)
			return reply(
				textCard("This form is no longer supported. Try /search."),
				"unsupported",
			)
		return reply(
			textCard("This interaction is not supported. Try /search."),
			"unsupported",
		)
	} catch {
		if (interaction.type === 4) return reply({ choices: [] }, "error", 8)
		return reply(textCard("Something went wrong. Please try again."), "error")
	}
}

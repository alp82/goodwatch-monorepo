import { message, textCard, type Component } from "./cards.ts"
import { localeCountry } from "./country.ts"
import type { GuildSettings } from "./guild.server.ts"
import type { Dependencies, Interaction } from "./router.server.ts"
import { within } from "./respond.server.ts"
export function canManageGuild(interaction: Interaction): boolean {
	const permissions = interaction.member?.permissions
	if (
		!interaction.guild_id ||
		typeof permissions !== "string" ||
		!/^\d+$/.test(permissions)
	)
		return false
	try {
		return (BigInt(permissions) & (BigInt(32) | BigInt(8))) !== BigInt(0)
	} catch {
		return false
	}
}
export const setupUnavailable = () =>
	textCard("Server setup isn't available yet.")
type SetupDeps = Required<
	Pick<
		Dependencies,
		"getGuild" | "saveGuild" | "guildAvailable" | "countries" | "read"
	>
>
export async function setupAutocomplete(
	interaction: Interaction,
	deps: SetupDeps,
) {
	if (!canManageGuild(interaction)) return []
	const focused = interaction.data?.options?.find((o) => o.focused)
	const query = String(focused?.value ?? "")
		.toLowerCase()
		.slice(0, 120)
	const countries = await deps.countries()
	if (focused?.name === "country")
		return countries
			.filter((c) => `${c.name} ${c.code}`.toLowerCase().includes(query))
			.slice(0, 25)
			.map((c) => ({ name: c.name.slice(0, 100), value: c.code }))
	if (focused?.name !== "service") return []
	const selected = interaction.data?.options?.find(
		(o) => o.name === "country",
	)?.value
	const guild = await deps.getGuild(interaction.guild_id!)
	const country = String(
		selected ?? guild?.country ?? localeCountry(interaction.locale),
	)
	if (!countries.some((c) => c.code === country)) return []
	const filters = await deps.read(
		{ country },
		"https://goodwatch.app",
		"get_discover_filters",
		{},
	)
	return ((filters.providers ?? []) as { id: number; name: string }[])
		.filter((p) => p.name.toLowerCase().includes(query))
		.slice(0, 25)
		.map((p) => ({ name: p.name.slice(0, 100), value: String(p.id) }))
}
export async function setup(interaction: Interaction, deps: SetupDeps) {
	if (!canManageGuild(interaction))
		return textCard("You need Manage Server permission to change server setup.")
	const guildId = interaction.guild_id!
	const existing = await deps.getGuild(guildId)
	if (!deps.guildAvailable()) return setupUnavailable()
	const options = Object.fromEntries(
		(interaction.data?.options ?? []).map((o) => [
			o.name,
			o.value === undefined ? undefined : String(o.value),
		]),
	)
	const country =
		options.country ?? existing?.country ?? localeCountry(interaction.locale)
	const countries = await deps.countries()
	if (!countries.some((c) => c.code === country))
		return textCard("Choose a supported country from /setup autocomplete.")
	const filters = await within(
		deps.read({ country }, "https://goodwatch.app", "get_discover_filters", {}),
		2000,
		{ status: "data_unavailable" },
	)
	if (filters.status === "data_unavailable")
		return textCard("Services are unavailable. Try /setup again shortly.")
	const providers = (filters.providers ?? []) as { id: number; name: string }[]
	let services = existing?.service_ids ?? []
	if (options.country && country !== existing?.country)
		services = services.filter((id) => providers.some((p) => p.id === id))
	const action = interaction.data?.custom_id ?? ""
	if (action === "setup:clear") services = []
	if (/^setup:remove:[1-9]\d*$/.test(action))
		services = services.filter((id) => String(id) !== action.split(":")[2])
	if (options.service) {
		const provider = providers.find((p) => String(p.id) === options.service)
		if (!provider)
			return textCard(
				"Choose a service from /setup autocomplete for this country.",
			)
		services = [...new Set([...services, provider.id])]
	}
	const changed =
		options.country ||
		options.service ||
		action === "setup:clear" ||
		action.startsWith("setup:remove:")
	const settings: GuildSettings = {
		guild_id: guildId,
		country,
		service_ids: services,
		digest_channel_id: existing?.digest_channel_id ?? null,
		updated_by: interaction.member?.user?.id ?? interaction.user!.id,
		updated_at: Date.now(),
	}
	if (changed && !(await deps.saveGuild(settings))) return setupUnavailable()
	const page = /^setup:page:\d+$/.test(action)
		? Number(action.split(":")[2])
		: 0
	const start =
		Math.min(page, Math.max(0, Math.ceil(services.length / 15) - 1)) * 15
	const components: Component[] = [
		{
			type: 10,
			content: `## Server setup\nCountry: ${
				countries.find((c) => c.code === country)?.name
			} (${country})\n${
				services.length
					? `Services: ${services.length}`
					: "Using every service in this country."
			}${
				!existing && !changed
					? "\nRun /setup with a country or service to save settings."
					: ""
			}`,
		},
	]
	for (const id of services.slice(start, start + 15)) {
		const name = providers.find((p) => p.id === id)?.name ?? String(id)
		components.push({
			type: 1,
			components: [
				{
					type: 2,
					style: 2,
					label: `Remove ${name}`.slice(0, 80),
					custom_id: `setup:remove:${id}`,
				},
			],
		})
	}
	const buttons: Component[] = [
		{ type: 2, style: 2, label: "Clear services", custom_id: "setup:clear" },
	]
	if (start > 0)
		buttons.push({
			type: 2,
			style: 2,
			label: "Previous",
			custom_id: `setup:page:${start / 15 - 1}`,
		})
	if (start + 15 < services.length)
		buttons.push({
			type: 2,
			style: 2,
			label: "Next",
			custom_id: `setup:page:${start / 15 + 1}`,
		})
	components.push({ type: 1, components: buttons })
	return message(components)
}

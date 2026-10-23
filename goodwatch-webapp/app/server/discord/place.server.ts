import { localeCountry } from "./country.ts"
import type { GuildSettings } from "./guild.server.ts"
import type { Interaction } from "./router.server.ts"
export interface ViewerPlace {
	country: string
	services?: number[]
}
export interface PlaceDependencies {
	getGuild?: (id: string) => Promise<GuildSettings | null>
	// Linking plugs its member resolver into this seam.
	resolveMemberPlace?: (interaction: Interaction) => Promise<ViewerPlace | null>
}
export async function resolveViewerPlace(
	interaction: Interaction,
	deps: PlaceDependencies,
): Promise<ViewerPlace> {
	const member = await deps.resolveMemberPlace?.(interaction)
	if (member) return member
	const guild = interaction.guild_id
		? await deps.getGuild?.(interaction.guild_id)
		: null
	if (guild) return { country: guild.country, services: guild.service_ids }
	return { country: localeCountry(interaction.locale) }
}

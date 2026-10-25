// The logos a list row shows in its text line: only the signed-in member's own saved services that carry the title in
// their country. A guest and a member without saved services get none, so the row's logos always mean "you can watch
// it on a service you have". Read from the in-memory availability index; nothing per title touches Crate.
import { getLocaleFromRequest } from "~/server/cache-identity.server"
import { getCardServices } from "~/server/title-cards.server"
import { getUserSettings } from "~/server/user-settings.server"
import type { MediaType } from "~/types/user-data"
import { createMediaKey } from "~/types/user-data"
import { getUserIdFromRequest } from "~/utils/auth"
import { duplicateProviderMapping } from "~/utils/streaming-links"
import { titleKey } from "~/utils/title-key"

/** One of the member's services, in the shape the row logos take (`PosterService` in ui/poster-card/services). */
export interface RowService {
	id: number
	name: string
	logoPath: string | null
}

/** By media key ("movie-603"); a title on none of the member's services is left out. */
export type RowServices = Record<string, RowService[]>

/** The member's country and saved services (each with its brand's duplicates); null for a guest or none saved. */
export async function memberServices(
	request: Request,
	knownUserId?: string | null,
): Promise<{ country: string; services: number[] } | null> {
	const userId =
		knownUserId === undefined
			? await getUserIdFromRequest({ request })
			: knownUserId
	if (!userId) return null
	const settings = await getUserSettings({ userId }).catch((error) => {
		console.error("[row-services] user settings failed", error)
		return null
	})
	const saved = (settings?.streaming_providers_default ?? "")
		.split(",")
		.map(Number)
		.filter((id) => Number.isSafeInteger(id) && id > 0)
	if (!saved.length) return null
	const code = settings?.country_default?.trim().toUpperCase()
	return {
		country:
			code && /^[A-Z]{2}$/.test(code)
				? code
				: getLocaleFromRequest(request).locale.country,
		services: [
			...new Set(
				saved.flatMap((id) => [id, ...(duplicateProviderMapping[id] ?? [])]),
			),
		],
	}
}

type RowTitle = { mediaType: MediaType; tmdbId: number }

/** The member's own services per title; null for a guest or a member without saved services. */
export async function rowServices(
	request: Request,
	titles: readonly RowTitle[],
	knownUserId?: string | null,
): Promise<RowServices | null> {
	const member = await memberServices(request, knownUserId)
	return member && ownServicesOf(member, titles)
}

/** The same for a caller that knows the member's country and services (each with its brand's duplicates). */
export async function ownServicesOf(
	member: { country: string; services: readonly number[] },
	titles: readonly RowTitle[],
): Promise<RowServices> {
	if (!member.services.length || !titles.length) return {}
	const own = new Set(member.services)
	const lists = await getCardServices(
		member.country,
		titles.map((t) => titleKey(t.mediaType, t.tmdbId)),
		[...member.services],
	)
	const result: RowServices = {}
	titles.forEach((t, i) => {
		const mine = (lists[i] ?? [])
			.filter((service) => own.has(service.id))
			.map(({ id, name, logo_path }) => ({ id, name, logoPath: logo_path }))
		if (mine.length) result[createMediaKey(t.mediaType, t.tmdbId)] = mine
	})
	return result
}

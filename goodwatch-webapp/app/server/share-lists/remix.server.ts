import { getListOverview } from "./view.server.ts"
/** Only the owner may use private or imported-list contents as a new five-title card. */
export async function getRemixSource(id: string, viewerId: string | undefined) {
	const list = await getListOverview(id)
	if (
		!list ||
		((list.visibility === "private" || list.isCollection) &&
			list.userId !== viewerId)
	)
		return null
	return list
}

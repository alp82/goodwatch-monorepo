// PROTOTYPE - throwaway (prototype/explore-r5). The lab's loader: the picks of this request (the cookie `gw-lab`,
// overridden by `?lab=`), the page slot of the address, and that slot's picked variant's loader. Read-only.
import type { ConceptLoader } from "../../kit/contract"
import type { LabData } from "./contract"
import { pageSlotOf } from "./pages"
import { LAB_PARAM, cookiePicks, parsePicks } from "./picks"
import { allSlots, resolvePicks } from "./registry"
import { loaderOf } from "./registry.server"

export const load: ConceptLoader<LabData> = async (args) => {
	const lab = resolvePicks(
		cookiePicks(args.request.headers.get("Cookie")),
		parsePicks(args.url.searchParams.get(LAB_PARAM)),
	)
	const slot = pageSlotOf(args.address)
	const variant = lab.pick(slot)
	// The page first: it takes the best-known titles; a part's loader comes after and avoids them.
	const data = (await loaderOf(slot, variant)?.({ ...args, lab })) ?? null
	const parts: Record<string, unknown> = {}
	for (const part of allSlots()) {
		if (part.group !== "part" || !part.applies(args.address)) continue
		const loadPart = loaderOf(part.id, lab.pick(part.id))
		if (loadPart) parts[part.id] = await loadPart({ ...args, lab })
	}
	return { slot, variant, picks: lab.picks, data, parts }
}

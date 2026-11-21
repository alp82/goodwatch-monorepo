// PROTOTYPE - throwaway (prototype/explore-r5, slot "tray", variant "tray"). What the tray needs on every page: every
// place it can hold (to recognize a card's link and to draw its mark), and what it holds now (a cookie, so the tray is
// already there when the page arrives).
import { FAMILIES, FAMILY, type Family } from "../../../../kit/address"
import type { PlaceRef } from "../../../../kit/types"
import type { SlotLoader } from "../../contract"
import { TRAY_COOKIE } from "./slot"

export interface TrayData {
	/** Every place with a page, by "family:slug". */
	places: Record<string, PlaceRef>
	/** Path segment to family: "moods" to "mood". */
	segs: Record<string, Family>
	held: string[]
}

export const load: SlotLoader<TrayData> = async ({ kit, request }) => {
	const places: Record<string, PlaceRef> = {}
	const segs: Record<string, Family> = {}
	for (const family of FAMILIES) {
		if (family === "trait") continue
		segs[FAMILY[family].seg] = family
		for (const p of kit.members(family)) places[`${p.family}:${p.slug}`] = p
	}
	let held: string[] = []
	for (const part of (request.headers.get("cookie") ?? "").split(";")) {
		const [name, ...rest] = part.trim().split("=")
		if (name !== TRAY_COOKIE) continue
		try {
			held = decodeURIComponent(rest.join("="))
				.split(",")
				.filter((id) => places[id])
				.slice(0, 6)
		} catch {}
	}
	return { places, segs, held }
}

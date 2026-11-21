// PROTOTYPE - throwaway (prototype/explore-r5). The lab's slots and variants, found by file name. Browser-safe.
//
// Read lazily, on first use: variants import the lab's helpers, which import this file, so at module load some of
// them may not have run yet.
import type { Address } from "../../kit/address"
import type { Lab, SlotMeta, SlotVariant } from "./contract"

type AnyVariant = SlotVariant<never, never>

const metas = import.meta.glob<{ slot?: SlotMeta }>("./slots/*/slot.ts", { eager: true })
const views = import.meta.glob<{ variant?: AnyVariant }>(
	["./slots/*/*.tsx", "!./slots/*/*.test.tsx"],
	{ eager: true },
)

const folderOf = (path: string) => path.split("/slots/")[1]?.split("/")[0] ?? ""
// `r4` first, then `r4-...`, then by `order`, then by name.
const rank = (v: AnyVariant) => (v.id === "r4" ? -2 : v.id.startsWith("r4-") ? -1 : (v.order ?? 50))

let built: { slots: SlotMeta[]; bySlot: Map<string, AnyVariant[]> } | null = null
function registry() {
	if (built) return built
	const slots = Object.values(metas)
		.flatMap((m) => (m.slot ? [m.slot] : []))
		.sort(
			(a, b) =>
				(a.group === "page" ? 0 : 1) - (b.group === "page" ? 0 : 1) ||
				(a.order ?? 50) - (b.order ?? 50) ||
				a.label.localeCompare(b.label),
		)
	const bySlot = new Map<string, AnyVariant[]>()
	for (const [path, m] of Object.entries(views)) {
		if (!m.variant) continue
		const slot = folderOf(path)
		bySlot.set(slot, [...(bySlot.get(slot) ?? []), m.variant])
	}
	for (const list of bySlot.values())
		list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
	built = { slots, bySlot }
	return built
}

/** Every slot: page slots first, then part slots, each group by `order`. */
export const allSlots = (): SlotMeta[] => registry().slots

export const slotById = (id: string) => allSlots().find((s) => s.id === id)

/** A slot's variants in panel order. */
export const variantsOf = (slot: string): AnyVariant[] => registry().bySlot.get(slot) ?? []

export const variantOf = (slot: string, id: string) => variantsOf(slot).find((v) => v.id === id)

/** A slot's round 4 baseline: `r4` where it has one, else the variant that adds nothing (`none`, `auto`). */
export const baselineOf = (slot: string): string => {
	const known = variantsOf(slot)
	const has = (id: string) => known.some((v) => v.id === id)
	return has("r4") ? "r4" : has("none") ? "none" : has("auto") ? "auto" : (known[0]?.id ?? "r4")
}

export const labOf = (picks: Record<string, string>): Lab => ({
	picks,
	pick: (slot) => picks[slot] ?? slotById(slot)?.fallback ?? "r4",
})

/**
 * Every slot gets a pick: the wanted one when that variant exists (a later argument wins), else the slot's fallback,
 * else its first variant.
 */
export function resolvePicks(...wanted: Record<string, string>[]): Lab {
	const picks: Record<string, string> = {}
	for (const slot of allSlots()) {
		const known = variantsOf(slot.id)
		const has = (id: string | undefined) => Boolean(id && known.some((v) => v.id === id))
		const want = [...wanted].reverse().find((w) => has(w[slot.id]))
		picks[slot.id] =
			want?.[slot.id] ?? (has(slot.fallback) ? slot.fallback : (known[0]?.id ?? slot.fallback))
	}
	return labOf(picks)
}

/** The slots the panel offers on an address: the page slot first, then the part slots that apply. */
export const slotsFor = (address: Address): SlotMeta[] =>
	allSlots().filter((s) => s.applies(address))

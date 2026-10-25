// The Taste page's one print state: the family on show (or the strongest pulls) and the attribute in the explorer's
// detail. The hero drawing and the explorer's list share it, so picking on either marks the other.
import { useState } from "react"
import {
	CRAFT_KEYS,
	type FamilyId,
	type TasteAttribute,
	useTaste,
} from "~/ui/profile/taste/model"

export interface PrintState {
	family: FamilyId | null
	key: string
	pickFamily: (id: FamilyId | null) => void
	pickAttribute: (key: string) => void
}

/** Strongest: the ten strongest pulls and the four strongest pushes among the worded attributes. */
export function strongest(attributes: TasteAttribute[]): TasteAttribute[] {
	const worded = attributes.filter((a) => !CRAFT_KEYS.has(a.key))
	return [
		...worded
			.filter((a) => a.edge > 0)
			.sort((a, b) => b.edge - a.edge)
			.slice(0, 10),
		...worded
			.filter((a) => a.edge < 0)
			.sort((a, b) => a.edge - b.edge)
			.slice(0, 4)
			.reverse(),
	]
}

/** The explorer's rows for a family, strongest pull first, or Strongest; and the largest edge, for the bars' scale. */
export function explorerRows(
	attributes: TasteAttribute[],
	family: FamilyId | null,
) {
	const rows = family
		? attributes
				.filter((a) => a.family === family)
				.sort((a, b) => b.edge - a.edge)
		: strongest(attributes)
	const max = Math.max(...attributes.map((a) => Math.abs(a.edge)))
	return { rows, max }
}

export function usePrintState(): PrintState {
	const { taste, attributeByKey } = useTaste()
	const [family, setFamily] = useState<FamilyId | null>(null)
	const [key, setKey] = useState<string>(
		taste.identity?.keys?.[0] ?? taste.seek[0] ?? taste.attributes[0].key,
	)
	const worded = taste.attributes.filter((a) => !CRAFT_KEYS.has(a.key))
	const strongestKeys = new Set(strongest(taste.attributes).map((a) => a.key))
	return {
		family,
		key,
		pickFamily: (id) => {
			setFamily(id)
			const pool = id ? taste.attributes.filter((a) => a.family === id) : worded
			const top = [...pool].sort((a, b) => b.edge - a.edge)[0]
			if (top) setKey(top.key)
		},
		// A pick while Strongest is open stays in Strongest when the attribute is listed there.
		pickAttribute: (k) => {
			setKey(k)
			if (family === null && strongestKeys.has(k)) return
			setFamily(attributeByKey.get(k)?.family ?? null)
		},
	}
}

// The five fingerprint families (domain/fingerprint-families.ts) with their names and lines, as the taste portrait
// shows them.
import { FAMILY_KEYS, familyOf } from "~/domain/fingerprint-families"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import type { Family, FamilyId } from "./view"

const NAMES: Record<FamilyId, { name: string; line: string }> = {
	feel: { name: "Feel", line: "How it makes you feel" },
	humor: { name: "Humor", line: "What makes you laugh" },
	world: { name: "World", line: "What it's about" },
	story: { name: "Story", line: "How it's told" },
	craft: { name: "Craft", line: "How it looks and sounds" },
}

const ORDER: FamilyId[] = ["feel", "humor", "world", "story", "craft"]

/** The families, each with its keys in fingerprint order. */
export const FAMILIES: Family[] = ORDER.map((id) => ({
	id,
	...NAMES[id],
	keys: VALID_FINGERPRINT_KEYS.filter((key) => FAMILY_KEYS[id].includes(key)),
}))

// Every fingerprint key belongs to exactly one family.
const placed = ORDER.flatMap((id) => FAMILY_KEYS[id])
const unplaced = VALID_FINGERPRINT_KEYS.filter((key) => !placed.includes(key))
if (unplaced.length || new Set(placed).size !== VALID_FINGERPRINT_KEYS.length)
	throw new Error(
		`Fingerprint families don't cover the fingerprint: ${unplaced.join(", ")}`,
	)

export { familyOf }

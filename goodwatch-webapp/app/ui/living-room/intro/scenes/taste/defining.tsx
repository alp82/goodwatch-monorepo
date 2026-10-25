// The taste's four defining attributes: the strongest attribute of four families. Novelty, Absurdist Humor and
// Futuristic are the viewer type's own three ("Originality, absurdity, sci-fi"), Visual Stylization is Craft's
// strongest. Emoji and colours as the profile's Taste tab shows them (attribute emoji, family colour).
import type { FamilyId } from "~/domain/for-you-page/contract"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"
import { ATTRIBUTES, markerOf } from "./kit"

const KEYS = ["novelty", "absurdist_humor", "futuristic", "visual_stylization"]

export const DEFINING = KEYS.map((key) => {
	const a = ATTRIBUTES.find((x) => x.key === key)
	if (!a) throw new Error(`taste.json lacks ${key}`)
	return {
		key,
		label: a.label,
		emoji: a.emoji,
		color: FAMILY_COLOR[a.family as FamilyId],
		m: markerOf(key),
	}
})

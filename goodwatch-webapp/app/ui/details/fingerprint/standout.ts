// The two readings that say most about a title, for a short preview of its fingerprint (the TV's title screen).
// The rule: of the eleven readings, the ones furthest from neutral. A two-ended reading (Pace, Tone, Setting)
// counts by how far it sits from the middle, toward either end; a one-ended reading (Energy, Heart, Craft and the
// rest) by how high it reads. At most one reading per area, so the two say different things; ties go to the
// earlier reading in Feel, Story, Look order. They are shown in that order too.
import type * as F from "~/ui/fingerprint/fingerprintText"
import { SCALE_GROUPS, readScale } from "./scales"

export function standoutReadings(t: F.TitleInput, count = 2) {
	const all = SCALE_GROUPS.flatMap((g) => g.scales).map((scale, order) => {
		const { position, word } = readScale(scale, t)
		const strength = scale.fromMiddle ? Math.abs(position - 0.5) * 2 : position
		return { scale, position, word, strength, order }
	})
	const picked: typeof all = []
	for (const reading of [...all].sort(
		(a, b) => b.strength - a.strength || a.order - b.order,
	)) {
		if (picked.some((p) => p.scale.area === reading.scale.area)) continue
		picked.push(reading)
		if (picked.length === count) break
	}
	return picked.sort((a, b) => a.order - b.order)
}

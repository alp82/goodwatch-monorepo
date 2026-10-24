import type { ForYouTaste } from "~/domain/for-you-page/contract"
import type { PortraitViewer } from "~/server/taste-portrait/index.server"
import type { FingerprintView, SidesView } from "~/server/taste-portrait/view"
import { parseTitleKey } from "~/utils/title-key"

export function tasteFromPortrait(
	fingerprint: FingerprintView,
	sides: SidesView,
): ForYouTaste | null {
	if (fingerprint.status !== "ready" || sides.status === "unavailable")
		return null
	const carriers = new Set(fingerprint.attributes.flatMap((a) => a.carriers))
	const loved: ForYouTaste["loved"] = {}
	for (const key of carriers) {
		const title = fingerprint.titles[key]
		if (title && title.mine !== null && title.mine >= 8) {
			const { mediaType, tmdbId } = parseTitleKey(key)
			loved[`${mediaType}-${tmdbId}`] = {
				title: title.title,
				year: title.year,
				poster: title.poster,
				score: title.mine,
			}
		}
	}
	return {
		subject: fingerprint.subject.kind,
		attributes: fingerprint.attributes.map(
			({ key, label, family, edge, tier, carriers }) => ({
				key,
				label,
				family,
				edge,
				tier,
				carriers: carriers.map((key) => {
					const { mediaType, tmdbId } = parseTitleKey(key)
					return `${mediaType}-${tmdbId}`
				}),
			}),
		),
		groups: sides.sides.slice(0, 5).map((s) => ({
			id: s.id,
			name: s.name,
			keys: s.attributes.map((a) => a.key),
			count: s.count,
		})),
		loved,
	}
}

export async function getForYouTaste(
	who: PortraitViewer,
): Promise<ForYouTaste | null> {
	const { getTastePortrait } = await import(
		"~/server/taste-portrait/index.server"
	)
	const [fingerprint, sides] = await Promise.all([
		getTastePortrait(who, "fingerprint"),
		getTastePortrait(who, "sides"),
	])
	return tasteFromPortrait(fingerprint, sides)
}

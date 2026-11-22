import { useEffect, useMemo, useState } from "react"
import { POPULATION_MEDIANS } from "~/domain/fingerprint-effects/population-medians"
import type { CoreScores } from "~/server/utils/fingerprint"
import { printAttributes } from "./reading"

type Shape = typeof import("./Shape")

/** The text and outline are server-rendered. The detailed SVG needs its drawing code only near the section. */
export function usePrintRidges(
	near: boolean,
	scores: CoreScores | undefined,
	type: "movie" | "show",
) {
	const [shape, setShape] = useState<Shape | null>(null)
	const needed = near && !!scores
	useEffect(() => {
		if (!needed) return
		let listening = true
		void import("./Shape")
			.then((module) => {
				if (listening) setShape(module)
			})
			.catch(() => {})
		return () => {
			listening = false
		}
	}, [needed])
	const geo = useMemo(
		() =>
			needed && shape && scores
				? shape.printGeometry(printAttributes(scores, POPULATION_MEDIANS[type]))
				: null,
		[needed, scores, shape, type],
	)
	return { geo, RidgeSprite: shape?.RidgeSprite }
}

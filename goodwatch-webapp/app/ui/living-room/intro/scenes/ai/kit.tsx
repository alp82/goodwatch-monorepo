// Shared pieces of the "Use with AI" chapter: the motion helper, the title lookup, typed text and the GoodWatch logo
// plate. Everything is sized in container units for the film's stage.
import type { CSSProperties } from "react"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import type { IntroCard } from "~/ui/living-room/intro/data"
import type { IntroData } from "~/ui/living-room/intro/scene"
import "./ai.css"

/** Delay (and duration) for an `intro-ai-*` move, in ms at k = 1. */
export const at = (
	d: number,
	dur?: number,
	extra?: Record<string, string | number>,
): CSSProperties =>
	({
		"--d": `${d}ms`,
		...(dur ? { "--dur": `${dur}ms` } : {}),
		...extra,
	}) as CSSProperties

/** A title from the intro's modern shows or its pool, by name. */
export function titleOf(data: IntroData, name: string): IntroCard | null {
	const shows = data.extra.shows as IntroCard[] | undefined
	return [...(shows ?? []), ...data.pool].find((c) => c.title === name) ?? null
}

/** The widget's logo plate: G, "ood" white, "Watch" yellow. */
export function Mark({ className = "" }: { className?: string }) {
	return (
		<span className={`intro-ai-mark ${className}`}>
			<GoodWatchWordmark fontSize="1em" />
		</span>
	)
}

/** Text that types itself, word by word kept whole, a caret on the newest letter. */
export function Typed({
	text,
	start,
	per = 36,
}: { text: string; start: number; per?: number }) {
	const words = text.split(" ")
	let n = 0
	const total = [...text].length
	return (
		<span className="intro-ai-typed" aria-label={text}>
			{words.map((w, wi) => {
				const chars = [...(wi < words.length - 1 ? `${w} ` : w)]
				return (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: words of a fixed string
						key={wi}
						className="intro-ai-word"
						aria-hidden="true"
					>
						{chars.map((c) => {
							const i = n++
							return (
								<span
									key={i}
									className={`intro-ai-ch ${i === total - 1 ? "intro-ai-ch-last" : ""}`}
									style={at(start + i * per, undefined, { "--pc": `${per}ms` })}
								>
									{c === " " ? " " : c}
								</span>
							)
						})}
					</span>
				)
			})}
		</span>
	)
}

/** When the last letter of `text` lands. */
export const typedEnd = (text: string, start: number, per = 36) =>
	start + ([...text].length - 1) * per

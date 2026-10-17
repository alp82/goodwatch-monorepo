// Pieces the search scene uses: the score ring at stage size and the feeling chips.
import { type CSSProperties, useEffect, useRef, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { fingerprintChipStyle } from "~/ui/title-card/ReasonChips"

/** A CSS delay for `ms` at k = 1. */
export const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties

/** Text that types itself, a caret riding on the newest letter and blinking at the end. */
export function Typed({
	text,
	start,
	perChar = 80,
}: { text: string; start: number; perChar?: number }) {
	const chars = [...text]
	return (
		<span className="intro-search-typed" aria-label={text}>
			{chars.map((c, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed string
					key={i}
					className={`intro-search-ch ${i === chars.length - 1 ? "intro-search-ch-last" : ""}`}
					style={
						{
							"--d": `${start + i * perChar}ms`,
							"--pc": `${perChar}ms`,
						} as CSSProperties
					}
					aria-hidden="true"
				>
					{c === " " ? " " : c}
				</span>
			))}
		</span>
	)
}

/** The details page's score ring, sized to its box (which CSS sizes in container units). */
export function Ring({
	score,
	className = "",
	style,
}: { score: number | null; className?: string; style?: CSSProperties }) {
	const box = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState(0)
	useEffect(() => {
		const el = box.current
		if (!el) return
		const measure = () => setSize(Math.round(el.getBoundingClientRect().width))
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	return (
		<div ref={box} className={`intro-search-ring ${className}`} style={style}>
			{size > 0 && (
				<ScoreRing
					media={
						{
							details: { goodwatch_overall_score_normalized_percent: score },
						} as never
					}
					size={size}
					label={false}
				/>
			)}
		</div>
	)
}

/** A reading chip as the search shows it: wanted ones in their fingerprint colour, avoided ones struck through. */
export function ReadChip({
	chip,
	ms,
}: { chip: { text: string; kind: string; key?: string }; ms: number }) {
	if (chip.kind === "avoid" || chip.kind === "excluded")
		return (
			<span
				className="intro-search-chip intro-search-chip-avoid intro-search-pop"
				style={at(ms)}
			>
				{chip.key
					? getFingerprintMeta(chip.key).label
					: chip.text.replace(/^(not|low)\s+/i, "")}
			</span>
		)
	if (chip.kind === "want" && chip.key)
		return (
			<span
				className="intro-search-chip intro-search-pop"
				style={{ ...fingerprintChipStyle(chip.key), ...at(ms) }}
			>
				{getFingerprintMeta(chip.key).label}
			</span>
		)
	return (
		<span
			className="intro-search-chip intro-search-chip-attr intro-search-pop"
			style={at(ms)}
		>
			{chip.text}
		</span>
	)
}

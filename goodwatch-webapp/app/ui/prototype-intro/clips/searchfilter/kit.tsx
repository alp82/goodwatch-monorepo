// PROTOTYPE - throwaway. Helpers for the "searchfilter" intro clips: timing, typing, dealt posters, the score ring at
// stage size, and swaps (one thing replacing another at a moment). All timing is in ms at k = 1 and goes through
// `--k` in CSS.
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"
import type { SfData, SfTitle } from "~/server/prototype-intro/searchfilter.server"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { fingerprintChipStyle } from "~/ui/title-card/ReasonChips"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"

export const sfData = (data: IntroData) => (data.extra.searchfilter ?? null) as SfData | null

/** A CSS delay for `ms` at k = 1. */
export const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties

/** The search field as the site's header draws it, at stage size. `text` types itself from `start`. */
export function SearchField({
	text,
	start,
	perChar = 80,
	className = "",
}: {
	text: string
	start: number
	perChar?: number
	className?: string
}) {
	return (
		<div className={`lpc-sf-field ${className}`}>
			<svg viewBox="0 0 20 20" fill="currentColor" className="lpc-sf-glass" aria-hidden="true">
				<path
					fillRule="evenodd"
					d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
					clipRule="evenodd"
				/>
			</svg>
			<Typed text={text} start={start} perChar={perChar} />
		</div>
	)
}

/** Text that types itself, a caret riding on the newest letter and blinking at the end. */
export function Typed({ text, start, perChar = 80 }: { text: string; start: number; perChar?: number }) {
	const chars = [...text]
	return (
		<span className="lpc-sf-typed" aria-label={text}>
			{chars.map((c, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: letters of a fixed string
					key={i}
					className={`lpc-sf-ch ${i === chars.length - 1 ? "lpc-sf-ch-last" : ""}`}
					style={{ "--d": `${start + i * perChar}ms`, "--pc": `${perChar}ms` } as CSSProperties}
					aria-hidden="true"
				>
					{c === " " ? " " : c}
				</span>
			))}
		</span>
	)
}

/** When `text` has finished typing. */
export const typedEnd = (text: string, start: number, perChar = 80) => start + [...text].length * perChar

/** A poster dealt in like the sign-up wall's flip, at `ms`. */
export function Poster({ title, ms, score = false, className = "" }: { title: SfTitle; ms: number; score?: boolean; className?: string }) {
	return (
		<figure className={`lpc-sf-poster lpc-sf-deal ${className}`} style={at(ms)}>
			{title.poster ? (
				<img src={tmdbImageUrl(title.poster, "w342")} alt="" />
			) : (
				<span className="lpc-sf-noposter">{title.title}</span>
			)}
			{score && title.score != null && <span className="lpc-sf-badge">{title.score}</span>}
		</figure>
	)
}

/** The details page's score ring, sized to its box (which CSS sizes in container units). */
export function Ring({ score, className = "", style }: { score: number | null; className?: string; style?: CSSProperties }) {
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
		<div ref={box} className={`lpc-sf-ring ${className}`} style={style}>
			{size > 0 && (
				<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: score } } as never} size={size} label={false} />
			)}
		</div>
	)
}

/** A reading chip as the search shows it: wanted ones in their fingerprint colour, avoided ones struck through. */
export function ReadChip({ chip, ms }: { chip: { text: string; kind: string; key?: string }; ms: number }) {
	if (chip.kind === "avoid" || chip.kind === "excluded")
		return (
			<span className="lpc-sf-chip lpc-sf-chip-avoid lpc-sf-pop" style={at(ms)}>
				{chip.key ? getFingerprintMeta(chip.key).label : chip.text.replace(/^(not|low)\s+/i, "")}
			</span>
		)
	if (chip.kind === "want" && chip.key)
		return (
			<span className="lpc-sf-chip lpc-sf-pop" style={{ ...fingerprintChipStyle(chip.key), ...at(ms) }}>
				{getFingerprintMeta(chip.key).label}
			</span>
		)
	return (
		<span className="lpc-sf-chip lpc-sf-chip-attr lpc-sf-pop" style={at(ms)}>
			{chip.text}
		</span>
	)
}

/** The reading's chips in the search's order: wanted and attributes first, then a couple it avoids. */
export function readingChips(reading: { text: string; kind: string; key?: string }[], wants = 3, avoids = 2) {
	const w = reading.filter((c) => c.kind === "want" || c.kind === "attribute").slice(0, wants)
	const a = reading.filter((c) => c.kind === "avoid" || c.kind === "excluded").slice(0, avoids)
	return [...w, ...a]
}

/**
 * One of a series of things shown in turn in the same place: it arrives at `from` and, unless it is the last,
 * leaves at `to`. Two nested boxes, so the arrival and the leaving never fight over the same property.
 */
export function Swap({ from, to, children, className = "", kind = "rise" }: { from: number; to?: number; children: ReactNode; className?: string; kind?: "rise" | "deal" | "fade" }) {
	return (
		<span className={`lpc-sf-swap-in lpc-sf-in-${kind} ${className}`} style={at(from)}>
			{to === undefined ? children : (
				<span className={`lpc-sf-swap-out lpc-sf-out-${kind}`} style={at(to)}>
					{children}
				</span>
			)}
		</span>
	)
}

export const fmt = (n: number) => n.toLocaleString("en-US")

/** Titles with a poster, the best scored first when `byScore`. */
export function withPosters(titles: SfTitle[], n: number, byScore = false) {
	const list = titles.filter((t) => t.poster)
	if (byScore) list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
	return list.slice(0, n)
}

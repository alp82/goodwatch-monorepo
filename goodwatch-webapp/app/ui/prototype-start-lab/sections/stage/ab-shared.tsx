// PROTOTYPE (start page lab, round 2): what stage a and b share: the search-then-tap-three state (kept in
// sessionStorage), the poster fan for a mood, and the "Loved it" toggle under a real poster card.
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline"
import { HeartIcon } from "@heroicons/react/20/solid"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MOOD_BY_KEY } from "~/domain/moods"
import { type FixtureAnswer, fixtureSearch, moodAnswer, picksFrom, promptAnswer, typedSearch } from "../../lab/fixture-search"
import { tmdbImage } from "../../lab/kit"
import type { LabMood } from "~/server/prototype-start-lab.server"
import { type LabCard, type LabData, useLab } from "../../lab/types"
import { scoreRanked } from "../recs/shared"
import { leadVocab, mixAnswer, picksName } from "./jl-mixes"

export const NEED = 3

// PROTOTYPE · Round 15: "mix" is stage l/m's picker: up to three picks (mixes, moods, themes, styles, jl-mixes), with
// the stage vocabulary id of the first pick's first word (`lead`, what the room's light reads) and the picks' names.
export type Source =
	| { kind: "popular" }
	| { kind: "mood"; key: string }
	| { kind: "prompt"; q: string }
	| { kind: "typed"; q: string }
	| { kind: "mix"; ids: string[]; lead: string | null; name: string }

type Saved = { draft: string; source: Source; loved: LabCard[]; done: boolean; step?: number }

const short = (title: string) => title.replace(/:.*$/, "")
/** A mood's color (the Discover filter's swatch), gray when the site has none. */
export const moodHue = (key: string) => (MOOD_BY_KEY as Record<string, { hue: string } | undefined>)[key]?.hue ?? "#94a3b8"
/**
 * Each mood's face: three fan posters and a line of two titles, picked so no title repeats across the moods (the
 * fixtures share hits like The Odyssey between moods).
 */
export function useMoodFaces(moods: LabMood[]) {
	return useMemo(() => {
		const usedFan = new Set<number>()
		const usedName = new Set<number>()
		const out: Record<string, { fan: LabCard[]; examples: string }> = {}
		for (const m of moods) {
			const fresh = (used: Set<number>, n: number) => {
				const list = m.titles.filter((t) => !used.has(t.key)).slice(0, n)
				const pick = list.length >= n ? list : m.titles.slice(0, n)
				for (const t of pick) used.add(t.key)
				return pick
			}
			const fan = fresh(usedFan, 3)
			const names = fresh(usedName, 2)
			out[m.key] = { fan, examples: names.map((t) => short(t.title)).join(", ") }
		}
		return out
	}, [moods])
}

function answerFor(data: LabData, source: Source): FixtureAnswer | null {
	if (source.kind === "mood") return moodAnswer(data, source.key)
	if (source.kind === "prompt") return promptAnswer(data, source.q) ?? fixtureSearch(data, source.q)
	if (source.kind === "typed") return fixtureSearch(data, source.q)
	if (source.kind === "mix") return source.ids.length ? mixAnswer(data, source.ids) : null
	return null
}

/**
 * Search, then tap three: what the tray or panel shows. Typed text waits for the site's timing (reading, then
 * titles); moods and example prompts answer at once. Loved titles carry across searches. The shelves follow the
 * titles on show, and the picks once there are three.
 */
export function useStageFlow(key: string, { shelfByStep = false }: { shelfByStep?: boolean } = {}) {
	const lab = useLab()
	const { data } = lab
	const storage = `start-lab-stage-${key}`
	const popular = useMemo(() => (data.guest.popular.length ? data.guest.popular : scoreRanked(data, 18)), [data])

	const [draft, setDraft] = useState("")
	const [source, setSource] = useState<Source>({ kind: "popular" })
	const [answer, setAnswer] = useState<FixtureAnswer | null>(null)
	const [loading, setLoading] = useState(false)
	const [reading, setReading] = useState<unknown>(null)
	const [loved, setLoved] = useState<LabCard[]>([])
	const [done, setDone] = useState(false)
	const [step, setStep] = useState(0)
	const [restored, setRestored] = useState(false)
	const abort = useRef<AbortController | null>(null)
	const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Back from a title page: the same query, taps and step.
	useEffect(() => {
		try {
			const raw = sessionStorage.getItem(storage)
			if (raw) {
				const s = JSON.parse(raw) as Saved
				setDraft(s.draft ?? "")
				setSource(s.source ?? { kind: "popular" })
				setAnswer(answerFor(data, s.source ?? { kind: "popular" }))
				setLoved(Array.isArray(s.loved) ? s.loved.slice(0, NEED) : [])
				setDone(!!s.done && (s.loved?.length ?? 0) >= NEED)
				setStep(typeof s.step === "number" ? s.step : 0)
			}
		} catch {}
		setRestored(true)
	}, [storage, data])

	useEffect(() => {
		if (!restored) return
		try {
			sessionStorage.setItem(storage, JSON.stringify({ draft, source, loved, done, step } satisfies Saved))
		} catch {}
	}, [restored, storage, draft, source, loved, done, step])

	useEffect(() => () => abort.current?.abort(), [])

	const results = answer?.titles.length ? answer.titles : popular
	const picks = useMemo(() => {
		if (loved.length < NEED) return []
		const p = picksFrom(data, loved, 12)
		const keys = new Set(loved.map((c) => c.key))
		return p.length ? p : scoreRanked(data, 15).filter((c) => !keys.has(c.key)).slice(0, 12)
	}, [data, loved])

	const stop = () => {
		abort.current?.abort()
		abort.current = null
		setLoading(false)
		setReading(null)
	}

	const typed = useCallback(
		(q: string) => {
			const t = q.trim()
			stop()
			if (!t) {
				setSource({ kind: "popular" })
				setAnswer(null)
				return
			}
			setDone(false)
			setSource({ kind: "typed", q: t })
			setLoading(true)
			const ctl = new AbortController()
			abort.current = ctl
			typedSearch(data, t, { signal: ctl.signal, onReading: (r) => !ctl.signal.aborted && setReading(r) }).then((a) => {
				if (ctl.signal.aborted) return
				setAnswer(a)
				setLoading(false)
				setReading(null)
			})
		},
		[data],
	)
	const mood = useCallback(
		(k: string) => {
			stop()
			setDone(false)
			setDraft("")
			setSource({ kind: "mood", key: k })
			setAnswer(moodAnswer(data, k))
		},
		[data],
	)
	const prompt = useCallback(
		(q: string) => {
			stop()
			setDone(false)
			setDraft(q)
			setSource({ kind: "prompt", q })
			setAnswer(promptAnswer(data, q) ?? fixtureSearch(data, q))
		},
		[data],
	)
	// Round 15: the picker's picks (stage l/m); none is the empty state again.
	const mix = useCallback(
		(ids: string[]) => {
			stop()
			setDone(false)
			setDraft("")
			if (!ids.length) {
				setSource({ kind: "popular" })
				setAnswer(null)
				return
			}
			setSource({ kind: "mix", ids, lead: leadVocab(ids), name: picksName(ids) }) // Round 16: the mix by its name while whole
			setAnswer(mixAnswer(data, ids))
		},
		[data],
	)
	const clear = useCallback(() => {
		stop()
		setDraft("")
		setSource({ kind: "popular" })
		setAnswer(null)
	}, [])

	const toggleLoved = useCallback((card: LabCard) => {
		setLoved((prev) => {
			const on = prev.some((p) => p.key === card.key)
			if (!on && prev.length >= NEED) return prev
			const next = on ? prev.filter((p) => p.key !== card.key) : [...prev, card]
			if (doneTimer.current) clearTimeout(doneTimer.current)
			// A beat to see the third heart land, then the picks.
			if (next.length >= NEED) doneTimer.current = setTimeout(() => setDone(true), 450)
			return next
		})
	}, [])
	const backToResults = useCallback(() => setDone(false), [])
	const startOver = useCallback(() => {
		setDone(false)
		setLoved([])
	}, [])

	// The shelves mirror what's on show: the tray's titles or picks, or (shelfByStep) step 0 popular, 1 results, 2 picks.
	const shelf = shelfByStep
		? step === 0
			? popular
			: step === 2 && picks.length
				? picks
				: results
		: done && picks.length
			? picks
			: results
	const sig = shelf.map((c) => c.key).join(",")
	const { setShelfTitles } = lab
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the titles
	useEffect(() => {
		if (shelf.length) setShelfTitles(shelf)
	}, [sig])

	const label =
		source.kind === "popular"
			? "Popular right now"
			: source.kind === "mood"
				? (answer?.answeredAs ?? "Mood")
				: source.kind === "mix"
					? source.name
					: `“${source.q}”`
	const seeAllQ =
		source.kind === "popular" ? null : source.kind === "mood" ? (answer?.answeredAs ?? null) : source.kind === "mix" ? source.name : source.q

	return {
		data,
		draft,
		setDraft,
		source,
		answer,
		loading,
		reading,
		results,
		popular,
		label,
		seeAllQ,
		loved,
		isLoved: (c: LabCard) => loved.some((p) => p.key === c.key),
		toggleLoved,
		done,
		picks,
		backToResults,
		startOver,
		typed,
		mood,
		prompt,
		mix,
		clear,
		step,
		setStep,
	}
}

export type StageFlow = ReturnType<typeof useStageFlow>

/** Render once per stage: the fan's transforms (they spread when an `.ab-fan-host` is hovered or focused). */
export const FAN_CSS = `.ab-fan-card{transform:translateX(calc(-50% + var(--x))) rotate(var(--r));transition:transform .3s cubic-bezier(.2,.8,.2,1)}
@media (hover:hover){.ab-fan-host:hover .ab-fan-card{transform:translateX(calc(-50% + var(--x2))) rotate(var(--r2)) translateY(var(--y2))}}
.ab-fan-host:focus-visible .ab-fan-card,.ab-fan-host[aria-pressed=true] .ab-fan-card{transform:translateX(calc(-50% + var(--x2))) rotate(var(--r2)) translateY(var(--y2))}`

/** Three of a mood's posters, fanned. They spread a little on hover; transform only. */
export function PosterFan({ cards, size = 40, className = "" }: { cards: LabCard[]; size?: number; className?: string }) {
	const three = cards.slice(0, 3)
	const h = size * 1.5
	const spread = [-1, 0, 1]
	return (
		<span aria-hidden className={`relative block shrink-0 ${className}`} style={{ width: size * 2.1, height: h + 6 }}>
			{three.map((t, i) => {
				const d = spread[i] ?? 0
				return (
					<img
						key={t.key}
						src={tmdbImage(t.poster_path, "w185")}
						alt=""
						loading="lazy"
						draggable={false}
						className="ab-fan-card absolute bottom-0 left-1/2 rounded-[4px] object-cover shadow-[0_4px_10px_rgb(0_0_0/0.5)] ring-1 ring-black/40"
						style={
							{
								width: size,
								height: h,
								zIndex: d === 0 ? 3 : 1,
								transformOrigin: "50% 100%",
								"--x": `${d * size * 0.42}px`,
								"--r": `${d * 9}deg`,
								"--x2": `${d * size * 0.6}px`,
								"--r2": `${d * 14}deg`,
								"--y2": d === 0 ? "-3px" : "0px",
							} as React.CSSProperties
						}
					/>
				)
			})}
		</span>
	)
}

/** The "Loved it" toggle under a poster card. */
export function LovedButton({ on, disabled, onClick, compact }: { on: boolean; disabled?: boolean; onClick: () => void; compact?: boolean }) {
	const Icon = on ? HeartIcon : HeartOutline
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled && !on}
			aria-pressed={on}
			className={`mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-md font-semibold ring-1 ring-inset transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:opacity-35 ${compact ? "h-7 text-xs" : "h-8 text-sm"} ${on ? "bg-amber-400 text-gray-950 ring-amber-400" : "bg-white/[0.06] text-gray-200 ring-white/15 cursor-pointer can-hover:hover:bg-white/10 can-hover:hover:text-white"}`}
		>
			<Icon className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} transition-transform duration-200 ${on ? "scale-110" : "scale-100"}`} aria-hidden />
			Loved it
		</button>
	)
}

/** "1 of 3" with three small posters that fill as the guest taps. */
export function LovedCount({ loved }: { loved: LabCard[] }) {
	return (
		<span className="inline-flex items-center gap-2" aria-live="polite">
			<span className="flex gap-1" aria-hidden>
				{Array.from({ length: NEED }, (_, i) => {
					const c = loved[i]
					return (
						<span
							key={c?.key ?? `e${i}`}
							className={`relative block aspect-[2/3] w-5 overflow-hidden rounded-[3px] border ${c ? "border-amber-400" : "border-dashed border-white/30"}`}
						>
							{c ? <img src={tmdbImage(c.poster_path, "w185")} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
						</span>
					)
				})}
			</span>
			<span className="tabular-nums">
				{loved.length} of {NEED}
			</span>
		</span>
	)
}

/** React 18 has no `inert` prop; an empty string attribute does the job. */
export const inertProps = (on: boolean): Record<string, string> => (on ? { inert: "" } : {})

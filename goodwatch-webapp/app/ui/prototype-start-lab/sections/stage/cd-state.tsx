// PROTOTYPE (start page lab, round 2): what stage c and d share: the search-then-tap-three state (typed search with
// the site's timing, moods and prompts at once, loved titles, picks), kept in sessionStorage so Back restores it, and
// the mood details (hue, description, example titles).
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MOOD_BY_KEY, isMoodKey } from "~/domain/moods"
import { type FixtureAnswer, fixtureSearch, moodAnswer, picksFrom, promptAnswer, typedSearch } from "../../lab/fixture-search"
import { type LabCard, type LabData, useLab } from "../../lab/types"
import { scoreRanked } from "../recs/shared"

export const NEED = 3

export type Source = { kind: "typed" | "mood" | "prompt"; v: string }

type Saved = { draft: string; src: Source | null; loved: LabCard[]; done: boolean }

const storageKey = (key: string) => `start-lab-stage-${key}`

function load(key: string): Saved | null {
	try {
		const raw = sessionStorage.getItem(storageKey(key))
		return raw ? (JSON.parse(raw) as Saved) : null
	} catch {
		return null
	}
}

function save(key: string, s: Saved) {
	try {
		sessionStorage.setItem(storageKey(key), JSON.stringify(s))
	} catch {}
}

function answerFor(data: LabData, src: Source): FixtureAnswer | null {
	if (src.kind === "mood") return moodAnswer(data, src.v)
	if (src.kind === "prompt") return promptAnswer(data, src.v) ?? fixtureSearch(data, src.v)
	return fixtureSearch(data, src.v)
}

/** Picks for the loved titles, never empty. */
export function picksFor(data: LabData, loved: LabCard[], limit = 12): LabCard[] {
	const p = picksFrom(data, loved, limit)
	if (p.length) return p
	const keys = new Set(loved.map((t) => t.key))
	return scoreRanked(data, limit + NEED).filter((c) => !keys.has(c.key)).slice(0, limit)
}

export function useStage(key: string) {
	const { data } = useLab()
	const [draft, setDraft] = useState("")
	const [src, setSrc] = useState<Source | null>(null)
	const [answer, setAnswer] = useState<FixtureAnswer | null>(null)
	/** A typed search on its way: the query, and the reading once it arrives. */
	const [pending, setPending] = useState<{ q: string; reading: unknown } | null>(null)
	const [loved, setLoved] = useState<LabCard[]>([])
	const [done, setDone] = useState(false)
	const [ready, setReady] = useState(false)
	const abort = useRef<AbortController | null>(null)
	const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Back from a title page: the same query and taps, answered at once.
	useEffect(() => {
		const s = load(key)
		if (s) {
			setDraft(s.draft ?? "")
			setSrc(s.src)
			setAnswer(s.src ? answerFor(data, s.src) : null)
			setLoved(s.loved ?? [])
			setDone(!!s.done && (s.loved?.length ?? 0) >= NEED)
		}
		setReady(true)
	}, [key, data])

	// Only after the restore has rendered, so the first (empty) render never overwrites what was kept.
	useEffect(() => {
		if (ready) save(key, { draft, src, loved, done })
	}, [ready, key, draft, src, loved, done])

	useEffect(
		() => () => {
			abort.current?.abort()
			if (doneTimer.current) clearTimeout(doneTimer.current)
		},
		[],
	)

	const typed = useCallback(
		(q: string) => {
			abort.current?.abort()
			const text = q.trim()
			if (!text) {
				setPending(null)
				setSrc(null)
				setAnswer(null)
				return
			}
			const ctl = new AbortController()
			abort.current = ctl
			setPending({ q: text, reading: null })
			typedSearch(data, text, {
				signal: ctl.signal,
				onReading: (reading) => setPending((p) => (p && p.q === text ? { ...p, reading } : p)),
			}).then((a) => {
				if (ctl.signal.aborted) return
				setPending(null)
				setSrc({ kind: "typed", v: text })
				setAnswer(a)
			})
		},
		[data],
	)

	const mood = useCallback(
		(k: string) => {
			abort.current?.abort()
			setPending(null)
			setDraft("")
			if (src?.kind === "mood" && src.v === k) {
				setSrc(null)
				setAnswer(null)
				return
			}
			const s: Source = { kind: "mood", v: k }
			setSrc(s)
			setAnswer(answerFor(data, s))
		},
		[data, src],
	)

	const prompt = useCallback(
		(q: string) => {
			abort.current?.abort()
			setPending(null)
			setDraft(q)
			const s: Source = { kind: "prompt", v: q }
			setSrc(s)
			setAnswer(answerFor(data, s))
		},
		[data],
	)

	const clear = useCallback(() => {
		abort.current?.abort()
		setPending(null)
		setDraft("")
		setSrc(null)
		setAnswer(null)
	}, [])

	const toggleLove = useCallback(
		(card: LabCard) => {
			if (done) return
			setLoved((prev) => {
				const on = prev.some((p) => p.key === card.key)
				if (!on && prev.length >= NEED) return prev
				const next = on ? prev.filter((p) => p.key !== card.key) : [...prev, card]
				if (doneTimer.current) clearTimeout(doneTimer.current)
				// A beat to see the third heart land, then the picks.
				if (next.length >= NEED) doneTimer.current = setTimeout(() => setDone(true), 550)
				return next
			})
		},
		[done],
	)

	const restart = useCallback(() => {
		if (doneTimer.current) clearTimeout(doneTimer.current)
		setDone(false)
		setLoved([])
	}, [])

	const popular = useMemo(() => {
		const list = data.guest.popular.length ? data.guest.popular : data.guest.topRated
		return list.slice(0, 16)
	}, [data])
	const results = answer?.titles ?? popular
	const picks = useMemo(() => (done ? picksFor(data, loved, 16) : []), [done, loved, data])
	const lovedKeys = useMemo(() => new Set(loved.map((c) => c.key)), [loved])

	return {
		data,
		/** The kept state has been restored (after mount). */
		ready,
		draft,
		setDraft,
		src,
		answer,
		pending,
		results,
		/** Popular titles before any search. */
		isPopular: !answer,
		loved,
		lovedKeys,
		done,
		picks,
		typed,
		mood,
		prompt,
		clear,
		toggleLove,
		restart,
	}
}

export type StageState = ReturnType<typeof useStage>

export type MoodInfo = { key: string; name: string; description: string; hue: string; titles: LabCard[]; examples: string }

const short = (title: string) => title.replace(/:.*$/, "")

/** The lab's moods with the site's names, hues and descriptions, and a short line of example titles. */
export function useMoods(): MoodInfo[] {
	const { data } = useLab()
	return useMemo(
		() =>
			data.guest.moods.map((m) => {
				const site = isMoodKey(m.key) ? MOOD_BY_KEY[m.key] : null
				return {
					key: m.key,
					name: site?.name ?? m.label,
					description: site?.description ?? "",
					hue: site?.hue ?? "#fbbf24",
					titles: m.titles,
					examples: m.titles
						.slice(0, 3)
						.map((t) => short(t.title))
						.join(", "),
				}
			}),
		[data],
	)
}

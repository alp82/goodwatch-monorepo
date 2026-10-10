// PROTOTYPE - throwaway (#369). One store per show, kept in localStorage. No request leaves the page.
import { type ReactNode, createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import {
	type Derived,
	EMPTY,
	type Ep,
	type Origin,
	STATUS_LABEL,
	type Scenario,
	type Season,
	type Show,
	type State,
	type Status,
	type When,
	derive,
	epCode,
	isAired,
	mark,
	plural,
	rate,
	redate,
	scenario,
	setStatus,
	toggleHidden,
	toggleSeen,
	toggleWant,
	unmark,
	unwatchedUpTo,
} from "./model"

/** The id of round 2's score control, which turns into the rate prompt. */
export const SCORE_ANCHOR = "gw-prototype-score"

export type VariantKey = "A" | "B" | "C"

/** How each variant handles bulk marks and "watched up to here". */
export const FLOW = {
	A: { bulk: "ask", upTo: "menu" },
	B: { bulk: "apply", upTo: "offer" },
	C: { bulk: "ask", upTo: "inline" },
} as const

export interface ToastAction {
	label: string
	run: () => void
}
interface Toast {
	id: number
	text: string
	actions: ToastAction[]
}
export interface BulkRequest {
	title: string
	eps: Ep[]
	origin: Origin
	/** "redate" changes the date of watches a bulk mark already made. */
	mode: "mark" | "redate"
}

interface Store {
	show: Show
	today: string
	variant: VariantKey
	st: State
	d: Derived
	allBulk: boolean
	setAllBulk: (v: boolean) => void
	toast: Toast | null
	closeToast: () => void
	dialog: BulkRequest | null
	closeDialog: () => void
	confirmDialog: (when: When) => void
	sheet: boolean
	setSheet: (open: boolean) => void
	markOne: (ep: Ep, when?: When) => void
	unmarkOne: (ep: Ep) => void
	setWhen: (ep: Ep, when: When) => void
	upTo: (ep: Ep) => void
	markSeason: (season: Season) => void
	unmarkSeason: (season: Season) => void
	seen: () => void
	status: (status: Status) => void
	want: () => void
	hide: () => void
	rate: (score: number | null) => void
	dismissRate: () => void
	load: (name: Scenario) => void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => {
	const s = useContext(Ctx)
	if (!s) throw new Error("no store")
	return s
}

const now = (): When => ({ kind: "moment", at: new Date().toISOString() })

export function StoreProvider({
	show,
	today,
	variant,
	initial,
	children,
}: {
	show: Show
	today: string
	variant: VariantKey
	/** A scenario from the URL wins over what localStorage holds. */
	initial: Scenario | null
	children: ReactNode
}) {
	const key = `gw-prototype-episode-list:${show.id}`
	const [st, setSt] = useState<State>(EMPTY)
	const [ready, setReady] = useState(false)
	const [allBulk, setAllBulk] = useState(true)
	const [toast, setToast] = useState<Toast | null>(null)
	const [dialog, setDialog] = useState<BulkRequest | null>(null)
	const [sheet, setSheet] = useState(false)
	const stRef = useRef(st)
	stRef.current = st

	useEffect(() => {
		let stored: State | null = null
		try {
			stored = JSON.parse(localStorage.getItem(key) ?? "null")
		} catch {}
		// A transition, because the page around it may still be hydrating.
		startTransition(() => {
			setSt(initial ? scenario(show, today, initial) : (stored ?? EMPTY))
			setReady(true)
		})
	}, [key])
	useEffect(() => {
		if (!ready) return
		try {
			localStorage.setItem(key, JSON.stringify(st))
		} catch {}
	}, [st, ready, key])
	useEffect(() => {
		if (!toast) return
		const t = setTimeout(() => setToast(null), 9000)
		return () => clearTimeout(t)
	}, [toast])

	const say = useCallback((text: string, actions: ToastAction[] = []) => setToast({ id: Date.now(), text, actions }), [])
	/** Applies a change and offers Undo, which puts the whole state back. */
	const change = useCallback(
		(next: State, text: string, actions: ToastAction[] = []) => {
			const before = stRef.current
			setSt(next)
			say(text, [...actions, { label: "Undo", run: () => {
						setSt(before)
						setToast(null)
					} }])
		},
		[say],
	)

	const store = useMemo<Store>(() => {
		const d = derive(show, st, today)
		const flow = FLOW[variant]
		const bulk = (request: BulkRequest) => {
			const eps = request.eps.filter((e) => isAired(e, today) && !st.watches[e.id])
			if (!eps.length) return
			if (flow.bulk === "ask") return setDialog({ ...request, eps })
			// Variant B: mark at once with no date, and offer the date afterwards.
			change(mark(show, st, today, eps, { kind: "unknown" }, request.origin, `${request.title}: ${plural(eps.length, "bulk watch")}, date unknown`), `${plural(eps.length, "episode")} marked, date unknown`, [
				{ label: "Set a date", run: () => {
						setDialog({ ...request, eps, mode: "redate" })
						setToast(null)
					} },
			])
		}
		return {
			show,
			today,
			variant,
			st,
			d,
			allBulk,
			setAllBulk,
			toast,
			closeToast: () => setToast(null),
			dialog,
			closeDialog: () => setDialog(null),
			confirmDialog: (when) => {
				if (!dialog) return
				const word = when.kind === "unknown" ? "date unknown" : when.kind === "day" ? when.day : "now"
				const line = `${dialog.title}: ${plural(dialog.eps.length, "bulk watch")}, ${word}`
				if (dialog.mode === "redate") setSt(redate(st, dialog.eps, when, line))
				else change(mark(show, st, today, dialog.eps, when, dialog.origin, line), `${plural(dialog.eps.length, "episode")} marked as watched`)
				setDialog(null)
			},
			sheet,
			setSheet,
			markOne: (ep, when = now()) => {
				const special = !show.seasons.some((s) => s.number > 0 && s.episodes.includes(ep))
				const next = mark(show, st, today, [ep], when, "hand", `${epCode(show, ep)} watched, ${when.kind === "moment" ? "now" : when.kind === "day" ? when.day : "date unknown"}`)
				const earlier = special ? [] : unwatchedUpTo(show, next, today, ep)
				const actions: ToastAction[] =
					flow.upTo === "offer" && earlier.length
						? [
								{
									label: `Mark ${plural(earlier.length, "earlier episode")} too`,
									run: () =>
										change(
											mark(show, next, today, earlier, { kind: "unknown" }, "upto", `Up to ${epCode(show, ep)}: ${plural(earlier.length, "bulk watch")}, date unknown`),
											`${plural(earlier.length, "earlier episode")} marked, date unknown`,
											[{ label: "Set a date", run: () => {
						setDialog({ title: `Up to ${epCode(show, ep)}`, eps: earlier, origin: "upto", mode: "redate" })
						setToast(null)
					} }],
										),
								},
							]
						: []
				const after = derive(show, next, today)
				const text = special
					? `${ep.name} watched. Specials don't count toward your progress.`
					: after.through && !after.airing && !d.through
						? `You've watched all of ${show.name}. It's in your Seen titles.`
						: after.caughtUp
							? `Caught up. ${after.upcoming?.air_date ? `Next episode airs ${after.upcoming.air_date}.` : ""}`
							: `${epCode(show, ep)} marked as watched`
				// Round 2 (/prototype/episode-list-2): the page's one score control carries the prompt, so the toast points
				// at it. Round 1 has no such element and gets no extra action.
				const score = typeof document === "undefined" ? null : document.getElementById(SCORE_ANCHOR)
				if (score && after.ratePrompt && !d.ratePrompt)
					actions.push({ label: "Rate it", run: () => {
						setSheet(false)
						setToast(null)
						requestAnimationFrame(() => score.scrollIntoView({ behavior: "smooth", block: "center" }))
					} })
				change(next, text, actions)
			},
			unmarkOne: (ep) => change(unmark(show, st, today, [ep], `${epCode(show, ep)} watch removed`), `${epCode(show, ep)} is unwatched again`),
			setWhen: (ep, when) => setSt(redate(st, [ep], when, `${epCode(show, ep)} date: ${when.kind === "moment" ? "now" : when.kind === "day" ? when.day : "unknown"}`)),
			upTo: (ep) => bulk({ title: `Up to ${epCode(show, ep)}`, eps: unwatchedUpTo(show, st, today, ep), origin: "upto", mode: "mark" }),
			markSeason: (season) => bulk({ title: season.number === 0 ? "Specials" : `Season ${season.number}`, eps: season.episodes, origin: "season", mode: "mark" }),
			unmarkSeason: (season) => {
				const eps = season.episodes.filter((e) => st.watches[e.id])
				change(unmark(show, st, today, eps, `Season ${season.number}: ${plural(eps.length, "watch")} removed`), `${plural(eps.length, "watch")} removed`)
			},
			seen: () => {
				if (!st.seenMarked && st.score != null) return say("You scored it, so it counts as Seen. Clear your score to change that. A score marks no episodes.")
				const next = toggleSeen(show, st, today, allBulk)
				const kept = Object.keys(next.watches).length
				change(
					next,
					st.seenMarked
						? next.seenMarked
							? "You marked every episode yourself, so the show is still Seen. Unmark episodes in the list."
							: `${next.score != null ? "Bulk watches removed. Still Seen, because you scored it" : "Seen removed"}${kept ? `. ${plural(kept, "watch")} you marked yourself stay.` : ""}`
						: `Seen: ${plural(derive(show, next, today).watched.length, "episode")} watched, date unknown`,
				)
			},
			status: (status) => {
				const next = setStatus(show, st, today, status)
				change(next, next.status === "dropped" ? `${show.name} is dropped and hidden from your recommendations` : next.status ? `${show.name}: ${STATUS_LABEL[next.status]}` : "Status removed")
			},
			want: () => setSt(toggleWant(show, st, today)),
			hide: () => change(toggleHidden(st), st.hidden ? `${show.name} is back in your recommendations` : `${show.name} is hidden from your recommendations`),
			rate: (score) => setSt(rate(st, score)),
			dismissRate: () => setSt({ ...st, rateDismissed: true }),
			load: (name) => {
				setSt(scenario(show, today, name))
				setToast(null)
			},
		}
	}, [show, today, variant, st, allBulk, toast, dialog, sheet, change, say])

	// The marks come from localStorage, so the server render has none to show.
	if (!ready) return <p className="p-8 text-gray-400">Loading the prototype…</p>
	return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

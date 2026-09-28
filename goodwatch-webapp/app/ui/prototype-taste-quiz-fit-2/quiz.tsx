// PROTOTYPE - throwaway (#220 round 2). The taste quiz inside the living room: the TV home's second tile starts
// it, the quiz runs on the TV, then tonight's picks, then the sign-up (guests) or "saved to your taste" (members).
//
// Seven ways into the quiz (?variant=) and five progressive rating controls (?rating=). Every screen has a 2D
// focus: the remote's D-pad moves left/right/up/down (the wheel and scroll step through everything in order),
// OK or a click picks. Rating screens give the D-pad's four directions their own jobs; see RATINGS below.
//
// The state keeps round 4's field names (stack, top, focus, mode, step, ok, back, lcd...) so the final Remote
// drives it unchanged, and adds `dpad` for the four edges (r6's Ring asks it first).
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import type { LRServiceButton } from "~/server/prototype-start-living-room.server"
import { GwBadge, ease } from "~/ui/prototype-start-living-room/channels"
import { Icon } from "~/ui/prototype-start-living-room/r3"
import type { PageId, Tv4 } from "~/ui/prototype-start-living-room/r4"
import { type Zapper, zapSound } from "~/ui/prototype-start-living-room/tv"
import {
	type Answer,
	BANDS,
	BY,
	type Band,
	PAIRS,
	type Pick,
	type QTitle,
	RATE_DECK,
	backdrop,
	bandOf,
	fineOf,
	hue,
	label,
	leanings,
	picksFor,
	poster,
	tasteOf,
} from "./data"

export type Variant =
	| "duel"
	| "rate"
	| "seen"
	| "warmup"
	| "shelf"
	| "live"
	| "swap"
export type Rating = "stack" | "fused" | "reveal" | "dpad" | "after"
export type As = "guest" | "new" | "me"

export const VARIANTS: Record<
	Variant,
	{ name: string; tile: string; line: string; idea: string }
> = {
	duel: {
		name: "This or that",
		tile: "Find my tonight",
		line: "Five quick this-or-thats. No need to have seen them.",
		idea: "Round 1's picker: two titles from opposite ends of one axis, go with your gut. Nothing to rate.",
	},
	rate: {
		name: "Rate what you've seen",
		tile: "Rate 5, get yours",
		line: "Five titles you know, a quick score each.",
		idea: "Direct rating: one widely seen title at a time with the progressive control. Haven't seen it skips.",
	},
	seen: {
		name: "Seen it or not",
		tile: "Find my tonight",
		line: "Seen it? Score it. Not seen? Want it or not. Every card counts.",
		idea: "Hybrid: no card is wasted. Seen ones get a score; unseen ones get Want it or Not for me, which also shape the taste.",
	},
	warmup: {
		name: "Warm up, then rate",
		tile: "Find my tonight",
		line: "Three this-or-thats, then two you've seen.",
		idea: "Hybrid: the gut picks warm up with nothing to know, then two rating cards chosen to match those answers.",
	},
	shelf: {
		name: "The shelf",
		tile: "Seen any of these?",
		line: "A shelf of famous titles. Score the ones you know.",
		idea: "Hybrid: sixteen posters at once. You only touch what you've seen, and the rating opens under the poster.",
	},
	live: {
		name: "Watch it learn",
		tile: "Rate 5, get yours",
		line: "Your picks change with every score.",
		idea: "Direct rating with tonight's three picks beside it, reshuffling after every answer. The reward is visible from the first press.",
	},
	swap: {
		name: "Picks first, then sharpen",
		tile: "Tonight, sharpened",
		line: "Three picks now. Seen one? Score it and a better one slides in.",
		idea: "Hybrid, answer first: you rate the recommendations themselves. A seen or unwanted pick is swapped for a closer one.",
	},
}

export const RATINGS: Record<
	Rating,
	{ name: string; idea: string; hint: string }
> = {
	stack: {
		name: "Stacked (4 over 10)",
		idea: "The owner's sketch: Dislike, Okay, Good, Great on top, the 1-10 strip underneath at a third of the height. Each level sits exactly over its scores (1-4, 5-6, 7-8, 9-10). OK on a level gives its middle score. D-pad: left/right along a row, down drops from a level onto its scores, up goes back.",
		hint: "◀▶ level · ▼ exact",
	},
	fused: {
		name: "Fused keys",
		idea: "One key per level, and each key carries its own scores in a thin footer, a third of the key's height. Press the key for the level, or its footer for the exact score. D-pad: down steps into the footer, left/right runs straight through all ten.",
		hint: "◀▶ level · ▼ into the key",
	},
	reveal: {
		name: "Zoom in",
		idea: "Just the four levels. The level you're on shows its own two to four scores under it, and nothing else. Down zooms into them, up zooms out.",
		hint: "◀▶ level · ▼ zoom in",
	},
	dpad: {
		name: "D-pad dial",
		idea: "One meter, remote-native: left/right jumps a whole level, up/down nudges by one. Haven't seen sits just left of Dislike. The screen always shows both the word and the number.",
		hint: "◀▶ level · ▲▼ ±1",
	},
	after: {
		name: "Rough now, exact after",
		idea: "Only the four levels, and a press moves on at once. The last title stays on screen with its own few scores at a third of the height: fix it to an exact score if you care, or just keep going.",
		hint: "OK rates · ▼ fix the last one",
	},
}

const GOAL = 5
const PRESET: Record<As, Answer[]> = {
	guest: [],
	new: [
		{ key: "movie:807", kind: "score", score: 9 },
		{ key: "movie:496243", kind: "score", score: 8 },
		{ key: "movie:155", kind: "score", score: 9 },
		{ key: "show:2316", kind: "score", score: 5 },
		{ key: "movie:8966", kind: "score", score: 2 },
	],
	me: [
		{ key: "movie:807", kind: "score", score: 9 },
		{ key: "movie:496243", kind: "score", score: 8 },
		{ key: "movie:155", kind: "score", score: 9 },
		{ key: "show:2316", kind: "score", score: 5 },
		{ key: "movie:8966", kind: "score", score: 2 },
		{ key: "movie:27205", kind: "score", score: 8 },
		{ key: "show:1396", kind: "score", score: 10 },
		{ key: "movie:11036", kind: "score", score: 4 },
	],
}
const RATED_BEFORE: Record<As, number> = { guest: 0, new: 5, me: 42 }

type Scr =
	| { k: "boot" }
	| { k: "home" }
	| { k: "about" }
	| { k: "quiz" }
	| { k: "enough" }
	| { k: "picks"; quick?: boolean }
	| { k: "title"; key: string }
	| { k: "signup" }
	| { k: "welcome" }
	| { k: "taste" }

type Dir = "top" | "bottom" | "left" | "right"

// ---------------------------------------------------------------------------------------------------------
// State.

export function useQuiz(
	z: Zapper,
	variant: Variant,
	rating: Rating,
	as: As,
	_services: LRServiceButton[],
) {
	const member = as !== "guest"
	const [stack, setStack] = useState<Scr[]>([{ k: "boot" }])
	const [fv, setFv] = useState("")
	const [pulse, setPulse] = useState(0)
	const [answers, setAnswers] = useState<Answer[]>(PRESET[as])
	const preset = PRESET[as].length
	const [goal, setGoal] = useState(GOAL)
	const [open, setOpen] = useState<string | null>(null)
	const [shelfPage, setShelfPage] = useState(0)
	const [slots, setSlots] = useState<string[]>([])
	const [swapped, setSwapped] = useState<Record<number, number>>({})
	const [dial, setDial] = useState<number | string | null>(null)
	const [band, setBand] = useState<Band>(2)
	const [last, setLast] = useState<string | null>(null)
	const [note, setNote] = useState<{ id: number; text: string } | null>(null)
	const top = stack[stack.length - 1]

	useEffect(() => {
		if (z.on) return
		setStack([{ k: "boot" }])
	}, [z.on])
	useEffect(() => {
		if (!z.on || top.k !== "boot") return
		const t = setTimeout(() => nav([{ k: "home" }], "go:quiz"), 1700)
		return () => clearTimeout(t)
	}, [z.on, top.k])
	useEffect(() => {
		if (!note) return
		const t = setTimeout(() => setNote(null), 2600)
		return () => clearTimeout(t)
	}, [note])

	const click = useCallback(() => setPulse((p) => p + 1), [])
	const say = (text: string) => setNote({ id: Date.now(), text })

	// ------------------------------------------------------------- where the quiz stands
	const mine = answers.slice(preset)
	const counts = (a: Answer) =>
		variant === "duel"
			? a.kind === "duel"
			: variant === "warmup"
				? a.kind === "duel" || a.kind === "score"
				: variant === "seen" || variant === "swap"
					? a.kind !== "skip"
					: a.kind === "score"
	const progress = mine.filter(counts).length
	const duels = mine.filter((a) => a.kind === "duel").length
	const done = new Set(answers.map((a) => a.key))
	const pairIdx = PAIRS.findIndex((p) => !done.has(p.a) && !done.has(p.b))
	// Warm up: three gut picks, then the deck ordered by closeness to them.
	const deck =
		variant === "warmup"
			? [...RATE_DECK].sort((a, b) => affinity(b) - affinity(a))
			: RATE_DECK
	function affinity(k: string) {
		const w = tasteOf(answers)
		return BY[k].feel.reduce((s, f) => s + (w[f] ?? 0), 0)
	}
	const phase: "duel" | "card" | "shelf" | "swap" =
		variant === "duel" || (variant === "warmup" && duels < 3 && pairIdx >= 0)
			? "duel"
			: variant === "shelf"
				? "shelf"
				: variant === "swap"
					? "swap"
					: "card"
	const cardKey =
		phase === "card" ? (deck.find((k) => !done.has(k)) ?? null) : open
	// The shelf: sixteen famous titles, eight to a row; More titles turns the shelf by a row.
	const shelfAll = RATE_DECK.filter((k) => !PRESET[as].some((a) => a.key === k))
	const shelf = shelfAll
		.map((_, i) => shelfAll[(i + shelfPage * 8) % shelfAll.length])
		.slice(0, 16)
	// Watch it learn: the card being rated never shows among its own picks.
	const ranked = picksFor(
		answers,
		3,
		variant === "live" && phase === "card" && cardKey ? [cardKey] : [],
	)
	// Picks first: tonight is whatever three are on screen.
	const picks =
		variant === "swap" && slots.length
			? slots.map(
					(k) =>
						picksFor(answers, 40).find((p) => p.key === k) ?? {
							...BY[k],
							match: null,
							because: null,
						},
				)
			: ranked
	const acts =
		variant === "seen" || variant === "swap" ? ["nope", "want"] : ["skip"]
	const rateOpen =
		(phase === "card" && !!cardKey) ||
		(!!open && (phase === "shelf" || phase === "swap"))

	// Swap: the three on screen, refilled from the picks as they're answered.
	useEffect(() => {
		if (variant !== "swap" || slots.length) return
		setSlots(picksFor(PRESET[as]).map((p) => p.key))
	}, [variant])

	// ------------------------------------------------------------- what the D-pad moves through, per screen
	const ratingRows = (): string[][] => {
		const c = BANDS.map((_, i) => `c:${i}`)
		const f = Array.from({ length: 10 }, (_, i) => `f:${i + 1}`)
		if (rating === "dpad") return [["dial"]]
		if (rating === "reveal") return [c, fineOf(band).map((n) => `f:${n}`), acts]
		if (rating === "after") {
			const l = last ? answers.find((a) => a.key === last) : null
			return l?.kind === "score"
				? [c, fineOf(bandOf(l.score)).map((n) => `rf:${n}`), acts]
				: [c, acts]
		}
		return [c, f, acts]
	}
	const rows = (s: Scr): string[][] => {
		switch (s.k) {
			case "home":
				return [
					member
						? ["go:tonight", "go:quiz", "go:taste"]
						: ["go:quick", "go:quiz", "go:about"],
				]
			case "about":
				return [["go:quiz", "go:quick"]]
			case "quiz":
				if (phase === "duel") return [["duel:a", "duel:b"], ["duel:skip"]]
				if (phase === "shelf" && !open) {
					const r = [
						shelf.slice(0, 8).map((k) => `open:${k}`),
						shelf.slice(8, 16).map((k) => `open:${k}`),
					]
					return [...r, ["shelf:more", ...(progress >= GOAL ? ["done"] : [])]]
				}
				if (phase === "swap" && !open)
					return [slots.map((k) => `open:${k}`), ["done"]]
				if (variant === "live" && progress >= goal)
					return [...ratingRows(), ["done"]]
				return ratingRows()
			case "enough":
				return [["done", "more"]]
			case "picks": {
				const p = picks.map((x) => `t:${x.key}`)
				if (s.quick && !mine.length) return [p, ["go:quiz"]]
				return [p, member ? ["taste:open", "more"] : ["cta", "more"]]
			}
			case "title":
				return [[`want:${s.key}`, "back"]]
			case "signup":
				return [["su:create", "su:signin", "su:later"]]
			case "welcome":
				return [["taste:open", "go:tonight"]]
			case "taste":
				return [["go:quiz", "taste:open"]]
			default:
				return []
		}
	}
	const grid = rows(top)
	const flat = grid.flat()
	const focused = flat.includes(fv)
		? fv
		: (flat.find((v) => v === "c:2") ?? flat[0] ?? "")
	const isFocus = (v: string) => focused === v
	const focus = (v: string) => {
		setFv(v)
		if (v.startsWith("c:")) setBand(Number(v.slice(2)) as Band)
		else if (v.startsWith("f:") && rating === "reveal")
			setBand(bandOf(Number(v.slice(2))))
	}
	const hover = (v: string) => flat.includes(v) && focus(v)

	// ------------------------------------------------------------- moving
	const nav = (st: Scr[], f = "") => {
		setStack(st)
		setFv(f)
		setOpen(null)
		zapSound()
	}
	const go = (s: Scr, f = "") =>
		nav([...stack.filter((x) => x.k !== "boot"), s], f)
	const replace = (s: Scr, f = "") => nav([...stack.slice(0, -1), s], f)
	const back = () => {
		if (open) return setOpen(null), setFv(`open:${open}`)
		if (stack.length > 1 && top.k !== "home") {
			setStack((st) => st.slice(0, -1))
			setFv("")
		}
	}
	const home = () => nav([{ k: "home" }], "go:quiz")

	const step = (d: 1 | -1) => {
		click()
		const i = flat.indexOf(focused)
		if (flat.length) focus(flat[(i + d + flat.length) % flat.length])
	}
	const dialStops: (string | number)[] = [
		...acts,
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
	]
	function dialMove(dir: Dir) {
		const p = dial
		if (dir === "left" || dir === "right") {
			const d = dir === "right" ? 1 : -1
			if (p == null) return setDial(d > 0 ? BANDS[2].pick : BANDS[1].pick)
			if (typeof p === "string") {
				const i = acts.indexOf(p) + d
				return setDial(i < 0 ? p : i >= acts.length ? BANDS[0].pick : acts[i])
			}
			const b = bandOf(p) + d
			return setDial(b < 0 ? acts[acts.length - 1] : b > 3 ? p : BANDS[b].pick)
		}
		const d = dir === "top" ? 1 : -1
		if (p == null || typeof p === "string") return setDial(d > 0 ? 1 : 10)
		setDial(Math.max(1, Math.min(10, p + d)))
	}
	// The four edges. Rows: left/right along, up/down across (a level drops onto its own scores).
	const dpad = (dir: Dir) => {
		if (!z.on) return z.setOn(true), true
		click()
		if (focused === "dial") return dialMove(dir), true
		const r = grid.findIndex((row) => row.includes(focused))
		if (r < 0) return true
		const row = grid[r]
		const c = row.indexOf(focused)
		if (dir === "left" || dir === "right") {
			const d = dir === "right" ? 1 : -1
			if (row[c + d]) focus(row[c + d])
			else if (rating === "fused" && focused.startsWith("f:"))
				focus(`f:${Math.max(1, Math.min(10, Number(focused.slice(2)) + d))}`)
			return true
		}
		const nr = r + (dir === "bottom" ? 1 : -1)
		const next = grid[nr]
		if (!next) return true
		const link =
			focused.startsWith("c:") && dir === "bottom"
				? (next.find(
						(v) => v === `f:${BANDS[Number(focused.slice(2))].pick}`,
					) ?? next[0])
				: focused.startsWith("f:") && dir === "top"
					? `c:${bandOf(Number(focused.slice(2)))}`
					: null
		focus(
			link && next.includes(link)
				? link
				: next[
						Math.round((c / Math.max(1, row.length - 1)) * (next.length - 1))
					],
		)
		return true
	}

	// ------------------------------------------------------------- answering
	const answer = (a: Answer) => {
		const next = [...answers.filter((x) => x.key !== a.key), a]
		setAnswers(next)
		const counted = next.slice(preset).filter(counts).length
		setDial(null)
		if (a.kind === "score") setLast(a.key)
		if (phase === "shelf") {
			setOpen(null)
			setFv(`open:${a.key}`)
		} else if (phase === "swap") {
			setOpen(null)
			const i = slots.indexOf(a.key)
			if (a.kind !== "want" && i >= 0) {
				const fresh = picksFor(next, 1, slots)[0]
				if (fresh) {
					setSlots((s) => s.map((k, j) => (j === i ? fresh.key : k)))
					setSwapped((w) => ({ ...w, [i]: (w[i] ?? 0) + 1 }))
					setFv(`open:${fresh.key}`)
				}
			} else setFv(`open:${a.key}`)
		} else if (a.kind === "score" && rating !== "after" && rating !== "dpad")
			setFv("c:2")
		zapSound()
		if (
			counted >= goal &&
			counted - 1 < goal &&
			variant !== "live" &&
			variant !== "shelf" &&
			variant !== "swap"
		)
			replace({ k: "enough" }, "done")
	}
	const rate = (key: string | null, s: number) =>
		key && answer({ key, kind: "score", score: s })
	const refine = (n: number) => {
		if (!last) return
		setAnswers((as) =>
			as.map((a) =>
				a.key === last && a.kind === "score" ? { ...a, score: n } : a,
			),
		)
		say(`${BY[last].title}: ${n}, ${label(n)}`)
	}

	const run = (v: string) => {
		click()
		const key = cardKey
		if (v === "go:quiz") {
			if (
				phase !== "swap" &&
				variant !== "shelf" &&
				!cardKey &&
				phase !== "duel"
			)
				return say("That's every title in this prototype.")
			return go(
				{ k: "quiz" },
				phase === "duel"
					? "duel:a"
					: phase === "shelf" || phase === "swap"
						? ""
						: rating === "dpad"
							? "dial"
							: "c:2",
			)
		}
		if (v === "go:quick") return go({ k: "picks", quick: true })
		if (v === "go:tonight") return go({ k: "picks" })
		if (v === "go:about") return go({ k: "about" })
		if (v === "go:taste") return go({ k: "taste" })
		if (v.startsWith("c:")) return rate(key, BANDS[Number(v.slice(2))].pick)
		if (v.startsWith("f:")) return rate(key, Number(v.slice(2)))
		if (v.startsWith("rf:")) return refine(Number(v.slice(3)))
		if (v === "dial") {
			if (dial == null) return say("Left or right picks a level first.")
			if (typeof dial === "string") return run(dial)
			return rate(key, dial)
		}
		if (v === "skip" || v === "want" || v === "nope")
			return key && answer({ key, kind: v })
		if (v.startsWith("duel:")) {
			const p = PAIRS[pairIdx]
			if (!p) return
			const side = v.slice(5)
			if (side === "skip") return answer({ key: p.a, kind: "skip" })
			return answer({
				key: side === "a" ? p.a : p.b,
				kind: "duel",
				other: side === "a" ? p.b : p.a,
			})
		}
		if (v.startsWith("open:")) {
			setOpen(v.slice(5))
			setDial(null)
			setFv(rating === "dpad" ? "dial" : "c:2")
			return
		}
		if (v === "shelf:more") return setShelfPage((p) => p + 1), setFv("")
		if (v === "done") return replace({ k: "picks" })
		if (v === "more") {
			setGoal((g) => Math.max(g, progress) + 5)
			const f =
				phase === "duel"
					? "duel:a"
					: phase === "card"
						? rating === "dpad"
							? "dial"
							: "c:2"
						: ""
			return top.k === "quiz"
				? undefined
				: top.k === "enough"
					? replace({ k: "quiz" }, f)
					: go({ k: "quiz" }, f)
		}
		if (v.startsWith("t:"))
			return go({ k: "title", key: v.slice(2) }, `want:${v.slice(2)}`)
		if (v.startsWith("want:")) {
			const k = v.slice(5)
			setAnswers((as) => [
				...as.filter((a) => a.key !== k),
				{ key: k, kind: "want" },
			])
			return say(
				member ? "On your Wishlist." : "Saved on this TV. An account keeps it.",
			)
		}
		if (v === "back") return back()
		if (v === "bar:home") return home()
		if (v === "cta") return go({ k: "signup" }, "su:create")
		if (v === "su:create") return replace({ k: "welcome" }, "taste:open")
		if (v === "su:signin")
			return say(
				"Prototype: sign-in opens here, then the answers merge into the account.",
			)
		if (v === "su:later") return back()
		if (v === "taste:open")
			return say("Prototype: this opens Taste with the new ratings in.")
	}
	const pick = (el: HTMLElement) => run(el.dataset.pick ?? "")
	const ok = () => {
		if (!z.on) return z.setOn(true)
		if (focused) run(focused)
	}

	// The remote's feature keys: Taste opens its glimpse here, the others aren't part of this round.
	const openPage = (id: PageId) => {
		click()
		if (id === "taste") return go({ k: "taste" }, "go:quiz")
		say("Not part of this prototype: the quiz, picks, and sign-up are.")
	}
	const pickMode = (_m: "mood" | "search") => (
		click(),
		say("Not part of this prototype: the quiz, picks, and sign-up are.")
	)

	// ------------------------------------------------------------- the remote's screen
	const lcd = ((): [string, string] => {
		const v = focused
		const hint =
			top.k === "quiz" && rateOpen
				? RATINGS[rating].hint
				: "◀▶▲▼ move · OK picks"
		if (top.k === "boot") return ["Starting…", "GoodWatch"]
		if (v === "dial")
			return [
				dial == null
					? "Pick a level"
					: typeof dial === "string"
						? ACT[dial]
						: `${dial} ${BANDS[bandOf(dial)].name}`,
				hint,
			]
		if (v.startsWith("c:")) {
			const b = BANDS[Number(v.slice(2))]
			return [`${b.name} (${b.pick})`, hint]
		}
		if (v.startsWith("f:") || v.startsWith("rf:")) {
			const n = Number(v.split(":")[1])
			return [`${n} ${label(n)}`, hint]
		}
		if (v in ACT) return [ACT[v], hint]
		if (v.startsWith("open:") || v.startsWith("t:"))
			return [BY[v.split(":").slice(1).join(":")]?.title ?? "Title", hint]
		const names: Record<string, string> = {
			"go:quick": "Just show me",
			"go:quiz": member ? "Rate a few more" : VARIANTS[variant].tile,
			"go:about": "What is GoodWatch?",
			"go:tonight": "Tonight, for you",
			"go:taste": "Your taste",
			"duel:a": PAIRS[pairIdx]?.left ?? "This one",
			"duel:b": PAIRS[pairIdx]?.right ?? "That one",
			"duel:skip": "Skip",
			done: "Show my picks",
			more: "Rate more",
			cta: "Keep my taste",
			"shelf:more": "More titles",
			"su:create": "Create account",
			"su:signin": "Sign in",
			"su:later": "Not now",
			"taste:open": "Open Taste",
			back: "Back",
		}
		return [
			names[v] ?? (v.startsWith("want:") ? "Want to See" : "GoodWatch"),
			hint,
		]
	})()

	return {
		// Round 4's fields, read by the remote.
		stack,
		top: top as unknown as Tv4["top"],
		focus: flat.indexOf(focused),
		setFocus: () => {},
		mode: "nav" as const,
		moodIdx: 0,
		mix: { switches: {}, service: null, seeds: [], label: null },
		menu: false,
		draft: "",
		setDraft: () => {},
		query: null,
		loved: [] as string[],
		deckPage: 0,
		pulse,
		muted: false,
		setMuted: () => {},
		on: z.on,
		wake: () => z.setOn(true),
		click,
		step,
		ok,
		back,
		home,
		pickMode,
		pickService: () => (
			click(), say("Services aren't part of this prototype.")
		),
		pick,
		submit: () => {},
		startPicks: () => run("go:quiz"),
		openPage,
		openTitle: (key: string) => go({ k: "title", key }),
		okLabel: "OK",
		country: "US",
		lcd,
		// This round's own.
		dpad,
		scr: top,
		variant,
		rating,
		as,
		member,
		answers,
		mine,
		progress,
		goal,
		phase,
		pairIdx,
		cardKey,
		open,
		shelf,
		slots,
		swapped,
		picks,
		acts,
		dial,
		setDial,
		band,
		last,
		isFocus,
		hover,
		run,
		note,
		ratedBefore: RATED_BEFORE[as],
	}
}

export type QuizT = ReturnType<typeof useQuiz>

const ACT: Record<string, string> = {
	skip: "Haven't seen it",
	want: "Not seen: want it",
	nope: "Not for me",
}

// ---------------------------------------------------------------------------------------------------------
// The TV.

export function QuizScreen({ t }: { t: QuizT }) {
	const s = t.scr
	const key = s.k === "title" ? `t-${s.key}` : s.k
	return (
		<div
			data-flow-screen
			className="absolute inset-0 overflow-hidden bg-[#07080b] text-white"
		>
			<AnimatePresence initial={false}>
				<motion.div
					key={key}
					className="absolute inset-0"
					initial={{ opacity: 0, scale: 1.015 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.26, ease }}
				>
					{s.k === "boot" && <Boot />}
					{s.k === "home" && <Home t={t} />}
					{s.k === "about" && <About t={t} />}
					{s.k === "quiz" && <Quiz t={t} />}
					{s.k === "enough" && <Enough t={t} />}
					{s.k === "picks" && <Picks t={t} quick={!!s.quick} />}
					{s.k === "title" && <TitleScreen t={t} k={s.key} />}
					{s.k === "signup" && <SignUp t={t} />}
					{s.k === "welcome" && <Welcome t={t} />}
					{s.k === "taste" && <Taste t={t} />}
				</motion.div>
			</AnimatePresence>
			{s.k !== "boot" && s.k !== "home" && <Bar t={t} />}
			<AnimatePresence>
				{t.note && (
					<motion.div
						key={t.note.id}
						className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/95 px-5 py-2 text-[15px] font-semibold text-black shadow-2xl"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
					>
						{t.note.text}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

function Boot() {
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
			<motion.img
				src={gwLogo}
				alt=""
				className="h-16"
				initial={{ scale: 0.7, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
			/>
			<motion.div
				className="mt-5 text-[26px] font-bold tracking-[0.35em] text-white/90"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.6, duration: 0.5 }}
			>
				GOODWATCH
			</motion.div>
		</div>
	)
}

// A focusable thing on the TV, as in the `ask` flow: pointing focuses, the D-pad moves, OK or a click opens.
function F({
	t,
	v,
	className = "",
	on = "ring-amber-300 bg-white/[0.10]",
	off = "ring-white/5 bg-white/[0.04]",
	children,
	scale = 1.04,
	style,
}: {
	t: QuizT
	v: string
	className?: string
	on?: string
	off?: string
	children: ReactNode
	scale?: number
	style?: React.CSSProperties
}) {
	const f = t.isFocus(v)
	return (
		<motion.button
			type="button"
			data-pick={v}
			onMouseEnter={() => t.hover(v)}
			style={style}
			className={`relative text-left ring-2 transition-colors ${f ? on : off} ${className}`}
			animate={{ scale: f ? scale : 1 }}
			transition={{ type: "spring", stiffness: 420, damping: 32 }}
		>
			{children}
		</motion.button>
	)
}

function Head({
	title,
	line,
	eyebrow,
}: { title: string; line?: ReactNode; eyebrow?: string }) {
	return (
		<div className="absolute left-12 right-44 top-9">
			{eyebrow && (
				<div className="mb-1 text-[12px] font-bold uppercase tracking-[0.25em] text-amber-300/80">
					{eyebrow}
				</div>
			)}
			<div className="text-[34px] font-extrabold leading-none tracking-tight">
				{title}
			</div>
			{line && <div className="mt-2 text-[15px] text-white/60">{line}</div>}
		</div>
	)
}

function Backdrop({ x, dim = 0.22 }: { x?: QTitle | null; dim?: number }) {
	const src = x ? (backdrop(x) ?? poster(x, "w780")) : null
	return (
		<AnimatePresence initial={false}>
			{x && src && (
				<motion.img
					key={x.key}
					src={src}
					alt=""
					className="absolute inset-0 h-full w-full object-cover"
					initial={{ opacity: 0 }}
					animate={{ opacity: dim }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.5 }}
				/>
			)}
		</AnimatePresence>
	)
}

function Coin({ m, className = "" }: { m: number | null; className?: string }) {
	if (m == null) return null
	return (
		<span
			className={`rounded-full bg-gradient-to-b from-amber-400 to-amber-600 px-2 py-0.5 text-[13px] font-black tabular-nums text-black ring-2 ring-black/60 ${className}`}
		>
			{m}
		</span>
	)
}

function Dots({
	at,
	of,
	className = "absolute right-12 top-[92px]",
}: { at: number; of: number; className?: string }) {
	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{Array.from({ length: of }, (_, i) => (
				<span
					key={i}
					className={`h-1.5 rounded-full transition-all ${i < at ? "w-6 bg-amber-400" : i === at ? "w-6 bg-white/60" : "w-3 bg-white/20"}`}
				/>
			))}
		</div>
	)
}

function Fan({ xs, heart }: { xs: QTitle[]; heart?: boolean }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center">
			{xs.slice(0, 3).map((p, i) => (
				<div
					key={p.key}
					className="relative -mx-3 first:mt-6 last:mt-6"
					style={{
						transform: `rotate(${(i - 1) * 7}deg)`,
						zIndex: i === 1 ? 2 : 1,
					}}
				>
					<img
						src={poster(p, "w185")}
						alt=""
						className="w-[86px] rounded-lg shadow-xl ring-1 ring-white/10"
					/>
					{heart && i === 1 && (
						<span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[13px] text-black">
							♥
						</span>
					)}
				</div>
			))}
		</div>
	)
}

// The quiz tile's picture says which quiz it is.
function QuizArt({ t }: { t: QuizT }) {
	const v = t.variant
	if (v === "duel" || v === "warmup")
		return (
			<div className="absolute inset-0 flex items-center justify-center gap-3">
				<img
					src={poster(BY[PAIRS[0].a], "w185")}
					alt=""
					className="w-[78px] -rotate-6 rounded-lg shadow-xl ring-1 ring-white/10"
				/>
				<span className="text-[15px] font-bold text-white/50">or</span>
				<img
					src={poster(BY[PAIRS[0].b], "w185")}
					alt=""
					className="w-[78px] rotate-6 rounded-lg shadow-xl ring-1 ring-white/10"
				/>
			</div>
		)
	if (v === "shelf")
		return (
			<div className="absolute inset-x-5 inset-y-6 grid grid-cols-4 gap-1.5">
				{RATE_DECK.slice(0, 8).map((k, i) => (
					<div key={k} className="relative">
						<img
							src={poster(BY[k], "w92")}
							alt=""
							className={`h-full w-full rounded object-cover ${i === 2 || i === 5 ? "" : "opacity-60"}`}
						/>
						{(i === 2 || i === 5) && (
							<span
								className="absolute -right-1 -top-1 rounded-full px-1 text-[10px] font-black text-black"
								style={{ background: hue(i === 2 ? 9 : 7) }}
							>
								{i === 2 ? 9 : 7}
							</span>
						)}
					</div>
				))}
			</div>
		)
	if (v === "swap") return <Fan xs={t.picks.slice(0, 3)} />
	// A title with the four levels under it: the rating is the picture.
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
			<img
				src={poster(BY[RATE_DECK[0]], "w185")}
				alt=""
				className="w-[70px] rounded-lg shadow-xl ring-1 ring-white/10"
			/>
			<div className="flex gap-1">
				{BANDS.map((b, i) => (
					<span
						key={b.name}
						className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${i === 2 ? "text-black" : "text-white/70"}`}
						style={{ background: i === 2 ? b.hue : `${b.hue}33` }}
					>
						{b.name}
					</span>
				))}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Home: three tiles, the quiz second.

function Home({ t }: { t: QuizT }) {
	const hour = new Date().getHours()
	const hi =
		hour < 12
			? "Good morning."
			: hour < 18
				? "Good afternoon."
				: "Good evening."
	const best = [...t.picks].slice(0, 3)
	const cols: { v: string; label: string; line: string; art: ReactNode }[] =
		t.member
			? [
					{
						v: "go:tonight",
						label: "Tonight, for you",
						line: "Three picks from your taste, on your services.",
						art: <Fan xs={best} heart />,
					},
					{
						v: "go:quiz",
						label: "Rate a few more",
						line: `${t.ratedBefore} ratings so far. A few more sharpen tonight.`,
						art: <QuizArt t={t} />,
					},
					{
						v: "go:taste",
						label: "Your taste",
						line: "What you go for, and what you don't.",
						art: (
							<div className="absolute inset-0 flex flex-wrap content-center justify-center gap-1.5 px-6">
								{leanings(t.answers).map((l) => (
									<span
										key={l}
										className="rounded-full bg-pink-400/20 px-3 py-1 text-[14px] font-bold text-pink-200"
									>
										{l}
									</span>
								))}
							</div>
						),
					},
				]
			: [
					{
						v: "go:quick",
						label: "Just show me",
						line: "The best rated, right now.",
						art: <Fan xs={best} />,
					},
					{
						v: "go:quiz",
						label: VARIANTS[t.variant].tile,
						line: VARIANTS[t.variant].line,
						art: <QuizArt t={t} />,
					},
					{
						v: "go:about",
						label: "What is GoodWatch?",
						line: "One score, how it feels, where it streams.",
						art: (
							<div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle,rgba(34,197,94,0.22),transparent_65%)]">
								<GwBadge gw={85} size={70} text="text-[48px]" />
							</div>
						),
					},
				]
	return (
		<>
			<Backdrop x={best[0]} dim={0.18} />
			<Head
				eyebrow={t.member ? hi : undefined}
				title={
					t.member
						? "What's it tonight?"
						: "Let's find something good for tonight."
				}
			/>
			<div className="absolute inset-x-12 bottom-12 top-[120px] grid grid-cols-3 gap-6">
				{cols.map((c, i) => (
					<F
						key={c.v}
						t={t}
						v={c.v}
						className="flex flex-col overflow-hidden rounded-3xl"
						off={i === 1 ? "ring-amber-300/25 bg-amber-400/[0.06]" : undefined}
					>
						<div className="relative h-[200px] w-full">{c.art}</div>
						<div className="px-6 pt-2">
							<div className="text-[24px] font-extrabold leading-tight">
								{c.label}
							</div>
							<div className="mt-1 text-[15px] leading-snug text-white/60">
								{c.line}
							</div>
						</div>
					</F>
				))}
			</div>
		</>
	)
}

function About({ t }: { t: QuizT }) {
	return (
		<>
			<Head
				title="What is GoodWatch?"
				line="One score from every critic and audience, how a title feels, and where it streams tonight."
			/>
			<div className="absolute inset-x-12 top-[150px] grid grid-cols-3 gap-5 text-[15px] text-white/70">
				<div className="rounded-3xl bg-white/[0.04] p-5">
					<GwBadge gw={88} size={36} text="text-[26px]" />
					<div className="mt-3 font-bold text-white">One score</div>IMDb,
					Metacritic, Rotten Tomatoes, together.
				</div>
				<div className="rounded-3xl bg-white/[0.04] p-5">
					<div className="text-[26px] font-extrabold text-pink-300">
						Dark · Tense
					</div>
					<div className="mt-3 font-bold text-white">How it feels</div>Not just
					the genre.
				</div>
				<div className="rounded-3xl bg-white/[0.04] p-5">
					<div className="text-[26px] font-extrabold text-sky-300">Netflix</div>
					<div className="mt-3 font-bold text-white">Where it streams</div>On
					the services you have.
				</div>
			</div>
			<div className="absolute bottom-10 left-12 flex gap-3">
				<F
					t={t}
					v="go:quiz"
					className="rounded-full px-6 py-3 text-[16px] font-bold"
					on="ring-amber-300 bg-amber-400 text-black"
					off="ring-transparent bg-amber-400/90 text-black"
				>
					{VARIANTS[t.variant].tile}
				</F>
				<F
					t={t}
					v="go:quick"
					className="rounded-full px-5 py-3 text-[16px] font-semibold"
				>
					Just show me
				</F>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The quiz.

function Quiz({ t }: { t: QuizT }) {
	if (t.phase === "duel") return <Duel t={t} />
	if (t.phase === "shelf") return <Shelf t={t} />
	if (t.phase === "swap") return <Swap t={t} />
	if (t.variant === "live") return <Live t={t} />
	return <Card t={t} />
}

const eyebrowOf = (t: QuizT) =>
	t.variant === "warmup"
		? "Now two you've seen"
		: t.member
			? `Sharpen your taste · ${t.ratedBefore + t.progress} ratings`
			: t.variant === "seen"
				? "Seen it? Score it. Not seen? Say if you want it."
				: "Rate what you've seen"

function Card({ t }: { t: QuizT }) {
	const x = t.cardKey ? BY[t.cardKey] : null
	if (!x) return <Head title="That's every title in this prototype." />
	return (
		<>
			<Backdrop x={x} dim={0.14} />
			<div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />
			<Head
				eyebrow={eyebrowOf(t)}
				title={t.variant === "seen" ? "Seen this one?" : "How was it?"}
			/>
			<Dots at={t.progress} of={t.goal} />
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={x.key}
					className="absolute left-12 top-[122px] flex gap-6"
					initial={{ opacity: 0, x: 30 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -30 }}
					transition={{ duration: 0.2 }}
				>
					<img
						src={poster(x, "w342")}
						alt=""
						className="h-[270px] w-[180px] rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
					/>
					<div className="w-[640px] pt-1">
						<div className="truncate text-[28px] font-extrabold leading-none">
							{x.title}
						</div>
						<div className="mt-1.5 text-[14px] text-white/55">
							{[x.year, x.genres.join(", ")].join(" · ")}
						</div>
						<div className="mt-6">
							<Control t={t} width={640} />
						</div>
					</div>
				</motion.div>
			</AnimatePresence>
		</>
	)
}

function Duel({ t }: { t: QuizT }) {
	const p = PAIRS[t.pairIdx]
	if (!p) return <Head title="That's every pair in this prototype." />
	const side = (k: string, s: "a" | "b", lab: string) => {
		const x = BY[k]
		return (
			<F
				t={t}
				v={`duel:${s}`}
				className="flex w-[330px] items-center gap-4 rounded-3xl p-3"
				scale={1.05}
			>
				<img
					src={poster(x, "w185")}
					alt=""
					className="h-[210px] w-[140px] rounded-xl object-cover"
				/>
				<div className="min-w-0">
					<div className="text-[22px] font-extrabold leading-tight">{lab}</div>
					<div className="mt-2 line-clamp-2 text-[14px] text-white/60">
						{x.title} <span className="text-white/35">({x.year})</span>
					</div>
				</div>
			</F>
		)
	}
	const warm = t.variant === "warmup"
	return (
		<>
			<Backdrop x={BY[p.a]} dim={0.12} />
			<Head
				eyebrow={
					warm ? "Warm up: 1 of 2" : t.member ? "Sharpen your taste" : undefined
				}
				title="Which one, tonight?"
				line="No need to have seen them. Go with your gut."
			/>
			<Dots
				at={warm ? t.mine.filter((a) => a.kind === "duel").length : t.progress}
				of={warm ? 3 : t.goal}
			/>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={t.pairIdx}
					className="absolute inset-x-12 top-[142px] flex items-center justify-center gap-6"
					initial={{ opacity: 0, x: 30 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -30 }}
					transition={{ duration: 0.22 }}
				>
					{side(p.a, "a", p.left)}
					<span className="text-[22px] font-bold text-white/40">or</span>
					{side(p.b, "b", p.right)}
				</motion.div>
			</AnimatePresence>
			<div className="absolute bottom-9 left-1/2 -translate-x-1/2">
				<F
					t={t}
					v="duel:skip"
					className="rounded-full px-5 py-2.5 text-[15px] font-semibold"
				>
					Neither, skip
				</F>
			</div>
		</>
	)
}

function Shelf({ t }: { t: QuizT }) {
	const x = t.open ? BY[t.open] : null
	const scoreOf = (k: string) => {
		const a = t.answers.find((y) => y.key === k)
		return a?.kind === "score" ? a.score : null
	}
	return (
		<>
			<Head
				eyebrow={t.member ? "Sharpen your taste" : undefined}
				title="Seen any of these?"
				line="Score the ones you know. Skip the rest, it's fine."
			/>
			<Dots at={Math.min(t.progress, GOAL)} of={GOAL} />
			<div
				className={`absolute left-12 right-12 top-[124px] grid grid-cols-8 gap-x-3 gap-y-3 transition-opacity ${x ? "opacity-30" : ""}`}
			>
				{t.shelf.map((k) => {
					const s = scoreOf(k)
					return (
						<F
							key={k}
							t={t}
							v={`open:${k}`}
							className="rounded-xl p-1"
							scale={1.07}
						>
							<img
								src={poster(BY[k], "w185")}
								alt=""
								className="h-[138px] w-full rounded-lg object-cover"
							/>
							{s != null && (
								<span
									className="absolute -right-1.5 -top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[14px] font-black text-black ring-2 ring-black/60"
									style={{ background: hue(s) }}
								>
									{s}
								</span>
							)}
						</F>
					)
				})}
			</div>
			{!x && (
				<div className="absolute bottom-7 left-12 flex items-center gap-3">
					<F
						t={t}
						v="shelf:more"
						className="rounded-full px-5 py-2.5 text-[15px] font-semibold"
					>
						More titles
					</F>
					{t.progress >= GOAL ? (
						<F
							t={t}
							v="done"
							className="rounded-full px-6 py-2.5 text-[16px] font-bold"
							on="ring-amber-300 bg-amber-400 text-black"
							off="ring-transparent bg-amber-400/90 text-black"
						>
							♥ Show my picks
						</F>
					) : (
						<span className="text-[14px] text-white/45">
							{GOAL - t.progress} more for your picks.
						</span>
					)}
				</div>
			)}
			<AnimatePresence>
				{x && (
					<motion.div
						key={x.key}
						className="absolute inset-x-8 bottom-6 flex gap-5 rounded-3xl bg-[#101216] p-5 ring-1 ring-white/10"
						initial={{ opacity: 0, y: 40 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 40 }}
						transition={{ duration: 0.2 }}
					>
						<img
							src={poster(x, "w185")}
							alt=""
							className="h-[150px] w-[100px] rounded-xl object-cover"
						/>
						<div className="flex-1">
							<div className="text-[22px] font-extrabold leading-none">
								{x.title}
							</div>
							<div className="mb-3 mt-1 text-[13px] text-white/50">
								{x.year} · Back closes
							</div>
							<Control t={t} width={680} compact />
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	)
}

function Swap({ t }: { t: QuizT }) {
	const x = t.open ? BY[t.open] : null
	const wants = new Set(
		t.answers.filter((a) => a.kind === "want").map((a) => a.key),
	)
	return (
		<>
			<Head
				eyebrow={`Tonight · ${t.progress} answered`}
				title="Seen one already? Score it."
				line="A seen or unwanted pick makes room for a closer one."
			/>
			<div
				className={`absolute left-12 top-[128px] flex gap-6 transition-opacity ${x ? "opacity-30" : ""}`}
			>
				{t.slots.map((k, i) => (
					<F
						key={`${i}`}
						t={t}
						v={`open:${k}`}
						className="w-[200px] rounded-2xl p-2"
						scale={1.05}
					>
						<AnimatePresence mode="wait" initial={false}>
							<motion.div
								key={k}
								initial={{ opacity: 0, rotateY: 80 }}
								animate={{ opacity: 1, rotateY: 0 }}
								exit={{ opacity: 0, rotateY: -80 }}
								transition={{ duration: 0.25 }}
							>
								<img
									src={poster(BY[k], "w342")}
									alt=""
									className="h-[240px] w-full rounded-xl object-cover"
								/>
								<div className="mt-1.5 truncate text-[15px] font-bold">
									{BY[k].title}
								</div>
								<div className="flex items-center gap-1.5 text-[12px] text-white/55">
									<GwBadge gw={BY[k].gw} size={16} text="text-[12px]" />
									<span className="truncate">
										{wants.has(k)
											? "♥ Kept for tonight"
											: t.swapped[i]
												? "New, closer to you"
												: `On ${BY[k].on}`}
									</span>
								</div>
							</motion.div>
						</AnimatePresence>
					</F>
				))}
			</div>
			{!x && (
				<div className="absolute bottom-8 right-12">
					<F
						t={t}
						v="done"
						className="rounded-full px-6 py-2.5 text-[16px] font-bold"
						on="ring-amber-300 bg-amber-400 text-black"
						off="ring-transparent bg-amber-400/90 text-black"
					>
						These are tonight →
					</F>
				</div>
			)}
			<AnimatePresence>
				{x && (
					<motion.div
						key={x.key}
						className="absolute inset-x-8 bottom-6 flex gap-5 rounded-3xl bg-[#101216] p-5 ring-1 ring-white/10"
						initial={{ opacity: 0, y: 40 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 40 }}
						transition={{ duration: 0.2 }}
					>
						<div className="flex-1">
							<div className="text-[22px] font-extrabold leading-none">
								Seen {x.title}?
							</div>
							<div className="mb-3 mt-1 text-[13px] text-white/50">
								Score it and a closer pick takes its place. Back closes.
							</div>
							<Control t={t} width={820} compact />
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	)
}

function Live({ t }: { t: QuizT }) {
	const x = t.cardKey ? BY[t.cardKey] : null
	const yours = t.progress >= t.goal
	const n = t.mine.filter((a) => a.kind === "score").length
	return (
		<>
			<Head
				eyebrow={t.member ? "Sharpen your taste" : "Rate what you've seen"}
				title={x ? "How was it?" : "That's the deck."}
			/>
			<Dots
				at={t.progress}
				of={t.goal}
				className="absolute left-12 top-[92px]"
			/>
			{x && (
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={x.key}
						className="absolute left-12 top-[118px] w-[560px]"
						initial={{ opacity: 0, x: 24 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -24 }}
						transition={{ duration: 0.2 }}
					>
						<div className="flex gap-4">
							<img
								src={poster(x, "w342")}
								alt=""
								className="h-[180px] w-[120px] rounded-xl object-cover shadow-2xl ring-1 ring-white/10"
							/>
							<div className="pt-1">
								<div className="text-[24px] font-extrabold leading-tight">
									{x.title}
								</div>
								<div className="mt-1 text-[13px] text-white/55">
									{[x.year, x.genres.join(", ")].join(" · ")}
								</div>
							</div>
						</div>
						<div className="mt-4">
							<Control t={t} width={560} compact />
						</div>
					</motion.div>
				</AnimatePresence>
			)}
			<div className="absolute bottom-6 right-6 top-[68px] w-[300px] rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
				<div className="text-[12px] font-bold uppercase tracking-[0.2em] text-amber-300/80">
					{yours
						? "These are yours"
						: n
							? `Tonight, from ${n} ${n === 1 ? "score" : "scores"}`
							: "Tonight, best rated"}
				</div>
				<div className="mt-3 flex flex-col gap-2.5">
					{t.picks.map((p) => (
						<motion.div
							layout
							key={p.key}
							className="flex items-center gap-3"
							transition={{ type: "spring", stiffness: 380, damping: 34 }}
						>
							<img
								src={poster(p, "w92")}
								alt=""
								className="h-[84px] w-[56px] rounded-lg object-cover"
							/>
							<div className="min-w-0">
								<div className="truncate text-[15px] font-bold">{p.title}</div>
								<div className="mt-0.5 flex items-center gap-1.5">
									<GwBadge gw={p.gw} size={16} text="text-[12px]" />
									<Coin m={p.match} className="!px-1.5 !text-[11px]" />
								</div>
								{p.because && (
									<div className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-amber-100/70">
										{p.because}
									</div>
								)}
							</div>
						</motion.div>
					))}
				</div>
				{yours && (
					<div className="absolute inset-x-4 bottom-4">
						<F
							t={t}
							v="done"
							className="w-full rounded-full py-2.5 text-center text-[15px] font-bold"
							on="ring-amber-300 bg-amber-400 text-black"
							off="ring-transparent bg-amber-400/90 text-black"
						>
							♥ Open my picks
						</F>
					</div>
				)}
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The progressive rating controls. Words and scores use the site's own score colors (the vibe scale).

function Control({
	t,
	width,
	compact,
}: { t: QuizT; width: number; compact?: boolean }) {
	const r = t.rating
	return (
		<div style={{ width }}>
			{r === "stack" && <Stack t={t} compact={compact} />}
			{r === "fused" && <Fused t={t} compact={compact} />}
			{r === "reveal" && <Reveal t={t} compact={compact} />}
			{r === "dpad" && <DialMeter t={t} compact={compact} />}
			{r === "after" && <After t={t} compact={compact} />}
			{r !== "dpad" && <Acts t={t} />}
			<div className="mt-2 text-[12px] text-white/35">{RATINGS[r].hint}</div>
		</div>
	)
}

function Acts({ t }: { t: QuizT }) {
	return (
		<div className="mt-3 flex gap-2">
			{t.acts.map((a) => (
				<F
					key={a}
					t={t}
					v={a}
					className="rounded-full px-4 py-1.5 text-[14px] font-semibold text-white/80"
					scale={1.05}
				>
					{ACT[a]}
				</F>
			))}
		</div>
	)
}

// The level word: a colored bar, the word, and its scores small.
function Level({ b, big }: { b: Band; big?: boolean }) {
	const x = BANDS[b]
	return (
		<span className="flex h-full w-full items-center gap-2.5 px-3">
			<span
				className="h-7 w-1.5 shrink-0 rounded-full"
				style={{ background: x.hue }}
			/>
			<span className={`${big ? "text-[20px]" : "text-[17px]"} font-extrabold`}>
				{x.name}
			</span>
			<span className="ml-auto text-[11px] tabular-nums text-white/40">
				{x.lo}–{x.hi}
			</span>
		</span>
	)
}

function Cell({
	t,
	v,
	n,
	h,
	dim,
	bright,
}: {
	t: QuizT
	v: string
	n: number
	h: number
	dim?: boolean
	bright?: boolean
}) {
	const f = t.isFocus(v)
	return (
		<button
			type="button"
			data-pick={v}
			onMouseEnter={() => t.hover(v)}
			className={`flex w-full items-center justify-center rounded-md text-[13px] font-black tabular-nums transition ${f ? "scale-110 text-black ring-2 ring-amber-300" : bright ? "text-white" : dim ? "text-white/35" : "text-white/70"}`}
			style={{
				height: h,
				background: f
					? hue(n)
					: `${hue(n)}${bright ? "66" : dim ? "1f" : "38"}`,
			}}
		>
			{n}
		</button>
	)
}

// Stacked: four levels over the ten scores, each level spanning exactly its own scores.
function Stack({ t, compact }: { t: QuizT; compact?: boolean }) {
	const H = compact ? 64 : 90
	const fc = BANDS.findIndex((_, i) => t.isFocus(`c:${i}`))
	return (
		<div className="grid grid-cols-10 gap-1.5">
			{BANDS.map((b, i) => (
				<F
					key={b.name}
					t={t}
					v={`c:${i}`}
					className="rounded-2xl"
					style={{ gridColumn: `span ${b.hi - b.lo + 1}`, height: H }}
					scale={1.03}
				>
					<Level b={i as Band} big={!compact} />
				</F>
			))}
			{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
				<Cell
					key={n}
					t={t}
					v={`f:${n}`}
					n={n}
					h={Math.round(H / 3)}
					bright={fc >= 0 && fc === bandOf(n)}
					dim={fc >= 0 && fc !== bandOf(n)}
				/>
			))}
		</div>
	)
}

// Fused: each level key carries its own scores in a footer a third of its height.
function Fused({ t, compact }: { t: QuizT; compact?: boolean }) {
	const H = compact ? 64 : 90
	return (
		<div className="grid grid-cols-10 gap-1.5">
			{BANDS.map((b, i) => {
				const inside = fineOf(i as Band).some((n) => t.isFocus(`f:${n}`))
				return (
					<div
						key={b.name}
						className={`overflow-hidden rounded-2xl ring-2 transition-colors ${t.isFocus(`c:${i}`) ? "bg-white/[0.10] ring-amber-300" : inside ? "bg-white/[0.07] ring-amber-300/40" : "bg-white/[0.04] ring-white/5"}`}
						style={{ gridColumn: `span ${b.hi - b.lo + 1}` }}
					>
						<button
							type="button"
							data-pick={`c:${i}`}
							onMouseEnter={() => t.hover(`c:${i}`)}
							className="block w-full text-left"
							style={{ height: H }}
						>
							<Level b={i as Band} big={!compact} />
						</button>
						<div className="flex gap-1 border-t border-white/10 p-1">
							{fineOf(i as Band).map((n) => (
								<div key={n} className="flex-1">
									<Cell t={t} v={`f:${n}`} n={n} h={Math.round(H / 3)} />
								</div>
							))}
						</div>
					</div>
				)
			})}
		</div>
	)
}

// Zoom in: the four levels; the one you're on opens its own scores underneath.
function Reveal({ t, compact }: { t: QuizT; compact?: boolean }) {
	const H = compact ? 64 : 90
	return (
		<div className="grid grid-cols-4 gap-2">
			{BANDS.map((b, i) => (
				<div key={b.name}>
					<F
						t={t}
						v={`c:${i}`}
						className="w-full rounded-2xl"
						style={{ height: H }}
						scale={1.03}
					>
						<Level b={i as Band} big={!compact} />
					</F>
					<div className="mt-1.5" style={{ height: Math.round(H / 3) }}>
						<AnimatePresence initial={false}>
							{t.band === i && (
								<motion.div
									key={i}
									className="flex gap-1"
									initial={{ opacity: 0, y: -6 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.14 }}
								>
									{fineOf(i as Band).map((n) => (
										<div key={n} className="flex-1">
											<Cell t={t} v={`f:${n}`} n={n} h={Math.round(H / 3)} />
										</div>
									))}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			))}
		</div>
	)
}

// The D-pad dial: left/right jumps a level, up/down nudges one. The meter shows both, the readout says both.
function DialMeter({ t, compact }: { t: QuizT; compact?: boolean }) {
	const d = t.dial
	const f = t.isFocus("dial")
	const H = compact ? 34 : 42
	return (
		<div
			data-pick="dial"
			onMouseEnter={() => t.hover("dial")}
			className={`rounded-2xl p-3 ring-2 transition-colors ${f ? "bg-white/[0.08] ring-amber-300" : "bg-white/[0.04] ring-white/5"}`}
		>
			<div className="flex items-end gap-1.5">
				{t.acts.map((a) => (
					<button
						key={a}
						type="button"
						data-pick={a}
						onMouseEnter={() => t.setDial(a)}
						className={`mr-1 rounded-lg px-2.5 text-[12px] font-bold ${d === a ? "bg-white text-black" : "bg-white/[0.06] text-white/60"}`}
						style={{ height: H }}
					>
						{a === "skip"
							? "Not seen"
							: a === "want"
								? "Want it"
								: "Not for me"}
					</button>
				))}
				{BANDS.map((b, i) => (
					<div
						key={b.name}
						className="flex flex-col gap-1"
						style={{ flex: b.hi - b.lo + 1 }}
					>
						<div
							className={`text-center text-[14px] font-extrabold uppercase tracking-wider ${typeof d === "number" && bandOf(d) === i ? "" : "opacity-60"}`}
							style={{ color: b.hue }}
						>
							{b.name}
						</div>
						<div className="flex gap-1">
							{fineOf(i as Band).map((n) => (
								<button
									key={n}
									type="button"
									data-pick={`f:${n}`}
									onMouseEnter={() => t.setDial(n)}
									className={`flex flex-1 items-center justify-center rounded-md text-[14px] font-black tabular-nums transition ${d === n ? "scale-110 text-black ring-2 ring-amber-300" : "text-white/70"}`}
									style={{
										height: H,
										background: d === n ? hue(n) : `${hue(n)}33`,
									}}
								>
									{n}
								</button>
							))}
						</div>
					</div>
				))}
			</div>
			<div className="mt-2.5 flex items-baseline gap-3">
				<span
					className="text-[22px] font-extrabold"
					style={{ color: typeof d === "number" ? hue(d) : undefined }}
				>
					{d == null
						? "◀ ▶ picks a level"
						: typeof d === "string"
							? ACT[d]
							: `${BANDS[bandOf(d)].name} · ${d}`}
				</span>
				{typeof d === "number" && (
					<span className="text-[14px] text-white/50">
						{label(d)} · OK to score
					</span>
				)}
			</div>
		</div>
	)
}

// Rough now, exact after: four levels that move on at once; the last title waits with its own scores.
function After({ t, compact }: { t: QuizT; compact?: boolean }) {
	const H = compact ? 64 : 90
	const l = t.last ? t.answers.find((a) => a.key === t.last) : null
	return (
		<>
			<div className="grid grid-cols-4 gap-2">
				{BANDS.map((b, i) => (
					<F
						key={b.name}
						t={t}
						v={`c:${i}`}
						className="w-full rounded-2xl"
						style={{ height: H }}
						scale={1.03}
					>
						<Level b={i as Band} big={!compact} />
					</F>
				))}
			</div>
			<AnimatePresence initial={false}>
				{l?.kind === "score" && (
					<motion.div
						key={l.key}
						className="mt-2 flex items-center gap-3 rounded-xl bg-white/[0.04] px-2 py-1"
						initial={{ opacity: 0, y: -6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.16 }}
					>
						<img
							src={poster(BY[l.key], "w92")}
							alt=""
							className="h-[32px] w-[22px] rounded object-cover"
						/>
						<span className="truncate text-[13px] text-white/60">
							{BY[l.key].title}: {BANDS[bandOf(l.score)].name}. Exactly?
						</span>
						<div className="ml-auto flex w-[180px] gap-1">
							{fineOf(bandOf(l.score)).map((n) => (
								<div key={n} className="relative flex-1">
									<Cell
										t={t}
										v={`rf:${n}`}
										n={n}
										h={Math.round(H / 3)}
										bright={l.score === n}
									/>
								</div>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// After the quiz.

function Enough({ t }: { t: QuizT }) {
	const got = t.mine.filter((a) => a.kind !== "skip").slice(-8)
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			<Head
				eyebrow={`${t.progress} answers`}
				title={t.member ? "Saved to your taste." : "That's enough for tonight."}
				line={
					t.member
						? `${t.ratedBefore + t.progress} ratings now. Your picks moved with them.`
						: "Your picks are ready. More answers make them sharper."
				}
			/>
			<div className="absolute left-12 top-[150px] flex gap-3">
				{got.map((a, i) => (
					<motion.div
						key={a.key}
						className="relative"
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: i * 0.06 }}
					>
						<img
							src={poster(BY[a.key], "w185")}
							alt=""
							className="h-[150px] w-[100px] rounded-xl object-cover ring-1 ring-white/10"
						/>
						<AnswerChip a={a} />
					</motion.div>
				))}
			</div>
			<div className="absolute bottom-10 left-12 flex gap-3">
				<F
					t={t}
					v="done"
					className="rounded-full px-7 py-3 text-[17px] font-bold"
					on="ring-amber-300 bg-amber-400 text-black"
					off="ring-transparent bg-amber-400/90 text-black"
				>
					♥ Show my picks
				</F>
				<F
					t={t}
					v="more"
					className="rounded-full px-5 py-3 text-[16px] font-semibold"
				>
					5 more
				</F>
			</div>
		</>
	)
}

function AnswerChip({ a }: { a: Answer }) {
	const base =
		"absolute -right-1.5 -top-1.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[13px] font-black text-black ring-2 ring-black/60"
	if (a.kind === "score")
		return (
			<span className={base} style={{ background: hue(a.score) }}>
				{a.score}
			</span>
		)
	if (a.kind === "duel")
		return <span className={`${base} bg-amber-400`}>♥</span>
	if (a.kind === "want") return <span className={`${base} bg-sky-300`}>+</span>
	if (a.kind === "nope") return <span className={`${base} bg-white/60`}>–</span>
	return null
}

function Picks({ t, quick }: { t: QuizT; quick: boolean }) {
	const [a, ...rest] = t.picks
	const n = t.mine.filter((x) => x.kind !== "skip").length
	const line = t.member
		? `From your ${t.ratedBefore + t.progress} ratings · on your services`
		: n
			? `Closest to your ${n} answers · everywhere`
			: "Best rated right now · everywhere"
	return (
		<>
			<Backdrop x={a} dim={0.3} />
			<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
			<Head title="Here's tonight." line={line} />
			<div className="absolute left-12 right-12 top-[124px] flex gap-5">
				{a && <BigPick t={t} p={a} />}
				{rest.map((x) => (
					<F
						key={x.key}
						t={t}
						v={`t:${x.key}`}
						className="w-[150px] rounded-2xl p-2"
						scale={1.05}
					>
						<img
							src={poster(x, "w185")}
							alt=""
							className="h-[200px] w-full rounded-xl object-cover"
						/>
						<div className="mt-1.5 truncate text-[14px] font-bold">
							{x.title}
						</div>
						<div className="flex items-center gap-1.5 text-[12px] text-white/55">
							<Coin m={x.match} className="!px-1.5 !text-[11px]" />
							<span className="truncate">On {x.on}</span>
						</div>
					</F>
				))}
			</div>
			<div className="absolute bottom-9 left-12 right-12 flex items-center gap-3">
				{quick && !t.mine.length ? (
					<F
						t={t}
						v="go:quiz"
						className="rounded-full px-5 py-2.5 text-[15px] font-bold text-amber-200"
						on="ring-amber-300 bg-amber-400/20"
						off="ring-amber-300/30 bg-amber-400/10"
					>
						♥ Make it mine: {VARIANTS[t.variant].tile.toLowerCase()}
					</F>
				) : t.member ? (
					<>
						<F
							t={t}
							v="taste:open"
							className="rounded-full px-5 py-2.5 text-[15px] font-semibold"
						>
							✓ Saved to your taste · Open Taste
						</F>
						<F
							t={t}
							v="more"
							className="rounded-full px-5 py-2.5 text-[15px] font-semibold"
						>
							Rate more
						</F>
					</>
				) : (
					<>
						<F
							t={t}
							v="cta"
							className="flex items-center gap-2.5 rounded-full py-2 pl-2 pr-5 text-[15px] font-bold"
							on="ring-amber-300 bg-white text-black"
							off="ring-transparent bg-white/90 text-black"
						>
							<span className="flex -space-x-2">
								{t.mine
									.filter((x) => x.kind !== "skip")
									.slice(-3)
									.map((x) => (
										<img
											key={x.key}
											src={poster(BY[x.key], "w92")}
											alt=""
											className="h-8 w-8 rounded-full object-cover ring-2 ring-white"
										/>
									))}
							</span>
							Keep these {n} answers: free account
						</F>
						<F
							t={t}
							v="more"
							className="rounded-full px-5 py-2.5 text-[15px] font-semibold"
						>
							Rate more
						</F>
						<span className="ml-auto text-[12px] text-white/40">
							Without an account, they stay on this TV.
						</span>
					</>
				)}
			</div>
		</>
	)
}

function BigPick({ t, p }: { t: QuizT; p: Pick }) {
	return (
		<F
			t={t}
			v={`t:${p.key}`}
			className="flex w-[440px] gap-4 rounded-3xl p-3"
			scale={1.03}
		>
			<img
				src={poster(p, "w342")}
				alt=""
				className="h-[240px] w-[160px] rounded-xl object-cover"
			/>
			<div className="min-w-0 py-1">
				<div className="line-clamp-2 text-[24px] font-extrabold leading-tight">
					{p.title}
				</div>
				<div className="mt-2 flex items-center gap-2">
					<GwBadge gw={p.gw} size={24} text="text-[17px]" />
					<Coin m={p.match} />
				</div>
				<div className="mt-2 text-[13px] text-white/60">
					{p.runtime} · On {p.on}
				</div>
				{p.because && (
					<div className="mt-2 line-clamp-3 text-[13px] text-amber-100/80">
						{p.because}.
					</div>
				)}
			</div>
		</F>
	)
}

function TitleScreen({ t, k }: { t: QuizT; k: string }) {
	const x = BY[k]
	const want = t.answers.some((a) => a.key === k && a.kind === "want")
	return (
		<>
			<Backdrop x={x} dim={0.5} />
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
			<div className="absolute left-12 top-10 flex gap-7">
				<img
					src={poster(x, "w342")}
					alt=""
					className="h-[300px] w-[200px] rounded-2xl object-cover shadow-2xl ring-1 ring-white/10"
				/>
				<div className="w-[500px] pt-1">
					<div className="line-clamp-2 text-[34px] font-extrabold leading-none">
						{x.title}
					</div>
					<div className="mt-2 text-[14px] text-white/55">
						{[x.year, x.runtime, x.genres.join(", ")].join(" · ")}
					</div>
					<div className="mt-3">
						<GwBadge gw={x.gw} size={32} text="text-[22px]" />
					</div>
					<div className="mt-3 text-[15px] text-white/70">
						Feels {x.feel.slice(0, 3).join(", ")}. On {x.on}.
					</div>
				</div>
			</div>
			<div className="absolute bottom-9 left-12 flex gap-2.5">
				<F
					t={t}
					v={`want:${k}`}
					className="rounded-full px-5 py-2.5 text-[15px] font-bold"
					on="ring-amber-300 bg-white text-black"
					off="ring-transparent bg-white/90 text-black"
				>
					{want ? "✓ Want to See" : "Want to See"}
				</F>
				<F
					t={t}
					v="back"
					className="rounded-full px-4 py-2.5 text-[15px] font-semibold"
				>
					Back to tonight
				</F>
			</div>
		</>
	)
}

// Sign up on a TV: the buttons, and a code for the phone in your other hand.
function SignUp({ t }: { t: QuizT }) {
	const got = t.mine.filter((a) => a.kind !== "skip").slice(-6)
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_20%_0%,#3a2206_0%,#08070a_60%)]" />
			<Head
				eyebrow="Free, no card"
				title="Keep your taste."
				line="Your answers become picks every night, on every screen. Without an account they stay on this TV."
			/>
			<div className="absolute left-12 top-[170px] flex gap-2.5">
				{got.map((a) => (
					<div key={a.key} className="relative">
						<img
							src={poster(BY[a.key], "w185")}
							alt=""
							className="h-[120px] w-[80px] rounded-lg object-cover ring-1 ring-white/10"
						/>
						<AnswerChip a={a} />
					</div>
				))}
			</div>
			<div className="absolute bottom-10 left-12 flex gap-3">
				<F
					t={t}
					v="su:create"
					className="rounded-full px-7 py-3 text-[17px] font-bold"
					on="ring-amber-300 bg-white text-black"
					off="ring-transparent bg-white/90 text-black"
				>
					Create a free account
				</F>
				<F
					t={t}
					v="su:signin"
					className="rounded-full px-5 py-3 text-[16px] font-semibold"
				>
					Sign in
				</F>
				<F
					t={t}
					v="su:later"
					className="rounded-full px-5 py-3 text-[16px] font-semibold text-white/60"
				>
					Not now
				</F>
			</div>
			<div className="absolute bottom-10 right-12 flex w-[190px] flex-col items-center rounded-3xl bg-white/[0.05] p-4 ring-1 ring-white/10">
				<Qr />
				<div className="mt-2 text-center text-[13px] leading-tight text-white/60">
					Or scan with your phone
				</div>
				<div className="mt-0.5 font-mono text-[13px] font-bold tracking-wider text-white/80">
					gw.tv/K7Q2
				</div>
			</div>
		</>
	)
}

// A stand-in code: a fixed pattern, not a real one.
function Qr() {
	const n = 21
	const on = (x: number, y: number) => {
		const finder = (a: number, b: number) =>
			x >= a &&
			x < a + 7 &&
			y >= b &&
			y < b + 7 &&
			(x === a ||
				x === a + 6 ||
				y === b ||
				y === b + 6 ||
				(x >= a + 2 && x <= a + 4 && y >= b + 2 && y <= b + 4))
		if (finder(0, 0) || finder(14, 0) || finder(0, 14)) return true
		if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) return false
		return (x * 7 + y * 13 + x * y) % 5 < 2
	}
	return (
		<svg
			viewBox={`-1 -1 ${n + 2} ${n + 2}`}
			className="h-[130px] w-[130px] rounded-lg bg-white"
		>
			{Array.from({ length: n * n }, (_, i) =>
				on(i % n, Math.floor(i / n)) ? (
					<rect
						key={i}
						x={i % n}
						y={Math.floor(i / n)}
						width={1}
						height={1}
						fill="#000"
					/>
				) : null,
			)}
		</svg>
	)
}

function Welcome({ t }: { t: QuizT }) {
	const n = t.mine.filter((a) => a.kind !== "skip").length
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_30%_0%,#0f2a14_0%,#08070a_62%)]" />
			<Head
				eyebrow="Prototype: the account is made here"
				title="You're in."
				line={`Your ${n} answers moved to your account. From now on this TV opens on your night.`}
			/>
			<div className="absolute bottom-10 left-12 flex gap-3">
				<F
					t={t}
					v="taste:open"
					className="rounded-full px-6 py-3 text-[16px] font-bold"
					on="ring-amber-300 bg-white text-black"
					off="ring-transparent bg-white/90 text-black"
				>
					See your taste
				</F>
				<F
					t={t}
					v="go:tonight"
					className="rounded-full px-5 py-3 text-[16px] font-semibold"
				>
					Back to tonight
				</F>
			</div>
		</>
	)
}

function Taste({ t }: { t: QuizT }) {
	const l = leanings(t.answers)
	const rated = t.answers
		.filter((a) => a.kind === "score")
		.sort(
			(a, b) =>
				(b.kind === "score" ? b.score : 0) - (a.kind === "score" ? a.score : 0),
		)
	return (
		<>
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(90% 80% at 20% 0%, #f472b633 0%, #07080b 60%)",
				}}
			/>
			<Head
				eyebrow="Taste"
				title={l.length ? `You go for ${l.join(", ")}.` : "No taste yet."}
				line={
					t.member
						? `${t.ratedBefore + t.progress} ratings`
						: l.length
							? "From your answers on this TV."
							: "A few answers and it takes shape."
				}
			/>
			<div className="absolute left-12 top-[150px] flex gap-2.5">
				{rated.slice(0, 8).map((a) => (
					<div key={a.key} className="relative">
						<img
							src={poster(BY[a.key], "w154")}
							alt=""
							className="h-[135px] w-[90px] rounded-lg object-cover ring-1 ring-white/10"
						/>
						<AnswerChip a={a} />
					</div>
				))}
			</div>
			<div className="absolute bottom-9 left-12 flex gap-3">
				<F
					t={t}
					v="go:quiz"
					className="rounded-full px-6 py-3 text-[16px] font-bold"
					on="ring-amber-300 bg-amber-400 text-black"
					off="ring-transparent bg-amber-400/90 text-black"
				>
					{t.member ? "Rate a few more" : VARIANTS[t.variant].tile}
				</F>
				<F
					t={t}
					v="taste:open"
					className="rounded-full px-5 py-3 text-[16px] font-semibold"
				>
					Open Taste ↗
				</F>
			</div>
		</>
	)
}

// Back and Home, top right, away from home.
function Bar({ t }: { t: QuizT }) {
	const btn = (k: string, d: string, lab: string) => (
		<button
			key={k}
			type="button"
			data-pick={k}
			aria-label={lab}
			title={lab}
			className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white/85 ring-1 ring-white/10"
		>
			<Icon d={d} className="h-[18px] w-[18px]" />
		</button>
	)
	return (
		<div className="absolute right-6 top-5 z-20 flex items-center gap-2">
			{btn("back", "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", "Back")}
			<button
				type="button"
				data-pick="bar:home"
				aria-label="Home"
				title="Home"
				className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white/85 ring-1 ring-white/10"
			>
				<Icon d="M3 11l9-7 9 7M5 10v10h14V10" className="h-[18px] w-[18px]" />
			</button>
		</div>
	)
}

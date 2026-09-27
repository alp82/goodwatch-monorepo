// PROTOTYPE - throwaway. The in-memory start page for /prototype/rec-home (#178). One hook serves every variant:
// the Wishlist (round 3's store, read as Watch next under round 7's selection with Best match as the sort),
// taste-matched picks the person hasn't seen, one-tap Want to See / Seen it / Not interested with undo, and
// for guests the first-visit state: chosen services and this-or-that answers that build a taste in the browser.
// Nothing persists; a reload starts over.
import { useMemo, useState } from "react"
import type { HomeData } from "~/server/prototype-rec-home.server"
import { type WTitle, onMine } from "~/ui/prototype-rec-watch-next-2/model"
import { useQueue } from "~/ui/prototype-rec-watch-next-3/model"
import type { Ctx7 } from "~/ui/prototype-rec-watch-next-7/kit7"
import { MOODS, type MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { type Sel7, apply7, fitCount, perMood, toggleMood } from "~/ui/prototype-rec-watch-next-7/view"
import { W, leanings, makeSpace, matches, vector, why } from "./taste"

export type Toast = { id: number; text: string; undo?: () => void } | null
export type Gone = Record<string, "seen" | "no">

export const TASTE_HREF = "/prototype/rec-taste-6"
export const DISCOVER_HREF = "/prototype/rec-discover-4"
export const EXPLORER_HREF = "/prototype/rec-explorer-6"
export const WATCH_NEXT_HREF = "/prototype/rec-watch-next-7"

export function useHome(data: HomeData) {
	const guest = data.audience === "guest"

	// ---------------------------------------------------------------- guest taste and services
	const [mine, setMine] = useState<string[]>([])
	const [sig, setSig] = useState<Record<string, number>>({})
	const [answers, setAnswers] = useState<{ pair: number; side: "a" | "b" | "skip" }[]>([])
	const space = useMemo(() => (guest ? makeSpace(data.fp, data.keys) : null), [data])
	const gv = useMemo(() => (space ? vector(space, sig) : null), [space, sig])
	const gm = useMemo(() => (space ? matches(space, gv) : null), [space, gv])

	const titles = useMemo(() => {
		if (!guest) return data.titles
		return data.titles.map((t) => ({
			...t,
			match: gm?.get(t.key) ?? null,
			offers: t.offers.map((o) => ({ ...o, owned: mine.includes(o.name) })).sort((a, b) => Number(b.owned) - Number(a.owned) || a.order - b.order),
		}))
	}, [data, gm, mine, guest])
	const services = guest ? data.catalog.filter((c) => mine.includes(c.name)).map((c, i) => ({ id: i + 1, name: c.name, logo: c.logo })) : data.services
	const d2 = useMemo(() => ({ ...data, titles, services }), [titles, services.length])
	const q = useQueue(d2)
	const T = (k: string) => q.T(k) as WTitle | undefined

	// ---------------------------------------------------------------- Watch next (round 7's selection)
	const hasServices = services.length > 0
	const [sel, setSelRaw] = useState<Sel7>({ moods: [], everywhere: !hasServices, by: "match" })
	// A guest who picks services gets "On my services" on, as members have it by default.
	const effSel = hasServices ? sel : { ...sel, everywhere: true }
	const [open, setOpen] = useState(false)
	const [blocked, setBlocked] = useState<Ctx7["blocked"]>(null)
	const [passed, setPassed] = useState<string[]>([])
	const setSel = (s: Sel7) => setSelRaw(s)
	const tap = (m: MoodKey) => {
		const r = toggleMood(effSel, m)
		if (r.blocked) setBlocked({ m, at: Date.now() })
		else setSel(r.sel)
	}
	const v = useMemo(() => apply7(q, data.extra, effSel, passed), [q.order, effSel.moods.join(), effSel.everywhere, effSel.by, passed, titles])
	const per = useMemo(() => perMood(q, data.extra, effSel, data.pool), [q.order, effSel.everywhere, effSel.by, titles])
	const c: Ctx7 = { q, x: data.extra, sel: effSel, setSel, v, n: fitCount(v), per, tap, blocked, open, setOpen, services, reset: () => setSel({ moods: [], everywhere: !hasServices, by: "match" }) }
	const pass = (k: string) => setPassed((p) => [...p.filter((y) => y !== k), k])
	const watchNext = v.keys.map(T).filter((t): t is WTitle => !!t)
	const onServicesCount = q.titles.filter(onMine).length

	// ---------------------------------------------------------------- one-tap triage with undo
	const [gone, setGone] = useState<Gone>({})
	const [toast, setToast] = useState<Toast>(null)
	const say = (text: string, undo?: () => void) => setToast({ id: Date.now() + Math.random(), text, undo })
	const nudge = (k: string, w: number | null) =>
		guest &&
		setSig((s) => {
			const n = { ...s }
			if (w == null) delete n[k]
			else n[k] = w
			return n
		})

	const want = (k: string) => {
		const t = T(k)
		if (!t) return
		if (q.inQueue(k)) {
			q.remove(k)
			nudge(k, null)
			return say(`Removed ${t.title} from your Wishlist`, () => (q.addQ(k, "bottom"), nudge(k, W.want)))
		}
		q.addQ(k, "bottom")
		nudge(k, W.want)
		say(`${t.title} is on your Wishlist`, () => (q.remove(k), nudge(k, null)))
	}
	const mark = (k: string, how: "seen" | "no") => {
		const t = T(k)
		if (!t) return
		const was = gone[k]
		setGone((g) => ({ ...g, [k]: how }))
		if (how === "no") nudge(k, W.no)
		say(how === "seen" ? `Marked ${t.title} as seen` : `Not interested in ${t.title}. It won't come back.`, () => {
			setGone((g) => {
				const n = { ...g }
				if (was) n[k] = was
				else delete n[k]
				return n
			})
			if (how === "no") nudge(k, null)
		})
	}
	const seen = (k: string) => mark(k, "seen")
	const no = (k: string) => mark(k, "no")

	// ---------------------------------------------------------------- picks: not seen, on your services, best match
	const answered = new Set(Object.keys(sig))
	const hasTaste = guest ? !!gv : true
	const all = useMemo(() => {
		const keys = [...new Set([...data.pool, ...data.fresh])]
		return keys.map(T).filter((t): t is WTitle => !!t && !!t.poster && !!t.backdrop)
	}, [titles])
	const candidates = all.filter((t) => !q.isSeen(t.key) && !q.inQueue(t.key) && !gone[t.key] && !(guest && answered.has(t.key)))
	// Before a guest has a taste: the best rated of the 150 most popular, then the rest.
	const ranked = hasTaste
		? [...candidates].sort((a, b) => (b.match ?? 0) - (a.match ?? 0) || (b.score ?? 0) - (a.score ?? 0))
		: [...candidates.slice(0, 150).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), ...candidates.slice(150)]
	const everywhere = !hasServices || effSel.everywhere
	const picks = everywhere ? ranked : ranked.filter(onMine)
	const hiddenElsewhere = ranked.length - picks.length
	const whyOf = (k: string): string[] => (guest ? (space && gv ? why(space, gv, k) : []) : (data.why[k] ?? []))

	// ---------------------------------------------------------------- guest first visit
	const toggleService = (name: string) => setMine((m) => (m.includes(name) ? m.filter((x) => x !== name) : [...m, name]))
	const pickSide = (i: number, side: "a" | "b" | "skip") => {
		const p = data.pairs[i]
		if (!p) return
		setAnswers((a) => [...a.filter((x) => x.pair !== i), { pair: i, side }])
		setSig((s) => {
			const n = { ...s }
			delete n[p.a]
			delete n[p.b]
			if (side === "a") Object.assign(n, { [p.a]: W.picked, [p.b]: W.passed })
			if (side === "b") Object.assign(n, { [p.b]: W.picked, [p.a]: W.passed })
			return n
		})
	}
	const love = (k: string) =>
		setSig((s) => {
			const n = { ...s }
			if (n[k] === W.picked) delete n[k]
			else n[k] = W.picked
			return n
		})
	const loved = Object.entries(sig).filter(([, w]) => w === W.picked).map(([k]) => k)
	const resetGuest = () => (setSig({}), setAnswers([]), setMine([]))

	// ---------------------------------------------------------------- taste in short
	const leans = guest ? (space ? leanings(space, gv) : []) : data.leans
	const moods: MoodKey[] = guest ? topMoods(loved.map((k) => data.extra[k]?.m ?? [])) : data.loved

	return {
		data,
		guest,
		q,
		T,
		c,
		v,
		pass,
		watchNext,
		onServicesCount,
		services,
		hasServices,
		gone,
		want,
		seen,
		no,
		toast,
		setToast,
		picks,
		hiddenElsewhere,
		whyOf,
		hasTaste,
		mine,
		toggleService,
		answers,
		pickSide,
		love,
		loved,
		resetGuest,
		leans,
		moods,
	}
}

export type Home = ReturnType<typeof useHome>

const topMoods = (lists: MoodKey[][]): MoodKey[] => {
	const n = new Map<MoodKey, number>()
	for (const l of lists) for (const m of l) n.set(m, (n.get(m) ?? 0) + 1)
	return MOODS.map((m) => m.key)
		.filter((m) => n.get(m))
		.sort((a, b) => (n.get(b) ?? 0) - (n.get(a) ?? 0))
		.slice(0, 3)
}

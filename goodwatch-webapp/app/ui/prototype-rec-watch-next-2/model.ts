// PROTOTYPE - throwaway. Types and the in-memory store for /prototype/rec-watch-next-2 (#176, round 2).
// A title moves Suggested -> Wishlist (Want to See) -> Watch next. Watch next holds the Wishlist titles
// promoted to the top, so the two lists never overlap. Nothing persists; a reload starts over.
// The store is shaped like round 1's `Store` so its kit (hero pieces, rate dialog, toast) works unchanged.
import { useMemo, useState } from "react"
import type { Offer, State, Store, Title } from "~/ui/prototype-rec-watch-next/model"

export type WishlistMode = "empty" | "few" | "many" | "me"
export type TopKind = "hero" | "tonight"
export type Mood = "comfort" | "thoughtful" | "escape" | "binge" | "light"

export const MOOD_LABEL: Record<Mood, string> = {
	comfort: "Comfort watch",
	thoughtful: "Thought-provoking",
	escape: "Pure escape",
	binge: "Bingeable",
	light: "Easy to drop into",
}

export interface WTitle extends Title {
	match: number | null
	near: string[]
	moods: Mood[]
	popularity: number
	newOnMine: number | null
	leavingInDays: number | null
}

export interface LoaderData {
	mode: WishlistMode
	signedIn: boolean
	country: string
	demoServices: boolean
	services: { id: number; name: string; logo: string }[]
	titles: WTitle[]
	pool: string[]
	fresh: string[]
	wishlist: { key: string; added: number }[]
	ratings: Record<string, number>
	seen: string[]
}

export interface State2 extends State {
	added: Record<string, number>
	dismissed: string[]
	kept: string[]
	// Titles added in this session, newest first, for "because you added X".
	session: string[]
}

export const onMine = (t: Title) => t.offers.some((o: Offer) => o.owned)
export const DAY = 86400000
export const ageLabel = (ms: number, now: number) => {
	const d = Math.max(0, Math.round((now - ms) / DAY))
	if (d < 1) return "today"
	if (d < 2) return "yesterday"
	if (d < 30) return `${d} days ago`
	if (d < 365) return `${Math.round(d / 30)} months ago`
	const y = Math.floor(d / 365)
	return y === 1 ? "over a year ago" : `${y} years ago`
}
export const runtimeLabel = (t: Title) => (t.runtime ? (t.type === "show" ? `${t.runtime} min episodes` : t.runtime >= 60 ? `${Math.floor(t.runtime / 60)}h ${t.runtime % 60}m` : `${t.runtime} min`) : t.type === "show" ? "Series" : "Film")

export type SortKey = "tonight" | "match" | "short" | "added" | "oldest" | "score"
export const SORTS: { key: SortKey; label: string }[] = [
	{ key: "tonight", label: "On my services, best match" },
	{ key: "match", label: "Taste match" },
	{ key: "short", label: "Shortest first" },
	{ key: "score", label: "Highest score" },
	{ key: "added", label: "Recently added" },
	{ key: "oldest", label: "Oldest first" },
]

function seed(data: LoaderData, cap: number): State2 {
	const keys = data.wishlist.map((w) => w.key)
	const byKey = new Map(data.titles.map((t) => [t.key, t]))
	const n = data.mode === "few" ? 1 : data.mode === "empty" ? 0 : Math.min(cap, 4)
	// Seed Watch next with the newest Wishlist titles you can stream now.
	const playable = keys.filter((k) => byKey.get(k) && onMine(byKey.get(k)!))
	const queue = (playable.length >= n ? playable : keys).slice(0, n)
	return {
		queue,
		wishlist: keys.filter((k) => !queue.includes(k)),
		seen: data.seen,
		ratings: data.ratings,
		progress: {},
		added: Object.fromEntries(data.wishlist.map((w) => [w.key, w.added])),
		dismissed: [],
		kept: [],
		session: [],
	}
}

export function useWishlistStore(data: LoaderData, cap: number, addAt: "top" | "end") {
	const byKey = useMemo(() => new Map(data.titles.map((t) => [t.key, t])), [data.titles])
	const [state, setState] = useState<State2>(() => seed(data, cap))
	const [toast, setToast] = useState<Store["toast"]>(null)
	const [rate, setRate] = useState<Store["rate"]>(null)
	const [now] = useState(() => Date.now())
	const say = (text: string, undo?: State) => setToast({ id: Date.now(), text, undo })
	const name = (k: string) => byKey.get(k)?.title ?? "Title"
	const seenSet = useMemo(() => new Set(state.seen), [state.seen])

	// Want to See: into the Wishlist, newest first. Also leaves Seen and the dismissed pile.
	const want = (key: string, quiet = false) =>
		setState((s) => {
			if (s.wishlist.includes(key) || s.queue.includes(key)) return s
			if (!quiet) say(`${name(key)} is on your Wishlist`, s)
			return {
				...s,
				wishlist: [key, ...s.wishlist],
				added: { ...s.added, [key]: Date.now() },
				dismissed: s.dismissed.filter((k) => k !== key),
				session: [key, ...s.session.filter((k) => k !== key)],
			}
		})

	// Remove from Wishlist (and Watch next) entirely.
	const unwant = (key: string, text?: string) =>
		setState((s) => {
			say(text ?? `Removed ${name(key)} from your Wishlist`, s)
			return { ...s, wishlist: s.wishlist.filter((k) => k !== key), queue: s.queue.filter((k) => k !== key), session: s.session.filter((k) => k !== key) }
		})

	const dismiss = (key: string) =>
		setState((s) => {
			say(`Not interested in ${name(key)}. We will stop suggesting it.`, s)
			return { ...s, dismissed: [...s.dismissed, key], wishlist: s.wishlist.filter((k) => k !== key) }
		})

	// Still want to see it: stays, and leaves the pruning pile.
	const keep = (key: string) => setState((s) => ({ ...s, kept: [...s.kept, key] }))

	// Promote into Watch next. Titles not yet on the Wishlist are added on the way. Past the cap,
	// the last title goes back to the top of the Wishlist.
	const add = (key: string, at: "top" | "end" = addAt) =>
		setState((s) => {
			if (s.queue.includes(key)) return s
			const q = at === "top" ? [key, ...s.queue] : [...s.queue, key]
			let wishlist = s.wishlist.filter((k) => k !== key)
			const fresh = !s.wishlist.includes(key)
			let msg = fresh ? `Added ${name(key)} to your Wishlist and Watch next` : `${name(key)} moved up to Watch next`
			if (q.length > cap) {
				const out = at === "top" ? q.pop()! : q.splice(q.length - 2, 1)[0]
				wishlist = [out, ...wishlist]
				msg = `${name(key)} is in Watch next. ${name(out)} went back to your Wishlist.`
			}
			say(msg, s)
			return {
				...s,
				queue: q,
				wishlist,
				added: fresh ? { ...s.added, [key]: Date.now() } : s.added,
				seen: s.seen.filter((k) => k !== key),
				session: fresh ? [key, ...s.session] : s.session,
			}
		})

	// Out of Watch next, back to the top of the Wishlist.
	const remove = (key: string) =>
		setState((s) => {
			say(`${name(key)} went back to your Wishlist`, s)
			return { ...s, queue: s.queue.filter((k) => k !== key), wishlist: [key, ...s.wishlist.filter((k) => k !== key)] }
		})

	const reorder = (keys: string[]) => setState((s) => ({ ...s, queue: keys }))
	const move = (key: string, to: number) => {
		const list = [...state.queue]
		const from = list.indexOf(key)
		if (from < 0) return
		list.splice(from, 1)
		list.splice(Math.max(0, Math.min(list.length, to)), 0, key)
		reorder(list)
	}
	const toTop = (key: string) => {
		move(key, 0)
		say(`${name(key)} is up first`)
	}
	const wantToSee = (key: string) => (state.wishlist.includes(key) ? unwant(key) : want(key))

	const watched = (key: string) => {
		setState((s) => ({ ...s, queue: s.queue.filter((k) => k !== key), wishlist: s.wishlist.filter((k) => k !== key), seen: [key, ...s.seen.filter((k) => k !== key)] }))
		setRate({ key })
	}
	const score = (key: string, n: number | null) => {
		setRate(null)
		if (n == null) return say(`${name(key)} moved to Seen`)
		setState((s) => ({ ...s, ratings: { ...s.ratings, [key]: n } }))
		say(`Scored ${name(key)} ${n}. Moved to Seen.`)
	}
	const undo = () => {
		if (toast?.undo) setState(toast.undo as State2)
		setToast(null)
	}
	const reset = () => {
		setState(seed(data, cap))
		say("Demo reset")
	}

	const T = (k: string) => byKey.get(k)
	const list = (keys: string[]) => keys.map(T).filter((t): t is WTitle => !!t)
	const queueTitles = list(state.queue)
	const wishTitles = list(state.wishlist)
	const taken = (k: string) => state.queue.includes(k) || state.wishlist.includes(k) || seenSet.has(k) || state.dismissed.includes(k)

	// Suggestions, recomputed from the current state.
	const pool = list(data.pool)
	const suggest = {
		forYou: (n = 20) =>
			pool
				.filter((t) => !taken(t.key))
				.sort((a, b) => (b.match ?? 0) + (onMine(b) ? 8 : 0) - ((a.match ?? 0) + (onMine(a) ? 8 : 0)))
				.slice(0, n),
		popular: (n = 20) => pool.filter((t) => !taken(t.key) && onMine(t)).slice(0, n),
		fresh: (n = 20) => list(data.fresh).filter((t) => !taken(t.key)).slice(0, n),
		// Seeds: this session's adds first, then the newest Wishlist titles.
		because: (seeds = 3, n = 12) => {
			const from = [...state.session, ...state.queue, ...state.wishlist].filter((k, i, a) => a.indexOf(k) === i)
			const out: { seed: WTitle; titles: WTitle[] }[] = []
			const used = new Set<string>()
			for (const k of from) {
				const s = T(k)
				if (!s) continue
				const titles = list(s.near).filter((t) => !taken(t.key) && !used.has(t.key)).slice(0, n)
				if (titles.length < 3) continue
				titles.forEach((t) => used.add(t.key))
				out.push({ seed: s, titles })
				if (out.length >= seeds) break
			}
			return out
		},
	}

	const sortBacklog = (titles: WTitle[], by: SortKey) => {
		const added = (t: WTitle) => state.added[t.key] ?? 0
		const s = [...titles]
		if (by === "tonight") return s.sort((a, b) => Number(onMine(b)) - Number(onMine(a)) || (b.match ?? 0) - (a.match ?? 0))
		if (by === "match") return s.sort((a, b) => (b.match ?? 0) - (a.match ?? 0))
		if (by === "short") return s.sort((a, b) => (a.runtime ?? 999) - (b.runtime ?? 999))
		if (by === "score") return s.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
		if (by === "oldest") return s.sort((a, b) => added(a) - added(b))
		return s.sort((a, b) => added(b) - added(a))
	}

	const backlog = {
		tonight: () => sortBacklog(wishTitles.filter(onMine), "match"),
		// Added more than a year ago and still a strong match.
		forgotten: () => wishTitles.filter((t) => now - (state.added[t.key] ?? now) > 365 * DAY && (t.match ?? 0) >= 70).sort((a, b) => (b.match ?? 0) - (a.match ?? 0)),
		// Added more than 18 months ago, weaker match, and not confirmed yet: ask whether to keep.
		stale: () =>
			wishTitles
				.filter((t) => !state.kept.includes(t.key) && now - (state.added[t.key] ?? now) > 540 * DAY)
				.sort((a, b) => (a.match ?? 0) - (b.match ?? 0) || (state.added[a.key] ?? 0) - (state.added[b.key] ?? 0)),
		leaving: () => wishTitles.filter((t) => t.leavingInDays != null).sort((a, b) => a.leavingInDays! - b.leavingInDays!),
		byService: () => {
			const groups = new Map<string, { name: string; logo: string; titles: WTitle[] }>()
			const elsewhere: WTitle[] = []
			for (const t of wishTitles) {
				const o = t.offers.find((x) => x.owned)
				if (!o) {
					elsewhere.push(t)
					continue
				}
				const g = groups.get(o.name) ?? { name: o.name, logo: o.logo, titles: [] }
				g.titles.push(t)
				groups.set(o.name, g)
			}
			return { groups: [...groups.values()].sort((a, b) => b.titles.length - a.titles.length), elsewhere }
		},
		sort: sortBacklog,
	}

	const store = {
		cfg: { ns: "rec-watch-next-2", cap, addAt },
		state,
		byKey: byKey as Map<string, Title>,
		queue: state.queue,
		queueTitles,
		has: (k: string) => state.queue.includes(k),
		add,
		remove,
		reorder,
		reorderWishlist: (keys: string[]) => setState((s) => ({ ...s, wishlist: keys })),
		move,
		toTop,
		wantToSee,
		watched,
		episodeWatched: watched,
		score,
		rate,
		setRate,
		toast,
		setToast,
		undo,
		reset,
		nextEpisode: () => null,
		episodeProgress: () => 0,
		isSeen: (k: string) => seenSet.has(k),
		onWishlist: (k: string) => state.wishlist.includes(k),
	} satisfies Store

	return {
		...store,
		mode: data.mode,
		now,
		T,
		wishTitles,
		wishCount: state.wishlist.length + state.queue.length,
		inWishlist: (k: string) => state.wishlist.includes(k) || state.queue.includes(k),
		addedAt: (k: string) => state.added[k],
		want,
		unwant,
		dismiss,
		keep,
		suggest,
		backlog,
	}
}

export type Store2 = ReturnType<typeof useWishlistStore>

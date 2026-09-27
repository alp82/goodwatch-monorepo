// PROTOTYPE - throwaway. The in-memory store for /prototype/rec-watch-next-3 (#176, round 3).
// One interest signal: Want to See puts a title on the Wishlist. The Wishlist is one ordered priority
// queue, and "Watch next" is simply its top. Ordering is the only extra concept. Nothing persists.
// The store also exposes the fields round 1's kit and round 2's start hero read, so both work unchanged.
import { useMemo, useState } from "react"
import type { State, Store, Title } from "~/ui/prototype-rec-watch-next/model"
import { type LoaderData, type WTitle, DAY, onMine } from "~/ui/prototype-rec-watch-next-2/model"

// The hero shows the top title plus the next four.
export const HERO = 5

export interface State3 {
	order: string[]
	seen: string[]
	ratings: Record<string, number>
	added: Record<string, number>
	kept: string[]
	dismissed: string[]
}

// The last placement, for the "placed at #7" moment. `n` changes on every add so the moment replays.
export type Landed = { key: string; pos: number; how: AddHow; why: string; n: number } | null
export type AddHow = "bottom" | "auto" | "top" | "at"

export type SortKey = "tonight" | "short" | "leaving" | "match" | "oldest"
export const SORTS: { key: SortKey; label: string; note: string }[] = [
	{ key: "tonight", label: "For tonight", note: "On your services first, then best taste match" },
	{ key: "short", label: "Shortest first", note: "Films under two hours and short episodes up top" },
	{ key: "leaving", label: "Leaving soon", note: "Titles about to leave your services first" },
	{ key: "match", label: "Best match", note: "Highest taste match first, wherever it streams" },
	{ key: "oldest", label: "Oldest wish first", note: "Clear the titles you have wanted the longest" },
]

// How well a title fits tonight: on your services counts most, then taste match, then leaving soon.
export const tonightScore = (t: WTitle) => (onMine(t) ? 40 : 0) + (t.match ?? 50) * 0.6 + (t.leavingInDays != null ? 12 : 0) + (t.score ?? 60) * 0.05

export const reason = (t: WTitle) => {
	const o = t.offers.find((x) => x.owned)
	const bits = [t.match ? `${t.match}% taste match` : null, o ? `on ${o.name}` : "not on your services", t.leavingInDays != null ? `leaves in ${t.leavingInDays} days` : null].filter(Boolean)
	return bits.join(", ")
}

const seed = (data: LoaderData): State3 => ({
	order: data.wishlist.map((w) => w.key),
	seen: data.seen,
	ratings: data.ratings,
	added: Object.fromEntries(data.wishlist.map((w) => [w.key, w.added])),
	kept: [],
	dismissed: [],
})

export function useQueue(data: LoaderData) {
	const byKey = useMemo(() => new Map(data.titles.map((t) => [t.key, t])), [data.titles])
	const [state, setState] = useState<State3>(() => seed(data))
	const [toast, setToast] = useState<Store["toast"]>(null)
	const [rate, setRate] = useState<Store["rate"]>(null)
	const [landed, setLanded] = useState<Landed>(null)
	// A title waiting to be placed by "which first?" questions before it enters the queue.
	const [pending, setPending] = useState<string | null>(null)
	const [now] = useState(() => Date.now())
	// Undo snapshots are State3, stored where round 1's toast expects its State.
	const say = (text: string, undo?: State3) => setToast({ id: Date.now() + Math.random(), text, undo: undo as unknown as State })
	const T = (k: string) => byKey.get(k)
	const name = (k: string) => T(k)?.title ?? "Title"
	const list = (keys: string[]) => keys.map(T).filter((t): t is WTitle => !!t)
	const seenSet = useMemo(() => new Set(state.seen), [state.seen])
	const order = state.order
	const pos = (k: string) => order.indexOf(k) + 1

	// Where "auto" puts a new title: ranked among the first 40 by the tonight score, never above #2
	// so the title you already chose to watch next keeps its place.
	const autoIndex = (key: string, o: string[]) => {
		const t = T(key)
		if (!t || o.length === 0) return 0
		const s = tonightScore(t)
		const head = o.slice(0, 40)
		const better = head.filter((k) => {
			const x = T(k)
			return x ? tonightScore(x) >= s : true
		}).length
		const idx = better >= head.length ? o.length : better
		return Math.max(Math.min(1, o.length), idx)
	}

	// Want to See. `how` decides where it lands; the index is 0-based when how is "at".
	const add = (key: string, how: AddHow = "bottom", at = 0) =>
		setState((s) => {
			if (s.order.includes(key)) return s
			const o = [...s.order]
			const idx = how === "top" ? 0 : how === "at" ? Math.max(0, Math.min(o.length, at)) : how === "auto" ? autoIndex(key, o) : o.length
			o.splice(idx, 0, key)
			const t = T(key)
			setLanded({ key, pos: idx + 1, how, why: t ? reason(t) : "", n: Date.now() })
			say(idx === 0 ? `${name(key)} is up next` : `${name(key)} is #${idx + 1} on your Wishlist`, s)
			return { ...s, order: o, added: { ...s.added, [key]: Date.now() }, dismissed: s.dismissed.filter((k) => k !== key), seen: s.seen.filter((k) => k !== key) }
		})

	const remove = (key: string, text?: string) =>
		setState((s) => {
			if (!s.order.includes(key)) return s
			say(text ?? `Removed ${name(key)} from your Wishlist`, s)
			return { ...s, order: s.order.filter((k) => k !== key) }
		})

	const toggle = (key: string, how: AddHow = "bottom") => (order.includes(key) ? remove(key) : add(key, how))

	const move = (key: string, to: number, quiet = true) =>
		setState((s) => {
			const o = [...s.order]
			const from = o.indexOf(key)
			if (from < 0) return s
			const target = Math.max(0, Math.min(o.length - 1, to))
			if (target === from) return s
			o.splice(from, 1)
			o.splice(target, 0, key)
			if (!quiet) say(target === 0 ? `${name(key)} is up next` : `${name(key)} moved to #${target + 1}`, s)
			return { ...s, order: o }
		})
	const toTop = (key: string) => move(key, 0, false)
	const bump = (key: string, by: number) => move(key, order.indexOf(key) + by)
	const toBottom = (key: string) => move(key, order.length - 1, false)
	// Replace the first keys.length titles (a dragged head) and keep the rest.
	const reorderHead = (keys: string[]) => setState((s) => ({ ...s, order: [...keys, ...s.order.filter((k) => !keys.includes(k))] }))
	const setOrder = (keys: string[], text: string) =>
		setState((s) => {
			say(text, s)
			return { ...s, order: keys }
		})

	const sorted = (by: SortKey, keys = order) => {
		const added = (k: string) => state.added[k] ?? 0
		const val = (k: string) => {
			const t = T(k)
			if (!t) return 0
			if (by === "tonight") return tonightScore(t)
			if (by === "short") return -(t.runtime ?? 999) + (onMine(t) ? 30 : 0)
			if (by === "leaving") return (t.leavingInDays != null ? 1000 - t.leavingInDays * 10 : 0) + tonightScore(t)
			if (by === "match") return t.match ?? 0
			return -added(k)
		}
		const idx = new Map(keys.map((k, i) => [k, i]))
		return [...keys].sort((a, b) => val(b) - val(a) || idx.get(a)! - idx.get(b)!)
	}

	// Finishing a title: it leaves the queue, the next one rises, and the score prompt opens.
	const watched = (key: string) => {
		setState((s) => ({ ...s, order: s.order.filter((k) => k !== key), seen: [key, ...s.seen.filter((k) => k !== key)] }))
		setRate({ key })
	}
	const score = (key: string, n: number | null) => {
		setRate(null)
		const up = order[0] ? name(order[0]) : null
		const tail = up ? ` Up next: ${up.replace(/\.$/, "")}.` : ""
		if (n == null) return say(`${name(key)} moved to Seen.${tail}`)
		setState((s) => ({ ...s, ratings: { ...s.ratings, [key]: n } }))
		say(`Scored ${name(key)} ${n}.${tail}`)
	}

	const dismiss = (key: string) =>
		setState((s) => {
			say(`Not interested in ${name(key)}. It won't be suggested again.`, s)
			return { ...s, dismissed: [...s.dismissed, key], order: s.order.filter((k) => k !== key) }
		})
	const keep = (key: string) => setState((s) => ({ ...s, kept: [...s.kept, key] }))
	const letGo = (keys: string[]) =>
		setState((s) => {
			say(keys.length === 1 ? `Let go of ${name(keys[0])}` : `Let go of ${keys.length} titles`, s)
			return { ...s, order: s.order.filter((k) => !keys.includes(k)) }
		})

	const undo = () => {
		if (toast?.undo) setState(toast.undo as unknown as State3)
		setToast(null)
	}
	const reset = () => {
		setState(seed(data))
		setLanded(null)
		say("Demo reset")
	}

	const taken = (k: string) => order.includes(k) || seenSet.has(k) || state.dismissed.includes(k)
	const pool = list(data.pool)
	const suggest = {
		forYou: (n = 20) =>
			pool
				.filter((t) => !taken(t.key))
				.sort((a, b) => (b.match ?? 0) + (onMine(b) ? 8 : 0) - ((a.match ?? 0) + (onMine(a) ? 8 : 0)))
				.slice(0, n),
		fresh: (n = 20) => list(data.fresh).filter((t) => !taken(t.key)).slice(0, n),
		// Near the top of the queue first, so suggestions follow what you want to watch soonest.
		because: (n = 12) => {
			for (const k of order.slice(0, 6)) {
				const s = T(k)
				if (!s) continue
				const titles = list(s.near).filter((t) => !taken(t.key)).slice(0, n)
				if (titles.length >= 4) return { seed: s, titles }
			}
			return null
		},
	}

	const titles = list(order)
	const addedAt = (k: string) => state.added[k] ?? now
	// Added over 18 months ago, a weaker match, and not confirmed: ask whether to keep.
	const stale = () =>
		titles
			.filter((t) => !state.kept.includes(t.key) && now - addedAt(t.key) > 540 * DAY && (t.match ?? 0) < 72)
			.sort((a, b) => addedAt(a.key) - addedAt(b.key))

	const head = order.slice(0, HERO)
	const headTitles = list(head)

	// What round 1's kit (rate dialog, toast, queue items) and round 2's start hero read. In this model
	// "the queue" they see is the head of the Wishlist; remove means off the Wishlist.
	const kitStore = {
		cfg: { ns: "rec-watch-next-3", cap: HERO, addAt: "end" as const },
		state: { queue: head, wishlist: order, seen: state.seen, ratings: state.ratings, progress: {} } as State,
		byKey: byKey as Map<string, Title>,
		queue: head,
		queueTitles: headTitles,
		has: (k: string) => head.includes(k),
		add: (k: string) => add(k, "top"),
		remove: (k: string) => remove(k),
		reorder: reorderHead,
		reorderWishlist: (keys: string[]) => setState((s) => ({ ...s, order: keys })),
		move: (k: string, to: number) => move(k, to),
		toTop,
		wantToSee: (k: string) => toggle(k),
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
		onWishlist: (k: string) => order.includes(k),
	} satisfies Store

	return {
		...kitStore,
		// Round 2's hero also calls these.
		want: (k: string) => add(k, "bottom"),
		dismiss,
		suggest,
		mode: data.mode,
		now,
		T,
		order,
		titles,
		count: order.length,
		pos,
		inQueue: (k: string) => order.includes(k),
		addQ: add,
		toggle,
		bump,
		toBottom,
		setOrder,
		sorted,
		landed,
		setLanded,
		pending,
		setPending,
		keep,
		letGo,
		stale,
		addedAt,
		say,
	}
}

export type Queue = ReturnType<typeof useQueue>

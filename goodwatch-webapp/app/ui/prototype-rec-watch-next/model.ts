// PROTOTYPE - throwaway. Types and the local Watch next store for /prototype/rec-watch-next (#176).
// Every variant keeps its own state in localStorage so the models never bleed into each other.
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type Offer = { id: number; name: string; logo: string; owned: boolean; order: number }
export type Episode = { s: number; e: number; name: string }

export interface Title {
	key: string
	type: "movie" | "show"
	id: number
	title: string
	year: number | null
	poster: string | null
	backdrop: string | null
	genres: string[]
	synopsis: string
	tagline: string
	score: number | null
	runtime: number | null
	episodes: Episode[]
	offers: Offer[]
}

export const posterUrl = (t: Title, size = "w342") => (t.poster ? `https://image.tmdb.org/t/p/${size}${t.poster}` : "")
export const backdropUrl = (t: Title, size = "w1280") => (t.backdrop ? `https://image.tmdb.org/t/p/${size}${t.backdrop}` : "")
export const ownedOffers = (t: Title) => t.offers.filter((o) => o.owned)
export const detailsHref = (t: Title) => `/${t.type}/${t.id}-${t.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`

export interface State {
	// Watch next in order. For the "top of Wishlist" model this is empty and the order lives in `wishlist`.
	queue: string[]
	// Want to See, most recent first (or in manual order for the "top of Wishlist" model).
	wishlist: string[]
	seen: string[]
	ratings: Record<string, number>
	// Index into `episodes` of the next episode to watch, per show.
	progress: Record<string, number>
}

export interface ModelConfig {
	// Storage namespace, one per variant.
	ns: string
	// Most titles Watch next holds. Past it, the last title goes back to Wishlist.
	cap: number
	// Where a one-tap add lands.
	addAt: "top" | "end"
	// Watch next is the first `cap` titles of an ordered Wishlist instead of its own list.
	wishlistTop?: boolean
}

export function seedState(titles: Title[], cfg: ModelConfig): State {
	const onMine = titles.filter((t) => t.offers.some((o) => o.owned))
	const shows = onMine.filter((t) => t.type === "show" && t.episodes.length)
	const movies = onMine.filter((t) => t.type === "movie")
	const q = [shows[0], movies[0], movies[1], shows[1]].filter(Boolean).map((t) => t.key).slice(0, Math.min(4, cfg.cap))
	const rest = titles.filter((t) => !q.includes(t.key)).slice(4, 11).map((t) => t.key)
	const progress: Record<string, number> = {}
	if (shows[0]) progress[shows[0].key] = Math.min(3, shows[0].episodes.length - 1)
	if (cfg.wishlistTop) return { queue: [], wishlist: [...q, ...rest], seen: [], ratings: {}, progress }
	return { queue: q, wishlist: rest, seen: [], ratings: {}, progress }
}

export type Toast = { id: number; text: string; undo?: State }
export type RatePrompt = { key: string; episodeFinish?: boolean } | null

export function useWatchNext(titles: Title[], cfg: ModelConfig) {
	const byKey = useMemo(() => new Map(titles.map((t) => [t.key, t])), [titles])
	const storageKey = `prototype-rec-watch-next:${cfg.ns}`
	const [state, setState] = useState<State>(() => seedState(titles, cfg))
	const loaded = useRef(false)
	useEffect(() => {
		try {
			const raw = localStorage.getItem(storageKey)
			if (raw) setState(JSON.parse(raw))
		} catch {}
		loaded.current = true
	}, [storageKey])
	useEffect(() => {
		if (!loaded.current) return
		try {
			localStorage.setItem(storageKey, JSON.stringify(state))
		} catch {}
	}, [state, storageKey])

	const [toast, setToast] = useState<Toast | null>(null)
	const [rate, setRate] = useState<RatePrompt>(null)
	const say = (text: string, undo?: State) => setToast({ id: Date.now(), text, undo })

	const queue = cfg.wishlistTop ? state.wishlist.slice(0, cfg.cap) : state.queue
	const has = (key: string) => queue.includes(key)
	const name = (key: string) => byKey.get(key)?.title ?? "Title"

	const add = useCallback(
		(key: string, at: "top" | "end" = cfg.addAt) => {
			setState((s) => {
				const before = s
				if (cfg.wishlistTop) {
					const w = s.wishlist.filter((k) => k !== key)
					const idx = at === "top" ? 0 : Math.min(w.length, cfg.cap - 1)
					w.splice(idx, 0, key)
					const bumped = w[cfg.cap]
					say(bumped && !s.wishlist.slice(0, cfg.cap).includes(key) ? `Added ${name(key)}. ${name(bumped)} moved below the line.` : `Added ${name(key)} to Watch next`, before)
					return { ...s, wishlist: w, seen: s.seen.filter((k) => k !== key) }
				}
				if (s.queue.includes(key)) return s
				const q = at === "top" ? [key, ...s.queue] : [...s.queue, key]
				let wishlist = s.wishlist.filter((k) => k !== key)
				let msg = `Added ${name(key)} to Watch next`
				if (q.length > cfg.cap) {
					const out = at === "top" ? q.pop()! : q.splice(q.length - 2, 1)[0]
					wishlist = [out, ...wishlist]
					msg = `Added ${name(key)}. ${name(out)} went back to Wishlist.`
				}
				say(msg, before)
				return { ...s, queue: q, wishlist, seen: s.seen.filter((k) => k !== key) }
			})
		},
		[cfg, byKey],
	)

	const remove = (key: string, toWishlist = true) =>
		setState((s) => {
			if (cfg.wishlistTop) {
				// Out of Watch next means just below the line, still in Wishlist.
				const w = s.wishlist.filter((k) => k !== key)
				w.splice(cfg.cap, 0, key)
				say(`${name(key)} moved below the line`, s)
				return { ...s, wishlist: w }
			}
			say(`Removed ${name(key)}${toWishlist ? ", kept in Wishlist" : ""}`, s)
			return { ...s, queue: s.queue.filter((k) => k !== key), wishlist: toWishlist ? [key, ...s.wishlist.filter((k) => k !== key)] : s.wishlist }
		})

	const reorder = (keys: string[]) =>
		setState((s) => (cfg.wishlistTop ? { ...s, wishlist: [...keys, ...s.wishlist.filter((k) => !keys.includes(k))] } : { ...s, queue: keys }))
	// Reorders the full Wishlist (only for the top-of-Wishlist model).
	const reorderWishlist = (keys: string[]) => setState((s) => ({ ...s, wishlist: keys }))

	const move = (key: string, to: number) => {
		const list = [...(cfg.wishlistTop ? state.wishlist : state.queue)]
		const from = list.indexOf(key)
		if (from < 0) return
		const target = Math.max(0, Math.min(list.length - 1, to))
		list.splice(from, 1)
		list.splice(target, 0, key)
		if (cfg.wishlistTop) reorderWishlist(list)
		else reorder(list)
	}
	const toTop = (key: string) => {
		move(key, 0)
		say(`${name(key)} is up first`)
	}

	const wantToSee = (key: string) =>
		setState((s) => {
			if (s.wishlist.includes(key)) return { ...s, wishlist: s.wishlist.filter((k) => k !== key) }
			say(`${name(key)} is on your Wishlist`, s)
			return { ...s, wishlist: cfg.wishlistTop ? [...s.wishlist, key] : [key, ...s.wishlist] }
		})

	// "I watched it": the title leaves Watch next and Wishlist, lands in Seen, and asks for a score.
	const watched = (key: string) => {
		setState((s) => ({
			...s,
			queue: s.queue.filter((k) => k !== key),
			wishlist: s.wishlist.filter((k) => k !== key),
			seen: [key, ...s.seen.filter((k) => k !== key)],
		}))
		setRate({ key })
	}

	// Shows: one episode done. The show stays in Watch next until the last episode.
	const episodeWatched = (key: string) => {
		const t = byKey.get(key)
		if (!t) return
		const next = (state.progress[key] ?? 0) + 1
		if (next >= t.episodes.length) {
			watched(key)
			setRate({ key, episodeFinish: true })
			return
		}
		setState((s) => ({ ...s, progress: { ...s.progress, [key]: next } }))
		const ep = t.episodes[next]
		say(`Up next: S${ep.s} E${ep.e}`)
	}

	const score = (key: string, n: number | null) => {
		setRate(null)
		if (n == null) return say(`${name(key)} moved to Seen`)
		setState((s) => ({ ...s, ratings: { ...s.ratings, [key]: n } }))
		say(`Scored ${name(key)} ${n}. Moved to Seen.`)
	}

	const undo = () => {
		if (toast?.undo) setState(toast.undo)
		setToast(null)
	}
	const reset = () => {
		setState(seedState(titles, cfg))
		say("Demo reset")
	}

	const nextEpisode = (t: Title) => (t.type === "show" && t.episodes.length ? t.episodes[Math.min(state.progress[t.key] ?? 0, t.episodes.length - 1)] : null)
	const episodeProgress = (t: Title) => (t.episodes.length ? (state.progress[t.key] ?? 0) / t.episodes.length : 0)

	return {
		cfg,
		state,
		byKey,
		queue,
		queueTitles: queue.map((k) => byKey.get(k)).filter((t): t is Title => !!t),
		has,
		add,
		remove,
		reorder,
		reorderWishlist,
		move,
		toTop,
		wantToSee,
		watched,
		episodeWatched,
		score,
		rate,
		setRate,
		toast,
		setToast,
		undo,
		reset,
		nextEpisode,
		episodeProgress,
		isSeen: (k: string) => state.seen.includes(k),
		onWishlist: (k: string) => state.wishlist.includes(k),
	}
}

export type Store = ReturnType<typeof useWatchNext>

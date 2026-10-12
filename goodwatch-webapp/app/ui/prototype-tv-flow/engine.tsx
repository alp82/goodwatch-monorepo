// PROTOTYPE - throwaway. The TV screen flow prototype's engine: the stack of TV screens (in the URL), the focus
// (moved in four directions by where the items sit on the screen), and the expand run that leaves the TV.
//
// A TV screen is an id such as `home`, `discover-cozy` or `title-arrival`; the stack of ids is `?at=` joined by
// dots. Back pops one screen and gives the focus back to where it was. Nothing is stored: Want to See, ratings and
// the quiz live in React state and are gone on reload.
//
// The stack lives in React state and is only mirrored into the address (history.replaceState): a router navigation
// per key press commits as a transition, which the dev build delays by up to a second.
import { useLocation, useSearchParams } from "@remix-run/react"
import { type RefObject, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { type Dest, LEVELS, QUIZ_GOAL } from "./data"

export type Variant = "rows" | "apps" | "guided"
export const VARIANTS: Record<Variant, string> = {
	rows: "Rows: tabs, a hero, rows",
	apps: "Apps: a dashboard of apps",
	guided: "Guided: one question per screen",
}

/** What the expand control can be called. The owner picks one. */
export const LABELS: Record<string, string> = {
	expand: "Expand",
	"full-view": "Full view",
	"full-page": "Full page",
	"open-up": "Open up",
	"go-big": "Go big",
	maximise: "Maximise",
}

export type Dir = "up" | "down" | "left" | "right"
export type Rect = { left: number; top: number; width: number; height: number }

/** How long the brackets take from the control to the edge of the picture, and the picture to the window. */
const ARM_FAST_MS = 420
const ARM_SLOW_MS = 2400
const GROW_MS = 850

/**
 * One run of the expand animation. `p` goes from 0 to 1: up to `arm` the brackets travel from the control to the
 * edge of the TV picture, after it the picture grows past the TV into the window. At 1 the real page is there.
 */
export type LeaveRun = {
	dest: Dest
	/** The control's box, relative to the scene. */
	from: Rect
	slow: boolean
	p: number
	arm: number
	/** 1 leaves, -1 comes back (or cancels a slow run). */
	dir: 1 | -1
	/** Where a run backwards ends: at the picture's edge when it came from the page, at the control when cancelled. */
	floor: number
}

export type Store = {
	want: string[]
	seen: Record<string, string>
	rated: number
	quizAt: number
	/** The streaming key that is on: only titles of this service show. */
	service: string | null
	power: "on" | "off"
	draft: string
}

export type Tv = {
	variant: Variant
	member: boolean
	phone: boolean
	/** The expand control's label. */
	label: string
	stack: string[]
	top: string
	focus: string | null
	store: Store
	/** True once the person has a taste: a member, or a guest who rated enough titles. */
	taste: boolean
	leaving: LeaveRun | null
	toastText: string | null
	push: (id: string) => void
	/** Swaps the top screen. `keep` leaves the focus on the same item id. */
	replace: (id: string, keep?: boolean) => void
	/** Makes `id` the only screen (a tab). The focus stays where it is. */
	root: (id: string) => void
	back: () => void
	home: () => void
	setFocus: (id: string, by?: "key" | "pointer") => void
	move: (dir: Dir) => void
	step: (by: 1 | -1) => void
	ok: () => void
	toggleMenu: () => void
	openSearch: () => void
	/** Starts the expand run from the control `from`. `framed`: the brackets are already at the picture's edge. */
	leave: (dest: Dest, from: string, how?: { slow?: boolean; framed?: boolean }) => void
	toast: (text: string) => void
	want: (key: string) => void
	rate: (key: string, level: string) => void
	/** Answers the quiz title on screen; null is "Haven't seen it". True when the answer reached the goal. */
	quiz: (level: string | null) => boolean
	service: (name: string) => void
	power: (on: boolean) => void
	type: (update: (draft: string) => string) => void
}

export const TvCtx = createContext<Tv | null>(null)
export const useTv = () => useContext(TvCtx) as Tv

export const OVERLAYS = ["menu"]
export const parseId = (id: string): [kind: string, arg: string] => {
	const at = id.indexOf("-")
	return at < 0 ? [id, ""] : [id.slice(0, at), id.slice(at + 1)]
}

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n))

export function useTvEngine({ variant, member, phone, label, scene, ready }: { variant: Variant; member: boolean; phone: boolean; label: string; scene: RefObject<HTMLElement | null>; /** The TV is laid out. */ ready: boolean }): Tv {
	const [params] = useSearchParams()
	const { search } = useLocation()
	const [stack, setStack] = useState(() => {
		const ids = (params.get("at") ?? "").split(".").filter(Boolean)
		return ids.length ? ids : ["home"]
	})
	// A router navigation (another variant or person) drops `at` from the address: `search` changes, and this puts it back.
	useEffect(() => {
		const url = new URL(window.location.href)
		const value = stack.join(".")
		if (value === "home") url.searchParams.delete("at")
		else url.searchParams.set("at", value)
		url.searchParams.delete("f")
		if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url)
	}, [stack, search])
	const depth = stack.length - 1
	const top = stack[depth]
	// The focus of every screen on the stack, by depth, so Back gives it back.
	const [focusMap, setFocusMap] = useState<Record<number, string>>(() => {
		const f = params.get("f")
		return f ? { [depth]: f } : {}
	})
	const focus = focusMap[depth] ?? null
	const [store, setStore] = useState<Store>({ want: [], seen: {}, rated: 0, quizAt: 0, service: null, power: "on", draft: "" })
	const [toastText, setToastText] = useState<string | null>(null)
	const [leaving, setLeaving] = useState<LeaveRun | null>(null)
	// `?hold` freezes the expand run so a screenshot can show any moment of it: `window.__tvLeave(0.4)`.
	const hold = params.has("hold")

	/** Shows another stack. `keep`: the new top screen keeps the focus its depth had (Back, a tab, the next pick). */
	const go = useCallback((next: string[], keep = false) => {
		const d = next.length - 1
		setFocusMap((m) => Object.fromEntries(Object.entries(m).filter(([k]) => Number(k) < d || (keep && Number(k) === d))))
		setStack(next)
	}, [])

	// Another variant or person: the screens differ, so start at home.
	const who = `${variant}:${member}`
	const lastWho = useRef(who)
	useEffect(() => {
		if (lastWho.current === who) return
		lastWho.current = who
		setLeaving(null)
		go(["home"])
	}, [who, go])

	const items = useCallback(() => {
		const layers = scene.current?.querySelectorAll<HTMLElement>("[data-tv-layer]")
		const layer = layers?.[layers.length - 1]
		return layer ? Array.from(layer.querySelectorAll<HTMLElement>("[data-tv-item]")) : []
	}, [scene])
	const itemEl = (id: string | null) => (id ? (items().find((el) => el.dataset.tvItem === id) ?? null) : null)

	// A screen's focus starts on its marked first item, else on its first item that is not the expand control.
	useLayoutEffect(() => {
		const all = items()
		if (!all.length || all.some((el) => el.dataset.tvItem === focus)) return
		const first = all.find((el) => el.dataset.tvFirst != null) ?? all.find((el) => !el.classList.contains("tvx")) ?? all[0]
		const id = first.dataset.tvItem as string
		setFocusMap((m) => ({ ...m, [depth]: id }))
	})

	// The focused item scrolls into view: rows page sideways, a tall screen pages down. `ready`: a linked focus
	// (`?f=`) is known before the TV is laid out.
	useEffect(() => {
		if (ready) itemEl(focus)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
	}, [focus, top, ready])

	const setFocus = useCallback((id: string) => setFocusMap((m) => (m[depth] === id ? m : { ...m, [depth]: id })), [depth])

	const toastTimer = useRef<ReturnType<typeof setTimeout>>()
	const toast = useCallback((text: string) => {
		setToastText(text)
		clearTimeout(toastTimer.current)
		toastTimer.current = setTimeout(() => setToastText(null), 2400)
	}, [])

	// ---- The expand run.
	const p = useRef(0)
	useEffect(() => {
		;(window as unknown as { __tvLeave?: (v: number) => void }).__tvLeave = (v) => {
			p.current = v
			setLeaving((l) => (l ? { ...l, p: v } : l))
		}
	}, [])
	const running = leaving ? `${leaving.dir}:${leaving.slow}` : null
	// The loop restarts only when the run starts or turns around, not on every frame.
	useEffect(() => {
		if (!leaving || hold) return
		const total = (leaving.slow ? ARM_SLOW_MS : ARM_FAST_MS) + GROW_MS
		const { dir, floor } = leaving
		let last = performance.now()
		let raf = 0
		const tick = (now: number) => {
			const dt = now - last
			last = now
			// Coming back, or cancelling, is quicker than leaving.
			const next = clamp(p.current + (dir * dt * (dir < 0 ? 2.5 : 1)) / total)
			p.current = next
			if (dir < 0 && next <= floor) {
				p.current = 0
				setLeaving(null)
				return
			}
			setLeaving((l) => (l ? { ...l, p: next } : l))
			if (dir > 0 && next >= 1) return
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [running, hold])

	const leave: Tv["leave"] = (dest, from, how) => {
		const el = itemEl(from)
		const root = scene.current
		if (!el || !root || leaving) return
		const b = el.getBoundingClientRect()
		const r = root.getBoundingClientRect()
		const slow = Boolean(how?.slow)
		const arm = (slow ? ARM_SLOW_MS : ARM_FAST_MS) / ((slow ? ARM_SLOW_MS : ARM_FAST_MS) + GROW_MS)
		p.current = how?.framed ? arm : 0
		setLeaving({ dest, from: { left: b.left - r.left, top: b.top - r.top, width: b.width, height: b.height }, slow, p: p.current, arm, dir: 1, floor: 0 })
	}
	const turnBack = () => setLeaving((l) => (l ? { ...l, dir: -1, floor: l.p >= l.arm ? l.arm : 0 } : l))

	// ---- Moving the focus.
	const move = (dir: Dir) => {
		const all = items()
		const from = itemEl(focus)
		if (!from) return
		// A scroll toward the focused item may still be under way: finish it, so the boxes are where they will be.
		from.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" })
		const a = from.getBoundingClientRect()
		const k = a.width / (from.offsetWidth || 1)
		const horizontal = dir === "left" || dir === "right"
		const candidates = all
			.filter((el) => el !== from)
			.map((el) => {
				const b = el.getBoundingClientRect()
				// How far ahead the item is, and how far off to the side (0 while the two overlap sideways).
				const ahead = dir === "right" ? b.left - a.right : dir === "left" ? a.left - b.right : dir === "down" ? b.top - a.bottom : a.top - b.bottom
				const [a0, a1, b0, b1] = horizontal ? [a.top, a.bottom, b.top, b.bottom] : [a.left, a.right, b.left, b.right]
				const aside = Math.max(0, Math.max(a0, b0) - Math.min(a1, b1))
				const centers = Math.abs((a0 + a1) / 2 - (b0 + b1) / 2)
				return { el, ahead, aside, centers }
			})
			// Left and right stay in the row; up and down take whatever row comes next.
			.filter((c) => c.ahead > -8 * k && (!horizontal || c.aside === 0))
		if (!candidates.length) return
		const nearest = Math.min(...candidates.map((c) => c.ahead))
		const row = candidates.filter((c) => c.ahead <= nearest + 40 * k)
		// Down from a wide item (a hero over a row of tiles) starts at the row's left end, as a TV does.
		const wide = !horizontal && row.filter((c) => c.aside === 0).length > 1 && row.every((c) => c.el.getBoundingClientRect().width < a.width / 2)
		let target = row.sort((x, y) => (horizontal ? x.ahead - y.ahead : wide ? x.el.getBoundingClientRect().left - y.el.getBoundingClientRect().left : x.aside - y.aside || x.centers - y.centers))[0].el
		// Entering a group (the tabs) lands on the item the group names, not on the nearest one.
		const group = target.closest<HTMLElement>("[data-tv-group]")
		if (group && group !== from.closest("[data-tv-group]")) target = itemEl(group.dataset.tvPrefer ?? null) ?? target
		setFocus(target.dataset.tvItem as string)
		target.dispatchEvent(new CustomEvent("tvkeyfocus"))
	}
	const step = (by: 1 | -1) => {
		const all = items()
		if (!all.length) return
		const i = Math.max(0, all.indexOf(itemEl(focus) as HTMLElement))
		setFocus(all[(i + by + all.length) % all.length].dataset.tvItem as string)
	}

	const push = (id: string) => go([...stack, id])
	const back = () => {
		if (leaving) return turnBack()
		if (depth > 0) return go(stack.slice(0, -1), true)
		if (top !== "home") go(["home"])
	}
	const tv: Tv = {
		variant,
		member,
		phone,
		label,
		stack,
		top,
		focus,
		store,
		taste: member || store.rated >= QUIZ_GOAL,
		leaving,
		toastText,
		push,
		replace: (id, keep) => go([...stack.slice(0, -1), id], keep),
		root: (id) => {
			if (depth !== 0 || top !== id) go([id], true)
		},
		back,
		home: () => {
			setLeaving(null)
			go(["home"])
		},
		setFocus,
		move: (dir) => {
			if (!leaving && store.power === "on") move(dir)
		},
		step: (by) => {
			if (!leaving && store.power === "on") step(by)
		},
		ok: () => {
			if (store.power === "off") return setStore((s) => ({ ...s, power: "on" }))
			// On the search screen, OK searches for what was typed.
			if (!leaving && top === "search" && store.draft.trim().length > 1) return push(`search-${store.draft.trim()}`)
			if (!leaving) return itemEl(focus)?.click()
			// On the page, OK comes back. During a slow run, OK again skips the wait.
			if (leaving.p >= 1) return turnBack()
			if (leaving.p < leaving.arm) {
				p.current = leaving.arm
				setLeaving({ ...leaving, p: leaving.arm })
			}
		},
		toggleMenu: () => {
			if (leaving) return
			if (top === "menu") back()
			else push("menu")
		},
		openSearch: () => {
			if (leaving) return
			if (parseId(top)[0] === "search") back()
			else {
				setStore((s) => ({ ...s, draft: "" }))
				go([...stack.filter((id) => id !== "menu"), "search"])
			}
		},
		leave,
		toast,
		want: (key) => {
			const on = store.want.includes(key)
			setStore((s) => ({ ...s, want: on ? s.want.filter((k) => k !== key) : [...s.want, key] }))
			toast(on ? "Off your Wishlist" : "On your Wishlist")
		},
		rate: (key, level) => {
			setStore((s) => ({ ...s, seen: { ...s.seen, [key]: level } }))
			toast(`Rated: ${level}`)
		},
		quiz: (level) => {
			const rated = store.rated + (level ? 1 : 0)
			setStore((s) => ({ ...s, quizAt: s.quizAt + 1, rated }))
			if (level) toast(`${LEVELS.includes(level) ? level : "Rated"} · ${Math.min(rated, QUIZ_GOAL)} of ${QUIZ_GOAL}`)
			return Boolean(level) && rated === QUIZ_GOAL
		},
		service: (name) => {
			const on = store.service === name
			setStore((s) => ({ ...s, service: on ? null : name }))
			toast(on ? "All services" : `Only ${name}`)
		},
		power: (on) => setStore((s) => ({ ...s, power: on ? "on" : "off" })),
		type: (update) => setStore((s) => ({ ...s, draft: update(s.draft).slice(0, 40) })),
	}

	// The keyboard works like the Remote: arrows move, Enter is OK, Escape and Backspace are Back, H is Home, M is
	// the menu, S is search ("/" is the site's own search). On the search screen, typing goes to the TV.
	const latest = useRef(tv)
	latest.current = tv
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement
			if (target.closest("input, textarea, select, [contenteditable]")) return
			if (e.metaKey || e.ctrlKey || e.altKey) return
			if ((e.key === "Enter" || e.key === " ") && target.closest("button, a")) return
			const k = latest.current
			// While the set is off, any key turns it on.
			if (k.store.power === "off") {
				k.power(true)
				e.preventDefault()
				return
			}
			const typing = k.top === "search" && !k.leaving && k.store.power === "on"
			if (typing && e.key === "Backspace" && k.store.draft) k.type((d) => d.slice(0, -1))
			else if (typing && /^[\p{L}\p{N} ]$/u.test(e.key)) k.type((d) => d + e.key)
			else if (e.key === "ArrowUp") k.move("up")
			else if (e.key === "ArrowDown") k.move("down")
			else if (e.key === "ArrowLeft") k.move("left")
			else if (e.key === "ArrowRight") k.move("right")
			else if (e.key === "Enter") k.ok()
			else if (e.key === "Escape" || e.key === "Backspace") k.back()
			else if (e.key === "h" || e.key === "H") k.home()
			else if (e.key === "m" || e.key === "M") k.toggleMenu()
			else if (e.key === "s" || e.key === "S") k.openSearch()
			else return
			e.preventDefault()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	return tv
}

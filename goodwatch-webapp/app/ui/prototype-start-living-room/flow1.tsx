// PROTOTYPE - throwaway. The TV screens and the user flow (#187), round 1. Round 4's TV is the baseline; this
// round trims every screen to one job and answers the ticket's open points:
//   - first-time guest versus returning member (members get a personalized TV home),
//   - what "Tonight" and "Pick for me" lead to (the `guided` flow from the superseded start page, #178),
//   - Taste, Discover, Explorer, and Watch now close to the start (the remote's feature keys and the TV's menu),
//   - where the person leaves the living room: the camera steps into the TV and the page takes over.
// Three flows (?variant=): `ask` (the TV asks, then answers), `launcher` (a smart-TV home: a hero, a Tonight row,
// and an apps row), `tonight` (the answer first: three picks the moment the set is on).
//
// The brain is the rec-home model (useHome): real Wishlist, ratings, services, taste match, and the guests'
// in-browser taste from this-or-that answers. The state below keeps round 4's shape so the round 8 remote
// drives it unchanged. Nothing persists; a reload starts over.
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogo from "~/img/metacritic-logo-icon-250.png"
import rottenLogo from "~/img/rotten-logo-icon-250.png"
import type { LRServiceButton } from "~/server/prototype-start-living-room.server"
import { PILLAR_CONFIG, type PillarName } from "~/ui/fingerprint/Pillars"
import type { Home } from "~/ui/prototype-rec-home/model"
import { and } from "~/ui/prototype-rec-home/taste"
import { watchLine as watchLineOf } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, detailsHref, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { MOODS, MOOD, type MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { GwBadge, Search, ease } from "./channels"
import { Icon } from "./r3"
import { Keyboard, type PageId, SEARCH_PRESETS, type Tv4 } from "./r4"
import { SUGGESTIONS } from "./remote2"
import { type Zapper, zapSound } from "./tv"

export type Flow = "ask" | "launcher" | "tonight"

export const FLOWS: Record<Flow, { name: string; idea: string }> = {
	ask: { name: "Ask, then answer", idea: "Guests: find my tonight (services, this or that, picks). Members: what kind of night, from where, three picks." },
	launcher: { name: "Smart-TV home", idea: "A hero that follows the focus, a Tonight row, and an apps row with Watch now, Taste, Discover, and Explorer." },
	tonight: { name: "Answer first", idea: "The set comes on showing three picks for tonight. Everything else is one step from there." },
}

// Where each page's prototype runs today (the main checkout's dev server), for the exit screen.
const PROTOTYPE_AT: Record<PageId, string> = {
	watchnext: "/prototype/rec-watch-next-8",
	taste: "/prototype/rec-taste-6",
	discover: "/prototype/rec-discover-4",
	explorer: "/prototype/rec-explorer-7",
}
const PROTO_ORIGIN = "http://localhost:3003"

const APP: Record<PageId, { name: string; line: string; d: string; tint: string }> = {
	watchnext: { name: "Watch now", line: "Your Wishlist, best match first, on your services.", d: "M6 4h12v16l-6-4-6 4z", tint: "#38bdf8" },
	taste: { name: "Taste", line: "The sides of you, you versus everyone, and your fingerprint.", d: "M12 11v3M8.5 8.5a5 5 0 0 1 7 0M6 12a6 6 0 0 1 12 0v2M9 13v1a3 3 0 0 0 6 0", tint: "#f472b6" },
	discover: { name: "Discover", line: "Browse and search everything, sorted for you.", d: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z", tint: "#34d399" },
	explorer: { name: "Explorer", line: "Wander a map of titles grouped by how they feel.", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z", tint: "#a78bfa" },
}
const APPS: PageId[] = ["watchnext", "taste", "discover", "explorer"]

type Scr =
	| { k: "boot" }
	| { k: "home" }
	| { k: "about" }
	| { k: "services" }
	| { k: "duel" }
	| { k: "moods" }
	| { k: "from" }
	| { k: "tonight" }
	| { k: "title"; key: string }
	| { k: "page"; id: PageId }
	| { k: "keyboard" }
	| { k: "search" }

type Night = { mood: MoodKey | null; from: "auto" | "wish" | "new" }
export type Exit = { kind: "page"; id: PageId } | { kind: "title"; key: string }

// Someone with no saved services has no "yours": just say where it streams.
let noServices = false
const watchLine = (t: WTitle) => {
	const w = watchLineOf(t)
	return noServices && w.offer ? { ...w, text: `On ${w.offer.name}` } : w
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

// ---------------------------------------------------------------------------------------------------------
// State. Round 4's shape (stack, focus, mode, step, ok, back, pick...) so the round 8 remote drives it as is.

export function useFlow(z: Zapper, h: Home, flow: Flow, services: LRServiceButton[]) {
	const [stack, setStack] = useState<Scr[]>([{ k: "boot" }])
	const [focus, setFocus] = useState(0)
	const [mode, setMode] = useState<"nav" | "mood" | "search">("nav")
	const [night, setNight] = useState<Night>({ mood: null, from: "auto" })
	const [svc, setSvc] = useState<string | null>(null)
	const [draft, setDraft] = useState("")
	const [query, setQuery] = useState<string | null>(null)
	const [pulse, setPulse] = useState(0)
	const [menu, setMenu] = useState(false)
	const [exit, setExit] = useState<Exit | null>(null)
	const [note, setNote] = useState<{ id: number; text: string } | null>(null)
	const top = stack[stack.length - 1]
	const member = !h.guest
	noServices = !h.hasServices

	useEffect(() => {
		if (z.on) return
		setMode("nav")
		setStack([{ k: "boot" }])
	}, [z.on])
	// A short boot: the logo, then home.
	useEffect(() => {
		if (!z.on || top.k !== "boot") return
		const t = setTimeout(() => setStack([{ k: "home" }]), 1700)
		return () => clearTimeout(t)
	}, [z.on, top.k])
	useEffect(() => {
		if (!note) return
		const t = setTimeout(() => setNote(null), 2600)
		return () => clearTimeout(t)
	}, [note])
	// The model's own toasts (Want to See, Seen it, Not interested) show on the TV.
	useEffect(() => {
		if (h.toast) setNote({ id: h.toast.id, text: h.toast.text })
	}, [h.toast?.id])

	const click = useCallback(() => setPulse((p) => p + 1), [])
	const say = (text: string) => setNote({ id: Date.now(), text })

	const go = (s: Scr) => {
		setMenu(false)
		setMode("nav")
		setFocus(0)
		setStack((st) => [...st.filter((x) => x.k !== "boot"), s])
		zapSound()
	}
	const replace = (s: Scr) => {
		setFocus(0)
		setStack((st) => [...st.slice(0, -1), s])
	}
	const back = () => {
		if (menu) return setMenu(false)
		setMode("nav")
		setFocus(0)
		setStack((st) => (st.length > 1 && st[st.length - 1].k !== "home" ? st.slice(0, -1) : st))
	}
	const home = () => {
		setMenu(false)
		setMode("nav")
		setFocus(0)
		setStack([{ k: "home" }])
	}

	// ------------------------------------------------------------- what tonight's picks are
	const inMood = (t: WTitle) => !night.mood || (h.data.extra[t.key]?.m ?? []).includes(night.mood as never)
	const onSvc = (t: WTitle) => !svc || t.offers.some((o) => norm(o.name).includes(norm(svc)))
	const wish = h.watchNext.filter((t) => inMood(t) && onSvc(t))
	const fresh = h.picks.filter((t) => inMood(t) && onSvc(t))
	const source: "wish" | "new" = night.from === "auto" ? (member && wish.length ? "wish" : "new") : night.from
	const options = (source === "wish" ? wish : fresh).slice(0, 3)
	const moodCount = (m: MoodKey) => h.watchNext.filter((t) => (h.data.extra[t.key]?.m ?? []).includes(m as never)).length

	// ------------------------------------------------------------- what the wheel moves through, per screen
	const pairAt = () => {
		const done = new Set(h.answers.map((a) => a.pair))
		return h.data.pairs.findIndex((_, i) => !done.has(i))
	}
	const answered = h.answers.filter((a) => a.side !== "skip").length
	const launcherRow = (member ? [...h.watchNext.slice(0, 3), ...h.picks.slice(0, 3)] : h.picks.slice(0, 6)).map((t) => `t:${t.key}`)
	const items = (s: Scr): string[] => {
		switch (s.k) {
			case "home":
				if (flow === "launcher") return [...(member ? [] : ["go:services"]), ...launcherRow, ...APPS.map((a) => `page:${a}`), ...(member ? [] : ["go:about"])]
				if (flow === "tonight") return tonightItems()
				return member ? moodItems(true) : ["go:services", "go:quick", "go:about"]
			case "about":
				return ["go:services", "go:quick"]
			case "services":
				return [...h.data.catalog.slice(0, 12).map((c) => `svc:${c.name}`), "go:duel"]
			case "duel":
				return ["duel:a", "duel:b", "duel:skip", ...(answered >= 3 ? ["duel:done"] : [])]
			case "moods":
				return moodItems(false)
			case "from":
				return ["from:wish", "from:new"]
			case "tonight":
				return tonightItems()
			case "title": {
				const t = h.T(s.key)
				return t ? [`watch:${t.key}`, `want:${t.key}`, `seen:${t.key}`, `no:${t.key}`, `exit:title:${t.key}`] : []
			}
			case "page":
				return s.id === "watchnext" && member ? [...h.watchNext.slice(0, 6).map((t) => `t:${t.key}`), "exit:page:watchnext"] : [`exit:page:${s.id}`]
			default:
				return []
		}
	}
	function moodItems(doors: boolean) {
		return ["mood:any", ...MOODS.map((m) => `mood:${m.key}`), ...(doors ? APPS.map((a) => `page:${a}`) : [])]
	}
	function tonightItems() {
		return [
			...options.map((t) => `t:${t.key}`),
			"go:moods",
			...(member ? ["night:switch"] : [answered ? "go:duel" : "go:services"]),
			...(flow === "tonight" ? APPS.map((a) => `page:${a}`) : []),
		]
	}
	const list = items(top)
	const focused = list[Math.min(focus, list.length - 1)] ?? ""
	const isFocus = (v: string) => mode === "nav" && !menu && focused === v
	const hover = (v: string) => {
		const i = list.indexOf(v)
		if (i >= 0) setFocus(i)
	}

	// ------------------------------------------------------------- actions
	const startPicks = () => {
		if (member) return go({ k: "moods" })
		if (!h.mine.length && !answered) return go({ k: "services" })
		go({ k: "duel" })
	}
	const leave = (x: Exit) => {
		setMenu(false)
		setExit(x)
	}
	const run = (v: string) => {
		click()
		if (v.startsWith("key:")) {
			const k = v.slice(4)
			if (k === "del") setDraft((d) => d.slice(0, -1))
			else if (k === "space") setDraft((d) => (d.endsWith(" ") || !d ? d : `${d} `))
			else if (k === "go") submit()
			else setDraft((d) => (d + k).slice(0, 120))
		} else if (v.startsWith("preset:")) submit(SEARCH_PRESETS[Number(v.slice(7))])
		else if (v === "go:quick") {
			setNight({ mood: null, from: "new" })
			go({ k: "tonight" })
		} else if (v === "go:moods") go({ k: "moods" })
		else if (v === "go:duel") go({ k: "duel" })
		else if (v === "go:services") go({ k: "services" })
		else if (v === "go:about") go({ k: "about" })
		else if (v.startsWith("page:")) go({ k: "page", id: v.slice(5) as PageId })
		else if (v.startsWith("mood:")) {
			const m = v.slice(5)
			setNight({ mood: m === "any" ? null : (m as MoodKey), from: "auto" })
			// Changing the mood of the picks on screen goes straight back to them. Otherwise members choose where
			// from; guests have no Wishlist yet, so their picks come straight up.
			if (top.k === "moods" && stack.some((x) => x.k === "tonight" || (flow === "tonight" && x.k === "home"))) back()
			else if (member && flow === "ask") go({ k: "from" })
			else go({ k: "tonight" })
		} else if (v.startsWith("from:")) {
			setNight((n) => ({ ...n, from: v.slice(5) as "wish" | "new" }))
			go({ k: "tonight" })
		} else if (v === "night:switch") setNight((n) => ({ ...n, from: source === "wish" ? "new" : "wish" }))
		else if (v.startsWith("svc:")) h.toggleService(v.slice(4))
		else if (v.startsWith("duel:")) {
			const side = v.slice(5)
			if (side === "done") return replace({ k: "tonight" })
			const i = pairAt()
			if (i < 0) return
			h.pickSide(i, side as "a" | "b" | "skip")
			// The last pair answered: straight to the picks.
			if (h.answers.length + 1 >= h.data.pairs.length) {
				setNight({ mood: null, from: "new" })
				replace({ k: "tonight" })
			}
		} else if (v.startsWith("t:")) go({ k: "title", key: v.slice(2) })
		else if (v.startsWith("want:")) h.want(v.slice(5))
		else if (v.startsWith("seen:")) (h.seen(v.slice(5)), back())
		else if (v.startsWith("no:")) (h.no(v.slice(3)), back())
		else if (v.startsWith("watch:")) {
			const t = h.T(v.slice(6))
			const w = t ? watchLine(t) : null
			say(w?.offer ? `Prototype: this opens ${w.offer.name}.` : "Prototype: not streaming here.")
		} else if (v.startsWith("exit:page:")) leave({ kind: "page", id: v.slice(10) as PageId })
		else if (v.startsWith("exit:title:")) leave({ kind: "title", key: v.slice(11) })
		else if (v === "bar:more") setMenu((m) => !m)
		else if (v.startsWith("bar:")) {
			setMenu(false)
			const a = v.slice(4)
			if (a === "back") back()
			else if (a === "home") home()
			else if (a === "search") pickMode("search")
			else if (a === "mood") go({ k: "moods" })
			else if (a === "picks") startPicks()
			else if (a === "power") z.setOn(false)
			else if (a.startsWith("page:")) go({ k: "page", id: a.slice(5) as PageId })
		}
	}
	const pick = (el: HTMLElement) => run(el.dataset.pick ?? "")

	const submit = (text = draft) => {
		const q = text.trim()
		if (q.length < 2) return
		setDraft(q)
		setQuery(q)
		setMode("nav")
		if (top.k === "keyboard" || top.k === "search") replace({ k: "search" })
		else go({ k: "search" })
	}
	const pickMode = (m: "mood" | "search") => {
		click()
		setMenu(false)
		if (m === "mood") return top.k === "moods" ? back() : go({ k: "moods" })
		if (mode === "search") {
			setMode("nav")
			if (top.k === "keyboard") back()
			return
		}
		if (top.k !== "keyboard") go({ k: "keyboard" })
		setMode("search")
	}
	const step = (d: 1 | -1) => {
		click()
		if (mode === "search") {
			const i = (SUGGESTIONS.indexOf(draft) + d + SUGGESTIONS.length) % SUGGESTIONS.length
			return setDraft(SUGGESTIONS[i])
		}
		if (list.length) setFocus((f) => (Math.min(f, list.length - 1) + d + list.length) % list.length)
	}
	const ok = () => {
		if (mode === "search") return (click(), submit())
		if (focused) run(focused)
	}
	// The remote's streaming keys: guests on the services screen pick services; everywhere else they narrow
	// tonight's picks to one service.
	const pickService = (key: string) => {
		click()
		const label = services.find((s) => s.key === key)?.label ?? key
		if (top.k === "services") {
			const c = h.data.catalog.find((x) => norm(x.name).includes(norm(label)))
			if (c) h.toggleService(c.name)
			return
		}
		setSvc((s) => (s === label ? null : label))
		if (top.k !== "tonight" && !(flow === "tonight" && top.k === "home")) go({ k: "tonight" })
	}

	const lcd = lcdFor()
	function lcdFor(): [string, string] {
		const label = (v: string) => {
			if (v.startsWith("t:")) return h.T(v.slice(2))?.title ?? "Title"
			if (v.startsWith("page:")) return APP[v.slice(5) as PageId].name
			if (v.startsWith("mood:")) return v === "mood:any" ? "Any mood" : MOOD[v.slice(5) as MoodKey].name
			if (v.startsWith("svc:")) return v.slice(4)
			return (
				{
					"go:services": member ? "Services" : "Find my tonight",
					"go:quick": "Just show me",
					"go:about": "What is GoodWatch?",
					"go:moods": "Another mood",
					"go:duel": top.k === "services" ? "Continue" : "Change answers",
					"night:switch": source === "wish" ? "Something new" : "From my Wishlist",
					"from:wish": "From my Wishlist",
					"from:new": "Something new",
					"duel:a": "This one",
					"duel:b": "That one",
					"duel:skip": "Skip",
					"duel:done": "Show my picks",
				}[v] ?? (v.startsWith("watch:") ? "Watch" : v.startsWith("want:") ? "Want to See" : v.startsWith("seen:") ? "Seen it" : v.startsWith("no:") ? "Not interested" : v.startsWith("exit:") ? "Open full page" : "")
			)
		}
		if (top.k === "boot") return ["Starting…", "GoodWatch"]
		if (top.k === "keyboard") return ["Search", "Type, or point at the keys"]
		if (top.k === "search") return ["Search", "Point at a title to open it"]
		return [label(focused) || "GoodWatch", "Turn to choose, OK to open"]
	}

	return {
		// Round 4's fields, read by the remote.
		stack,
		top: top as unknown as Tv4["top"],
		focus,
		setFocus,
		mode,
		moodIdx: 0,
		mix: { switches: {}, service: services.find((s) => s.label === svc)?.key ?? null, seeds: [], label: null },
		menu,
		draft,
		setDraft,
		query,
		loved: h.loved,
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
		pickService,
		pick,
		submit,
		startPicks,
		openPage: (id: PageId) => (click(), go({ k: "page", id })),
		openTitle: (key: string) => (click(), go({ k: "title", key })),
		okLabel: mode === "search" ? "GO" : "OK",
		country: h.data.country ?? "US",
		lcd,
		// This round's own.
		scr: top,
		flow,
		h,
		night,
		svc,
		options,
		source,
		wish,
		moodCount,
		isFocus,
		hover,
		pairAt,
		answered,
		launcherRow,
		exit,
		setExit,
		note,
		member,
	}
}

export type FlowT = ReturnType<typeof useFlow>

// ---------------------------------------------------------------------------------------------------------
// The TV.

export function FlowScreen({ t }: { t: FlowT }) {
	const s = t.scr
	const key = s.k === "title" ? `t-${s.key}` : s.k === "page" ? `p-${s.id}` : s.k
	return (
		<div data-flow-screen className="absolute inset-0 overflow-hidden bg-[#07080b] text-white">
			<AnimatePresence initial={false}>
				<motion.div key={key} className="absolute inset-0" initial={{ opacity: 0, scale: 1.015 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26, ease }}>
					{s.k === "boot" && <Boot />}
					{s.k === "home" && <HomeScreen t={t} />}
					{s.k === "about" && <About t={t} />}
					{s.k === "services" && <Services t={t} />}
					{s.k === "duel" && <Duel t={t} />}
					{s.k === "moods" && <Moods t={t} doors={false} />}
					{s.k === "from" && <From t={t} />}
					{s.k === "tonight" && <Tonight t={t} doors={false} />}
					{s.k === "title" && <TitleScreen t={t} k={s.key} />}
					{s.k === "page" && <AppScreen t={t} id={s.id} />}
					{s.k === "keyboard" && <Keyboard t={t as unknown as Tv4} />}
					{s.k === "search" && t.query && <Search queries={SUGGESTIONS} fixed={t.query} />}
				</motion.div>
			</AnimatePresence>
			{s.k !== "boot" && <Bar t={t} />}
			<AnimatePresence>
				{t.note && (
					<motion.div key={t.note.id} className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-white/95 px-5 py-2 text-[15px] font-semibold text-black shadow-2xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
						{t.note.text}
					</motion.div>
				)}
			</AnimatePresence>
			{t.exit && typeof document !== "undefined" && createPortal(<ExitLayer t={t} />, document.body)}
		</div>
	)
}

function Boot() {
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
			<motion.img src={gwLogo} alt="" className="h-16" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} />
			<motion.div className="mt-5 text-[26px] font-bold tracking-[0.35em] text-white/90" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.5 }}>
				GOODWATCH
			</motion.div>
		</div>
	)
}

// A focusable thing on the TV: pointing at it focuses it, the wheel moves the focus, OK or a click opens it.
function F({ t, v, className = "", on = "ring-amber-300 bg-white/[0.10]", off = "ring-white/5 bg-white/[0.04]", children, scale = 1.04 }: { t: FlowT; v: string; className?: string; on?: string; off?: string; children: ReactNode; scale?: number }) {
	const f = t.isFocus(v)
	return (
		<motion.button type="button" data-pick={v} onMouseEnter={() => t.hover(v)} className={`relative text-left ring-2 transition-colors ${f ? on : off} ${className}`} animate={{ scale: f ? scale : 1 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}>
			{children}
		</motion.button>
	)
}

function Head({ title, line, eyebrow }: { title: string; line?: ReactNode; eyebrow?: string }) {
	return (
		<div className="absolute left-12 right-44 top-9">
			{eyebrow && <div className="mb-1 text-[12px] font-bold uppercase tracking-[0.25em] text-amber-300/80">{eyebrow}</div>}
			<div className="text-[34px] font-extrabold leading-none tracking-tight">{title}</div>
			{line && <div className="mt-2 text-[15px] text-white/60">{line}</div>}
		</div>
	)
}

function Backdrop({ t, dim = 0.22 }: { t?: WTitle | null; dim?: number }) {
	return (
		<AnimatePresence initial={false}>
			{t?.backdrop && <motion.img key={t.key} src={backdropUrl(t, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover" initial={{ opacity: 0 }} animate={{ opacity: dim }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} />}
		</AnimatePresence>
	)
}

function Coin({ t, className = "" }: { t: WTitle; className?: string }) {
	if (t.match == null) return null
	return <span className={`rounded-full bg-gradient-to-b from-amber-400 to-amber-600 px-2 py-0.5 text-[13px] font-black tabular-nums text-black ring-2 ring-black/60 ${className}`}>{t.match}</span>
}

// ---------------------------------------------------------------------------------------------------------
// Home, per flow and audience.

function HomeScreen({ t }: { t: FlowT }) {
	if (t.flow === "launcher") return <Launcher t={t} />
	if (t.flow === "tonight") return <Tonight t={t} doors />
	return t.member ? <Moods t={t} doors /> : <Welcome t={t} />
}

// `ask`, guests: one question, three ways in.
function Welcome({ t }: { t: FlowT }) {
	const p = t.h.picks
	const cols: { v: string; label: string; line: string; art: ReactNode }[] = [
		{ v: "go:services", label: "Find my tonight", line: "Three quick questions, then your picks.", art: <Fan posters={p.slice(3, 6)} heart /> },
		{ v: "go:quick", label: "Just show me", line: "The best rated, right now.", art: <Fan posters={p.slice(0, 3)} /> },
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
			<Backdrop t={p[0]} dim={0.18} />
			<Head title="Let's find something good for tonight." />
			<div className="absolute inset-x-12 bottom-12 top-[120px] grid grid-cols-3 gap-6">
				{cols.map((c) => (
					<F key={c.v} t={t} v={c.v} className="flex flex-col overflow-hidden rounded-3xl">
						<div className="relative h-[200px] w-full">{c.art}</div>
						<div className="px-6 pt-2">
							<div className="text-[24px] font-extrabold leading-tight">{c.label}</div>
							<div className="mt-1 text-[15px] leading-snug text-white/60">{c.line}</div>
						</div>
					</F>
				))}
			</div>
		</>
	)
}

function Fan({ posters, heart }: { posters: WTitle[]; heart?: boolean }) {
	return (
		<div className="absolute inset-0 flex items-center justify-center">
			{posters.slice(0, 3).map((p, i) => (
				<div key={p.key} className="relative -mx-3 first:mt-6 last:mt-6" style={{ transform: `rotate(${(i - 1) * 7}deg)`, zIndex: i === 1 ? 2 : 1 }}>
					<img src={posterUrl(p, "w185")} alt="" className="w-[86px] rounded-lg shadow-xl ring-1 ring-white/10" />
					{heart && i === 1 && <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-[13px] text-black">♥</span>}
				</div>
			))}
		</div>
	)
}

// `launcher`: a hero that follows the focus, a Tonight row, and an apps row.
function Launcher({ t }: { t: FlowT }) {
	const h = t.h
	const row = t.launcherRow.map((v) => h.T(v.slice(2))).filter((x): x is WTitle => !!x)
	const focusedTitle = row.find((x) => t.isFocus(`t:${x.key}`))
	const focusedApp = APPS.find((a) => t.isFocus(`page:${a}`))
	const hero = focusedTitle ?? row[0]
	const w = hero ? watchLine(hero) : null
	return (
		<>
			<Backdrop t={focusedApp ? null : hero} dim={0.55} />
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
			<div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
			<div className="absolute left-12 top-10 max-w-[520px]">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div key={focusedApp ?? hero?.key ?? "x"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
						{focusedApp ? (
							<>
								<div className="text-[12px] font-bold uppercase tracking-[0.25em]" style={{ color: APP[focusedApp].tint }}>
									GoodWatch
								</div>
								<div className="mt-1 text-[40px] font-extrabold leading-none">{APP[focusedApp].name}</div>
								<div className="mt-3 text-[16px] text-white/70">{appLine(t, focusedApp)}</div>
							</>
						) : hero ? (
							<>
								<div className="text-[12px] font-bold uppercase tracking-[0.25em] text-amber-300/80">{t.member ? (h.watchNext.some((x) => x.key === hero.key) ? "From your Wishlist" : "New for you") : "Best rated right now"}</div>
								<div className="mt-1 line-clamp-2 text-[40px] font-extrabold leading-none">{hero.title}</div>
								<div className="mt-3 flex items-center gap-3 text-[15px] text-white/70">
									<GwBadge gw={hero.score} size={26} text="text-[18px]" />
									<Coin t={hero} />
									<span>{[hero.year, runtimeLabel(hero), w?.text].filter(Boolean).join(" · ")}</span>
								</div>
								<div className="mt-2 line-clamp-2 text-[14px] text-white/55">{hero.tagline || hero.synopsis}</div>
							</>
						) : null}
					</motion.div>
				</AnimatePresence>
			</div>
			<div className="absolute inset-x-12 top-[248px]">
				<div className="mb-2 flex items-center gap-3 text-[14px] font-bold text-white/80">
					Tonight
					{!t.member && (
						<F t={t} v="go:services" className="rounded-full px-3 py-0.5 text-[12px] font-bold text-amber-200" on="ring-amber-300 bg-amber-400/20" off="ring-amber-300/30 bg-amber-400/10">
							♥ Make it mine
						</F>
					)}
				</div>
				<div className="flex gap-3">
					{row.map((x) => (
						<F key={x.key} t={t} v={`t:${x.key}`} className="h-[78px] w-[132px] shrink-0 overflow-hidden rounded-xl" scale={1.08}>
							<img src={backdropUrl(x, "w300")} alt="" className="h-full w-full object-cover" />
							<span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-2 pb-1 pt-4 text-[12px] font-semibold">{x.title}</span>
						</F>
					))}
				</div>
			</div>
			<div className="absolute inset-x-12 top-[372px]">
				<div className="mb-2 text-[14px] font-bold text-white/80">Apps</div>
				<div className="flex gap-3">
					{APPS.map((a) => (
						<F key={a} t={t} v={`page:${a}`} className="flex h-[74px] w-[150px] items-center gap-3 rounded-xl px-4" scale={1.08}>
							<span style={{ color: APP[a].tint }}>
								<Icon d={APP[a].d} className="h-6 w-6" />
							</span>
							<span className="text-[16px] font-bold">{APP[a].name}</span>
						</F>
					))}
					{!t.member && (
						<F t={t} v="go:about" className="flex h-[74px] w-[150px] items-center gap-3 rounded-xl px-4" scale={1.08}>
							<img src={gwLogo} alt="" className="h-6" />
							<span className="text-[14px] font-bold leading-tight">What is GoodWatch?</span>
						</F>
					)}
				</div>
			</div>
		</>
	)
}

function appLine(t: FlowT, id: PageId) {
	const h = t.h
	if (id === "watchnext") return t.member ? `${h.watchNext.length} on your Wishlist you can play tonight, best match first.` : "Save what you want to see; it waits here, best match first."
	if (id === "taste") return h.leans.length ? `You go for ${and(h.leans)}.` : APP.taste.line
	return APP[id].line
}

// ---------------------------------------------------------------------------------------------------------
// The guided screens.

const PILLARS: PillarName[] = ["Energy", "Heart", "Humor", "World", "Craft", "Style"]

// Trimmed: three facts on one screen, not three more screens to open.
function About({ t }: { t: FlowT }) {
	const d = t.h.picks[0]
	return (
		<>
			<Head title="What is GoodWatch?" line="Everything you need to decide, before you press play." />
			<div className="absolute inset-x-12 top-[132px] grid grid-cols-3 gap-6">
				<Fact title="One score" line="IMDb, Rotten Tomatoes, and Metacritic in one number.">
					<div className="flex items-center gap-3">
						<div className="flex flex-col gap-1.5 opacity-80">
							{[imdbLogo, rottenLogo, metacriticLogo].map((s) => (
								<img key={s} src={s} alt="" className="h-6 w-6 object-contain" />
							))}
						</div>
						<span className="text-[22px] text-white/40">→</span>
						<GwBadge gw={d?.score ?? 85} size={50} text="text-[36px]" />
					</div>
				</Fact>
				<Fact title="How it feels" line="Energy, heart, humor, and more, at a glance.">
					<div className="flex w-full flex-col gap-1.5 px-6">
						{PILLARS.map((p, i) => (
							<div key={p} className="flex items-center gap-2">
								<span className="w-5 text-[13px]">{PILLAR_CONFIG[p].emoji}</span>
								<span className="flex flex-1 gap-1">
									{[0, 1, 2, 3].map((j) => (
										<span key={j} className={`h-2 flex-1 rounded-sm ${j < [3, 2, 1, 3, 4, 2][i] ? "bg-orange-300" : "bg-white/10"}`} />
									))}
								</span>
							</div>
						))}
					</div>
				</Fact>
				<Fact title="Where it streams" line="Your services first, in your country.">
					<div className="grid grid-cols-3 gap-2 px-8">
						{t.h.data.catalog.slice(0, 6).map((c) => (
							<img key={c.name} src={c.logo} alt="" className="aspect-square w-full rounded-xl" />
						))}
					</div>
				</Fact>
			</div>
			<div className="absolute bottom-10 left-12 flex gap-3">
				<F t={t} v="go:services" className="rounded-full px-6 py-3 text-[17px] font-bold" on="ring-amber-300 bg-amber-400 text-black" off="ring-transparent bg-amber-400/90 text-black">
					Find my tonight
				</F>
				<F t={t} v="go:quick" className="rounded-full px-6 py-3 text-[17px] font-semibold">
					Just show me
				</F>
			</div>
		</>
	)
}

function Fact({ title, line, children }: { title: string; line: string; children: ReactNode }) {
	return (
		<div className="flex flex-col rounded-3xl bg-white/[0.04] ring-1 ring-white/5">
			<div className="flex h-[160px] items-center justify-center">{children}</div>
			<div className="px-5 pb-5">
				<div className="text-[21px] font-extrabold">{title}</div>
				<div className="mt-1 text-[14px] leading-snug text-white/60">{line}</div>
			</div>
		</div>
	)
}

function Steps({ at, of }: { at: number; of: number }) {
	return (
		<div className="absolute right-12 top-[92px] flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/40">
			{Array.from({ length: of }, (_, i) => (
				<span key={i} className={`h-1.5 rounded-full ${i < at ? "w-6 bg-amber-400" : i === at ? "w-6 bg-white/60" : "w-3 bg-white/20"}`} />
			))}
		</div>
	)
}

function Services({ t }: { t: FlowT }) {
	const h = t.h
	return (
		<>
			<Head eyebrow="1 of 3" title="Where do you watch?" line="Pick every service you have. The streaming keys on the remote work too." />
			<div className="absolute inset-x-12 top-[150px] grid grid-cols-4 gap-3">
				{h.data.catalog.slice(0, 12).map((c) => {
					const on = h.mine.includes(c.name)
					return (
						<F key={c.name} t={t} v={`svc:${c.name}`} className="flex h-[58px] items-center gap-3 rounded-2xl pr-3" off={on ? "ring-green-500 bg-green-500/10" : "ring-white/5 bg-white/[0.04]"} on={on ? "ring-green-400 bg-green-500/20" : "ring-amber-300 bg-white/[0.10]"}>
							<img src={c.logo} alt="" className="h-[54px] w-[54px] rounded-[14px]" />
							<span className="truncate text-[15px] font-semibold">{c.name}</span>
							{on && <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-[13px] font-black text-black">✓</span>}
						</F>
					)
				})}
			</div>
			<div className="absolute bottom-10 left-12">
				<F t={t} v="go:duel" className="rounded-full px-7 py-3 text-[17px] font-bold" on="ring-amber-300 bg-white text-black" off="ring-transparent bg-white/90 text-black">
					{h.mine.length ? `Continue with ${h.mine.length}` : "Continue without"}
				</F>
			</div>
		</>
	)
}

function Duel({ t }: { t: FlowT }) {
	const h = t.h
	const i = t.pairAt()
	const p = h.data.pairs[i]
	if (!p) return null
	const side = (k: string, s: "a" | "b", label: string) => {
		const x = h.T(k)
		if (!x) return null
		return (
			<F t={t} v={`duel:${s}`} className="flex w-[300px] items-center gap-4 rounded-3xl p-3" scale={1.05}>
				<img src={posterUrl(x, "w185")} alt="" className="h-[210px] w-[140px] rounded-xl object-cover" />
				<div className="min-w-0">
					<div className="text-[20px] font-extrabold leading-tight">{label}</div>
					<div className="mt-2 line-clamp-2 text-[14px] text-white/60">
						{x.title} <span className="text-white/35">({x.year})</span>
					</div>
				</div>
			</F>
		)
	}
	return (
		<>
			<Backdrop t={h.T(p.a)} dim={0.12} />
			<Head eyebrow="2 of 3" title="Which one, tonight?" line="No need to have seen them. Go with your gut." />
			<Steps at={h.answers.length} of={h.data.pairs.length} />
			<AnimatePresence mode="wait" initial={false}>
				<motion.div key={i} className="absolute inset-x-12 top-[142px] flex items-center justify-center gap-6" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22 }}>
					{side(p.a, "a", p.left)}
					<span className="text-[22px] font-bold text-white/40">or</span>
					{side(p.b, "b", p.right)}
				</motion.div>
			</AnimatePresence>
			<div className="absolute bottom-9 left-12 flex items-center gap-3">
				<F t={t} v="duel:skip" className="rounded-full px-5 py-2.5 text-[15px] font-semibold">
					Skip
				</F>
				{t.answered >= 3 && (
					<F t={t} v="duel:done" className="rounded-full px-6 py-2.5 text-[16px] font-bold" on="ring-amber-300 bg-amber-400 text-black" off="ring-transparent bg-amber-400/90 text-black">
						♥ Show my picks
					</F>
				)}
				<span className="text-[13px] text-white/40">{t.answered >= 3 ? "Three are enough, six are better." : `${3 - t.answered} more for your picks.`}</span>
			</div>
		</>
	)
}

// The moods: members see how many fit on their Wishlist. On the `ask` home, the doors sit underneath.
function Moods({ t, doors }: { t: FlowT; doors: boolean }) {
	const hour = new Date().getHours()
	const hi = hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening."
	return (
		<>
			<div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_30%_0%,#2b1706_0%,#08070a_62%)]" />
			<Head eyebrow={doors ? hi : undefined} title="What kind of night?" line={t.member ? "Numbers are what fits on your Wishlist, on your services." : undefined} />
			<div className={`absolute inset-x-12 grid grid-cols-4 gap-2.5 ${doors ? "top-[128px]" : "top-[140px]"}`}>
				<F t={t} v="mood:any" className="flex h-[60px] items-center gap-3 rounded-2xl px-4">
					<span className="h-7 w-1.5 rounded-full bg-white/60" />
					<span className="text-[17px] font-bold">Any mood</span>
				</F>
				{MOODS.map((m) => {
					const n = t.member ? t.moodCount(m.key) : null
					return (
						<F key={m.key} t={t} v={`mood:${m.key}`} className="flex h-[60px] items-center gap-3 rounded-2xl px-4">
							<span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: m.hue }} />
							<span className="min-w-0 flex-1 truncate text-[17px] font-bold">{m.name}</span>
							{n != null && <span className={`text-[13px] tabular-nums ${n ? "text-white/60" : "text-white/25"}`}>{n}</span>}
						</F>
					)
				})}
			</div>
			{doors && <Doors t={t} />}
		</>
	)
}

// Taste, Discover, Explorer, and Watch now as a thin row near the bottom of the start screen.
function Doors({ t }: { t: FlowT }) {
	return (
		<div className="absolute inset-x-12 bottom-8 flex items-center gap-3">
			<span className="mr-1 text-[12px] font-bold uppercase tracking-[0.2em] text-white/35">Or open</span>
			{APPS.map((a) => (
				<F key={a} t={t} v={`page:${a}`} className="flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold" scale={1.06}>
					<span style={{ color: APP[a].tint }}>
						<Icon d={APP[a].d} className="h-[18px] w-[18px]" />
					</span>
					{APP[a].name}
				</F>
			))}
		</div>
	)
}

function From({ t }: { t: FlowT }) {
	const h = t.h
	const mood = t.night.mood ? MOOD[t.night.mood].name : null
	const card = (v: string, title: string, line: string, art: WTitle[]) => (
		<F t={t} v={v} className="flex h-[250px] flex-col justify-end overflow-hidden rounded-3xl p-6">
			<span className="absolute -right-4 top-4 flex -space-x-10">
				{art.slice(0, 3).map((x, i) => (
					<img key={x.key} src={posterUrl(x, "w185")} alt="" className="h-[150px] w-[100px] rounded-lg object-cover shadow-2xl ring-1 ring-white/10" style={{ transform: `rotate(${(i - 1) * 6}deg)` }} />
				))}
			</span>
			<span className="absolute inset-0 bg-gradient-to-r from-[#0b0c10] via-[#0b0c10]/80 to-transparent" />
			<span className="relative max-w-[62%]">
				<span className="block text-[28px] font-extrabold leading-none">{title}</span>
				<span className="mt-2 block text-[15px] text-white/60">{line}</span>
			</span>
		</F>
	)
	const newArt = h.picks.filter((x) => !t.night.mood || (h.data.extra[x.key]?.m ?? []).includes(t.night.mood as never))
	return (
		<>
			<Head title={mood ? `${mood}. From where?` : "From where?"} />
			<div className="absolute inset-x-12 top-[120px] grid grid-cols-2 gap-6">
				{card("from:wish", "From my Wishlist", t.wish.length ? `${t.wish.length} fit, on your services, best match first.` : "Nothing on your Wishlist fits.", t.wish)}
				{card("from:new", "Something new", "Not seen yet, on your services, closest to your taste.", newArt)}
			</div>
		</>
	)
}

// The answer: three picks, the first one big. Every pick opens its title screen.
function Tonight({ t, doors }: { t: FlowT; doors: boolean }) {
	const h = t.h
	const [a, ...rest] = t.options
	const mood = t.night.mood ? MOOD[t.night.mood].name : null
	const where = t.svc ? `only ${t.svc}` : h.hasServices && !h.c.sel.everywhere ? "on your services" : "everywhere"
	const from = t.source === "wish" ? "From your Wishlist" : t.member ? "New to you" : h.hasTaste ? "Closest to your answers" : "Best rated right now"
	const line = [from, mood, where].filter(Boolean).join(" · ")
	return (
		<>
			<Backdrop t={a} dim={0.3} />
			<div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/20" />
			<Head title={doors ? (t.member ? "Tonight, for you." : "Tonight's picks.") : "Here's tonight."} line={line} />
			{!a && <div className="absolute left-12 top-[150px] text-[18px] text-white/60">Nothing fits. Try another mood, or everywhere.</div>}
			<div className={`absolute left-12 right-12 flex gap-5 ${doors ? "top-[112px]" : "top-[124px]"}`}>
				{a && (
					<F t={t} v={`t:${a.key}`} className="flex w-[430px] gap-4 rounded-3xl p-3" scale={1.03}>
						<img src={posterUrl(a, "w342")} alt="" className="h-[240px] w-[160px] rounded-xl object-cover" />
						<div className="min-w-0 py-1">
							<div className="line-clamp-2 text-[24px] font-extrabold leading-tight">{a.title}</div>
							<div className="mt-2 flex items-center gap-2">
								<GwBadge gw={a.score} size={24} text="text-[17px]" />
								<Coin t={a} />
							</div>
							<div className="mt-2 text-[13px] text-white/60">{[runtimeLabel(a), watchLine(a).text].join(" · ")}</div>
							{h.whyOf(a.key).length > 0 && <div className="mt-2 line-clamp-3 text-[13px] text-amber-100/80">For you: {and(h.whyOf(a.key))}.</div>}
						</div>
					</F>
				)}
				{rest.map((x) => (
					<F key={x.key} t={t} v={`t:${x.key}`} className="w-[150px] rounded-2xl p-2" scale={1.05}>
						<img src={posterUrl(x, "w185")} alt="" className="h-[200px] w-full rounded-xl object-cover" />
						<div className="mt-1.5 truncate text-[14px] font-bold">{x.title}</div>
						<div className="flex items-center gap-1.5 text-[12px] text-white/55">
							<Coin t={x} className="!px-1.5 !text-[11px]" />
							<span className="truncate">{watchLine(x).text}</span>
						</div>
					</F>
				))}
			</div>
			<div className={`absolute left-12 flex items-center gap-2.5 ${doors ? "bottom-[76px]" : "bottom-9"}`}>
				<F t={t} v="go:moods" className="rounded-full px-4 py-2 text-[14px] font-semibold">
					{mood ? `Mood: ${mood}` : "Pick a mood"}
				</F>
				{t.member ? (
					<F t={t} v="night:switch" className="rounded-full px-4 py-2 text-[14px] font-semibold">
						{t.source === "wish" ? "Something new instead" : "From my Wishlist instead"}
					</F>
				) : (
					<F t={t} v={t.answered ? "go:duel" : "go:services"} className="rounded-full px-4 py-2 text-[14px] font-bold text-amber-200" on="ring-amber-300 bg-amber-400/20" off="ring-amber-300/30 bg-amber-400/10">
						{t.answered ? "♥ Refine my picks" : "♥ Make it mine: 3 quick questions"}
					</F>
				)}
			</div>
			{doors && <Doors t={t} />}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A title and the apps.

function TitleScreen({ t, k }: { t: FlowT; k: string }) {
	const h = t.h
	const x = h.T(k)
	if (!x) return null
	const w = watchLine(x)
	const want = h.q.inQueue(x.key)
	const why = h.whyOf(x.key)
	return (
		<>
			<Backdrop t={x} dim={0.5} />
			<div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-transparent" />
			<div className="absolute left-12 top-10 flex gap-7">
				<img src={posterUrl(x, "w342")} alt="" className="h-[300px] w-[200px] rounded-2xl object-cover shadow-2xl ring-1 ring-white/10" />
				<div className="w-[500px] pt-1">
					<div className="line-clamp-2 text-[34px] font-extrabold leading-none">{x.title}</div>
					<div className="mt-2 text-[14px] text-white/55">{[x.year, runtimeLabel(x), x.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}</div>
					<div className="mt-3 flex items-center gap-3">
						<GwBadge gw={x.score} size={32} text="text-[22px]" />
						{x.match != null && (
							<span className="flex items-center gap-2 text-[14px] text-white/70">
								<Coin t={x} /> taste match
							</span>
						)}
					</div>
					{why.length > 0 && <div className="mt-3 text-[15px] text-amber-100/85">For you: {and(why)}.</div>}
					<div className="mt-2 line-clamp-3 text-[14px] leading-snug text-white/60">{x.synopsis}</div>
				</div>
			</div>
			<div className="absolute bottom-9 left-12 flex items-center gap-2.5">
				<F t={t} v={`watch:${x.key}`} className="flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-bold" on="ring-amber-300 bg-white text-black" off="ring-transparent bg-white/90 text-black">
					{w.offer?.logo && <img src={w.offer.logo} alt="" className="h-6 w-6 rounded-md" />}
					{w.owned ? `Watch on ${w.offer?.name}` : w.offer ? `On ${w.offer.name}` : "Not streaming"}
				</F>
				<F t={t} v={`want:${x.key}`} className="rounded-full px-4 py-2.5 text-[15px] font-semibold">
					{want ? "✓ On Wishlist" : "Want to See"}
				</F>
				<F t={t} v={`seen:${x.key}`} className="rounded-full px-4 py-2.5 text-[15px] font-semibold">
					Seen it
				</F>
				<F t={t} v={`no:${x.key}`} className="rounded-full px-4 py-2.5 text-[15px] font-semibold">
					Not for me
				</F>
				<F t={t} v={`exit:title:${x.key}`} className="rounded-full px-4 py-2.5 text-[15px] font-semibold text-white/80">
					Full page ↗
				</F>
			</div>
		</>
	)
}

// The apps open on the TV as a glimpse; the full page is one step further, through the TV.
function AppScreen({ t, id }: { t: FlowT; id: PageId }) {
	const h = t.h
	const a = APP[id]
	const guestLocked = !t.member && id === "watchnext"
	const body = (() => {
		if (guestLocked)
			return (
				<div className="absolute left-12 top-[140px] w-[520px]">
					<div className="text-[18px] leading-snug text-white/75">With a free account, the TV opens on the best match from your Wishlist that you can play tonight, and keeps what you've seen out of the way.</div>
					<div className="mt-5 flex gap-3">
						<span className="rounded-full bg-white px-6 py-3 text-[16px] font-bold text-black">Create a free account</span>
						<span className="rounded-full px-5 py-3 text-[16px] font-semibold ring-1 ring-white/20">Sign in</span>
					</div>
				</div>
			)
		if (id === "watchnext")
			return (
				<div className="absolute inset-x-12 top-[132px] flex gap-3">
					{h.watchNext.slice(0, 6).map((x) => (
						<F key={x.key} t={t} v={`t:${x.key}`} className="w-[128px] rounded-2xl p-1.5" scale={1.06}>
							<img src={posterUrl(x, "w185")} alt="" className="h-[180px] w-full rounded-xl object-cover" />
							<div className="mt-1 truncate text-[13px] font-bold">{x.title}</div>
							<div className="truncate text-[11px] text-white/50">{watchLine(x).text}</div>
						</F>
					))}
				</div>
			)
		if (id === "taste") {
			const loved = (t.member ? Object.entries(h.data.ratings).filter(([, s]) => s >= 9).map(([k]) => k) : h.loved).map(h.T).filter((x): x is WTitle => !!x?.poster)
			return (
				<div className="absolute inset-x-12 top-[130px]">
					{h.leans.length ? <div className="text-[26px] font-extrabold leading-tight">You go for {and(h.leans)}.</div> : <div className="text-[20px] text-white/70">Answer a few this-or-thats and watch your taste take shape.</div>}
					<div className="mt-3 flex flex-wrap gap-2">
						{h.moods.map((m) => (
							<span key={m} className="rounded-full px-3 py-1 text-[13px] font-bold text-black" style={{ background: MOOD[m].hue }}>
								{MOOD[m].name}
							</span>
						))}
					</div>
					<div className="mt-5 flex gap-2">
						{loved.slice(0, 7).map((x) => (
							<img key={x.key} src={posterUrl(x, "w154")} alt="" className="h-[140px] w-[94px] rounded-lg object-cover ring-1 ring-white/10" />
						))}
					</div>
				</div>
			)
		}
		if (id === "discover")
			return (
				<div className="absolute inset-x-12 top-[132px] grid grid-cols-8 gap-2.5">
					{h.picks.slice(0, 16).map((x) => (
						<div key={x.key} className="relative">
							<img src={posterUrl(x, "w154")} alt="" className="aspect-[2/3] w-full rounded-lg object-cover" />
							<Coin t={x} className="absolute bottom-1 right-1 !px-1.5 !text-[10px]" />
						</div>
					))}
				</div>
			)
		// Explorer: islands of moods, a few posters each.
		const isl = MOODS.slice(0, 6).map((m) => ({ m, xs: h.picks.filter((x) => (h.data.extra[x.key]?.m ?? []).includes(m.key as never)).slice(0, 3) }))
		return (
			<div className="absolute inset-x-12 top-[128px] grid grid-cols-3 gap-4">
				{isl.map(({ m, xs }) => (
					<div key={m.key} className="flex items-center gap-3 rounded-[40px] px-4 py-3" style={{ background: `${m.hue}1f`, boxShadow: `inset 0 0 0 1px ${m.hue}40` }}>
						<div className="flex -space-x-4">
							{xs.map((x) => (
								<img key={x.key} src={posterUrl(x, "w92")} alt="" className="h-[66px] w-[44px] rounded-md object-cover ring-2 ring-black/60" />
							))}
						</div>
						<span className="text-[15px] font-bold" style={{ color: m.hue }}>
							{m.name}
						</span>
					</div>
				))}
			</div>
		)
	})()
	return (
		<>
			<div className="absolute inset-0" style={{ background: `radial-gradient(90% 80% at 20% 0%, ${a.tint}33 0%, #07080b 60%)` }} />
			<div className="absolute left-12 top-9 flex items-center gap-3">
				<span style={{ color: a.tint }}>
					<Icon d={a.d} className="h-8 w-8" />
				</span>
				<div>
					<div className="text-[34px] font-extrabold leading-none">{a.name}</div>
					<div className="mt-1 text-[14px] text-white/60">{appLine(t, id)}</div>
				</div>
			</div>
			{body}
			{!guestLocked && (
				<div className="absolute bottom-9 left-12">
					<F t={t} v={`exit:page:${id}`} className="rounded-full px-6 py-3 text-[16px] font-bold" on="ring-amber-300 bg-white text-black" off="ring-transparent bg-white/90 text-black">
						Open {a.name} ↗
					</F>
				</div>
			)}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The on-screen bar: Back and Home away from home, Search, and a menu that mirrors the remote's feature well.

function Bar({ t }: { t: FlowT }) {
	const atHome = t.scr.k === "home"
	const btn = (k: string, d: string, label: string, on?: boolean) => (
		<button key={k} type="button" data-pick={`bar:${k}`} aria-label={label} title={label} className={`flex h-9 w-9 items-center justify-center rounded-full ${on ? "bg-white/90 text-black" : "bg-black/45 text-white/85 ring-1 ring-white/10"}`}>
			<Icon d={d} className="h-[18px] w-[18px]" />
		</button>
	)
	const item = (pick: string, d: string, label: string, tint?: string) => (
		<button key={pick} type="button" data-pick={pick} className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] font-medium text-white/90">
			<span style={tint ? { color: tint } : undefined}>
				<Icon d={d} className="h-[18px] w-[18px] text-current opacity-80" />
			</span>
			{label}
		</button>
	)
	return (
		<div className="absolute right-6 top-5 z-20 flex flex-col items-end gap-2">
			<div className="flex items-center gap-2">
				{!atHome && btn("back", "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3", "Back")}
				{!atHome && btn("home", "M3 11l9-7 9 7M5 10v10h14V10", "Home")}
				{btn("search", "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5", "Search", t.scr.k === "keyboard")}
				{btn("more", "M5 12h.01M12 12h.01M19 12h.01", "More", t.menu)}
			</div>
			<AnimatePresence>
				{t.menu && (
					<motion.div className="flex w-[220px] flex-col gap-0.5 rounded-2xl bg-[#0c0e12]/95 p-2 ring-1 ring-white/10" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
						{item("bar:mood", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01", "Mood", "#fbbf24")}
						{APPS.map((a) => item(`bar:page:${a}`, APP[a].d, APP[a].name, APP[a].tint))}
						{item("bar:picks", "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", "Pick for me", "#fb923c")}
						<div className="mx-2 my-1 h-px bg-white/10" />
						{item("bar:power", "M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0", "Turn off")}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Leaving the living room: the TV grows until it is the window, and the page is what was on it. Back grows
// the room around it again. One-shot clip-path and transform animations; nothing loops.

function ExitLayer({ t }: { t: FlowT }) {
	const x = t.exit!
	const [rect] = useState(() => {
		const el = document.querySelector("[data-flow-screen]")?.getBoundingClientRect()
		const W = window.innerWidth
		const H = window.innerHeight
		return el ? { top: el.top, right: W - el.right, bottom: H - el.bottom, left: el.left } : { top: H * 0.1, right: W * 0.2, bottom: H * 0.5, left: W * 0.2 }
	})
	const [closing, setClosing] = useState(false)
	const inset = (r: typeof rect) => `inset(${r.top}px ${r.right}px ${r.bottom}px ${r.left}px round 6px)`
	const title = x.kind === "title" ? t.h.T(x.key) : null
	const name = x.kind === "page" ? APP[x.id].name : (title?.title ?? "Title")
	const href = x.kind === "page" ? `${PROTO_ORIGIN}${PROTOTYPE_AT[x.id]}` : title ? `${PROTO_ORIGIN}${detailsHref(title)}` : PROTO_ORIGIN
	const back = () => setClosing(true)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape" && e.key !== "Backspace") return
			e.stopPropagation()
			e.preventDefault()
			back()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
	return (
		<motion.div
			className="fixed inset-0 z-[1000] overflow-hidden bg-[#0b0d12] text-white"
			initial={{ clipPath: inset(rect) }}
			animate={{ clipPath: closing ? inset(rect) : "inset(0px 0px 0px 0px round 0px)" }}
			transition={{ duration: closing ? 0.45 : 0.6, ease: [0.65, 0, 0.35, 1] }}
			onAnimationComplete={() => closing && t.setExit(null)}
		>
			<motion.div className="flex h-full flex-col" initial={{ scale: 0.97, opacity: 0.6 }} animate={{ scale: 1, opacity: closing ? 0.4 : 1 }} transition={{ duration: 0.6 }}>
				<header className="flex h-16 shrink-0 items-center gap-6 border-b border-white/10 px-8">
					<img src={gwLogo} alt="" className="h-7" />
					<nav className="flex gap-5 text-[15px] font-semibold text-white/70">
						<button type="button" onClick={back} className="hover:text-white">
							Living room
						</button>
						{APPS.map((a) => (
							<span key={a} className={x.kind === "page" && x.id === a ? "text-white" : ""}>
								{APP[a].name}
							</span>
						))}
					</nav>
				</header>
				<div className="relative flex-1">
					{title?.backdrop && <img src={backdropUrl(title, "w1280")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
					<div className="relative mx-auto max-w-3xl px-8 pt-24">
						<div className="text-[13px] font-bold uppercase tracking-[0.25em] text-amber-300/80">{x.kind === "page" ? "Page" : "Title page"}</div>
						<h1 className="mt-2 text-5xl font-extrabold">{name}</h1>
						<p className="mt-4 text-lg text-white/70">
							Prototype: the living room hands over here. The camera went through the TV, and this page is what the TV was showing, full size. Back returns to the room with the TV where you left it.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<button type="button" onClick={back} className="h-12 rounded-full bg-white px-6 font-bold text-black">
								← Back to the living room
							</button>
							<a href={href} target="_blank" rel="noreferrer" className="flex h-12 items-center rounded-full px-5 font-semibold ring-1 ring-white/25 hover:bg-white/10">
								Open the {x.kind === "page" ? `${name} prototype` : "title page"} in a new tab ↗
							</a>
						</div>
					</div>
				</div>
			</motion.div>
		</motion.div>
	)
}

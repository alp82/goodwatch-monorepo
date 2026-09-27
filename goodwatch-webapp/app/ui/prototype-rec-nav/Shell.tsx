// PROTOTYPE - throwaway. #192: the simulated app shell. It covers the site's real header and bottom nav and draws
// one navigation variant around the five page mocks. URL: ?variant=&page=home|watch|discover|taste|explorer
// &as=member|guest&tab=sides|crowd|fingerprint&s=1 (searching)&q=<query>. Nothing is fetched or written.
import { useSearchParams } from "@remix-run/react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { type DiscState, PAGE_KEYS, type PageKey, type Shell as ShellT, ShellCtx, type SheetKey, type TasteTab, type VariantKey, type WNState, WISHLIST } from "./model"
import { DiscoverPage, ExplorerPage, HomePage, TastePage, WatchPage } from "./pages"
import { Sheets } from "./sheets"
import { VARIANTS } from "./variants"

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

export function Shell({ variant }: { variant: VariantKey }) {
	const [params, setParams] = useSearchParams()
	const raw = params.get("page") as PageKey
	const page: PageKey = PAGE_KEYS.includes(raw) ? raw : "home"
	const who = params.get("as") === "guest" ? "guest" : "member"
	const tab = (["sides", "crowd", "fingerprint"].includes(params.get("tab") ?? "") ? params.get("tab") : "sides") as TasteTab
	const searching = page === "discover" && params.get("s") === "1"
	const urlQ = params.get("q") ?? ""
	// The query lives in memory while typing (so no keystroke waits on a navigation) and is mirrored to the URL.
	const [q, setQState] = useState(urlQ)

	const [sheet, setSheet] = useState<SheetKey>(null)
	useEffect(() => setQState(urlQ), [page, searching])
	const [wn, setWn] = useState<WNState>({ moods: [], everywhere: false, sort: "best" })
	const [disc, setDisc] = useState<DiscState>({ everywhere: false, unseen: true, forYou: true, sort: "popular" })
	const [lit, setLit] = useState<number | null>(null)
	const [folded, setFolded] = useState(false)

	const root = useRef<HTMLDivElement>(null)
	const scroll = useRef<HTMLDivElement>(null)
	const top = useRef<HTMLDivElement>(null)
	const head = useRef<HTMLDivElement>(null)
	const bottom = useRef<HTMLDivElement>(null)

	const upd = (patch: Record<string, string | null>, push: boolean) => {
		const p = new URLSearchParams(params)
		for (const [k, v] of Object.entries(patch)) v === null ? p.delete(k) : p.set(k, v)
		setParams(p, { replace: !push, preventScrollReset: true })
	}

	useEffect(() => setWn((w) => ({ ...w, sort: who === "guest" ? "added" : "best" })), [who])
	useEffect(() => root.current?.setAttribute("data-ready", "1"), [])
	useEffect(() => {
		scroll.current?.scrollTo({ top: 0 })
		setFolded(false)
		setLit(null)
	}, [page])

	// The slab's tab row folds away while scrolling down and returns on the way up (#175 `slab`).
	useEffect(() => {
		const el = scroll.current
		if (!el) return
		let last = el.scrollTop
		const on = () => {
			const y = el.scrollTop
			if (y < 80) setFolded(false)
			else if (y > last + 6) setFolded(true)
			else if (y < last - 6) setFolded(false)
			last = y
		}
		el.addEventListener("scroll", on, { passive: true })
		return () => el.removeEventListener("scroll", on)
	}, [])

	// The bars' heights become CSS variables so pages pad around them and Explorer's controls stay clear.
	useIso(() => {
		const set = () => {
			const r = root.current
			if (!r) return
			const t = (top.current?.offsetHeight ?? 0) + (head.current?.offsetHeight ?? 0)
			r.style.setProperty("--rn-top", `${t}px`)
			r.style.setProperty("--rn-bb", `${bottom.current?.offsetHeight ?? 0}px`)
		}
		set()
		const ro = new ResizeObserver(set)
		for (const el of [top.current, head.current, bottom.current]) el && ro.observe(el)
		return () => ro.disconnect()
	}, [])

	// Desktop command palette: ⌘K or "/" from anywhere.
	useEffect(() => {
		if (variant !== "command") return
		const k = (e: KeyboardEvent) => {
			const typing = (e.target as HTMLElement).closest("input, textarea, [contenteditable]")
			if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
				e.preventDefault()
				setSheet("cmd")
			}
		}
		window.addEventListener("keydown", k)
		return () => window.removeEventListener("keydown", k)
	}, [variant])

	const s: ShellT = {
		variant,
		page,
		who,
		tab,
		go: (p, extra = {}) => {
			setSheet(null)
			upd({ page: p === "home" ? null : p, s: null, q: null, ...extra }, true)
		},
		setTab: (t) => upd({ tab: t === "sides" ? null : t }, false),
		searching,
		q,
		setQ: (v) => {
			setQState(v)
			upd({ q: v || null }, false)
		},
		openSearch: () => {
			setSheet(null)
			upd({ page: "discover", s: "1" }, page !== "discover")
		},
		closeSearch: () => upd({ s: null, q: null }, false),
		sheet,
		setSheet,
		wn,
		setWn,
		disc,
		setDisc,
		lit,
		setLit,
		folded,
		tonight: WISHLIST[who][0],
	}
	const V = VARIANTS[variant]
	const Page = { home: HomePage, watch: WatchPage, discover: DiscoverPage, taste: TastePage, explorer: ExplorerPage }[page]
	return (
		<ShellCtx.Provider value={s}>
			<div ref={root} className={`rn-root v-${variant} p-${page} ${folded ? "is-folded" : ""}`} data-page={page} data-who={who}>
				<div ref={scroll} className="rn-scroll">
					<main className="rn-page">
						<Page />
					</main>
				</div>
				<div ref={top} className="rn-m rn-topwrap">
					<V.Top />
				</div>
				<div ref={head} className="rn-d rn-headwrap">
					<V.Header />
				</div>
				<div ref={bottom} className="rn-m rn-bottomwrap">
					<V.Bottom />
				</div>
				<Sheets />
			</div>
		</ShellCtx.Provider>
	)
}

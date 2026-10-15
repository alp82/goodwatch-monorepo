// PROTOTYPE - throwaway (#661, map #652). Sides of you on the title page: four variants of how a title page tells a
// member where the title sits in their Taste (on a side, just past a side, or nothing when it fits no side), mounted
// on the real title page. ?variant=line|panel|strip|map, ?as=owner|m1..m5 (members picked at runtime by rating
// count), ?names=1 shows the side names and edge sentences (the words gate, #656, is still closed, so every variant
// works without them). The choice sticks for the tab while browsing titles; "Exit" drops it. Read-only.
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import { MOOD_BY_KEY } from "~/domain/moods"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { lowerFirst, posterUrl, titleHref, titlesOf } from "~/ui/taste/tabs/parts"
import type { PortraitTitle } from "~/server/taste-portrait/view"
import { titleKey } from "~/utils/title-key"
import { VARIANTS, type SideCard, type SidesTitleView, type VariantKey, isVariant } from "./model"
import { LineVariant } from "./Line"
import { MapVariant } from "./MapPin"
import { PanelVariant } from "./Panel"
import { StripVariant } from "./Strip"

const KEEP = ["variant", "as", "names"] as const
const STORE = "proto-661"

export interface SidesProto {
	variant: VariantKey
	names: boolean
	view: SidesTitleView | null
	error: string | null
}

/** The prototype's state on a title page; null when the prototype is off (no ?variant=, or in production). */
export function useSidesPrototype(mediaType: "movie" | "show", tmdbId: number): SidesProto | null {
	const [params, setParams] = useSearchParams()
	const variant = params.get("variant")
	const active = process.env.NODE_ENV !== "production" && isVariant(variant)
	const as = params.get("as") ?? ""
	const key = titleKey(mediaType, tmdbId)
	const want = `${key}|${as}`
	const [state, setState] = useState<{ want: string; view: SidesTitleView | null; error: string | null } | null>(null)

	// Keep the prototype on while browsing from title to title in this tab.
	useEffect(() => {
		if (process.env.NODE_ENV === "production") return
		try {
			if (active) {
				sessionStorage.setItem(STORE, JSON.stringify(Object.fromEntries(KEEP.flatMap((k) => (params.get(k) ? [[k, params.get(k)]] : [])))))
				return
			}
			const saved = sessionStorage.getItem(STORE)
			if (!saved || params.get("variant")) return
			const p = new URLSearchParams(params)
			for (const [k, v] of Object.entries(JSON.parse(saved) as Record<string, string>)) p.set(k, v)
			setParams(p, { replace: true, preventScrollReset: true })
		} catch {}
	}, [active, params, setParams])

	useEffect(() => {
		if (!active) return
		let live = true
		fetch(`/prototype/sides-title-page/placement?title=${key}&as=${encodeURIComponent(as)}`)
			.then((r) => r.json())
			.then((d: { view: SidesTitleView | null; error: string | null }) => live && setState({ want, view: d.view, error: d.error }))
			.catch((e) => live && setState({ want, view: null, error: String(e) }))
		return () => {
			live = false
		}
	}, [active, key, as, want])

	if (!active) return null
	const current = state?.want === want ? state : null
	return { variant: variant as VariantKey, names: params.get("names") === "1", view: current?.view ?? null, error: current?.error ?? null }
}

export type Slot = "hero" | "afterHero" | "afterFingerprint"
const SLOT: Record<VariantKey, Slot> = { line: "hero", panel: "afterHero", strip: "afterFingerprint", map: "afterHero" }

/** Where on the title page each variant goes; nothing when the title fits no side. */
export function SidesSlot({ proto, at }: { proto: SidesProto | null; at: Slot }) {
	if (!proto?.view || SLOT[proto.variant] !== at || proto.view.placement.kind === "none") return null
	const props = { view: proto.view, names: proto.names }
	const Variant = { line: LineVariant, panel: PanelVariant, strip: StripVariant, map: MapVariant }[proto.variant]
	return (
		<div data-proto-661={proto.variant}>
			<Variant {...props} />
		</div>
	)
}

// ---------- words: grouping alone, names behind the toggle ----------

export const sideOf = (view: SidesTitleView, id: string | null) => view.sides.find((s) => s.id === id) ?? null

/** "Se7en, Zodiac and Prisoners". */
export function titleList(titles: PortraitTitle[], n = 3) {
	const names = titles.slice(0, n).map((t) => t.title)
	if (names.length < 2) return names[0] ?? ""
	return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

/** The edge's own words after the side's name: "from South Korea", "but darkly funny". */
export function edgeTail(view: SidesTitleView) {
	const { edge, side } = view.placement
	if (!edge) return ""
	if (edge.kind === "bridge") {
		const other = sideOf(view, edge.toward)
		return other ? `toward your ${lowerFirst(other.name)} side` : "toward another side"
	}
	const name = sideOf(view, side)?.name ?? ""
	return edge.line.startsWith(`${name}, `) ? edge.line.slice(name.length + 2) : lowerFirst(edge.chip)
}

/** The one-line answer: where the title sits. Without names it says which side by the titles in it. */
export function headline(view: SidesTitleView, names: boolean): { title: string; detail: string } {
	const p = view.placement
	const side = sideOf(view, p.side)
	if (!side) return { title: "", detail: "" }
	const near = titlesOf(view.titles, p.near)
	const share = `${Math.round(side.share * 100)}% of what you love`
	const mine = names ? `your ${lowerFirst(side.name)} side` : "one of your sides"
	if (p.kind === "on" && p.member)
		return { title: `One of the ${side.count} titles that make ${mine}`, detail: `With ${titleList(near)} · ${share}` }
	if (p.kind === "on") return { title: names ? `On ${mine}` : "On one of your sides", detail: `With ${titleList(near)} · ${share}` }
	if (p.edge?.kind === "bridge") {
		const other = sideOf(view, p.edge.toward)
		const otherNear = titlesOf(view.titles, p.nearOther)
		return {
			title: names && other ? `Between your ${lowerFirst(side.name)} and ${lowerFirst(other.name)} sides` : "Between two of your sides",
			detail: `Near ${titleList(near, 2)}, and near ${titleList(otherNear, 2)}`,
		}
	}
	const tail = edgeTail(view)
	return {
		title: names ? `Like ${mine}, but ${tail.replace(/^but /, "")}` : "Just past one of your sides",
		detail: names ? (p.edge?.evidence ?? "") : `Near ${titleList(near)}, somewhere you've barely tried`,
	}
}

export const watchNextHref = (side: SideCard) => (side.moods.length ? `/watch-next?moods=${side.moods.join(",")}` : "/watch-next")

/** Watch next with the side's moods. The mood names show with the side names. */
export function WatchNextLink({ side, names, className = "" }: { side: SideCard; names: boolean; className?: string }) {
	const moods = side.moods.map((m) => MOOD_BY_KEY[m].name).join(" + ")
	return (
		<Link
			to={watchNextHref(side)}
			title={moods ? `Watch next: ${moods}` : "Watch next"}
			className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 ${className}`}
		>
			{names && moods ? `Watch next: ${moods}` : "Watch next from this side"}
			<span aria-hidden>→</span>
		</Link>
	)
}

/** A poster linking to the title page (the prototype's choice comes along). */
export function ProtoPoster({ t, className = "", ring }: { t: PortraitTitle; className?: string; ring?: string }) {
	return (
		<Link to={titleHref(t)} prefetch="intent" title={t.title} className={`relative block shrink-0 overflow-hidden rounded-md bg-gray-900 ${className}`} style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}>
			<img src={posterUrl(t, "w185")} alt={`Poster for ${t.title}`} className="block aspect-[2/3] w-full object-cover" loading="lazy" draggable={false} />
		</Link>
	)
}

// ---------- the prototype's own controls ----------

export function SidesProtoBar({ proto }: { proto: SidesProto | null }) {
	const [params, setParams] = useSearchParams()
	const [open, setOpen] = useState(false)
	if (!proto) return null
	const set = (k: string, v: string | null) => {
		const p = new URLSearchParams(params)
		if (v === null) p.delete(k)
		else p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const exit = () => {
		try {
			sessionStorage.removeItem(STORE)
		} catch {}
		const p = new URLSearchParams(params)
		for (const k of KEEP) p.delete(k)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const { view } = proto
	const p = view?.placement
	const state: ReactNode = !view ? (
		<span className="text-gray-300">{proto.error ? `No data: ${proto.error}` : "Placing this title…"}</span>
	) : (
		<span className="text-gray-200">
			<b className={p?.kind === "on" ? "text-amber-300" : p?.kind === "edge" ? "text-sky-300" : "text-gray-400"}>
				{p?.kind === "on" ? (p.member ? "On a side (one of its loved titles)" : "On a side") : p?.kind === "edge" ? `Just past a side (${p.edge?.kind})` : "Fits no side: the page shows nothing"}
			</b>
			{p?.mine != null && <span className="text-gray-400"> · rated {p.mine}</span>}
		</span>
	)
	return (
		<>
			<div className="fixed bottom-20 left-1/2 z-50 w-[min(44rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-fuchsia-500/50 bg-gray-950/95 px-3 py-2 text-xs text-white shadow-2xl">
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="font-semibold text-fuchsia-300">Prototype data:</span>
					{(view?.members ?? []).map((m) => (
						<button
							key={m.slot}
							type="button"
							onClick={() => set("as", m.slot)}
							aria-pressed={m.slot === view?.member.slot}
							className={`cursor-pointer rounded-full border px-2 py-0.5 font-semibold ${m.slot === view?.member.slot ? "border-fuchsia-400 bg-fuchsia-900/60" : "border-white/15 text-gray-300 hover:border-fuchsia-400/60"}`}
						>
							{m.label}
						</button>
					))}
					<label className="ml-auto inline-flex cursor-pointer items-center gap-1.5 font-semibold">
						<input type="checkbox" checked={proto.names} onChange={(e) => set("names", e.target.checked ? "1" : null)} className="accent-fuchsia-500" />
						Side names (words gate)
					</label>
				</div>
				<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
					{state}
					<button type="button" onClick={() => setOpen(!open)} className="cursor-pointer text-gray-400 underline">
						{open ? "Hide why" : "Why"}
					</button>
					<Link to={`/prototype/sides-title-page?${new URLSearchParams(Object.fromEntries(KEEP.flatMap((k) => (params.get(k) ? [[k, params.get(k) as string]] : []))))}`} className="text-fuchsia-300 underline">
						Titles to try
					</Link>
					<button type="button" onClick={exit} className="ml-auto cursor-pointer text-gray-400 underline">
						Exit prototype
					</button>
				</div>
				{open && view && (
					<p className="mt-1.5 text-gray-400">
						{p?.debug}. {view.member.loved} loved, {view.member.loose} fit no side, {view.sides.length} sides. Personal order {view.personalOrder.on ? "orders the lists" : `not loaded (${view.personalOrder.note ?? "none"})`}. {view.computedMs} ms.
					</p>
				)}
			</div>
			<PrototypeSwitcher variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))} />
		</>
	)
}

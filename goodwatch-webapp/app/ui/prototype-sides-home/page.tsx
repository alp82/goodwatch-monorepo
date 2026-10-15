// PROTOTYPE - throwaway (#660). The page: the TV with the chosen variant, and a prototype bar over the room to
// switch the member, the names (the words gate), the frame (the room, or the TV's canvas filling the window) and
// the variant. The arrow keys belong to the TV here, so the bar's own keys are [ and ] for the variant and N for
// the names.
import { useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import { Guide } from "./Guide"
import { SidesTv } from "./host"
import { type SidesHomeView, VARIANTS, type VariantKey, isVariant, shareWords, sideTitle } from "./model"
import { Rows } from "./Rows"
import { Tiles } from "./Tiles"
import { Tonight } from "./Tonight"

const KEYS = Object.keys(VARIANTS) as VariantKey[]

export function SidesHomePage({ view }: { view: SidesHomeView | null }) {
	const [params, setParams] = useSearchParams()
	const variant: VariantKey = isVariant(params.get("variant")) ? (params.get("variant") as VariantKey) : "tiles"
	const names = params.get("names") === "on"
	const fit = params.get("fit") === "screen" ? "screen" : "room"
	const bar = params.get("bar") !== "off"
	const set = (key: string, value: string | null) => {
		const p = new URLSearchParams(params)
		if (value === null) p.delete(key)
		else p.set(key, value)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const step = (by: number) => set("variant", KEYS[(KEYS.indexOf(variant) + by + KEYS.length) % KEYS.length])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea")) return
			if (e.key === "[") step(-1)
			else if (e.key === "]") step(1)
			else if (e.key === "n" || e.key === "N") set("names", names ? null : "on")
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (!view)
		return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">The title snapshot is still loading on this dev server. Reload in a minute.</p>
	const home = () => (variant === "tiles" ? <Tiles /> : variant === "rows" ? <Rows /> : variant === "tonight" ? <Tonight /> : <Guide />)
	return (
		<div className="text-white">
			<SidesTv key={`${variant}:${view.member.slot}`} view={view} names={names} fit={fit} renderHome={home} />
			{bar && (
				<div data-proto-bar className="fixed left-3 top-3 z-[3000] max-w-[min(760px,calc(100vw-24px))] rounded-2xl bg-black/85 p-3 text-xs shadow-2xl ring-2 ring-fuchsia-500">
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="font-semibold text-fuchsia-300">Prototype #660</span>
						{view.members.map((m) => (
							<button key={m.slot} type="button" onClick={() => set("as", m.slot)} aria-pressed={m.slot === view.member.slot} className={`cursor-pointer rounded-full border px-2 py-0.5 font-semibold ${m.slot === view.member.slot ? "border-fuchsia-400 bg-fuchsia-900/60" : "border-white/15 text-gray-300 hover:border-fuchsia-400/60"}`}>
								{m.label}
								{m.ratings > 0 && <span className="ml-1 text-gray-400">{m.ratings}</span>}
							</button>
						))}
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<button type="button" onClick={() => step(-1)} className="cursor-pointer rounded-full bg-white px-2.5 py-0.5 font-bold text-black" aria-label="Previous variant">
							[
						</button>
						<span className="min-w-52 text-center font-semibold">
							{variant}: {VARIANTS[variant].name} ({VARIANTS[variant].style})
						</span>
						<button type="button" onClick={() => step(1)} className="cursor-pointer rounded-full bg-white px-2.5 py-0.5 font-bold text-black" aria-label="Next variant">
							]
						</button>
						<button type="button" onClick={() => set("names", names ? null : "on")} aria-pressed={names} className={`ml-2 cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold ${names ? "border-amber-400 bg-amber-900/60" : "border-white/20"}`}>
							Names {names ? "on" : "off"} (N)
						</button>
						<button type="button" onClick={() => set("fit", fit === "room" ? "screen" : null)} className="cursor-pointer rounded-full border border-white/20 px-2.5 py-0.5 font-semibold">
							{fit === "room" ? "In the room" : "TV full screen"}
						</button>
						<button type="button" onClick={() => set("bar", "off")} className="cursor-pointer rounded-full border border-white/20 px-2.5 py-0.5 text-gray-300">
							Hide bar
						</button>
					</div>
					<details className="mt-2 text-gray-300">
						<summary className="cursor-pointer">
							{view.sides.length} sides · {view.member.loved} loved, {view.loose} in no side · personal order {view.personalOrder.on ? "orders the picks" : `not loaded (${view.personalOrder.note ?? "none"})`} · {view.computedMs} ms
						</summary>
						<ul className="mt-1 list-disc pl-5">
							{view.sides.map((s) => (
								<li key={s.id}>
									{sideTitle(s, true)} · {shareWords(s.share)} ({Math.round(s.share * 100)}%, {s.count}) · moods {s.moods.map((m) => m.name).join(" + ") || "none"} · {s.picks.length} picks{s.onServices ? " on services" : ""} · best pick rank {s.rank}
								</li>
							))}
						</ul>
						<p className="mt-1">Arrows, Enter, Escape and H drive the TV, as on the start page. [ and ] switch the variant.</p>
					</details>
				</div>
			)}
		</div>
	)
}

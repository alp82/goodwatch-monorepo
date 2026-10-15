// PROTOTYPE - throwaway (#657). The better-sides page: the Taste tabs as on /taste, a data bar to switch members,
// the chosen variant, and the floating variant switcher.
import { useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { SidesOfYou } from "~/ui/taste/tabs/SidesOfYou"
import { TasteTabs } from "~/ui/taste/tabs/TasteTabs"
import { Anchored } from "./Anchored"
import { MapOfYou } from "./MapOfYou"
import { Moods } from "./Moods"
import { Tighter } from "./Tighter"
import { VARIANTS, type ProtoView } from "./model"

export function BetterSidesPage({ view }: { view: ProtoView | null }) {
	const [params, setParams] = useSearchParams()
	if (!view)
		return <p className="mx-auto max-w-7xl px-4 py-16 text-gray-300 md:px-8">The title snapshot is still loading on this dev server. Reload in a minute.</p>
	const pick = (slot: string) => {
		const p = new URLSearchParams(params)
		p.set("as", slot)
		setParams(p, { preventScrollReset: true })
	}
	return (
		<div className="pb-40 text-white">
			<TasteTabs />
			<div className="border-b border-fuchsia-500/30 bg-fuchsia-950/20">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2 text-xs md:px-8">
					<span className="font-semibold text-fuchsia-300">Prototype data:</span>
					{view.members.map((m) => (
						<button
							key={m.slot}
							type="button"
							onClick={() => pick(m.slot)}
							aria-pressed={m.slot === view.member.slot}
							className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold ${m.slot === view.member.slot ? "border-fuchsia-400 bg-fuchsia-900/60 text-white" : "border-white/15 text-gray-300 hover:border-fuchsia-400/60"}`}
						>
							{m.label}
							{m.ratings > 0 && <span className="ml-1 text-gray-400">{m.ratings.toLocaleString("en-US")}</span>}
						</button>
					))}
					<span className="text-gray-400">
						· {view.member.rated} rated, {view.member.loved} loved, usual {view.member.usual} · personal order {view.personalOrder.on ? "orders the lists" : `not loaded (${view.personalOrder.note ?? "none"})`} · {view.computedMs} ms
					</span>
					{view.notes.length > 0 && (
						<details className="w-full text-gray-400">
							<summary className="cursor-pointer">How these sides were built</summary>
							<ul className="mt-1 list-disc pl-5">
								{view.notes.map((n) => (
									<li key={n}>{n}</li>
								))}
							</ul>
						</details>
					)}
				</div>
			</div>
			{view.variant === "today" && view.production && <SidesOfYou view={view.production} />}
			{view.variant === "tighter" && <Tighter key={view.member.slot} view={view} />}
			{view.variant === "anchored" && <Anchored key={view.member.slot} view={view} />}
			{view.variant === "moods" && <Moods key={view.member.slot} view={view} />}
			{view.variant === "map" && <MapOfYou key={view.member.slot} view={view} />}
			<PrototypeSwitcher variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))} />
		</div>
	)
}

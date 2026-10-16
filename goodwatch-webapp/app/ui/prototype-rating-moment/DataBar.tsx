// PROTOTYPE - throwaway (#662). The prototype's data bar above the title: which member, side names on or off, titles
// to try the moment with, and the full state (the member's sides before the rating, and what the rating did).
import { Link, useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { SideMark, pct, useProtoHref } from "./bits"
import { type MomentView, type Outcome, VARIANTS, type VariantKey } from "./model"

const CHIP = "cursor-pointer rounded-full border px-2.5 py-0.5 font-semibold"

export function outcomeText(o: Outcome, view: MomentView) {
	switch (o.kind) {
		case "none":
			return "Not rated yet in this page. Rate it with the score button."
		case "low":
			return `5 or less: sides don't change; the #526 why row shows.${o.inside ? ` It sits close to ${o.inside}.` : ""}`
		case "middle":
			return `Not loved (loved is ${view.lovedFrom}+ for this member): sides don't change.`
		case "loose":
			return "Loved, but fits no side by production's rule (closeness 0.3 or more, not far below the catalog on what the side's name claims): left out quietly."
		case "forming":
			return `Loved, fits no side by production's rule, and is alike with ${o.with.length} other loved titles that fit no side: a side may be forming (${o.needs} more to hold; shown only when 3 or fewer).`
		case "new":
			return `Loved, and lands in a side that wasn't there before (${o.sidesBefore} sides → ${o.sidesAfter}).`
		case "joins":
			return `Joins ${o.was} (closeness 0.3 or more, not against its name): ${pct(o.shareBefore)} → ${pct(o.shareAfter)} of what they love; size rank ${o.rankBefore + 1} → ${o.rankAfter + 1}${o.reshaped ? "; the number of sides changed" : ""}.`
	}
}

export function DataBar({ base, moment, loading, names }: { base: MomentView | null; moment: MomentView | null; loading: boolean; variant: VariantKey; names: boolean }) {
	const [params, setParams] = useSearchParams()
	const href = useProtoHref()
	const set = (k: string, v: string | null) => {
		const p = new URLSearchParams(params)
		if (v === null) p.delete(k)
		else p.set(k, v)
		setParams(p, { preventScrollReset: true, replace: true })
	}
	const view = moment ?? base
	return (
		<div className="mb-3 rounded-2xl border border-fuchsia-500/40 bg-fuchsia-950/30 p-3 text-xs text-gray-300">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-semibold text-fuchsia-300">Prototype #662:</span>
				{base?.members.map((m) => (
					<button
						key={m.slot}
						type="button"
						onClick={() => set("as", m.slot)}
						aria-pressed={m.slot === base.member.slot}
						className={`${CHIP} ${m.slot === base.member.slot ? "border-fuchsia-400 bg-fuchsia-900/60 text-white" : "border-white/15 hover:border-fuchsia-400/60"}`}
					>
						{m.label}
						{m.ratings > 0 && <span className="ml-1 text-gray-400">{m.ratings.toLocaleString("en-US")}</span>}
					</button>
				))}
				<button
					type="button"
					onClick={() => set("names", names ? null : "1")}
					aria-pressed={names}
					className={`${CHIP} ${names ? "border-amber-400 bg-amber-900/50 text-white" : "border-white/15"}`}
				>
					Side names: {names ? "on" : "off (words gate)"}
				</button>
				<button
					type="button"
					onClick={() => set("place", params.get("place") === "rebuild" ? null : "rebuild")}
					aria-pressed={params.get("place") === "rebuild"}
					className={`${CHIP} ${params.get("place") === "rebuild" ? "border-sky-400 bg-sky-900/50 text-white" : "border-white/15"}`}
					title="Nearest: the sides stay and the title joins the nearest one. Rebuild: the sides are built again with the new score, as the Taste page would."
				>
					Placement: {params.get("place") === "rebuild" ? "rebuild the sides" : "nearest side (sides stay)"}
				</button>
				{!base && <span>Loading the member's sides… (the title snapshot loads once per dev server start)</span>}
				{loading && <span className="text-amber-300">Replaying their sides with this score…</span>}
			</div>
			{base && (
				<>
					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
						<span className="font-semibold text-gray-200">Try:</span>
						{base.demos.map((d) => {
							const t = base.titles[d.key]
							if (!t) return null
							const here = d.key === base.key
							return (
								<Link key={d.key} to={href(t)} className={`${CHIP} ${here ? "border-fuchsia-400 text-white" : "border-white/15 hover:border-fuchsia-400/60"}`}>
									{d.label}: {t.title}
									{d.mine != null && <span className="ml-1 text-gray-400">(they gave {d.mine})</span>}
								</Link>
							)
						})}
					</div>
					<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
						<span className="font-semibold text-gray-200">{moment?.after ? "Sides after" : "Sides before"}:</span>
						{(moment?.after?.sides ?? base.before.sides).map((s, i) => (
							<span key={s.id} className="inline-flex items-center gap-1.5">
								<span className="text-gray-500">{i + 1}</span>
								<SideMark view={view ?? base} side={s} names={names} />
								<span>{pct(s.share)}</span>
								{s.members.includes(base.key) && moment?.after && <span className="font-bold text-amber-300">← this title</span>}
							</span>
						))}
						<span className="text-gray-400">
							· {base.before.loved} loved (score {base.lovedFrom}+), {base.before.loose} fit no side
							{base.mine != null && ` · this member rated this title ${base.mine}; the page rates it as if for the first time`}
							{" · "}personal order {base.personalOrder ? "on" : "not loaded"}
						</span>
					</div>
					<p className="mt-2 text-gray-200">
						<span className="font-semibold">What this score did:</span> {outcomeText(moment?.outcome ?? { kind: "none" }, view ?? base)}
						{moment && <span className="text-gray-500"> ({moment.computedMs} ms)</span>}
					</p>
				</>
			)}
			<PrototypeSwitcher
				position="bottom-24 left-2 lg:bottom-4 lg:left-4"
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
			/>
		</div>
	)
}

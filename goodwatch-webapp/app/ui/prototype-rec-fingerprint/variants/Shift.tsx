// PROTOTYPE - throwaway. How it shifted (existing): your fingerprint per period of your rating history.
// One sentence says where you're heading; small multiples show the attributes that moved most, each on the
// same scale around "most people"; then each period with what defined it and the titles you rated best.
import { useState } from "react"
import { AVOID, CROWD, SEEK } from "../model"
import {
	AttrDetail,
	type ViewProps,
	attrOf,
	firstName,
	itemsOf,
	list,
} from "../parts"
import { RatedPoster } from "~/ui/prototype-rec-taste-2/kit"

export default function Shift({ data }: ViewProps) {
	const ps = data.periods
	const [sel, setSel] = useState<string | null>(null)
	if (ps.length < 2)
		return (
			<div className="min-h-screen bg-gray-950 px-4 pb-40 pt-16 text-white md:px-8">
				<div className="mx-auto max-w-3xl">
					<h1 className="text-3xl font-bold">Your fingerprint needs a history first</h1>
					<p className="mt-3 text-gray-400">
						Rate at least 30 titles over time and this page shows how your taste moves.
					</p>
				</div>
			</div>
		)
	const last = ps[ps.length - 1]
	const before = ps.slice(0, -1)
	const weight = before.reduce((a, p) => a + p.count, 0)
	const earlier = data.attrs.map((_, k) =>
		before.reduce((a, p) => a + (p.edge[k] * p.count) / weight, 0),
	)
	const moves = data.attrs
		.map((a, k) => ({ a, k, d: last.edge[k] - earlier[k] }))
		.sort((x, y) => y.d - x.d)
	const toward = moves.slice(0, 4)
	const away = moves.slice(-4).reverse()
	const shown = [...toward, ...away]
	const yMax = Math.max(
		0.05,
		...shown.flatMap((m) => ps.map((p) => Math.abs(p.edge[m.k]))),
	)
	const selAttr = sel ? attrOf(data, sel) : null

	return (
		<div className="min-h-screen bg-gray-950 pb-40 text-white">
			<header className="mx-auto max-w-6xl px-4 pb-8 pt-12 md:px-8 md:pt-16">
				<p className="text-sm font-semibold text-amber-400">
					How {data.who.mode === "me" ? "your" : "the demo member's"} fingerprint moved
				</p>
				<h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight md:text-5xl">
					{last.label === "Lately" || last.label === "Since then"
						? "Lately you've"
						: "More recently you've"}{" "}
					moved toward {list(toward.slice(0, 2).map((m) => m.a.phrase))}, and away from{" "}
					{list(away.slice(0, 2).map((m) => m.a.phrase))}.
				</h1>
				<p className="mt-4 max-w-2xl text-gray-400">
					{firstName(data)}'s ratings in {ps.length} periods, each read on its own
					against everyone.
					{!data.datedPeriods &&
						" The demo member has no rating dates, so the periods follow the order of their ratings."}
				</p>
			</header>

			<section className="mx-auto max-w-6xl px-4 md:px-8">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<h2 className="text-xl font-bold">What moved most</h2>
					<p className="text-xs text-gray-400">
						Line above the middle: more than most people. Tap one for its titles.
					</p>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
					{shown.map((m, i) => (
						<button
							key={m.a.key}
							type="button"
							onClick={() => setSel(sel === m.a.key ? null : m.a.key)}
							aria-pressed={sel === m.a.key}
							className={`rounded-lg border p-3 text-left transition ${sel === m.a.key ? "border-amber-500/70 bg-amber-900/20" : "border-white/10 bg-gray-900/60 hover:border-white/25"}`}
						>
							<span className="flex items-baseline justify-between gap-2">
								<span className="truncate font-semibold">{m.a.label}</span>
								<span
									className="shrink-0 text-xs font-semibold"
									style={{ color: i < 4 ? SEEK : AVOID }}
								>
									{i < 4 ? "Rising" : "Fading"}
								</span>
							</span>
							<Spark
								values={ps.map((p) => p.edge[m.k])}
								labels={ps.map((p) => p.label)}
								yMax={yMax}
								color={i < 4 ? SEEK : AVOID}
							/>
						</button>
					))}
				</div>
				<div className="mt-2 flex justify-between gap-2 text-[11px] text-gray-500">
					<span>{ps[0].label}</span>
					<span>{last.label}</span>
				</div>
				{selAttr && (
					<div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4 md:p-6">
						<AttrDetail data={data} a={selAttr} />
					</div>
				)}
			</section>

			<section className="mx-auto mt-14 max-w-6xl px-4 md:px-8">
				<h2 className="text-xl font-bold">Period by period</h2>
				<ol className="mt-4 grid gap-6 md:grid-flow-col md:auto-cols-fr">
					{ps.map((p) => {
						const defining = data.attrs
							.map((a, k) => ({ a, e: p.edge[k] }))
							.sort((x, y) => y.e - x.e)
							.slice(0, 3)
						return (
							<li key={p.id} className="border-t-2 border-white/15 pt-3">
								<p className="text-lg font-bold">{p.label}</p>
								<p className="text-sm text-gray-400">{p.sub}</p>
								<p className="mt-2 text-sm text-gray-200">
									Defined by {list(defining.map((d) => d.a.label.toLowerCase()))}
								</p>
								<div className="mt-3 grid grid-cols-4 gap-2">
									{itemsOf(data, p.top.slice(0, 4)).map((t) => (
										<RatedPoster key={t.key} t={t} size="w185" />
									))}
								</div>
							</li>
						)
					})}
				</ol>
			</section>
		</div>
	)
}

/** A small line across periods, on a scale shared by every card; the middle line is most people. */
function Spark({
	values,
	labels,
	yMax,
	color,
}: { values: number[]; labels: string[]; yMax: number; color: string }) {
	const W = 160
	const H = 64
	const x = (i: number) => 6 + (i * (W - 12)) / Math.max(1, values.length - 1)
	const y = (v: number) => H / 2 - (v / yMax) * (H / 2 - 5)
	const d = values.map((v, i) => `${i ? "L" : "M"} ${x(i)} ${y(v)}`).join(" ")
	return (
		<svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full" aria-hidden>
			<line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke={CROWD} strokeOpacity={0.35} strokeWidth={1} vectorEffect="non-scaling-stroke" />
			<path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
			{values.map((v, i) => (
				<circle key={labels[i]} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 3.5 : 2.2} fill={i === values.length - 1 ? color : "#d1d5db"}>
					<title>{labels[i]}</title>
				</circle>
			))}
		</svg>
	)
}

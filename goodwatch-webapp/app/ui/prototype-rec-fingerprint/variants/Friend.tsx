// PROTOTYPE - throwaway. You and a friend (existing): two fingerprints on one axis. How alike you are, the
// attributes you both seek, the ones that split you, and titles neither of you has seen that suit you both.
// Friends are round 2's two demo friends; real ones would need consent and a follow model.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { FpAttr } from "../model"
import { type ViewProps, cap, list } from "../parts"
import { MatchText, href } from "~/ui/prototype-rec-taste-2/kit"

const YOU = "#f59e0b"

export default function Friend({ data }: ViewProps) {
	const [fid, setFid] = useState(data.friends[0]?.id)
	const [all, setAll] = useState(false)
	const f = data.friends.find((x) => x.id === fid) ?? data.friends[0]
	if (!f) return null
	const rows = data.attrs.map((a, k) => ({ a, me: a.edge, them: f.edge[k] }))
	const max = Math.max(0.05, ...rows.flatMap((r) => [Math.abs(r.me), Math.abs(r.them)]))
	const common = rows
		.filter((r) => r.me > 0 && r.them > 0)
		.sort((x, y) => Math.min(y.me, y.them) - Math.min(x.me, x.them))
		.slice(0, 5)
	const split = rows
		.filter((r) => Math.sign(r.me) !== Math.sign(r.them))
		.sort((x, y) => Math.abs(y.me - y.them) - Math.abs(x.me - x.them))
		.slice(0, 5)
	const s0 = split[0]
	const you = data.who.mode === "me" ? "You" : "The demo member"

	return (
		<div className="min-h-screen bg-gray-950 pb-40 text-white">
			<header className="mx-auto max-w-5xl px-4 pb-8 pt-12 md:px-8 md:pt-16">
				<div className="flex flex-wrap items-center gap-2">
					{data.friends.map((x) => (
						<button
							key={x.id}
							type="button"
							onClick={() => setFid(x.id)}
							aria-pressed={x.id === f.id}
							className={`rounded-full border-2 px-3 py-1 text-sm font-semibold transition ${x.id === f.id ? "border-amber-600/70 bg-amber-900/30 text-amber-100" : "border-gray-700 bg-gray-900 text-gray-300"}`}
						>
							{x.name}
						</button>
					))}
					<span className="text-xs text-gray-500">Demo friends</span>
				</div>
				<h1 className="mt-6 text-3xl font-bold leading-tight md:text-5xl">
					{you} and {f.name} are {f.overlap}% alike.
				</h1>
				<p className="mt-3 max-w-3xl text-xl text-gray-300">
					{common.length
						? `You both seek ${list(common.slice(0, 3).map((r) => r.a.phrase))}.`
						: "You don't seek the same things."}{" "}
					{s0 &&
						(s0.me > 0
							? `You split on ${s0.a.phrase}: you seek it, ${f.name} doesn't.`
							: `You split on ${s0.a.phrase}: ${f.name} seeks it, you don't.`)}
				</p>
				<p className="mt-2 text-sm text-gray-500">{f.blurb}. {f.archetype}.</p>
			</header>

			<div className="mx-auto max-w-5xl px-4 md:px-8">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
					<div className="flex gap-4 text-xs text-gray-400">
						<span className="inline-flex items-center gap-1.5">
							<span className="h-3 w-3 rounded-full" style={{ background: YOU }} />
							{you}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="h-3 w-3 rounded-full border-2 border-white" />
							{f.name}
						</span>
					</div>
					<span className="text-xs text-gray-500">Middle line: most people. Right: more than most.</span>
				</div>

				<div className="grid gap-x-12 md:grid-cols-2">
					<Group title="Common ground" rows={common} max={max} name={f.name} />
					<Group title="Where you split" rows={split} max={max} name={f.name} />
				</div>

				<section className="mt-12">
					<h2 className="text-xl font-bold">For both of you</h2>
					<p className="mt-1 text-sm text-gray-400">Neither of you has seen these, and they suit you both.</p>
					<div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
						{f.both.slice(0, 6).map((b) => {
							const t = data.items[b.key]
							if (!t) return null
							return (
								<Link key={b.key} to={href(t)} className="block">
									<img src={t.poster} alt={`Poster for ${t.title}`} className="block aspect-[2/3] w-full rounded-md border-2 border-gray-800 object-cover" loading="lazy" />
									<span className="mt-1.5 block truncate text-sm font-semibold">{t.title}</span>
									<span className="block text-xs text-gray-400">
										<MatchText match={b.me} short /> you, <MatchText match={b.them} short /> {f.name}
									</span>
								</Link>
							)
						})}
					</div>
				</section>

				<section className="mt-12">
					<button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="text-sm font-semibold text-amber-300 underline underline-offset-2">
						{all ? "Hide the full comparison" : "Compare all 74 attributes"}
					</button>
					{all && (
						<div className="mt-4 grid gap-x-12 md:grid-cols-2">
							{data.families.map((fam) => (
								<Group
									key={fam.id}
									title={fam.name}
									rows={rows.filter((r) => r.a.family === fam.id)}
									max={max}
									name={f.name}
									dense
								/>
							))}
						</div>
					)}
				</section>
			</div>
		</div>
	)
}

function Group({
	title,
	rows,
	max,
	name,
	dense = false,
}: {
	title: string
	rows: { a: FpAttr; me: number; them: number }[]
	max: number
	name: string
	dense?: boolean
}) {
	const x = (v: number) => `${50 + (v / max) * 46}%`
	return (
		<div className="mt-6">
			<h3 className="text-sm font-semibold text-gray-300">{title}</h3>
			<ul className={dense ? "mt-1" : "mt-2 space-y-1"}>
				{rows.map((r) => (
					<li
						key={r.a.key}
						className={`grid grid-cols-[8rem_1fr] items-center gap-3 text-sm md:grid-cols-[10rem_1fr] ${dense ? "py-0.5" : "py-1.5"}`}
						title={`${r.a.label}: you ${r.me > 0 ? "more" : "less"} than most, ${name} ${r.them > 0 ? "more" : "less"} than most`}
					>
						<span className="truncate text-gray-200">{cap(r.a.label)}</span>
						<span className="relative block h-5" aria-hidden>
							<span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
							<span
								className="absolute top-1/2 h-px bg-white/30"
								style={{ left: `min(${x(r.me)}, ${x(r.them)})`, width: `calc(max(${x(r.me)}, ${x(r.them)}) - min(${x(r.me)}, ${x(r.them)}))` }}
							/>
							<span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gray-950" style={{ left: x(r.them) }} />
							<span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: x(r.me), background: YOU }} />
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}

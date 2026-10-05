// PROTOTYPE - throwaway. Round 4: round 2's You vs everyone, kept as it was. Where your ratings part ways
// with the GoodWatch score; each title shows both scores on one line, so the gap is the story.
// Changes from round 2: "an 8", a lead card that fits phones, and plain words for attributes in the gap list.
import { Link } from "@remix-run/react"
import { useState } from "react"
import {
	Ring,
	type ViewProps,
	YourScore,
	backdrop,
	href,
	vibe,
} from "~/ui/prototype-rec-taste-2/kit"
import type { CrowdRow } from "~/ui/prototype-rec-taste-2/model"
import { cap, noun } from "~/ui/prototype-rec-taste-2/words"

const article = (n: number) => (n === 8 ? "an" : "a")

const FILTERS = [
	{ id: "all", name: "Everything" },
	{ id: "movie", name: "Films" },
	{ id: "show", name: "Shows" },
] as const

export default function Crowd({ data }: ViewProps) {
	const r = data.report
	const c = r.crowd
	const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all")
	const [n, setN] = useState(8)
	const keep = (row: CrowdRow) =>
		filter === "all" || data.items[row.key]?.type === filter
	const higher = c.higher.filter(keep).slice(0, n)
	const lower = c.lower.filter(keep).slice(0, n)
	const warm = c.attrs.filter((a) => a.delta >= 3)
	const cold = c.attrs.filter((a) => a.delta <= -3)
	const hot = higher[0] && data.items[higher[0].key]
	const colder = lower[0] && data.items[lower[0].key]

	return (
		<div className="pb-32 text-white">
			<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-16">
				<p className="text-lg font-semibold text-amber-300">
					You and everyone else
				</p>
				<h1 className="mt-2 max-w-4xl text-4xl font-bold leading-tight md:text-6xl">
					{c.stance}
				</h1>
				<p className="mt-4 max-w-3xl text-lg text-gray-300 md:text-xl">
					{hot && (
						<>
							You gave{" "}
							<span className="font-semibold text-white">{hot.title}</span>{" "}
							{article(higher[0].mine)} {higher[0].mine} when the crowd
							shrugged.{" "}
						</>
					)}
					{colder && (
						<>
							Everyone loves{" "}
							<span className="font-semibold text-white">{colder.title}</span>.
							You gave it {article(lower[0].mine)} {lower[0].mine}.
						</>
					)}
				</p>
				{(warm.length > 0 || cold.length > 0) && (
					<p className="mt-3 max-w-3xl text-gray-400">
						{warm.length > 0 && (
							<>
								You're warmer than the crowd on{" "}
								{warm
									.slice(0, 3)
									.map((a) => noun(a.key))
									.join(", ")}
								.{" "}
							</>
						)}
						{cold.length > 0 && (
							<>
								You're colder on{" "}
								{cold
									.slice(0, 3)
									.map((a) => noun(a.key))
									.join(", ")}
								.
							</>
						)}
					</p>
				)}
				<div className="mt-8 flex flex-wrap items-center gap-2">
					{FILTERS.map((f) => (
						<button
							key={f.id}
							type="button"
							onClick={() => setFilter(f.id)}
							aria-pressed={filter === f.id}
							className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${filter === f.id ? "border-amber-500 bg-amber-900/30 text-amber-100" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
						>
							{f.name}
						</button>
					))}
					<span className="ml-auto flex items-center gap-4 text-xs text-gray-400">
						<span className="flex items-center gap-1.5">
							<span className="h-3 w-3 rounded-full border-2 border-gray-300" />{" "}
							GoodWatch score
						</span>
						<span className="flex items-center gap-1.5">
							<span className="h-3 w-3 rounded-sm bg-emerald-600" /> Your score
						</span>
					</span>
				</div>
			</section>

			<section className="mx-auto mt-8 grid max-w-7xl gap-10 px-4 md:grid-cols-2 md:px-8">
				<Column
					data={data}
					title="You rate higher than everyone"
					rows={higher}
					tone="up"
				/>
				<Column
					data={data}
					title="You rate lower than everyone"
					rows={lower}
					tone="down"
				/>
			</section>
			<div className="mx-auto mt-6 max-w-7xl px-4 md:px-8">
				{n < 30 && (
					<button
						type="button"
						onClick={() => setN((x) => x + 8)}
						className="text-sm font-semibold text-amber-300 underline underline-offset-4"
					>
						Show more
					</button>
				)}
			</div>

			{c.genres.length > 0 && (
				<section className="mx-auto mt-14 max-w-7xl px-4 md:px-8">
					<h2 className="text-2xl font-bold md:text-3xl">
						Where you and the crowd part ways
					</h2>
					<p className="mt-1 text-gray-400">
						Average gap between your score and the GoodWatch score, after
						allowing for how generous you are overall.
					</p>
					<div className="mt-6 grid gap-x-10 gap-y-3 md:grid-cols-2">
						{[
							...c.genres.map((g) => ({
								id: g.name,
								name: g.name,
								delta: g.delta,
								count: g.count,
							})),
							...c.attrs.map((a) => ({
								id: a.key,
								name: cap(noun(a.key)),
								delta: a.delta,
								count: a.count,
							})),
						]
							.filter((x) => Math.abs(x.delta) >= 2)
							.sort((a, b) => b.delta - a.delta)
							.map((x) => (
								<div
									key={x.id}
									className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-sm"
								>
									<span className="truncate text-gray-200">{x.name}</span>
									<span className="relative h-2 rounded-full bg-gray-800">
										<span className="absolute inset-y-0 left-1/2 w-px bg-gray-500" />
										<span
											className={`absolute inset-y-0 rounded-full ${x.delta > 0 ? "bg-emerald-500" : "bg-rose-500"}`}
											style={
												x.delta > 0
													? {
															left: "50%",
															width: `${Math.min(50, x.delta * 5)}%`,
														}
													: {
															right: "50%",
															width: `${Math.min(50, -x.delta * 5)}%`,
														}
											}
										/>
									</span>
									<span
										className={`text-right font-bold tabular-nums ${x.delta > 0 ? "text-emerald-400" : "text-rose-400"}`}
									>
										{x.delta > 0 ? "+" : ""}
										{x.delta}
									</span>
								</div>
							))}
					</div>
				</section>
			)}
		</div>
	)
}

function Column({
	data,
	title,
	rows,
	tone,
}: {
	data: ViewProps["data"]
	title: string
	rows: CrowdRow[]
	tone: "up" | "down"
}) {
	const [lead, ...rest] = rows
	const lt = lead && data.items[lead.key]
	return (
		<div className="min-w-0">
			<h2
				className={`mb-4 text-xl font-bold ${tone === "up" ? "text-emerald-300" : "text-rose-300"}`}
			>
				{title}
			</h2>
			{lt && (
				<Link
					to={href(lt)}
					className="relative isolate mb-4 block overflow-hidden rounded-2xl border border-gray-800"
				>
					<img
						src={backdrop(lt, "w780")}
						alt=""
						className="absolute inset-0 -z-10 h-full w-full object-cover opacity-50"
					/>
					<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
					<div className="flex items-end gap-4 p-4 md:gap-5 md:p-5">
						<img
							src={lt.poster}
							alt={`Poster for ${lt.title}`}
							className="w-20 shrink-0 rounded-lg border-2 border-gray-700 sm:w-28 md:w-32"
						/>
						<div className="min-w-0 pb-1">
							<p className="text-xl font-bold leading-tight md:text-2xl">
								{lt.title}{" "}
								<span className="font-normal text-gray-400">({lt.year})</span>
							</p>
							<div className="mt-3 flex flex-wrap items-center gap-3 md:mt-4 md:gap-4">
								<YourScore score={lead.mine} size="lg" label="You" />
								<Ring item={lt} size={48} label />
							</div>
							<p className="mt-3 text-sm text-gray-300">
								{tone === "up"
									? `${lead.delta} points above the crowd, after your usual generosity.`
									: `${-lead.delta} points below the crowd, after your usual generosity.`}
							</p>
						</div>
					</div>
				</Link>
			)}
			<ul className="space-y-3">
				{rest.map((row) => {
					const t = data.items[row.key]
					if (!t) return null
					const mine = row.mine * 10
					const lo = Math.min(mine, row.crowd)
					const hi = Math.max(mine, row.crowd)
					return (
						<li key={row.key}>
							<Link
								to={href(t)}
								className="grid grid-cols-[3.5rem_1fr] gap-4 rounded-xl border border-gray-800 bg-gray-950/60 p-2 pr-4 hover:border-gray-600"
							>
								<img
									src={t.poster.replace("/w342/", "/w185/")}
									alt=""
									className="aspect-[2/3] w-14 rounded-md object-cover"
									loading="lazy"
								/>
								<div className="min-w-0 self-center">
									<div className="flex items-center justify-between gap-3">
										<p className="truncate font-semibold">
											{t.title}{" "}
											<span className="font-normal text-gray-400">
												({t.year})
											</span>
										</p>
										<span className="flex shrink-0 items-center gap-2">
											<YourScore score={row.mine} size="sm" />
											<Ring item={t} size={30} />
										</span>
									</div>
									<div className="relative mt-3 h-4">
										<span className="absolute inset-x-0 top-1/2 h-px bg-gray-700" />
										<span
											className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25"
											style={{ left: `${lo}%`, width: `${hi - lo}%` }}
										/>
										<span
											className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-300 bg-gray-900"
											style={{ left: `${row.crowd}%` }}
										/>
										<span
											className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm"
											style={{ left: `${mine}%`, background: vibe(row.mine) }}
										/>
									</div>
								</div>
							</Link>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

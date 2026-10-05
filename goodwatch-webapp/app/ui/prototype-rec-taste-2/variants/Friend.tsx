// PROTOTYPE - throwaway. You and a friend (existing components): two tastes side by side. Canon against
// canon, both signatures on one line, what you share and where you split, the titles you both rated,
// and what to watch together. The friends are demo tastes; real ones would need consent and follows.
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	MatchText,
	PosterCard,
	RatedPoster,
	Signature,
	SignatureGroups,
	type ViewProps,
	YourScore,
	attrOf,
	href,
	itemsOf,
} from "../kit"
import type { FriendReport } from "../model"

export default function Friend({ data }: ViewProps) {
	const r = data.report
	const [id, setId] = useState(r.friends[0]?.id)
	const f = r.friends.find((x) => x.id === id) ?? r.friends[0]
	if (!f) return null
	const me = r.who.mode === "me" ? "You" : "The demo member"

	return (
		<div className="pb-32 text-white">
			<section className="mx-auto max-w-7xl px-4 pt-10 md:px-8 md:pt-14">
				<div className="flex flex-wrap items-center gap-2">
					<span className="mr-2 text-sm text-gray-400">Compare with</span>
					{r.friends.map((x) => (
						<button
							key={x.id}
							type="button"
							onClick={() => setId(x.id)}
							aria-pressed={x.id === f.id}
							className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold ${x.id === f.id ? "border-amber-500 bg-amber-900/30 text-amber-100" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
						>
							{x.name}
						</button>
					))}
					<span className="text-xs text-gray-500">{f.blurb}</span>
				</div>
			</section>

			<AnimatePresence mode="wait">
				<motion.div
					key={f.id}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
				>
					<section className="mx-auto mt-8 grid max-w-7xl items-center gap-8 px-4 md:grid-cols-[1fr_auto_1fr] md:px-8">
						<Person
							name={me}
							archetype={r.archetype.name}
							keys={r.canon.slice(0, 4).map((c) => c.key)}
							data={data}
						/>
						<div className="text-center">
							<p className="text-6xl font-extrabold tabular-nums md:text-8xl">
								{f.overlap}%
							</p>
							<p className="mt-1 text-gray-400">in tune</p>
						</div>
						<Person
							name={f.name}
							archetype={f.archetype}
							keys={f.canon}
							data={data}
							right
						/>
					</section>

					<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
						<div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4 md:p-6">
							<div className="mb-3 flex flex-wrap items-center gap-5 text-sm text-gray-300">
								<span className="flex items-center gap-2">
									<span className="h-3 w-5 rounded-sm bg-amber-500" />{" "}
									{me === "You" ? "You" : "Demo member"}
								</span>
								<span className="flex items-center gap-2">
									<span className="h-3 w-5 rounded-sm border border-white/60" />{" "}
									{f.name}
								</span>
							</div>
							<Signature vector={r.vector} other={f.vector} height={140} />
							<SignatureGroups />
						</div>
					</section>

					<section className="mx-auto mt-12 grid max-w-7xl gap-10 px-4 md:grid-cols-2 md:px-8">
						<div>
							<h2 className="text-2xl font-bold">You both go for</h2>
							<p className="mt-4 text-2xl leading-snug text-gray-100">
								{f.shared.map((k) => attrOf(data, k).phrase).join(", ") ||
									"Not much yet."}
							</p>
						</div>
						<div>
							<h2 className="text-2xl font-bold">Where you split</h2>
							<ul className="mt-4 space-y-3">
								{f.split.map((s) => (
									<SplitRow
										key={s.key}
										data={data}
										row={s}
										friend={f.name}
										scale={Math.max(
											0.05,
											...f.split.flatMap((x) => [
												Math.abs(x.me),
												Math.abs(x.them),
											]),
										)}
									/>
								))}
							</ul>
						</div>
					</section>

					{(f.agree.length > 0 || f.disagree.length > 0) && (
						<section className="mx-auto mt-14 grid max-w-7xl gap-10 px-4 md:grid-cols-2 md:px-8">
							<Both
								data={data}
								title="Rated by both, and you agree"
								rows={f.agree}
								friend={f.name}
							/>
							<Both
								data={data}
								title="Rated by both, and you don't"
								rows={f.disagree}
								friend={f.name}
							/>
						</section>
					)}

					<section className="mx-auto mt-14 max-w-7xl px-4 md:px-8">
						<h2 className="text-2xl font-bold md:text-3xl">
							Tonight, for both of you
						</h2>
						<p className="mt-1 text-gray-400">
							Neither of you has seen these. Ranked by the lower of your two
							matches, so nobody settles.
						</p>
						<div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
							{f.both.slice(0, 10).map((x) => {
								const t = data.items[x.key]
								return t ? (
									<Link key={x.key} to={href(t)} className="block">
										<PosterCard item={t} services={data.services} />
										<div className="mt-1.5 flex justify-between text-xs">
											<span>
												<span className="text-gray-400">You </span>
												<MatchText match={x.me} short />
											</span>
											<span>
												<span className="text-gray-400">{f.name} </span>
												<MatchText match={x.them} short />
											</span>
										</div>
									</Link>
								) : null
							})}
						</div>
					</section>
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

function Person({
	name,
	archetype,
	keys,
	data,
	right = false,
}: {
	name: string
	archetype: string
	keys: string[]
	data: ViewProps["data"]
	right?: boolean
}) {
	return (
		<div className={right ? "md:text-right" : ""}>
			<p className="text-sm text-gray-400">{name}</p>
			<p className="mt-1 text-2xl font-bold leading-tight md:text-3xl">
				{archetype}
			</p>
			<div className="mt-4 grid grid-cols-4 gap-2">
				{itemsOf(data, keys).map((t) => (
					<RatedPoster key={t.key} t={t} size="w185" showScore={false} />
				))}
			</div>
		</div>
	)
}

function SplitRow({
	data,
	row,
	friend,
	scale,
}: {
	data: ViewProps["data"]
	row: FriendReport["split"][number]
	friend: string
	scale: number
}) {
	const a = attrOf(data, row.key)
	const bar = (v: number, cls: string) => (
		<span className="relative h-2 flex-1 rounded-full bg-gray-800">
			<span className="absolute inset-y-0 left-1/2 w-px bg-gray-500" />
			<span
				className={`absolute inset-y-0 rounded-full ${cls}`}
				style={
					v >= 0
						? { left: "50%", width: `${(v / scale) * 50}%` }
						: { right: "50%", width: `${(-v / scale) * 50}%` }
				}
			/>
		</span>
	)
	return (
		<li>
			<p className="text-sm font-semibold">{a.label}</p>
			<div className="mt-1 grid grid-cols-[3.5rem_1fr] items-center gap-x-3 gap-y-1 text-xs text-gray-400">
				<span>You</span>
				{bar(row.me, "bg-amber-500")}
				<span className="truncate">{friend}</span>
				{bar(row.them, "bg-gray-300")}
			</div>
		</li>
	)
}

function Both({
	data,
	title,
	rows,
	friend,
}: {
	data: ViewProps["data"]
	title: string
	rows: FriendReport["agree"]
	friend: string
}) {
	return (
		<div className="min-w-0">
			<h2 className="text-xl font-bold">{title}</h2>
			{rows.length === 0 && (
				<p className="mt-3 text-sm text-gray-500">None yet.</p>
			)}
			<ul className="mt-4 space-y-2">
				{rows.map((x) => {
					const t = data.items[x.key]
					return t ? (
						<li
							key={x.key}
							className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950/60 p-2"
						>
							<img
								src={t.poster.replace("/w342/", "/w185/")}
								alt=""
								className="aspect-[2/3] w-10 rounded object-cover"
								loading="lazy"
							/>
							<span className="min-w-0 flex-1 truncate font-semibold">
								{t.title}
							</span>
							<YourScore score={x.me} size="sm" label="you" />
							<YourScore score={x.them} size="sm" label={friend} />
						</li>
					) : null
				})}
			</ul>
		</div>
	)
}

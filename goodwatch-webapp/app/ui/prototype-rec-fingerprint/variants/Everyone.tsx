// PROTOTYPE - throwaway. You vs everyone (existing): each attribute as two dots on one axis, how much of
// what you rate carries it strongly against how much of what everyone watches does, plus how you rate it
// when it's there. Starts with where you differ most; everything else is one tap away.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { CROWD, type FpAttr } from "../model"
import {
	AttrDetail,
	ShareDumbbell,
	type ViewProps,
	attrOf,
	cap,
	colorOf,
	firstName,
	pct,
	ratioWords,
} from "../parts"

type Tab = "more" | "less" | "all"

export default function Everyone({ data }: ViewProps) {
	const [tab, setTab] = useState<Tab>("more")
	const [open, setOpen] = useState<string | null>(null)
	const usable = data.attrs.filter((a) => a.n >= 3 || a.crowdShare >= 0.02)
	const ratio = (a: FpAttr) => (a.share + 0.01) / (a.crowdShare + 0.01)
	const more = [...usable]
		.filter((a) => a.share > a.crowdShare)
		.sort((a, b) => ratio(b) * Math.sqrt(b.share) - ratio(a) * Math.sqrt(a.share))
		.slice(0, 10)
	const less = [...usable]
		.filter((a) => a.share < a.crowdShare)
		.sort((a, b) => ratio(a) / Math.sqrt(a.crowdShare) - ratio(b) / Math.sqrt(b.crowdShare))
		.slice(0, 10)
	const top = more[0] ?? attrOf(data, data.headline.seek[0])
	const low = less[0]
	const maxShare = Math.max(0.05, ...data.attrs.flatMap((a) => [a.share, a.crowdShare]))
	const tabs: { id: Tab; name: string }[] = [
		{ id: "more", name: "More than most" },
		{ id: "less", name: "Less than most" },
		{ id: "all", name: "All 74" },
	]

	const row = (a: FpAttr) => {
		const isOpen = open === a.key
		return (
			<li key={a.key} className="border-b border-white/10">
				<button
					type="button"
					onClick={() => setOpen(isOpen ? null : a.key)}
					aria-expanded={isOpen}
					className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 text-left md:grid-cols-[13rem_1fr_7rem_5rem]"
				>
					<span className="min-w-0">
						<span className="block truncate font-semibold text-white">{a.label}</span>
						<span className="block text-xs text-gray-500">
							{data.families.find((f) => f.id === a.family)?.name}
						</span>
					</span>
					<span className="col-span-2 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1">
						<ShareDumbbell a={a} max={maxShare} />
					</span>
					<span className="text-right text-sm tabular-nums text-gray-300 md:text-left">
						<span className="font-semibold text-white">{pct(a.share)}</span>{" "}
						<span className="text-gray-500">vs {pct(a.crowdShare)}</span>
					</span>
					<span className="hidden text-right text-sm tabular-nums md:block">
						{a.lift == null ? (
							<span className="text-gray-600">few titles</span>
						) : (
							<span className={a.lift >= 0.2 ? "text-emerald-400" : a.lift <= -0.2 ? "text-rose-400" : "text-gray-400"}>
								{a.lift > 0 ? "+" : ""}
								{a.lift.toFixed(1)}
							</span>
						)}
					</span>
				</button>
				<AnimatePresence initial={false}>
					{isOpen && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.22 }}
							className="overflow-hidden"
						>
							<div className="pb-6 pt-1">
								<AttrDetail data={data} a={a} compact />
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</li>
		)
	}

	return (
		<div className="min-h-screen bg-gray-950 pb-40 text-white">
			<header className="mx-auto max-w-5xl px-4 pb-8 pt-12 md:px-8 md:pt-16">
				<p className="text-sm font-semibold text-amber-400">
					{firstName(data)} and everyone else
				</p>
				<h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
					{cap(top.noun)}: {ratioWords(top) ?? "more than most people"}.
				</h1>
				{low && (
					<p className="mt-3 text-xl text-gray-300 md:text-2xl">
						{cap(low.noun)}: {ratioWords(low) ?? "less than most people"}.
					</p>
				)}
				<p className="mt-4 max-w-2xl text-gray-400">
					Each row compares how much of what you rated carries an attribute
					strongly with how much of what everyone watches does. The last number
					is how you rate those titles against your usual{" "}
					{data.who.avg.toFixed(1)}.
				</p>
			</header>

			<div className="mx-auto max-w-5xl px-4 md:px-8">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
					<div className="flex flex-wrap gap-2" role="tablist">
						{tabs.map((t) => (
							<button
								key={t.id}
								type="button"
								role="tab"
								aria-selected={tab === t.id}
								onClick={() => setTab(t.id)}
								className={`whitespace-nowrap rounded-full border-2 px-3 py-1 text-sm font-semibold transition ${tab === t.id ? "border-amber-600/70 bg-amber-900/30 text-amber-100" : "border-gray-700 bg-gray-900 text-gray-300"}`}
							>
								{t.name}
							</button>
						))}
					</div>
					<div className="flex items-center gap-4 text-xs text-gray-400">
						<span className="inline-flex items-center gap-1.5">
							<span className="h-3 w-3 rounded-full" style={{ background: colorOf(1) }} />
							You
						</span>
						<span className="inline-flex items-center gap-1.5">
							<span className="h-2.5 w-2.5 rounded-full" style={{ background: CROWD }} />
							Everyone
						</span>
					</div>
				</div>

				{tab !== "all" ? (
					<ul>
						{(tab === "more" ? more : less).map(row)}
					</ul>
				) : (
					data.families.map((f) => (
						<section key={f.id} className="mt-8">
							<h2 className="text-lg font-bold">
								{f.name} <span className="font-normal text-gray-400">{f.line.toLowerCase()}</span>
							</h2>
							<ul>
								{f.keys
									.map((k) => attrOf(data, k))
									.sort((a, b) => b.share - b.crowdShare - (a.share - a.crowdShare))
									.map(row)}
							</ul>
						</section>
					))
				)}
			</div>
		</div>
	)
}

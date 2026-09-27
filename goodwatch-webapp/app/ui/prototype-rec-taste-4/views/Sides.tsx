// PROTOTYPE - throwaway. Round 4: round 2's Sides of you, kept as it was. The titles you love fall into a
// few clusters by title analysis; the page leads with the contradiction between the two furthest apart,
// lets you open each side, and ends with how you rate each viewing mood.
// Changes from round 2: smaller poster fans on phones, so the contradiction fits on one screen.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	PickRow,
	RatedPoster,
	ServicesSwitch,
	type ViewProps,
	YourScore,
	attrOf,
	itemsOf,
	useOnMine,
} from "~/ui/prototype-rec-taste-2/kit"
import type { Side } from "~/ui/prototype-rec-taste-2/model"

export default function Sides({ data }: ViewProps) {
	const r = data.report
	const [sideId, setSideId] = useState(
		[...r.sides].sort((x, y) => y.avg - x.avg)[0]?.id,
	)
	const [moodId, setMoodId] = useState(r.moods[0]?.id)
	const services = useOnMine(data)
	const side = r.sides.find((s) => s.id === sideId) ?? r.sides[0]
	const mood = r.moods.find((m) => m.id === moodId) ?? r.moods[0]
	const a = r.sides.find((s) => s.id === r.contradiction?.a)
	const b = r.sides.find((s) => s.id === r.contradiction?.b)

	return (
		<div className="pb-32 text-white">
			{a && b && (
				<section className="relative overflow-hidden border-b border-gray-800 bg-gray-950">
					<div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-10 md:gap-8 md:grid-cols-[1fr_1.3fr_1fr] md:px-8 md:py-16">
						<Fan data={data} side={a} dir={-1} onPick={() => setSideId(a.id)} />
						<div className="text-center">
							<p className="text-sm text-gray-400">
								The contradiction in your taste
							</p>
							<h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
								You love{" "}
								<span className="text-amber-300">{a.name.toLowerCase()}</span>
							</h1>
							<p className="my-3 text-xl text-gray-400 md:text-2xl">and also</p>
							<p className="text-3xl font-bold leading-tight md:text-5xl">
								<span className="text-sky-300">{b.name.toLowerCase()}</span>
							</p>
							<p className="mx-auto mt-5 max-w-md text-gray-400">
								Most people's favorites sit close together. Yours are{" "}
								{Math.round(a.share * 100)}% one thing and{" "}
								{Math.round(b.share * 100)}% its opposite.
							</p>
						</div>
						<Fan data={data} side={b} dir={1} onPick={() => setSideId(b.id)} />
					</div>
				</section>
			)}

			<section className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
				<h2 className="text-2xl font-bold md:text-3xl">
					The sides of your taste
				</h2>
				<p className="mt-1 text-gray-400">
					Everything you rated highly, grouped by what the title analysis says
					the titles have in common.
				</p>
				<div
					className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"
					role="tablist"
				>
					{r.sides.map((s) => {
						const on = s.id === side?.id
						const first = data.items[s.titles[0]]
						return (
							<button
								key={s.id}
								type="button"
								role="tab"
								aria-selected={on}
								onClick={() => setSideId(s.id)}
								className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition ${on ? "border-amber-500 bg-amber-950/40" : "border-gray-800 bg-gray-950/60 hover:border-gray-600"}`}
							>
								{first && (
									<img
										src={first.backdrop.replace("/w1280/", "/w780/")}
										alt=""
										className="absolute inset-0 -z-0 h-full w-full object-cover opacity-20"
									/>
								)}
								<span className="relative block text-lg font-bold leading-tight">
									{s.name}
								</span>
								<span className="relative mt-2 block text-sm text-gray-300">
									{Math.round(s.share * 100)}% of what you love
								</span>
							</button>
						)
					})}
				</div>

				<AnimatePresence mode="wait">
					{side && (
						<motion.div
							key={side.id}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.25 }}
							className="mt-8"
						>
							<div className="flex flex-wrap items-center gap-3">
								<YourScore
									score={Math.round(side.avg)}
									label={`Your average here: ${side.avg}`}
								/>
								{side.attrs.map((k) => {
									const at = attrOf(data, k)
									return (
										<span
											key={k}
											className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm"
										>
											<span
												className="h-2.5 w-2.5 rounded-full"
												style={{
													background: at.color.replace(/[\d.]+\)$/, "1)"),
												}}
											/>
											{at.label}
										</span>
									)
								})}
							</div>
							<div className="mt-5 grid grid-cols-5 gap-2 md:grid-cols-10">
								{itemsOf(data, side.titles).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" />
								))}
							</div>
							<div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
								<h3 className="text-xl font-bold">More for this side of you</h3>
								<ServicesSwitch state={services} />
							</div>
							<PickRow data={data} refs={services.filter(side.picks)} n={6} />
						</motion.div>
					)}
				</AnimatePresence>
			</section>

			{mood && (
				<section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
					<h2 className="text-2xl font-bold md:text-3xl">Your taste by mood</h2>
					<p className="mt-1 text-gray-400">
						How you rate titles made for each kind of evening, against your
						usual {r.who.avg}.
					</p>
					<div className="mt-6 flex flex-wrap gap-2">
						{r.moods.map((m) => (
							<button
								key={m.id}
								type="button"
								onClick={() => setMoodId(m.id)}
								aria-pressed={m.id === mood.id}
								className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition ${m.id === mood.id ? "border-amber-500 bg-amber-900/30 text-amber-100" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
							>
								{m.name}
								<span
									className={`ml-2 tabular-nums ${m.delta >= 0.2 ? "text-emerald-400" : m.delta <= -0.2 ? "text-rose-400" : "text-gray-400"}`}
								>
									{m.delta > 0 ? "+" : ""}
									{m.delta.toFixed(1)}
								</span>
							</button>
						))}
					</div>
					<div className="mt-6 grid gap-8 md:grid-cols-[1fr_2fr]">
						<div>
							<p className="text-3xl font-bold">{mood.name}</p>
							<p className="mt-1 text-gray-400">{mood.line}.</p>
							<p className="mt-4 text-lg text-gray-200">
								{mood.delta >= 0.2
									? `You rate these ${mood.delta.toFixed(1)} above your average. This is where your taste is happiest.`
									: mood.delta <= -0.2
										? `You rate these ${Math.abs(mood.delta).toFixed(1)} below your average. You watch them, but they rarely stick.`
										: "You rate these about as you rate everything else."}
							</p>
							<div className="mt-5 grid grid-cols-3 gap-2">
								{itemsOf(data, mood.top.slice(0, 3)).map((t) => (
									<RatedPoster key={t.key} t={t} size="w185" />
								))}
							</div>
						</div>
						<div>
							<h3 className="mb-4 text-lg font-bold">
								For your next {mood.name.toLowerCase()} evening
							</h3>
							<PickRow
								data={data}
								refs={services.filter(mood.picks)}
								n={4}
								cols="grid-cols-2 md:grid-cols-4"
							/>
						</div>
					</div>
				</section>
			)}
		</div>
	)
}

function Fan({
	data,
	side,
	dir,
	onPick,
}: { data: ViewProps["data"]; side: Side; dir: 1 | -1; onPick: () => void }) {
	const items = itemsOf(data, side.titles.slice(0, 3))
	return (
		<button
			type="button"
			onClick={onPick}
			className="relative mx-auto h-40 w-56 md:h-72 md:w-full"
			aria-label={`Open ${side.name}`}
		>
			{items.map((t, i) => (
				<img
					key={t.key}
					src={t.poster}
					alt={t.title}
					className="absolute top-1/2 w-24 rounded-lg border-4 border-gray-800 shadow-2xl md:w-40"
					style={{
						left: `calc(50% + ${(i - 1) * 44 * dir}px)`,
						transform: `translate(-50%, -50%) rotate(${(i - 1) * 8 * dir}deg)`,
						zIndex: dir === 1 ? 3 - i : i,
					}}
				/>
			))}
		</button>
	)
}

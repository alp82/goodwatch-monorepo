// PROTOTYPE - throwaway. Taste card (bolder): your taste as a card worth posting. Archetype, canon,
// what you seek, your contradiction and your signature, in three formats and four color themes
// taken from your own top attributes. Sharing is stubbed; the real one would use the share card pipeline.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import {
	Signature,
	type ViewProps,
	attrOf,
	backdrop,
	itemsOf,
	poster,
} from "../kit"

const SERIF = "'Instrument Serif', Georgia, serif"
const FONT =
	"https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"

const FORMATS = [
	{ id: "story", name: "Story", aspect: "9 / 16", width: "min(380px, 100%)" },
	{ id: "square", name: "Square", aspect: "1 / 1", width: "min(560px, 100%)" },
	{
		id: "wide",
		name: "Link preview",
		aspect: "1.91 / 1",
		width: "min(860px, 100%)",
	},
] as const

const solid = (rgba: string) => rgba.replace(/[\d.]+\)$/, "1)")

export default function Card({ data }: ViewProps) {
	const r = data.report
	const canon = itemsOf(
		data,
		r.canon.map((c) => c.key),
	)
	const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("story")
	const [themeId, setThemeId] = useState("first")
	const [shared, setShared] = useState(false)
	const f = FORMATS.find((x) => x.id === format) ?? FORMATS[0]
	const c1 = solid(r.loves[0]?.color ?? "rgba(245,158,11,1)")
	const c2 = solid(r.loves[1]?.color ?? "rgba(56,189,248,1)")
	const themes = [
		{
			id: "first",
			name: r.loves[0]?.label ?? "Warm",
			bg: `radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, ${c1} 55%, #05070b) 0%, #05070b 70%)`,
			ink: "#f5f5f4",
			accent: c1,
		},
		{
			id: "second",
			name: r.loves[1]?.label ?? "Cool",
			bg: `radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, ${c2} 55%, #05070b) 0%, #05070b 70%)`,
			ink: "#f5f5f4",
			accent: c2,
		},
		{ id: "screen", name: "Screen", bg: "", ink: "#ffffff", accent: "#fbbf24" },
		{
			id: "silver",
			name: "Silver",
			bg: "linear-gradient(160deg, #e9ebef, #c9ced8)",
			ink: "#0a0c10",
			accent: "#0a0c10",
		},
	]
	const theme = themes.find((t) => t.id === themeId) ?? themes[0]
	const who = r.who.handle
		? `@${r.who.handle}`
		: r.who.mode === "me"
			? r.who.name
			: "demo member"
	const a = r.sides.find((s) => s.id === r.contradiction?.a)
	const b = r.sides.find((s) => s.id === r.contradiction?.b)
	const wide = format === "wide"
	const story = format === "story"

	return (
		<div className="min-h-screen bg-gray-950 pb-32 text-white">
			<link rel="stylesheet" href={FONT} />
			<div className="mx-auto grid max-w-7xl gap-10 px-4 pt-10 md:px-8 lg:grid-cols-[1fr_20rem]">
				<div className="flex min-w-0 justify-center">
					<AnimatePresence mode="wait">
						<motion.div
							key={`${format}-${themeId}`}
							initial={{ opacity: 0, scale: 0.97 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.25 }}
							className="@container relative isolate overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10"
							style={{
								aspectRatio: f.aspect,
								width: f.width,
								background: theme.bg || "#000",
								color: theme.ink,
							}}
						>
							{theme.id === "screen" && canon[0] && (
								<>
									<img
										src={backdrop(canon[0], "w1280")}
										alt=""
										className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70"
									/>
									<div className="absolute inset-0 -z-10 bg-linear-to-t from-black via-black/70 to-black/20" />
								</>
							)}
							<div
								className={`flex h-full flex-col ${wide ? "p-[4cqw]" : "p-[6cqw]"}`}
							>
								<div
									className="flex items-center justify-between text-[3.2cqw] opacity-80"
									style={wide ? { fontSize: "1.9cqw" } : undefined}
								>
									<span className="font-semibold">{who}'s taste</span>
									<span className="font-bold tracking-tight">GoodWatch</span>
								</div>

								<div
									className={
										wide
											? "mt-[2cqw] grid flex-1 grid-cols-[1.1fr_1fr] gap-[3cqw]"
											: "flex flex-1 flex-col"
									}
								>
									<div className="flex min-h-0 flex-col">
										<h1
											className="mt-[3cqw] leading-[0.92]"
											style={{
												fontFamily: SERIF,
												fontSize: wide ? "6.2cqw" : story ? "13cqw" : "10cqw",
											}}
										>
											{r.archetype.name}
										</h1>
										<div
											className="mt-[4cqw] space-y-[1.5cqw]"
											style={{
												fontSize: wide ? "1.9cqw" : story ? "4cqw" : "3.1cqw",
											}}
										>
											{r.loves.slice(0, 3).map((l) => (
												<div
													key={l.key}
													className="flex items-center gap-[2cqw]"
												>
													<span
														className="h-[0.6em] w-[2.2em] rounded-full"
														style={{
															background:
																theme.id === "silver"
																	? "#0a0c10"
																	: solid(l.color),
														}}
													/>
													<span>{l.phrase}</span>
												</div>
											))}
										</div>
										{a && b && !wide && (
											<p
												className="mt-[4cqw] opacity-80"
												style={{
													fontFamily: SERIF,
													fontStyle: "italic",
													fontSize: story ? "5cqw" : "3.6cqw",
												}}
											>
												{a.name.toLowerCase()}, and also {b.name.toLowerCase()}
											</p>
										)}
									</div>

									{story ? (
										// Story: the canon as a fanned hand of posters, like a stack pulled from a shelf.
										<div className="mt-auto flex justify-center pb-[2cqw] pt-[6cqw]">
											{canon.slice(0, 4).map((t, i) => (
												<img
													key={t.key}
													src={poster(t, "w342")}
													alt={t.title}
													className="aspect-[2/3] w-[29cqw] rounded-[1.6cqw] object-cover shadow-2xl ring-1 ring-black/40"
													style={{
														marginLeft: i ? "-9cqw" : 0,
														transform: `rotate(${(i - 1.5) * 5}deg) translateY(${Math.abs(i - 1.5) * 2.2}cqw)`,
														zIndex: 4 - Math.abs(Math.round(i - 1.5)),
													}}
												/>
											))}
										</div>
									) : (
										<div
											className={
												wide
													? "grid grid-cols-2 gap-[1.2cqw] self-center"
													: "mt-auto grid grid-cols-4 gap-[2cqw]"
											}
										>
											{canon.slice(0, 4).map((t) => (
												<img
													key={t.key}
													src={poster(t, "w342")}
													alt={t.title}
													className="aspect-[2/3] w-full rounded-[1.2cqw] object-cover shadow-lg"
												/>
											))}
										</div>
									)}
								</div>

								<div className={wide ? "mt-[2cqw]" : "mt-[4cqw]"}>
									<Signature
										vector={r.vector}
										height={wide ? 34 : story ? 64 : 48}
										className="pointer-events-none"
									/>
								</div>
							</div>
						</motion.div>
					</AnimatePresence>
				</div>

				<aside className="space-y-8">
					<div>
						<h1 className="text-2xl font-bold">Your taste card</h1>
						<p className="mt-1 text-gray-400">
							Built from your ratings and the title analysis behind them. It
							changes as your taste does.
						</p>
					</div>
					<Choice
						label="Format"
						options={FORMATS.map((x) => ({ id: x.id, name: x.name }))}
						value={format}
						onChange={(v) => setFormat(v as typeof format)}
					/>
					<div>
						<h2 className="mb-2 text-sm font-semibold text-gray-400">Color</h2>
						<div className="flex flex-wrap gap-2">
							{themes.map((t) => (
								<button
									key={t.id}
									type="button"
									onClick={() => setThemeId(t.id)}
									aria-pressed={t.id === themeId}
									className={`flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-sm font-semibold ${t.id === themeId ? "border-amber-500 text-white" : "border-gray-700 text-gray-300 hover:border-gray-500"}`}
								>
									<span
										className="h-6 w-6 rounded-full ring-1 ring-white/20"
										style={{
											background:
												t.id === "screen" && canon[0]
													? `center / cover url(${backdrop(canon[0], "w780")})`
													: t.bg || t.accent,
										}}
									/>
									{t.name}
								</button>
							))}
						</div>
					</div>
					<div>
						<button
							type="button"
							onClick={() => setShared(true)}
							className="w-full rounded-xl bg-amber-500 px-5 py-3 font-bold text-black hover:bg-amber-400"
						>
							Copy link to my taste card
						</button>
						{shared && (
							<p className="mt-2 text-sm text-gray-400">
								Sharing is off in this prototype. The real card would publish
								through the share card and link preview pipeline.
							</p>
						)}
					</div>
					<div className="text-sm text-gray-400">
						<p>What's on it:</p>
						<ul className="mt-2 list-disc space-y-1 pl-5">
							<li>Your archetype, named from your two strongest attributes</li>
							<li>Your canon's first four titles</li>
							<li>
								What you seek most:{" "}
								{r.loves
									.slice(0, 3)
									.map((l) => attrOf(data, l.key).label)
									.join(", ")}
							</li>
							<li>Your signature across all 74 attributes</li>
						</ul>
					</div>
				</aside>
			</div>
		</div>
	)
}

function Choice({
	label,
	options,
	value,
	onChange,
}: {
	label: string
	options: { id: string; name: string }[]
	value: string
	onChange: (v: string) => void
}) {
	return (
		<div>
			<h2 className="mb-2 text-sm font-semibold text-gray-400">{label}</h2>
			<div className="inline-flex rounded-xl border-2 border-gray-700 p-1">
				{options.map((o) => (
					<button
						key={o.id}
						type="button"
						onClick={() => onChange(o.id)}
						aria-pressed={o.id === value}
						className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${o.id === value ? "bg-white text-black" : "text-gray-300 hover:text-white"}`}
					>
						{o.name}
					</button>
				))}
			</div>
		</div>
	)
}

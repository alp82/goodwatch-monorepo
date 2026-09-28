// Fingerprint: the person named from their fingerprint families ("The dreamlike novelty hunter") with one line on what
// gets them and what doesn't, then the five families as rows. Opening a family shows its attributes against everyone;
// picking one shows what it means, the person's stance, the titles that carry it, and the exception. Last, the titles
// that are most them.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useState } from "react"
import {
	type FamilyId,
	type FingerprintAttribute,
	type FingerprintView,
	TIER_NAMES,
} from "~/server/taste-portrait/view"
import {
	RatedPoster,
	type Titles,
	article,
	capitalize,
	posterUrl,
	titlesOf,
} from "./parts"

/** A warm and cool diverging pair, checked for color vision deficiency on the page surface; everyone is gray. */
const SEEK = "#f59e0b"
const AVOID = "#38bdf8"
const EVERYONE = "#9ca3af"

const colorOf = (edge: number) => (edge >= 0 ? SEEK : AVOID)

const NUMBER_WORDS = [
	"No",
	"One",
	"Two",
	"Three",
	"Four",
	"Five",
	"Six",
	"Seven",
	"Eight",
	"Nine",
	"Ten",
]
const numberWord = (n: number) => NUMBER_WORDS[n] ?? String(n)

/** How often it shows up for the person against everyone, as a ratio people can say out loud. */
function ratioWords(a: FingerprintAttribute) {
	if (a.everyoneShare < 0.01 || a.count < 3) return null
	const r = a.share / a.everyoneShare
	if (r >= 1.25)
		return `${r >= 3 ? Math.round(r) : r.toFixed(1)} times as often as most people`
	if (r >= 1.08) return "a bit more often than most people"
	if (r <= 0.92)
		return r < 0.05
			? "almost never, unlike most people"
			: `${Math.round((1 - r) * 100)}% less often than most people`
	return "about as often as most people"
}

function liftWords(a: FingerprintAttribute) {
	if (a.lift == null) return null
	if (a.lift >= 0.2)
		return `you rate them ${a.lift.toFixed(1)} above your usual`
	if (a.lift <= -0.2)
		return `you rate them ${Math.abs(a.lift).toFixed(1)} below your usual`
	return "you rate them about as usual"
}

/** One sentence that says what the numbers mean for the person. */
function stanceLine(a: FingerprintAttribute) {
	const ratio = ratioWords(a)
	const lift = liftWords(a)
	if (!ratio && !lift) return "Too few of your titles carry it to say more."
	if (ratio && lift) return `You watch ${a.noun} ${ratio}, and ${lift}.`
	return ratio
		? `You watch ${a.noun} ${ratio}.`
		: `${capitalize(a.noun)}: ${lift}.`
}

export function Fingerprint({ view }: { view: FingerprintView }) {
	const reduceMotion = useReducedMotion()
	const byKey = new Map(view.attributes.map((a) => [a.key, a]))
	const max = Math.max(0.01, ...view.attributes.map((a) => Math.abs(a.edge)))
	const top = view.seek[0] ? byKey.get(view.seek[0]) : undefined
	const [open, setOpen] = useState<FamilyId | null>(top?.family ?? null)
	const [selected, setSelected] = useState<string | null>(top?.key ?? null)
	const familyAttributes = (id: FamilyId) =>
		view.attributes
			.filter((a) => a.family === id)
			.sort((a, b) => b.edge - a.edge)
	const cover = titlesOf(view.titles, view.mostYou).slice(0, 3)

	return (
		<div className="bg-gray-950 pb-8">
			<header className="mx-auto grid max-w-5xl items-center gap-8 px-4 pb-10 pt-12 md:grid-cols-[1fr_auto] md:px-8 md:pt-16">
				<div>
					{view.identity ? (
						<>
							<p className="text-sm text-gray-400">You are</p>
							<h1 className="mt-1 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
								{capitalize(view.identity.name)}
							</h1>
							{view.line && (
								<p className="mt-5 max-w-xl text-xl leading-snug text-gray-100 md:text-2xl">
									{view.line}
								</p>
							)}
						</>
					) : (
						<h1 className="max-w-xl text-2xl font-bold leading-snug md:text-4xl">
							{view.line || "Your fingerprint"}
						</h1>
					)}
					<p className="mt-4 max-w-xl text-sm text-gray-400">
						Read from the title analysis of{" "}
						{view.subject.rated.toLocaleString("en")} titles you rated, weighted
						by how you rated them. {numberWord(view.families.length)} families,{" "}
						{view.attributes.length} attributes. Open one.
					</p>
				</div>
				<div className="relative mx-auto hidden h-60 w-72 md:block" aria-hidden>
					{cover.map((t, i) => (
						<img
							key={t.key}
							src={posterUrl(t)}
							alt=""
							className="absolute top-1/2 w-32 rounded-lg border-4 border-gray-800 shadow-2xl"
							style={{
								left: `calc(50% + ${(i - 1) * 64}px)`,
								transform: `translate(-50%, -50%) rotate(${(i - 1) * 7}deg)`,
								zIndex: i === 1 ? 3 : 1,
							}}
						/>
					))}
				</div>
			</header>

			<div className="mx-auto max-w-5xl px-4 md:px-8">
				<Legend />
				<ul className="divide-y divide-white/10 border-y border-white/10">
					{view.families.map((family) => {
						const attributes = familyAttributes(family.id)
						if (!attributes.length) return null
						const isOpen = open === family.id
						const lead = attributes.filter((a) => a.tier > 0).slice(0, 2)
						const low = attributes.filter((a) => a.tier < 0).slice(-1)
						const posters = titlesOf(
							view.titles,
							(lead[0] ?? attributes[0]).carriers,
						).slice(0, 3)
						const chosen =
							(selected && byKey.get(selected)?.family === family.id
								? byKey.get(selected)
								: undefined) ?? attributes[0]
						const panel = `taste-family-${family.id}`
						return (
							<li key={family.id}>
								<button
									type="button"
									onClick={() => {
										setOpen(isOpen ? null : family.id)
										if (!isOpen) setSelected(attributes[0].key)
									}}
									aria-expanded={isOpen}
									aria-controls={panel}
									className={`group -mx-3 grid w-[calc(100%+1.5rem)] cursor-pointer grid-cols-[1fr_auto] items-center gap-4 rounded-lg px-3 py-5 text-left transition hover:bg-white/[0.05] md:grid-cols-[11rem_1fr_9rem_auto] md:gap-8 ${isOpen ? "bg-white/[0.03]" : ""}`}
								>
									<span>
										<span className="block text-xl font-bold transition group-hover:text-amber-200 md:text-2xl">
											{family.name}
										</span>
										<span className="block text-sm text-gray-400">
											{family.line}
										</span>
									</span>
									<span className="col-span-2 row-start-2 min-w-0 md:col-span-1 md:col-start-2 md:row-start-1">
										<FamilyShape attributes={attributes} max={max} />
										<span className="mt-2 block truncate text-sm text-gray-300">
											{lead.length
												? `Drawn to ${lead.map((a) => a.label.toLowerCase()).join(" and ")}`
												: "Nothing here pulls you much"}
											{low.length ? `, not ${low[0].label.toLowerCase()}` : ""}
										</span>
									</span>
									<span className="hidden -space-x-4 md:flex" aria-hidden>
										{posters.map((t) => (
											<img
												key={t.key}
												src={posterUrl(t, "w185")}
												alt=""
												className="w-11 rotate-[-3deg] rounded-sm border-2 border-gray-950 transition group-hover:rotate-0"
											/>
										))}
									</span>
									<span
										className={`flex h-9 w-9 items-center justify-center rounded-full border text-2xl transition ${isOpen ? "rotate-90 border-amber-400/60 text-amber-300" : "border-white/15 text-gray-400 group-hover:border-white/40 group-hover:text-white"}`}
										aria-hidden
									>
										›
									</span>
								</button>
								<AnimatePresence initial={false}>
									{isOpen && (
										<motion.div
											id={panel}
											initial={{
												height: reduceMotion ? "auto" : 0,
												opacity: 0,
											}}
											animate={{ height: "auto", opacity: 1 }}
											exit={{ height: reduceMotion ? "auto" : 0, opacity: 0 }}
											transition={{ duration: reduceMotion ? 0.1 : 0.25 }}
											className="overflow-hidden"
										>
											<div className="grid gap-8 pb-8 pt-2 md:grid-cols-[18rem_1fr]">
												<ul
													className="space-y-0.5"
													aria-label={`${family.name} attributes`}
												>
													{attributes.map((a) => (
														<li key={a.key}>
															<button
																type="button"
																onClick={() => setSelected(a.key)}
																aria-pressed={chosen.key === a.key}
																className={`grid min-h-11 w-full cursor-pointer grid-cols-[8.5rem_1fr] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition md:min-h-0 ${chosen.key === a.key ? "bg-white/10 text-white ring-1 ring-amber-400/50" : "text-gray-300 hover:bg-white/[0.07] hover:text-white"}`}
															>
																<span className="truncate">{a.label}</span>
																<EdgeBar a={a} max={max} muted={a.tier === 0} />
															</button>
														</li>
													))}
												</ul>
												<div className="md:sticky md:top-20 md:self-start">
													<AttributeDetail a={chosen} titles={view.titles} />
												</div>
											</div>
										</motion.div>
									)}
								</AnimatePresence>
							</li>
						)
					})}
				</ul>

				{view.mostYou.length > 0 && (
					<section className="mt-14">
						<h2 className="text-xl font-bold">The titles that are most you</h2>
						<p className="mt-1 text-sm text-gray-400">
							Rated highly, and carrying several of the attributes that set you
							apart.
						</p>
						<div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-8">
							{titlesOf(view.titles, view.mostYou).map((t) => (
								<RatedPoster key={t.key} t={t} size="w185" />
							))}
						</div>
					</section>
				)}
			</div>
		</div>
	)
}

function Legend() {
	return (
		<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
			<span className="inline-flex items-center gap-1.5">
				<span className="h-2 w-4 rounded-full" style={{ background: SEEK }} />
				More than most people
			</span>
			<span className="inline-flex items-center gap-1.5">
				<span className="h-2 w-4 rounded-full" style={{ background: AVOID }} />
				Less than most people
			</span>
		</div>
	)
}

/** A family's attributes as small up and down bars, strongest pull first. */
function FamilyShape({
	attributes,
	max,
}: { attributes: FingerprintAttribute[]; max: number }) {
	return (
		<span className="flex h-12 items-stretch gap-1" aria-hidden>
			{attributes.map((a) => {
				const h = Math.max(3, (Math.abs(a.edge) / max) * 50)
				return (
					<span key={a.key} className="relative w-1.5 shrink-0 md:w-2">
						<span className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
						<span
							className="absolute inset-x-0 rounded-sm"
							style={{
								background: colorOf(a.edge),
								opacity: a.tier === 0 ? 0.35 : 1,
								height: `${h}%`,
								...(a.edge >= 0 ? { bottom: "50%" } : { top: "50%" }),
							}}
						/>
					</span>
				)
			})}
		</span>
	)
}

/** A diverging bar around "as much as most people": right is more, left is less. */
function EdgeBar({
	a,
	max,
	muted,
}: { a: FingerprintAttribute; max: number; muted: boolean }) {
	const w = Math.min(50, (Math.abs(a.edge) / max) * 50)
	return (
		<span className="relative block h-2 w-full" aria-hidden>
			<span className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
			<span
				className="absolute inset-y-0 rounded-full"
				style={{
					background: colorOf(a.edge),
					opacity: muted ? 0.45 : 1,
					width: `${w}%`,
					...(a.edge >= 0 ? { left: "50%" } : { right: "50%" }),
				}}
			/>
		</span>
	)
}

function TierTag({ a }: { a: FingerprintAttribute }) {
	const color = a.tier === 0 ? EVERYONE : colorOf(a.edge)
	return (
		<span
			className="inline-flex items-center gap-1.5 text-sm font-semibold"
			style={{ color }}
		>
			<span className="h-2 w-2 rounded-full" style={{ background: color }} />
			{TIER_NAMES[a.tier]}
		</span>
	)
}

/** Everything about one attribute, from its plain meaning down to the titles. */
function AttributeDetail({
	a,
	titles,
}: { a: FingerprintAttribute; titles: Titles }) {
	const exception = titlesOf(titles, [a.exception])[0]
	const sought = a.edge >= 0
	const showCarriers = sought || !a.against.length
	const shown = titlesOf(titles, showCarriers ? a.carriers : a.against).slice(
		0,
		6,
	)
	return (
		<div>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 className="text-2xl font-bold text-white md:text-3xl">{a.label}</h3>
				<TierTag a={a} />
			</div>
			<p className="mt-1 text-gray-400">{a.meaning}</p>
			<p className="mt-3 max-w-prose text-lg text-gray-100">{stanceLine(a)}</p>
			<div className="mt-5">
				<p className="mb-2 text-sm font-semibold text-gray-300">
					{showCarriers ? "Titles that carry it for you" : "Where it lost you"}
				</p>
				{shown.length ? (
					<div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
						{shown.map((t) => (
							<RatedPoster key={t.key} t={t} size="w185" />
						))}
					</div>
				) : (
					<p className="text-sm text-gray-500">
						None of your rated titles carries it strongly.
					</p>
				)}
			</div>
			{exception && exception.mine != null && (
				<p className="mt-4 text-sm text-gray-300">
					{sought ? "The exception: " : "Except "}
					<span className="font-semibold text-white">{exception.title}</span>
					{sought
						? `, which has plenty of it and got ${article(exception.mine)} ${exception.mine} from you.`
						: `, which you gave ${article(exception.mine)} ${exception.mine}.`}
				</p>
			)}
		</div>
	)
}

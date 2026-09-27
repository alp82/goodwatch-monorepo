// PROTOTYPE - throwaway. Taste portrait (bolder): who you are as a viewer, as a title card.
// A named archetype over your canon's backdrops, your taste written as prose, and a 74-bar signature
// drawn from the title analysis of everything you rated. Tap any bar to see the titles behind it.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import {
	PickRow,
	RatedPoster,
	ServicesSwitch,
	Signature,
	SignatureGroups,
	type ViewProps,
	attrOf,
	backdrop,
	itemsOf,
	useOnMine,
} from "../kit"

const SERIF = "'Instrument Serif', Georgia, serif"
const FONT =
	"https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap"

export default function Portrait({ data }: ViewProps) {
	const r = data.report
	const canon = itemsOf(
		data,
		r.canon.map((c) => c.key),
	)
	const [selected, setSelected] = useState<string>(
		r.loves[4]?.key ?? r.loves[0]?.key ?? "",
	)
	const sel = selected ? attrOf(data, selected) : null
	const selItems = itemsOf(data, r.attrEvidence[selected] ?? [])
	const services = useOnMine(data)
	const firstName = r.who.mode === "me" ? r.who.name : "The demo member"

	return (
		<div className="bg-gray-950 pb-32 text-white">
			<link rel="stylesheet" href={FONT} />

			<section className="relative isolate overflow-hidden">
				<div className="absolute inset-0 -z-10 flex">
					{canon.slice(0, 5).map((t, i) => (
						<img
							key={t.key}
							src={backdrop(t, "w780")}
							alt=""
							className={`h-full min-w-0 flex-1 object-cover opacity-50 grayscale-[40%] ${i > 2 ? "hidden md:block" : ""}`}
						/>
					))}
				</div>
				<div className="absolute inset-0 -z-10 bg-linear-to-b from-gray-950/40 via-gray-950/75 to-gray-950" />
				<div className="mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-end px-4 pb-14 pt-28 md:px-8">
					<p className="text-base text-gray-300">
						{firstName}, as seen through {r.who.rated.toLocaleString("en")}{" "}
						ratings
						{r.who.watched
							? ` and ${r.who.watched.toLocaleString("en")} watched titles`
							: ""}
					</p>
					<motion.h1
						initial={{ opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
						className="mt-3 max-w-5xl text-6xl leading-[0.92] md:text-[8.5rem]"
						style={{ fontFamily: SERIF }}
					>
						{r.archetype.name}
					</motion.h1>
					<p
						className="mt-6 max-w-3xl text-xl text-gray-300 md:text-2xl"
						style={{ fontFamily: SERIF, fontStyle: "italic" }}
					>
						{r.archetype.line}
					</p>
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-4 md:px-8">
				<div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
					<div
						className="space-y-5 text-2xl leading-snug text-gray-100 md:text-[2rem]"
						style={{ fontFamily: SERIF }}
					>
						{r.portrait.map((s) => (
							<p key={s}>{s}</p>
						))}
					</div>
					<div className="space-y-6">
						{r.people.directors.length > 0 && (
							<div>
								<h2 className="text-sm font-semibold text-gray-400">
									Directors you return to
								</h2>
								<ul className="mt-3 divide-y divide-white/10 border-y border-white/10">
									{r.people.directors.slice(0, 5).map((d) => (
										<li
											key={d.name}
											className="flex items-center justify-between gap-3 py-2.5"
										>
											<span className="min-w-0 truncate text-lg font-semibold">
												{d.name}
											</span>
											<span className="flex shrink-0 -space-x-3">
												{itemsOf(data, d.keys.slice(0, 3)).map((t) => (
													<RatedPoster
														key={t.key}
														t={t}
														size="w185"
														showScore={false}
														className="w-9 rotate-[-2deg] border-gray-950"
													/>
												))}
											</span>
										</li>
									))}
								</ul>
							</div>
						)}
						{r.people.actors.length > 0 && (
							<p className="text-gray-300">
								On screen, you follow{" "}
								<span className="text-white">
									{r.people.actors
										.slice(0, 4)
										.map((a) => a.name)
										.join(", ")}
								</span>
								.
							</p>
						)}
					</div>
				</div>
			</section>

			<section className="mx-auto mt-20 max-w-7xl px-4 md:px-8">
				<h2 className="text-4xl md:text-5xl" style={{ fontFamily: SERIF }}>
					Your signature
				</h2>
				<p className="mt-2 max-w-2xl text-gray-400">
					All 74 attributes from the title analysis, averaged over what you
					watch and weighted by how you rate. Above the line is what you seek,
					below is what you steer around. Tap a bar.
				</p>
				<div className="mt-8 rounded-xl border border-white/10 bg-black/40 p-3 md:p-5">
					<Signature
						vector={r.vector}
						height={170}
						selected={selected}
						onSelect={setSelected}
					/>
					<SignatureGroups />
				</div>
				<AnimatePresence mode="wait">
					{sel && (
						<motion.div
							key={sel.key}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.25 }}
							className="mt-6 grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-center"
						>
							<div>
								<p
									className="text-5xl md:text-6xl"
									style={{
										fontFamily: SERIF,
										color: sel.color.replace(/[\d.]+\)$/, "1)"),
									}}
								>
									{sel.label}
								</p>
								<p className="mt-2 text-gray-400">
									{FINGERPRINT_META[sel.key]?.description}
								</p>
								<p className="mt-4 text-lg text-gray-200">
									{sel.value > 0.15
										? `A defining part of your taste.`
										: sel.value > 0.03
											? `You lean toward ${sel.phrase}.`
											: sel.value < -0.1
												? `You steer clear of ${sel.phrase}.`
												: sel.value < -0.03
													? `You tend to skip ${sel.phrase}.`
													: `Neither a draw nor a dealbreaker for you.`}
								</p>
							</div>
							<div className="grid grid-cols-4 gap-3">
								{selItems.map((t) => (
									<RatedPoster key={t.key} t={t} />
								))}
								{!selItems.length && (
									<p className="col-span-4 text-sm text-gray-500">
										No titles you rated carry this strongly.
									</p>
								)}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</section>

			<section className="mx-auto mt-24 max-w-7xl px-4 md:px-8">
				{r.loves.slice(0, 4).map((t) => (
					<div
						key={t.key}
						className="grid gap-6 border-t border-white/10 py-10 md:grid-cols-[1fr_1.6fr] md:items-center"
					>
						<div>
							<p
								className="text-4xl leading-tight md:text-6xl"
								style={{ fontFamily: SERIF }}
							>
								{t.phrase.charAt(0).toUpperCase() + t.phrase.slice(1)}
							</p>
							<span
								className="mt-3 block h-1 w-20 rounded-full"
								style={{ background: t.color.replace(/[\d.]+\)$/, "1)") }}
							/>
						</div>
						<div className="grid grid-cols-4 gap-3">
							{itemsOf(data, t.evidence).map((it) => (
								<RatedPoster key={it.key} t={it} />
							))}
						</div>
					</div>
				))}
			</section>

			<section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
				<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
					<h2 className="text-4xl md:text-5xl" style={{ fontFamily: SERIF }}>
						Made for this taste
					</h2>
					<ServicesSwitch state={services} />
				</div>
				<PickRow data={data} refs={services.filter(r.picks)} n={6} />
			</section>
		</div>
	)
}

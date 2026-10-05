// PROTOTYPE - throwaway. Taste portrait (bolder): your taste written back to you in large type, each
// trait shown through the backdrops of titles you loved, with quiet more/less dials that re-sort the picks below.
import { AnimatePresence, motion } from "framer-motion"
import { reasonText } from "../engine"
import { MatchText, Moved, ServiceLogos, ServicesSwitch, layoutSpring } from "../kit"
import { type PoolItem, backdropUrl } from "../model"
import type { Taste } from "../useTaste"

const DISPLAY = "'Big Shoulders Display', 'Gabarito', sans-serif"
const FONT = "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;800;900&display=swap"

export default function Mirror({ taste }: { taste: Taste }) {
	const p = taste.profile
	const loved = Object.entries(taste.signals)
		.filter(([, s]) => s.kind === "score" && s.score >= 8)
		.map(([k]) => taste.engine.byKey.get(k))
		.filter((i): i is PoolItem => !!i)
	// The loved titles that carry an attribute most strongly.
	const evidence = (key: string, n = 3) => {
		const k = taste.engine.keyIndex.get(key) ?? 0
		return [...loved].sort((a, b) => (taste.engine.z.get(b.key)?.[k] ?? 0) - (taste.engine.z.get(a.key)?.[k] ?? 0)).slice(0, n)
	}
	const traits = p.loves.slice(0, 4)
	const avoids = p.avoids.slice(0, 3)
	const cover = p.favorites.slice(0, 6)
	const directors = p.directors.filter((d) => d.count >= 2).slice(0, 3)
	const decade = p.decades.filter((d) => d.count >= 3)[0]
	const picks = taste.picks.slice(0, 8)
	const tuned = Object.values(taste.dials).some(Boolean)

	return (
		<div className="bg-black pb-32 text-white">
			<link rel="stylesheet" href={FONT} />

			<section className="relative isolate min-h-[78vh] overflow-hidden">
				<div className="absolute inset-0 -z-10 grid grid-cols-2 md:grid-cols-3">
					{cover.map((i) => (
						<img key={i.key} src={backdropUrl(i, "w780")} alt="" className="h-full w-full object-cover opacity-45 grayscale-[35%]" />
					))}
				</div>
				<div className="absolute inset-0 -z-10 bg-linear-to-b from-black/60 via-black/70 to-black" />
				<div className="mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-12 pt-24 md:px-8">
					<p className="text-sm text-gray-300">Your taste, from {p.rated} ratings and the title analysis behind each one</p>
					<AnimatePresence mode="wait">
						<motion.h1
							key={p.sentence.loves}
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -8 }}
							transition={{ duration: 0.35 }}
							className="mt-3 text-5xl font-extrabold leading-[0.95] tracking-tight md:text-8xl"
							style={{ fontFamily: DISPLAY }}
						>
							{p.sentence.loves}
						</motion.h1>
					</AnimatePresence>
					<p className="mt-5 max-w-2xl text-2xl font-medium text-gray-400 md:text-3xl" style={{ fontFamily: DISPLAY }}>
						{p.sentence.avoids}
					</p>
					{(directors.length > 0 || decade) && (
						<p className="mt-8 max-w-2xl text-lg text-gray-300">
							{directors.length > 0 && <>You keep returning to {joinNames(directors.map((d) => d.name))}. </>}
							{decade && <>Your ratings run highest for the {decade.name}.</>}
						</p>
					)}
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-4 md:px-8">
				{traits.map((t, i) => (
					<Trait key={t.key} index={i} taste={taste} attr={t} items={evidence(t.key)} />
				))}

				<div className="mt-16 border-t border-white/10 pt-10">
					<h2 className="text-3xl font-extrabold md:text-4xl" style={{ fontFamily: DISPLAY }}>
						What you tune out
					</h2>
					<div className="mt-6 grid gap-6 md:grid-cols-3">
						{avoids.map((a) => (
							<div key={a.key} className="flex flex-col gap-3 border-b border-white/10 pb-4">
								<span className="text-2xl font-bold text-gray-300 first-letter:uppercase md:text-3xl" style={{ fontFamily: DISPLAY }}>
									{a.phrase}
								</span>
								<Dial taste={taste} attr={a.key} />
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="mx-auto mt-20 max-w-6xl px-4 md:px-8">
				<div className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<h2 className="text-4xl font-extrabold leading-none md:text-6xl" style={{ fontFamily: DISPLAY }}>
							What this taste says to watch next
						</h2>
						<p className="mt-2 text-gray-400">{tuned ? "Re-sorted to your dials." : "Turn a dial above and these re-sort."}</p>
					</div>
					<ServicesSwitch taste={taste} />
				</div>
				<motion.div layout className="mt-8 grid gap-x-6 gap-y-8 md:grid-cols-2">
					{picks.map((pk, i) => (
						<motion.a
							key={pk.item.key}
							layout
							transition={layoutSpring}
							href={`/${pk.item.type}/${pk.item.id}`}
							onClick={(e) => e.preventDefault()}
							className="group block"
						>
							<div className="relative aspect-[16/8] overflow-hidden rounded-md">
								<img src={backdropUrl(pk.item, "w780")} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
								<div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent" />
								<div className="absolute left-3 top-3 flex items-center gap-2">
									<span className="text-3xl font-black text-white/90" style={{ fontFamily: DISPLAY }}>
										{i + 1}
									</span>
									<Moved delta={taste.moved(pk.item.key, i)} />
								</div>
								<div className="absolute inset-x-3 bottom-3">
									<h3 className="text-3xl font-extrabold leading-none md:text-4xl" style={{ fontFamily: DISPLAY }}>
										{pk.item.title} <span className="text-xl font-medium text-gray-300">{pk.item.year}</span>
									</h3>
								</div>
							</div>
							<div className="mt-2 flex items-start justify-between gap-3">
								<p className="text-sm text-gray-300">{reasonText(pk)}.</p>
								<span className="flex shrink-0 flex-col items-end gap-1">
									<MatchText match={pk.match} />
									<ServiceLogos item={pk.item} services={taste.services} size="w-6 h-6" />
								</span>
							</div>
						</motion.a>
					))}
				</motion.div>
			</section>
		</div>
	)
}

function Trait({ taste, attr, items, index }: { taste: Taste; attr: { key: string; label: string; phrase: string }; items: PoolItem[]; index: number }) {
	const flip = index % 2 === 1
	return (
		<div className={`mt-16 grid items-center gap-6 md:mt-24 md:grid-cols-[1fr_1.3fr] md:gap-10 ${flip ? "md:[&>*:first-child]:order-2" : ""}`}>
			<div>
				<h2 className="text-5xl font-extrabold leading-[0.9] first-letter:uppercase md:text-7xl" style={{ fontFamily: DISPLAY }}>
					{attr.phrase}
				</h2>
				<p className="mt-4 text-lg text-gray-300">
					Strongest in {joinNames(items.map((i) => i.title))}.
				</p>
				<div className="mt-5">
					<Dial taste={taste} attr={attr.key} />
				</div>
			</div>
			<div className="grid aspect-[16/8] grid-cols-3 grid-rows-2 gap-1.5">
				{items.map((it, i) => (
					<figure key={it.key} className={`relative overflow-hidden rounded-sm ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
						<img src={backdropUrl(it, i === 0 ? "w1280" : "w780")} alt="" className="h-full w-full object-cover" />
						<figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6 text-xs font-semibold text-gray-200">
							{it.title}
						</figcaption>
					</figure>
				))}
			</div>
		</div>
	)
}

/** A quiet five-step dial: less of this, as is, more of this. */
function Dial({ taste, attr }: { taste: Taste; attr: string }) {
	const v = taste.dials[attr] ?? 0
	return (
		<div className="inline-flex items-center gap-3 text-sm">
			<button type="button" onClick={() => taste.dial(attr, v - 1)} disabled={v <= -2} className="font-semibold text-gray-400 hover:text-white disabled:opacity-30">
				Less
			</button>
			<span className="flex items-center gap-1" aria-label={`Dial at ${v}`}>
				{[-2, -1, 0, 1, 2].map((s) => (
					<span
						key={s}
						className={`h-1.5 rounded-full transition-all ${s === 0 ? "w-1.5" : "w-4"} ${
							(s < 0 && v <= s) || (s > 0 && v >= s) ? (s < 0 ? "bg-rose-400" : "bg-amber-400") : s === 0 ? "bg-white/60" : "bg-white/15"
						}`}
					/>
				))}
			</span>
			<button type="button" onClick={() => taste.dial(attr, v + 1)} disabled={v >= 2} className="font-semibold text-gray-400 hover:text-white disabled:opacity-30">
				More
			</button>
		</div>
	)
}

const joinNames = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""))

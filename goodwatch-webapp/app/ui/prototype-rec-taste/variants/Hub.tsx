// PROTOTYPE - throwaway. Every-visit hub (existing components): land on tonight's top pick, your
// Watch next queue, a 20-second quick check that cleans up picks, your taste in short, and more picks.
import { BookmarkIcon, CheckIcon, EyeSlashIcon, NoSymbolIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import Button from "~/ui/button/Button"
import { reasonText } from "../engine"
import { MatchText, Moved, PosterCard, Ring, ServiceLogos, ServicesSwitch, VibeBar, layoutSpring } from "../kit"
import { type PoolItem, type Signal, backdropUrl } from "../model"
import type { Taste } from "../useTaste"

export default function Hub({ taste }: { taste: Taste }) {
	const [seenKey, setSeenKey] = useState<string | null>(null)
	const answer = (key: string, sig: Signal) => {
		taste.set(key, sig)
		setSeenKey(sig.kind === "seen" ? key : null)
	}
	const hero = taste.picks[0]
	const heroKeys = new Set(hero ? [hero.item.key] : [])
	const quick = taste.triage.filter((p) => !heroKeys.has(p.item.key)).slice(0, 6)
	const quickKeys = new Set(quick.map((p) => p.item.key))
	const more = taste.picks.slice(1).filter((p) => !quickKeys.has(p.item.key)).slice(0, 12)
	const seenItem = seenKey ? taste.item(seenKey) : null

	return (
		<div className="pb-32">
			{hero && (
				<section className="relative isolate overflow-hidden">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.img
							key={hero.item.key}
							src={backdropUrl(hero.item)}
							alt=""
							initial={{ opacity: 0, scale: 1.04 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.6 }}
							className="absolute inset-0 -z-10 h-full w-full object-cover object-top"
						/>
					</AnimatePresence>
					<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/85 to-gray-950/30" />
					<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-transparent to-gray-950/40" />
					<div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pb-10 pt-8 md:flex-row md:items-end md:gap-10 md:px-8 md:pb-14 md:pt-20">
						<motion.div key={hero.item.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-32 shrink-0 md:w-56">
							<PosterCard item={hero.item} services={taste.services} showTitle={false} />
						</motion.div>
						<div className="max-w-2xl">
							<p className="text-sm font-semibold text-amber-300">Tonight, on your services</p>
							<h1 className="mt-1 text-3xl font-bold leading-tight text-white md:text-5xl">
								{hero.item.title} <span className="font-normal text-gray-300">({hero.item.year})</span>
							</h1>
							<div className="mt-4 flex flex-wrap items-center gap-4">
								<Ring item={hero.item} size={48} label />
								<MatchText match={hero.match} className="text-base" />
								<ServiceLogos item={hero.item} services={taste.services} onlyMine />
							</div>
							<p className="mt-4 text-lg text-gray-200">{reasonText(hero)}.</p>
							<p className="mt-2 line-clamp-2 text-gray-400">{hero.item.synopsis}</p>
							<div className="mt-5 flex flex-wrap gap-2">
								<Button icon={BookmarkIcon} highlight="sky" mode="dark" size="sm" onClick={() => answer(hero.item.key, { kind: "want" })}>
									Want to See
								</Button>
								<Button icon={CheckIcon} highlight="emerald" mode="dark" size="sm" onClick={() => answer(hero.item.key, { kind: "seen" })}>
									Seen it
								</Button>
								<Button icon={NoSymbolIcon} highlight="stone" mode="dark" size="sm" onClick={() => answer(hero.item.key, { kind: "no" })}>
									Not interested
								</Button>
							</div>
						</div>
					</div>
				</section>
			)}

			<div className="mx-auto max-w-7xl px-4 md:px-8">
				<section className="mt-6">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 className="text-2xl font-bold text-white">Watch next</h2>
							<p className="text-sm text-gray-400">Your Wishlist, best match first.</p>
						</div>
						<ServicesSwitch taste={taste} />
					</div>
					<div className="-mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
						{taste.watchNext.length ? (
							taste.watchNext.map((p, i) => (
								<motion.div key={p.item.key} layout transition={layoutSpring} className="w-32 shrink-0 md:w-40">
									<PosterCard item={p.item} services={taste.services} match={p.match} />
									<p className="mt-1 px-1 text-xs text-gray-400">{i === 0 ? "Up first" : `#${i + 1} in your queue`}</p>
								</motion.div>
							))
						) : (
							<p className="py-6 text-gray-400">Nothing from your Wishlist streams on your services. Switch to Everywhere to see all of it.</p>
						)}
					</div>
				</section>

				<section className="mt-10 rounded-2xl border-2 border-gray-800 bg-gray-900/60 p-4 md:p-6">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<div>
							<h2 className="text-2xl font-bold text-white">Quick check</h2>
							<p className="text-sm text-gray-400">Six titles we're about to recommend: seen it, not seen, or not interested. Twenty seconds keeps your picks fresh.</p>
						</div>
						<button type="button" onClick={taste.undo} disabled={!taste.history.length} className="text-sm font-semibold text-gray-300 underline-offset-4 hover:underline disabled:opacity-30">
							Undo
						</button>
					</div>
					<motion.div layout className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
						<AnimatePresence mode="popLayout">
							{quick.map((p) => (
								<motion.div
									key={p.item.key}
									layout
									initial={{ opacity: 0, y: 12 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
									transition={layoutSpring}
								>
									<PosterCard item={p.item} services={taste.services} showTitle={false} />
									<p className="mt-1 truncate px-0.5 text-xs font-semibold text-gray-200">{p.item.title}</p>
									<div className="mt-1 grid grid-cols-3 gap-1">
										<QuickButton label="Seen it" short="Seen" icon={CheckIcon} className="bg-emerald-800/90 hover:bg-emerald-700" onClick={() => answer(p.item.key, { kind: "seen" })} />
										<QuickButton label="Not seen" short="Not seen" icon={EyeSlashIcon} className="bg-sky-800/90 hover:bg-sky-700" onClick={() => answer(p.item.key, { kind: "unseen" })} />
										<QuickButton label="Not interested" short="Pass" icon={NoSymbolIcon} className="bg-stone-800/90 hover:bg-stone-700" onClick={() => answer(p.item.key, { kind: "no" })} />
									</div>
								</motion.div>
							))}
						</AnimatePresence>
					</motion.div>
					<AnimatePresence>
						{seenItem && (
							<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
								<div className="mt-4 flex flex-col gap-2 border-t border-gray-800 pt-4 md:flex-row md:items-center md:gap-4">
									<p className="shrink-0 text-sm text-gray-200">
										How was <strong className="text-white">{seenItem.title}</strong>?
									</p>
									<div className="flex-1">
										<VibeBar
											compact
											onScore={(s) => {
												taste.set(seenItem.key, { kind: "score", score: s })
												setSeenKey(null)
											}}
										/>
									</div>
									<button type="button" onClick={() => setSeenKey(null)} className="self-end text-sm text-gray-400 hover:text-white md:self-auto">
										Later
									</button>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</section>

				<TasteInShort taste={taste} />

				<section className="mt-12">
					<h2 className="text-2xl font-bold text-white">More picks</h2>
					<p className="text-sm text-gray-400">Re-sorted after every answer. Arrows show what moved.</p>
					<motion.div layout className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
						{more.map((p) => (
							<motion.div key={p.item.key} layout transition={layoutSpring} className="relative">
								<PosterCard item={p.item} services={taste.services} match={p.match}>
									<div className="absolute bottom-2 right-2">
										<Moved delta={taste.moved(p.item.key, taste.picks.indexOf(p))} />
									</div>
								</PosterCard>
								<p className="mt-1 line-clamp-2 px-1 text-xs text-gray-400">{reasonText(p)}</p>
							</motion.div>
						))}
					</motion.div>
				</section>
			</div>
		</div>
	)
}

function QuickButton({ label, short, icon: Icon, className, onClick }: { label: string; short: string; icon: typeof CheckIcon; className: string; onClick: () => void }) {
	return (
		<button type="button" onClick={onClick} title={label} aria-label={label} className={`flex flex-col items-center justify-center gap-0.5 rounded-md border-2 border-white/10 py-1.5 text-white ${className}`}>
			<Icon className="h-4 w-4" />
			<span className="hidden text-[11px] font-semibold leading-none lg:block">{short}</span>
		</button>
	)
}

function Thumbs({ items }: { items: PoolItem[] }) {
	return (
		<span className="flex shrink-0 -space-x-3">
			{items.slice(0, 3).map((i) => (
				<img key={i.key} src={i.poster.replace("/w342/", "/w185/")} alt={i.title} title={i.title} className="h-14 w-10 rounded border-2 border-gray-900 object-cover" />
			))}
		</span>
	)
}

function TasteInShort({ taste }: { taste: Taste }) {
	const p = taste.profile
	const genres = p.genres.filter((g) => g.count >= 2).slice(0, 3)
	const decade = p.decades.filter((d) => d.count >= 3)[0]
	const directors = p.directors.filter((d) => d.count >= 2).slice(0, 3)
	const loves = p.loves.slice(0, 5)
	const lines: { text: string; items: PoolItem[] }[] = [
		{ text: `${p.sentence.loves} ${p.sentence.avoids}`, items: p.favorites },
		genres.length ? { text: `Your best-rated genres are ${and(genres.map((g) => g.name.toLowerCase()))}.`, items: genres.flatMap((g) => g.items) } : null,
		directors.length ? { text: `You keep coming back to ${and(directors.map((d) => d.name))}.`, items: directors.flatMap((d) => d.items) } : null,
		decade ? { text: `The ${decade.name} are where you rate highest.`, items: decade.items } : null,
	].filter((l): l is { text: string; items: PoolItem[] } => !!l)

	return (
		<section className="mt-12 grid gap-6 rounded-2xl border-2 border-gray-800 bg-gray-900/60 p-4 md:grid-cols-[1fr_1.4fr] md:p-6">
			<div>
				<h2 className="text-2xl font-bold text-white">Your taste, in short</h2>
				<p className="mt-1 text-sm text-gray-400">
					From {p.rated} ratings and the title analysis of each one. It moves when you rate.
				</p>
				<div className="mt-4 flex flex-wrap gap-2">
					{loves.map((a) => (
						<span key={a.key} className="rounded-lg border-2 border-white/15 bg-gray-900/80 px-3 py-1 text-sm font-medium text-white">
							{a.label}
						</span>
					))}
				</div>
			</div>
			<ul className="flex flex-col gap-4">
				{lines.map((l) => (
					<li key={l.text} className="flex items-center gap-4">
						<Thumbs items={l.items} />
						<span className="text-gray-200">{l.text}</span>
					</li>
				))}
			</ul>
		</section>
	)
}

const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""))

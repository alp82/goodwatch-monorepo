// PROTOTYPE - throwaway. Variant `magazine` (bolder): tonight's edition. A masthead with the day, a lead story
// (Watch next, poster large and type larger, with what follows it), a feature spread of picks where the
// fingerprint "why" reads like a pull quote, your taste as one sentence, and an index to the rest of
// GoodWatch. Guests get the this-or-that as the cover story until their first pick takes its place.
import { CheckIcon, PlayIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { ServiceTiles, useIsMobile, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { ServicesToggle } from "~/ui/prototype-rec-watch-next-7/kit7"
import { Coin, DISPLAY, Duel, EASE, Elsewhere, MemberTeaser, MoodChip, PickCard, ServicePick, Slab, SlabGuest, SlabWatchNext, Triage, WRAP, nextPair, whyLine } from "./kit"
import { DISCOVER_HREF, EXPLORER_HREF, type Home, TASTE_HREF } from "./model"
import { and } from "./taste"

const RULE = "border-t border-white/15"

export function MagazineVariant({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const answered = h.answers.filter((a) => a.side !== "skip").length
	const guestReady = answered >= 3 || nextPair(h) < 0
	return (
		<div className="pb-44 md:pb-24">
			<div className={WRAP}>
				<Masthead h={h} />
				{h.guest && !guestReady ? <Cover h={h} /> : <Lead h={h} onOpen={onOpen} />}
				<Feature h={h} onOpen={onOpen} />
				<Taste h={h} />
				{h.guest && <MemberTeaser h={h} className="mt-14" />}
				<Index h={h} />
			</div>
			<Slab h={h}>{h.guest ? <SlabGuest h={h} /> : <SlabWatchNext h={h} />}</Slab>
		</div>
	)
}

function Masthead({ h }: { h: Home }) {
	const mobile = useIsMobile()
	const day = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
	return (
		<header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2 pb-4 pt-8 md:pt-12">
			<h1 className={`${DISPLAY} text-[5.5rem] leading-[0.8] text-white md:text-[10rem]`}>Tonight</h1>
			<div className="flex flex-col items-start gap-2 pb-2 md:items-end">
				<p className="text-sm font-semibold text-gray-300" suppressHydrationWarning>
					{day}
				</p>
				{!mobile && h.hasServices && <ServicesToggle c={h.c} />}
			</div>
		</header>
	)
}

// ------------------------------------------------------------------ lead story

function Lead({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const fromWish = h.watchNext[0]
	const t = fromWish ?? h.picks[0]
	if (!t) return null
	const then = fromWish ? h.watchNext.slice(1, 4) : h.picks.slice(1, 4)
	const w = watchLine(t)
	const moods = h.data.extra[t.key]?.m ?? []
	return (
		<section className={`${RULE} grid gap-8 pt-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12`} aria-label="Lead">
			<AnimatePresence mode="wait" initial={false}>
				<motion.button key={t.key} type="button" onClick={() => onOpen(t)} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.35, ease: EASE }} className="relative block cursor-pointer">
					<img src={posterUrl(t, "w780")} alt="" className="aspect-[2/3] w-full rounded-sm object-cover shadow-[0_40px_80px_-30px_rgba(0,0,0,1)] max-md:max-h-[28rem] max-md:object-top" />
				</motion.button>
			</AnimatePresence>
			<div className="flex min-w-0 flex-col">
				<p className="text-sm font-semibold text-amber-300">{fromWish ? "Watch next, the best match on your Wishlist" : h.guest ? "Your first pick" : "Your Wishlist is empty, so start with this"}</p>
				<button type="button" onClick={() => onOpen(t)} className="block cursor-pointer text-left">
					<h2 className={`${DISPLAY} mt-2 text-balance leading-[0.88] text-white ${t.title.length > 20 ? "text-5xl md:text-7xl" : "text-6xl md:text-8xl"}`}>{t.title}</h2>
				</button>
				<p className="mt-5 max-w-xl text-xl leading-snug text-gray-100 md:text-2xl">{whyLine(h, t) ? `${whyLine(h, t)}.` : t.tagline || t.genres.join(", ")}</p>
				<div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-400">
					<Coin t={t} className="relative" />
					<span>{[t.year, runtimeLabel(t)].filter(Boolean).join(", ")}</span>
					{moods.slice(0, 3).map((m) => (
						<MoodChip key={m} m={m} />
					))}
				</div>
				<div className="mt-5">
					<ServiceTiles title={t} size={40} max={3} names />
				</div>
				<div className="mt-6 flex flex-wrap items-center gap-2">
					{fromWish ? (
						<>
							{w.offer && (
								<a href={`#play-${t.key}`} onClick={(e) => e.preventDefault()} className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 font-bold text-black hover:bg-gray-200">
									<img src={w.offer.logo} alt="" className="h-8 w-8 rounded-md" />
									<PlayIcon className="h-5 w-5" />
									{w.owned ? `Play on ${w.offer.name}` : `Open ${w.offer.name}`}
								</a>
							)}
							<button type="button" onClick={() => h.q.watched(t.key)} className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white hover:bg-white/20">
								<CheckIcon className="h-5 w-5 text-green-400" />I watched it
							</button>
							<button type="button" onClick={() => h.pass(t.key)} className="inline-flex h-12 cursor-pointer items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10">
								Not tonight
							</button>
						</>
					) : (
						<Triage h={h} t={t} tone="hero" />
					)}
				</div>
				{then.length > 0 && (
					<div className={`${RULE} mt-auto pt-5 max-md:mt-8`}>
						<p className="mb-3 text-sm font-semibold text-gray-400">{fromWish ? "Then, from your Wishlist" : "Also for you"}</p>
						<ol className="grid grid-cols-3 gap-4">
							{then.map((x, i) => (
								<li key={x.key} className="min-w-0">
									<button type="button" onClick={() => onOpen(x)} className="flex w-full cursor-pointer items-start gap-3 text-left">
										<span className={`${DISPLAY} text-4xl leading-none text-gray-600`}>{i + 2}</span>
										<span className="min-w-0">
											<span className="block truncate font-bold text-white">{x.title}</span>
											<span className="block truncate text-xs text-gray-400">{watchLine(x).text}</span>
										</span>
									</button>
								</li>
							))}
						</ol>
					</div>
				)}
			</div>
		</section>
	)
}

// Guests: the cover story is the first-visit question.
function Cover({ h }: { h: Home }) {
	return (
		<section className={`${RULE} grid gap-8 pt-8 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] md:gap-14`} aria-label="Start here">
			<Duel h={h} size="lg" />
			<div className="min-w-0 md:pt-10">
				<p className="text-sm font-semibold text-amber-300">Start here</p>
				<h2 className={`${DISPLAY} mt-2 text-5xl leading-[0.9] text-white md:text-7xl`}>Pick one of two. Three times.</h2>
				<p className="mt-5 max-w-md text-xl leading-snug text-gray-200">No ratings, no account. Each answer tells us what kind of night you like, and tonight's pick takes this spot.</p>
				<div id="services" className="mt-8">
					<p className="mb-2 text-sm font-semibold text-gray-300">Where do you watch?</p>
					<ServicePick h={h} />
				</div>
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ feature spread

function Feature({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const skip = h.watchNext[0] ? 0 : 1
	const [big, ...rest] = h.picks.slice(skip, skip + 5)
	if (!big) return null
	const quote = whyLine(h, big)
	return (
		<section className={`${RULE} mt-14 pt-6`} aria-label="Picked for you">
			<div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
				<h2 className={`${DISPLAY} text-4xl text-white md:text-5xl`}>{h.guest && !h.hasTaste ? "Popular right now" : "Picked for you"}</h2>
				<Elsewhere h={h} />
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
				<article className="min-w-0">
					<button type="button" onClick={() => onOpen(big)} className="relative block w-full cursor-pointer overflow-hidden rounded-sm">
						<img src={backdropUrl(big, "w1280")} alt="" className="aspect-[16/9] w-full object-cover" />
						<Coin t={big} className="absolute left-3 top-3" />
					</button>
					<h3 className={`${DISPLAY} mt-4 text-4xl leading-none text-white`}>{big.title}</h3>
					{quote && <p className="mt-3 border-l-4 border-amber-400 pl-4 text-2xl leading-snug text-gray-100">{quote}.</p>}
					<p className="mt-2 text-sm text-gray-400">{[big.year, runtimeLabel(big), watchLine(big).text].filter(Boolean).join(", ")}</p>
					<Triage h={h} t={big} tone="hero" className="mt-4" />
				</article>
				<div className="grid grid-cols-2 gap-x-4 gap-y-6">
					<AnimatePresence mode="popLayout" initial={false}>
						{rest.map((t) => (
							<motion.div key={t.key} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
								<PickCard h={h} t={t} onOpen={onOpen} />
							</motion.div>
						))}
					</AnimatePresence>
				</div>
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ taste and index

function Taste({ h }: { h: Home }) {
	if (!h.leans.length) return null
	return (
		<section className={`${RULE} mt-14 grid gap-6 pt-6 md:grid-cols-[12rem_1fr]`} aria-label="Your taste">
			<p className="text-sm font-semibold text-gray-400">Your taste{h.guest ? ", so far" : ""}</p>
			<div>
				<p className={`${DISPLAY} text-balance text-4xl leading-[1.02] text-white md:text-6xl`}>You go for {and(h.leans)}.</p>
				<div className="mt-4 flex flex-wrap items-center gap-2">
					{h.moods.map((m) => (
						<MoodChip key={m} m={m} />
					))}
					<Link to={TASTE_HREF} className="ml-1 text-sm font-semibold text-amber-400 hover:text-amber-300">
						See your whole taste
					</Link>
				</div>
			</div>
		</section>
	)
}

function Index({ h }: { h: Home }) {
	const items = [
		{ to: TASTE_HREF, word: "Taste", line: h.guest ? "Your taste, built from every answer." : "Sides of you, you against everyone, your fingerprint." },
		{ to: DISCOVER_HREF, word: "Discover", line: "Browse and search everything, sorted for you." },
		{ to: EXPLORER_HREF, word: "Explorer", line: "A map of titles, grouped by how they feel." },
	]
	return (
		<nav className={`${RULE} mt-14 pt-6`} aria-label="Elsewhere in GoodWatch">
			<p className="mb-2 text-sm font-semibold text-gray-400">Elsewhere</p>
			<ul>
				{items.map((i) => (
					<li key={i.word} className="border-b border-white/10">
						<Link to={i.to} className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
							<span className={`${DISPLAY} text-5xl text-white transition-colors group-hover:text-amber-400 md:text-7xl`}>{i.word}</span>
							<span className="text-gray-400">{i.line}</span>
						</Link>
					</li>
				))}
			</ul>
		</nav>
	)
}

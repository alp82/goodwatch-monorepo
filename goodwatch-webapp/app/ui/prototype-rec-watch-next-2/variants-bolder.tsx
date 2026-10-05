// PROTOTYPE - throwaway. The "bolder" variants for growing and managing the Wishlist (#176, round 2):
// a this-or-that duel, a swipe deck, and a poster wall that shows hundreds of titles at once.
import { ArrowUpIcon, ArrowsRightLeftIcon, BookmarkIcon, CheckIcon, QueueListIcon, SparklesIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion"
import { useMemo, useState } from "react"
import { ServiceTiles } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { DISPLAY, FlowBar, MatchText, StageButton, stageOf } from "./kit2"
import { MOOD_LABEL, type Mood, type Store2, type WTitle, ageLabel, onMine, runtimeLabel } from "./model"
import { GROW_BELOW, type VariantProps } from "./variants-existing"

const WRAP = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"

function Toggle<K extends string>({ value, options, onChange }: { value: K; options: [K, string][]; onChange: (k: K) => void }) {
	return (
		<div className="inline-flex rounded-full bg-white/10 p-1" role="tablist">
			{options.map(([k, label]) => (
				<button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={`h-8 rounded-full px-3 text-sm font-semibold cursor-pointer ${value === k ? "bg-white text-black" : "text-gray-300 hover:text-white"}`}>
					{label}
				</button>
			))}
		</div>
	)
}

// ============================================================ 5. Duel

// Two titles, one choice. While the list is small the pick goes to your Wishlist; once it is big,
// two titles from your Wishlist fight it out and the one you keep choosing goes to Watch next.
export function Duel({ store, onPeek }: VariantProps) {
	const [mode, setMode] = useState<"grow" | "choose">(store.wishCount >= GROW_BELOW ? "choose" : "grow")
	const [round, setRound] = useState(0)
	const [champ, setChamp] = useState<string | null>(null)
	const [streak, setStreak] = useState(0)
	const [picked, setPicked] = useState<string[]>([])

	const growPool = useMemo(() => {
		const because = store.suggest.because(2).flatMap((b) => b.titles)
		const mix = [...store.suggest.forYou(30), ...because, ...store.suggest.fresh(12)]
		return mix.filter((t, i) => mix.findIndex((x) => x.key === t.key) === i)
		// Recompute only when the round moves, so a pick does not reshuffle the pair under the pointer.
	}, [round, mode])
	const choosePool = useMemo(() => store.backlog.tonight().slice(0, 40), [mode])

	let pair: WTitle[] = []
	if (mode === "grow") pair = growPool.filter((t) => stageOf(store, t.key) === "suggested").slice(0, 2)
	else {
		const rest = choosePool.filter((t) => t.key !== champ && store.onWishlist(t.key))
		const c = champ ? store.T(champ) : undefined
		pair = c && store.onWishlist(c.key) ? [c, rest[round % Math.max(1, rest.length)]].filter(Boolean) : rest.slice(round % Math.max(1, rest.length - 1), (round % Math.max(1, rest.length - 1)) + 2)
	}

	const pick = (t: WTitle | null, other?: WTitle) => {
		if (mode === "grow") {
			if (t) {
				store.want(t.key)
				setPicked((p) => [t.key, ...p])
			}
			setRound((r) => r + 1)
			return
		}
		if (!t) return setRound((r) => r + 1)
		const same = champ === t.key
		setChamp(t.key)
		setStreak(same ? streak + 1 : 1)
		setRound((r) => r + 1)
		// Three wins in a row and it earns a Watch next slot.
		if (same && streak + 1 >= 3) {
			store.add(t.key)
			setChamp(null)
			setStreak(0)
		}
		void other
	}
	const both = () => {
		for (const t of pair) store.want(t.key, true)
		setPicked((p) => [...pair.map((t) => t.key), ...p])
		setRound((r) => r + 1)
	}

	return (
		<div className="pt-2">
			<div className={`${WRAP} mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between`}>
				<div>
					<h2 className={`${DISPLAY} text-3xl text-white md:text-5xl`}>{mode === "grow" ? "This or that?" : "Which one sooner?"}</h2>
					<p className="mt-1 max-w-xl text-sm text-gray-400">
						{mode === "grow"
							? "Tap the one you would rather watch. It goes on your Wishlist and the next pair is built from it."
							: `Two from your Wishlist on your services. The winner stays; win three in a row and it moves up to Watch next.`}
					</p>
				</div>
				<div className="flex flex-col items-start gap-2 md:items-end">
					<Toggle
						value={mode}
						onChange={(m) => {
							setMode(m)
							setRound(0)
							setChamp(null)
							setStreak(0)
						}}
						options={[
							["grow", "Add to Wishlist"],
							["choose", "Pick from Wishlist"],
						]}
					/>
					<FlowBar store={store} />
				</div>
			</div>

			{pair.length === 2 ? (
				<div className="relative grid md:h-[34rem] md:grid-cols-2">
					{pair.map((t, i) => (
						<motion.button
							key={`${t.key}-${round}-${i}`}
							type="button"
							onClick={() => pick(t, pair[1 - i])}
							initial={{ opacity: 0, x: i ? 30 : -30 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.35 }}
							className="group relative isolate flex h-[21rem] min-w-0 cursor-pointer items-end overflow-hidden text-left outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-amber-400 md:h-full"
							aria-label={mode === "grow" ? `Want to See ${t.title}` : `Choose ${t.title}`}
						>
							<img src={backdropUrl(t, "w1280")} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
							<div className={`absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/60 to-gray-900/10 transition-colors group-hover:via-gray-900/40 ${i ? "md:bg-gradient-to-l" : "md:bg-gradient-to-r"}`} />
							<div className={`flex w-full items-end gap-4 p-4 md:p-8 ${i ? "md:flex-row-reverse md:text-right" : ""}`}>
								<img src={posterUrl(t, "w342")} alt="" className="hidden w-36 rounded-lg shadow-2xl shadow-black ring-1 ring-white/15 transition-transform group-hover:-translate-y-2 sm:block lg:w-44" />
								<div className="min-w-0">
									{mode === "choose" && champ === t.key && <p className="text-sm font-bold text-amber-300">{streak} {streak === 1 ? "win" : "wins"} in a row</p>}
									<h3 className={`${DISPLAY} text-3xl leading-[0.95] text-white md:text-5xl`}>{t.title}</h3>
									<p className="mt-2 text-sm text-gray-200">
										{t.year}, {runtimeLabel(t)}, <MatchText t={t} />
									</p>
									<div className={`mt-3 flex ${i ? "md:justify-end" : ""}`}>
										<ServiceTiles title={t} size={32} max={2} names />
									</div>
								</div>
							</div>
						</motion.button>
					))}
					<div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 md:block">
						<span className={`${DISPLAY} flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-xl text-amber-300 ring-4 ring-gray-900 shadow-2xl`}>or</span>
					</div>
				</div>
			) : (
				<div className={`${WRAP}`}>
					<p className="rounded-2xl border-2 border-dashed border-white/10 p-10 text-center text-gray-400">
						{mode === "choose" ? "Add a few titles on your services to your Wishlist first." : "That is every suggestion for now."}
					</p>
				</div>
			)}

			<div className={`${WRAP} mt-4 flex flex-wrap items-center justify-center gap-2`}>
				{mode === "grow" ? (
					<>
						<button type="button" onClick={both} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white hover:bg-white/20 cursor-pointer">
							<BookmarkIcon className="h-5 w-5 text-amber-300" />
							Both
						</button>
						<button type="button" onClick={() => pick(null)} className="inline-flex h-11 items-center gap-2 rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer">
							<ArrowsRightLeftIcon className="h-5 w-5" />
							Neither, show another pair
						</button>
					</>
				) : (
					<>
						{champ && store.T(champ) && (
							<button type="button" onClick={() => { store.add(champ); setChamp(null); setStreak(0); setRound((r) => r + 1) }} className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-400 px-4 font-bold text-black hover:bg-amber-300 cursor-pointer">
								<QueueListIcon className="h-5 w-5" />
								{store.T(champ)!.title} to Watch next now
							</button>
						)}
						<button type="button" onClick={() => pick(null)} className="inline-flex h-11 items-center gap-2 rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer">
							<ArrowsRightLeftIcon className="h-5 w-5" />
							Skip this pair
						</button>
					</>
				)}
			</div>

			{mode === "grow" && picked.length > 0 && (
				<div className={`${WRAP} mt-8`}>
					<h3 className="mb-2 text-sm font-semibold text-gray-300">Added this session. Move one up when you are ready.</h3>
					<div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
						{picked.map((k) => store.T(k)).filter((t): t is WTitle => !!t && stageOf(store, t.key) !== "suggested").map((t) => (
							<div key={t.key} className="relative w-28 shrink-0">
								<button type="button" onClick={() => onPeek(t)} className="block w-full cursor-pointer">
									<img src={posterUrl(t, "w185")} alt={t.title} className="aspect-[2/3] w-full rounded-lg object-cover" />
								</button>
								<StageButton store={store} t={t} size="sm" className="absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap" />
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

// ============================================================ 6. Swipe

type Deck = "find" | "prune"

// A deck of cinematic cards. Finding: right is Want to See, left is not for me. Pruning the backlog:
// right keeps it, left removes it. Up sends either straight to Watch next.
export function Swipe({ store, onPeek }: VariantProps) {
	const big = store.wishCount >= GROW_BELOW
	const [deck, setDeck] = useState<Deck>(big ? "prune" : "find")
	const [skipped, setSkipped] = useState<string[]>([])
	const [tally, setTally] = useState({ yes: 0, no: 0, next: 0 })
	const findPool = useMemo(() => {
		const mix = [...store.suggest.because(2).flatMap((b) => b.titles.slice(0, 5)), ...store.suggest.forYou(40), ...store.suggest.fresh(10)]
		return mix.filter((t, i) => mix.findIndex((x) => x.key === t.key) === i)
	}, [deck])
	const stale = store.backlog.stale()
	const oldest = store.backlog.sort(store.wishTitles, "oldest")
	const pruneList = (stale.length ? stale : oldest).filter((t) => !store.state.kept.includes(t.key))
	const cards = (deck === "find" ? findPool.filter((t) => stageOf(store, t.key) === "suggested" && !store.state.dismissed.includes(t.key)) : pruneList).filter((t) => !skipped.includes(t.key))
	const top = cards[0]

	const act = (dir: "yes" | "no" | "next") => {
		if (!top) return
		if (dir === "next") store.add(top.key)
		else if (deck === "find") dir === "yes" ? store.want(top.key) : store.dismiss(top.key)
		else dir === "yes" ? store.keep(top.key) : store.unwant(top.key, `Removed ${top.title}. ${pruneList.length - 1} left to review.`)
		setSkipped((s) => [...s, top.key])
		setTally((x) => ({ ...x, [dir]: x[dir] + 1 }))
	}
	const labels = deck === "find" ? { yes: "Want to See", no: "Not for me" } : { yes: "Keep", no: "Remove" }

	return (
		<div className={`${WRAP} pt-4`}>
			<div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div>
					<h2 className={`${DISPLAY} text-3xl text-white md:text-5xl`}>{deck === "find" ? "Find more to watch" : "Still want to see these?"}</h2>
					<p className="mt-1 max-w-xl text-sm text-gray-400">
						{deck === "find"
							? "Swipe right to add it to your Wishlist, left to pass. Swipe up and it goes straight to Watch next."
							: `${pruneList.length} Wishlist titles you added long ago, weakest match first. Keep what still excites you.`}
					</p>
				</div>
				<div className="flex flex-col items-start gap-2 md:items-end">
					<Toggle
						value={deck}
						onChange={(d) => {
							setDeck(d)
							setSkipped([])
							setTally({ yes: 0, no: 0, next: 0 })
						}}
						options={[
							["find", "Find more"],
							["prune", `Clean up${store.wishCount ? ` (${pruneList.length})` : ""}`],
						]}
					/>
					<FlowBar store={store} />
				</div>
			</div>

			<div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_20rem]">
				<div
					tabIndex={0}
					aria-label="Card deck. Right arrow for yes, left arrow for no, up arrow for Watch next."
					onKeyDown={(e) => {
						const map: Record<string, "yes" | "no" | "next"> = { ArrowRight: "yes", ArrowLeft: "no", ArrowUp: "next" }
						if (map[e.key]) {
							e.preventDefault()
							e.stopPropagation()
							act(map[e.key])
						}
					}}
					className="relative mx-auto h-[30rem] w-full max-w-[24rem] rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-400 md:h-[34rem] md:max-w-[26rem]"
				>
					{!top && (
						<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 p-6 text-center text-gray-400">
							<CheckIcon className="h-8 w-8 text-green-400" />
							{deck === "find" ? "You have seen every suggestion for now." : store.wishCount ? "All reviewed. Your Wishlist is tidy." : "Nothing on your Wishlist to clean up yet."}
						</div>
					)}
					{cards
						.slice(0, 3)
						.reverse()
						.map((t) => {
							const depth = cards.indexOf(t)
							return depth === 0 ? (
								<SwipeCard key={t.key} t={t} store={store} deck={deck} onAct={act} onOpen={() => onPeek(t)} yes={labels.yes} no={labels.no} />
							) : (
								<motion.div
									key={t.key}
									animate={{ y: depth * 14, scale: 1 - depth * 0.05 }}
									className="absolute inset-0 overflow-hidden rounded-2xl shadow-2xl shadow-black"
									style={{ zIndex: 10 - depth, filter: `brightness(${1 - depth * 0.3})` }}
								>
									<img src={posterUrl(t, "w500")} alt="" className="h-full w-full object-cover" />
								</motion.div>
							)
						})}
				</div>

				<div className="flex flex-col gap-3">
					<div className="grid grid-cols-3 gap-2">
						<button type="button" onClick={() => act("no")} disabled={!top} className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-white/10 text-xs font-semibold text-gray-200 hover:bg-white/20 disabled:opacity-40 cursor-pointer">
							{deck === "find" ? <XMarkIcon className="h-6 w-6" /> : <TrashIcon className="h-6 w-6 text-rose-300" />}
							{labels.no}
						</button>
						<button type="button" onClick={() => act("next")} disabled={!top} className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-amber-400 text-xs font-bold text-black hover:bg-amber-300 disabled:opacity-40 cursor-pointer">
							<ArrowUpIcon className="h-6 w-6" />
							Watch next
						</button>
						<button type="button" onClick={() => act("yes")} disabled={!top} className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-xl bg-white text-xs font-bold text-black hover:bg-gray-200 disabled:opacity-40 cursor-pointer">
							{deck === "find" ? <BookmarkIcon className="h-6 w-6 text-amber-600" /> : <CheckIcon className="h-6 w-6 text-green-600" />}
							{labels.yes}
						</button>
					</div>
					<p className="hidden text-xs text-gray-500 [@media(hover:hover)]:block">Focus the deck and use the arrow keys: right {labels.yes.toLowerCase()}, left {labels.no.toLowerCase()}, up Watch next.</p>
					<dl className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 p-3 text-center">
						<div>
							<dt className="text-xs text-gray-400">{deck === "find" ? "Added" : "Kept"}</dt>
							<dd className="text-2xl font-bold text-white tabular-nums">{tally.yes}</dd>
						</div>
						<div>
							<dt className="text-xs text-gray-400">To Watch next</dt>
							<dd className="text-2xl font-bold text-amber-300 tabular-nums">{tally.next}</dd>
						</div>
						<div>
							<dt className="text-xs text-gray-400">{deck === "find" ? "Passed" : "Removed"}</dt>
							<dd className="text-2xl font-bold text-white tabular-nums">{tally.no}</dd>
						</div>
					</dl>
					{top && deck === "prune" && (
						<p className="text-sm text-gray-400">
							Added {ageLabel(store.addedAt(top.key) ?? store.now, store.now)}. {onMine(top) ? `On ${top.offers.find((o) => o.owned)?.name} now.` : "Not on your services."}
						</p>
					)}
				</div>
			</div>
		</div>
	)
}

function SwipeCard({ t, store, deck, onAct, onOpen, yes, no }: { t: WTitle; store: Store2; deck: Deck; onAct: (d: "yes" | "no" | "next") => void; onOpen: () => void; yes: string; no: string }) {
	const x = useMotionValue(0)
	const y = useMotionValue(0)
	const rotate = useTransform(x, [-220, 220], [-14, 14])
	const yesO = useTransform(x, [20, 120], [0, 1])
	const noO = useTransform(x, [-120, -20], [1, 0])
	const upO = useTransform(y, [-120, -20], [1, 0])
	return (
		<motion.div
			drag
			dragSnapToOrigin
			dragElastic={0.7}
			style={{ x, y, rotate, zIndex: 20 }}
			onDragEnd={(_, info) => {
				if (info.offset.y < -110 && Math.abs(info.offset.y) > Math.abs(info.offset.x)) onAct("next")
				else if (info.offset.x > 110) onAct("yes")
				else if (info.offset.x < -110) onAct("no")
			}}
			initial={{ scale: 0.95, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			exit={{ opacity: 0 }}
			className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-2xl bg-gray-900 shadow-2xl shadow-black ring-1 ring-white/10 active:cursor-grabbing"
		>
			<img src={posterUrl(t, "w780")} alt={t.title} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
			<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 pt-24">
				<p className="text-sm font-semibold text-amber-300">
					<MatchText t={t} />
					{t.moods[0] ? <span className="text-gray-300">, {MOOD_LABEL[t.moods[0]].toLowerCase()}</span> : null}
				</p>
				<h3 className={`${DISPLAY} mt-1 text-3xl leading-[0.95] text-white`}>{t.title}</h3>
				<p className="mt-1 text-sm text-gray-300">
					{t.year}, {runtimeLabel(t)}
				</p>
				<div className="mt-3 flex items-center justify-between gap-2">
					<ServiceTiles title={t} size={30} max={2} />
					<button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onOpen} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white hover:bg-white/25 cursor-pointer">
						Details
					</button>
				</div>
				{deck === "prune" && <p className="mt-2 text-xs text-gray-400">On your Wishlist since {ageLabel(store.addedAt(t.key) ?? store.now, store.now)}</p>}
			</div>
			<motion.span style={{ opacity: yesO }} className="absolute left-4 top-4 -rotate-6 rounded-lg border-4 border-green-400 bg-black/50 px-3 py-1 text-2xl font-black uppercase text-green-300">
				{yes}
			</motion.span>
			<motion.span style={{ opacity: noO }} className="absolute right-4 top-4 rotate-6 rounded-lg border-4 border-rose-400 bg-black/50 px-3 py-1 text-2xl font-black uppercase text-rose-300">
				{no}
			</motion.span>
			<motion.span style={{ opacity: upO }} className="absolute inset-x-0 top-1/3 mx-auto w-max rounded-lg border-4 border-amber-400 bg-black/50 px-3 py-1 text-2xl font-black uppercase text-amber-300">
				Watch next
			</motion.span>
		</motion.div>
	)
}

// ============================================================ 7. Wall

type Lens = "all" | "mine" | "match" | "short" | "forgotten" | "leaving" | Mood

// The whole Wishlist as one wall of posters. A lens lights up what fits and dims the rest, so hundreds
// of titles stay in view. While the list is small, suggestions fill the wall as ghosts to tap in.
export function Wall({ store, onPeek }: VariantProps) {
	const [lens, setLens] = useState<Lens>("all")
	const [spot, setSpot] = useState<string | null>(null)
	const n = store.wishCount
	const small = n < GROW_BELOW
	const mine = [...(store.queueTitles as WTitle[]), ...store.wishTitles]
	const ghosts = small ? [...store.suggest.because(2).flatMap((b) => b.titles.slice(0, 6)), ...store.suggest.forYou(60)].filter((t, i, a) => a.findIndex((x) => x.key === t.key) === i).slice(0, 56 - mine.length) : []
	const fits = (t: WTitle) => lensFits(store, t, lens)
	const lit = mine.filter(fits)
	const lenses: [Lens, string][] = [
		["all", "Everything"],
		["mine", "On my services"],
		["match", "85%+ match"],
		["short", "Under 100 min"],
		["forgotten", "Added 1+ year ago"],
		["leaving", "Leaving soon"],
		...(Object.keys(MOOD_LABEL) as Mood[]).map((m) => [m, MOOD_LABEL[m]] as [Lens, string]),
	]
	const surprise = () => {
		const pool = lit.filter((t) => !store.has(t.key))
		if (!pool.length) return
		const t = pool[Math.floor(Math.random() * pool.length)]
		setSpot(t.key)
		document.querySelector(`[data-wall="${t.key}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" })
	}
	const spotT = spot ? store.T(spot) : undefined
	return (
		<div className={`${WRAP} pt-4`}>
			<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
				<div className="min-w-0">
					{small ? (
						<p className={`${DISPLAY} text-4xl leading-none text-white md:text-6xl`}>{n ? `${n} saved. Keep going.` : "Tap what you want to see"}</p>
					) : (
						<p className={`${DISPLAY} text-5xl leading-none text-white tabular-nums md:text-7xl`}>
							{lit.length}
							<span className="text-gray-500"> / {n}</span>
						</p>
					)}
					<p className="mt-2 max-w-xl text-sm text-gray-400">
						{small
							? n
								? "On your Wishlist. The faded posters around them are suggestions; tap the plus to add one."
								: "Your Wishlist is empty. The wall is full of suggestions; tap the plus on any poster to add it."
							: lens === "all"
								? "Every title on your Wishlist. Pick a lens to light up what fits tonight."
								: `fit "${lenses.find((l) => l[0] === lens)?.[1]}". The rest stay on the wall, dimmed.`}
					</p>
				</div>
				<div className="flex flex-col items-start gap-2 md:items-end">
					{!small && (
						<button type="button" onClick={surprise} className="inline-flex h-10 items-center gap-2 rounded-full bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300 cursor-pointer">
							<SparklesIcon className="h-4 w-4" />
							Pick one for me
						</button>
					)}
					<FlowBar store={store} suggested={ghosts.length || undefined} />
				</div>
			</div>
			{!small && (
				<div className="sticky top-16 z-20 -mx-4 mb-3 flex gap-1.5 overflow-x-auto bg-gray-900/90 px-4 py-2 backdrop-blur [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
					{lenses.map(([k, label]) => (
						<button key={k} type="button" onClick={() => setLens(k)} className={`h-8 shrink-0 rounded-full px-3 text-sm font-semibold cursor-pointer ${lens === k ? "bg-white text-black" : "bg-white/10 text-gray-200 hover:bg-white/20"}`}>
							{label} <span className="tabular-nums opacity-60">{mine.filter((t) => lensFits(store, t, k)).length}</span>
						</button>
					))}
				</div>
			)}

			<AnimatePresence>
				{spotT && (
					<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative isolate mb-4 flex items-end gap-4 overflow-hidden rounded-2xl p-4 md:p-6">
						<img src={backdropUrl(spotT, "w1280")} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
						<div className="absolute inset-0 -z-10 bg-gradient-to-r from-gray-900 via-gray-900/80 to-gray-900/20" />
						<img src={posterUrl(spotT, "w342")} alt="" className="w-24 rounded-lg shadow-2xl md:w-32" />
						<div className="min-w-0">
							<p className="text-sm font-semibold text-amber-300">From your Wishlist, added {ageLabel(store.addedAt(spotT.key) ?? store.now, store.now)}</p>
							<h3 className={`${DISPLAY} text-3xl leading-none text-white md:text-5xl`}>{spotT.title}</h3>
							<p className="mt-1 text-sm text-gray-300">
								{runtimeLabel(spotT)}, <MatchText t={spotT as WTitle} />
							</p>
							<div className="mt-3 flex flex-wrap gap-2">
								<button type="button" onClick={() => { store.add(spotT.key); setSpot(null) }} className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300 cursor-pointer">
									<QueueListIcon className="h-4 w-4" />
									Watch next
								</button>
								<button type="button" onClick={surprise} className="h-10 rounded-lg bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20 cursor-pointer">
									Another
								</button>
								<button type="button" onClick={() => setSpot(null)} className="h-10 rounded-lg px-3 text-sm text-gray-300 hover:bg-white/10 cursor-pointer">
									Close
								</button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<div className="grid grid-cols-[repeat(auto-fill,minmax(4.6rem,1fr))] gap-1 md:grid-cols-[repeat(auto-fill,minmax(5.6rem,1fr))]">
				{mine.map((t) => (
					<WallTile key={t.key} t={t} store={store} on={fits(t)} spot={spot === t.key} onOpen={() => onPeek(t)} />
				))}
				{ghosts.map((t) => (
					<WallTile key={t.key} t={t} store={store} on ghost onOpen={() => onPeek(t)} />
				))}
			</div>
		</div>
	)
}

const lensFits = (store: Store2, t: WTitle, k: Lens) => {
	const age = store.now - (store.addedAt(t.key) ?? store.now)
	if (k === "all") return true
	if (k === "mine") return onMine(t)
	if (k === "match") return (t.match ?? 0) >= 85
	if (k === "short") return t.type === "movie" && (t.runtime ?? 999) <= 100
	if (k === "forgotten") return age > 365 * 86400000
	if (k === "leaving") return t.leavingInDays != null
	return t.moods.includes(k)
}

function WallTile({ t, store, on, ghost = false, spot = false, onOpen }: { t: WTitle; store: Store2; on: boolean; ghost?: boolean; spot?: boolean; onOpen: () => void }) {
	const stage = stageOf(store, t.key)
	const isGhost = ghost && stage === "suggested"
	return (
		<div data-wall={t.key} className={`group relative transition-[opacity,filter] duration-300 ${on ? "" : "opacity-15 grayscale"} ${isGhost ? "opacity-45 hover:opacity-100" : ""}`}>
			<button type="button" onClick={onOpen} className="block w-full cursor-pointer" aria-label={t.title} title={t.title}>
				<img
					src={posterUrl(t, "w185")}
					alt=""
					loading="lazy"
					className={`aspect-[2/3] w-full rounded-md object-cover ${stage === "next" ? "ring-2 ring-amber-400" : ""} ${spot ? "ring-4 ring-amber-300" : ""}`}
				/>
			</button>
			{stage === "next" && <span className="absolute left-1 top-1 rounded bg-amber-400 px-1 text-[10px] font-bold text-black">#{store.queue.indexOf(t.key) + 1}</span>}
			<button
				type="button"
				onClick={() => (stage === "suggested" ? store.want(t.key) : stage === "wishlist" ? store.add(t.key) : store.remove(t.key))}
				aria-label={stage === "suggested" ? `Want to See ${t.title}` : stage === "wishlist" ? `Move ${t.title} up to Watch next` : `Send ${t.title} back to Wishlist`}
				className={`absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full shadow-lg shadow-black/60 cursor-pointer ${
					stage === "suggested" ? "bg-white text-black" : stage === "wishlist" ? "bg-amber-500 text-black [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100" : "bg-amber-300 text-black"
				}`}
			>
				{stage === "suggested" ? <PlusGlyph /> : stage === "wishlist" ? <QueueListIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
			</button>
		</div>
	)
}
const PlusGlyph = () => (
	<svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
		<path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
	</svg>
)

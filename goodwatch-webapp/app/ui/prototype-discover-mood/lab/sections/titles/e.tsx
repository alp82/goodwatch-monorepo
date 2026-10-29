// PROTOTYPE (Discover lab, titles e): two kinds of search. A switch on top, Describe or Find a title, set by itself
// when the text looks like a title's name (and back), and always one tap to flip. The other reading waits at the
// right of the switch as a small offer (the found title, or how the text reads), so nothing is ever repeated.
// - Describe: how the text reads, a big poster preview, Show N titles (Enter runs it, as everywhere).
// - Find a title: the matches as poster cards to steer; Enter takes the first match as Similar to and clears the field.
import { ArrowRightIcon, ArrowTurnDownLeftIcon, FilmIcon, SparklesIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { TAP } from "~/ui/filter-bar/motion"
import { EXAMPLE_PROMPTS, short } from "../../../kit"
import { type FoundTitle, POSTER_SM, liveTitleUrl, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { Poster, SteerButtons, SteerTray, looksLikeTitle, metaLine, useExampleTitles } from "./def-steer"
import { SuggestChips, cardTitle } from "./ghi-parts"
import { type TitleUses, useKnown, useSearchPreview, useTitleUses } from "./shared"

type Mode = "describe" | "title"

function ModeSwitch({ mode, onMode }: { mode: Mode; onMode: (m: Mode) => void }) {
	const opts: { m: Mode; label: string; icon: React.ReactNode }[] = [
		{ m: "describe", label: "Describe", icon: <SparklesIcon /> },
		{ m: "title", label: "Find a title", icon: <FilmIcon /> },
	]
	return (
		<div role="radiogroup" aria-label="Kind of search" className="flex h-9 shrink-0 items-center rounded-full bg-white/[0.05] p-0.5 ring-1 ring-inset ring-white/[0.08]">
			{opts.map((o) => {
				const on = o.m === mode
				return (
					<button
						key={o.m}
						type="button"
						role="radio"
						aria-checked={on}
						onClick={() => onMode(o.m)}
						className={`relative flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 [&_svg]:h-3.5 [&_svg]:w-3.5 ${on ? "text-gray-950" : "text-gray-400 hover:text-white"}`}
					>
						{on && <motion.span layoutId="titles-e-mode" transition={{ type: "spring", stiffness: 520, damping: 42 }} className="absolute inset-0 rounded-full bg-amber-400" />}
						<span className="relative flex items-center gap-1.5">
							{o.icon}
							{o.label}
						</span>
					</button>
				)
			})}
		</div>
	)
}

/** The other reading, as one tap. */
function Offer({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-label={label}
			initial={{ opacity: 0, x: 8 }}
			animate={{ opacity: 1, x: 0 }}
			className="flex h-9 min-w-0 max-w-[50%] items-center gap-2 rounded-full bg-white/[0.04] pr-3 pl-1.5 text-[13px] text-gray-300 ring-1 ring-inset ring-white/[0.08] cursor-pointer outline-none hover:bg-white/[0.09] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			{children}
			<ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
		</motion.button>
	)
}

function TitleCard({ t, uses, onUse, w, first }: { t: FoundTitle; uses: TitleUses; onUse: () => void; w: number; first: boolean }) {
	const on = uses.usesOf(t.key)
	return (
		<div className="flex shrink-0 flex-col gap-1.5" style={{ width: w + 28 }}>
			<a href={liveTitleUrl(t)} target="_blank" rel="noreferrer" className="relative block self-start rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
				<Poster t={t} w={w} use={on[0]} />
				{first && (
					<kbd className="absolute top-1.5 right-1.5 flex items-center rounded-md bg-gray-950/85 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/40">
						<ArrowTurnDownLeftIcon className="h-3 w-3" aria-hidden />
					</kbd>
				)}
			</a>
			<span className="min-w-0">
				<span className="block truncate text-[13px] font-semibold text-gray-100">{t.title}</span>
				<span className="block text-[11px] text-gray-500">{metaLine(t)}</span>
			</span>
			<SteerButtons t={t} uses={uses} onUse={onUse} compact />
		</div>
	)
}

export function TitlesE({ d, phone, text, setText, runSearch }: SectionProps) {
	const typed = text.trim()
	const titles = useQuickTitles(text)
	const preview = useSearchPreview(d, text)
	const examples = useExampleTitles(6)
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))
	const [override, setOverride] = useState<Mode | null>(null)
	useEffect(() => {
		if (!typed) setOverride(null)
	}, [typed])
	const auto: Mode = looksLikeTitle(typed, titles.found) ? "title" : "describe"
	const mode = override ?? auto
	const running = d.q !== null && typed === d.q
	const asking = typed.length >= 2
	const cards = asking ? titles.found.slice(0, phone ? 4 : 7) : examples
	const top = asking ? titles.found[0] : undefined

	// Find a title: Enter takes the first match as Similar to instead of running the text.
	const latest = useRef({ mode, top, uses, known, setText })
	latest.current = { mode, top, uses, known, setText }
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const l = latest.current
			const el = e.target as HTMLElement | null
			if (e.key !== "Enter" || l.mode !== "title" || !l.top || el?.getAttribute("aria-label") !== "Search") return
			e.preventDefault()
			e.stopPropagation()
			l.known.remember(l.top)
			if (!l.uses.has("similarTo", l.top.key)) l.uses.toggle("similarTo", l.top.key)
			l.setText("")
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])

	const reading = running ? d.reading : preview.reading
	const pcards = running ? d.cards : preview.ready ? preview.cards : []
	const total = running ? d.total : preview.ready ? preview.total : null
	const busy = running ? d.searchBusy || d.loading : preview.busy

	const offer =
		mode === "describe" && top ? (
			<Offer onClick={() => setOverride("title")} label={`Find the title ${top.title}`}>
				<span className="block h-7 w-[19px] shrink-0 overflow-hidden rounded-[4px] bg-white/10">
					{top.poster && <img src={`${POSTER_SM}${top.poster}`} alt="" className="h-full w-full object-cover" />}
				</span>
				<FilmIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden />
				<span className="truncate font-semibold">{top.title}</span>
				<span className="shrink-0 text-gray-500">{top.year}</span>
			</Offer>
		) : mode === "title" && typed.length >= 3 ? (
			<Offer onClick={() => setOverride("describe")} label="Describe instead">
				<SparklesIcon className="ml-1.5 h-3.5 w-3.5 shrink-0 text-amber-400/80" aria-hidden />
				<span className="flex gap-1">
					{pcards.slice(0, 5).map((c) => (
						<span key={c.key} className="block h-7 w-[19px] shrink-0 overflow-hidden rounded-[4px] bg-white/10">
							{c.poster_path && <img src={`${POSTER_SM}${c.poster_path}`} alt="" className="h-full w-full object-cover" />}
						</span>
					))}
					{!pcards.length && Array.from({ length: 5 }, (_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
						<span key={i} className={`block h-7 w-[19px] rounded-[4px] bg-white/[0.06] ${busy ? "animate-pulse" : ""}`} />
					))}
				</span>
			</Offer>
		) : null

	const describe =
		typed.length >= 3 ? (
			<div className="flex flex-col gap-4">
				<div className="flex h-8 min-w-0 items-center gap-1.5 overflow-hidden">
					{reading.length > 0 ? (
						<ReadAsChips reading={reading} />
					) : (
						busy && [80, 104, 68].map((w) => <span key={w} className="h-7 animate-pulse rounded-full bg-white/[0.06]" style={{ width: w }} />)
					)}
				</div>
				<div className="flex gap-2.5 overflow-hidden" style={{ height: phone ? 90 : 132 }}>
					{(pcards.length ? pcards.slice(0, phone ? 5 : 11) : Array.from({ length: phone ? 5 : 11 }, () => null)).map((c, i) =>
						c ? (
							<span key={c.key} className="block h-full shrink-0 overflow-hidden rounded-lg bg-white/[0.06] ring-1 ring-white/10" style={{ width: phone ? 60 : 88 }} title={c.title}>
								{c.poster_path && <img src={`${POSTER_SM}${c.poster_path}`} alt={c.title} loading="lazy" className="h-full w-full object-cover" />}
							</span>
						) : (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								key={i}
								className={`block h-full shrink-0 rounded-lg bg-white/[0.04] ${busy ? "animate-pulse" : ""}`}
								style={{ width: phone ? 60 : 88 }}
							/>
						),
					)}
				</div>
				<div>
					{running ? (
						<span className="inline-flex h-11 items-center rounded-2xl bg-white/[0.05] px-4 text-[14px] font-semibold text-gray-300">
							{total != null ? `${short(total)} titles below` : ""}
						</span>
					) : (
						<motion.button
							type="button"
							whileTap={TAP}
							onClick={() => runSearch(typed)}
							className="inline-flex h-11 items-center gap-3 rounded-2xl bg-amber-400 px-5 text-[14px] font-bold text-gray-950 cursor-pointer outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white"
						>
							{total != null ? `Show ${short(total)} titles` : "Show titles"}
							<ArrowTurnDownLeftIcon className="h-3.5 w-3.5 opacity-60" aria-hidden />
						</motion.button>
					)}
				</div>
			</div>
		) : (
			<div className="flex flex-wrap gap-2">
				{EXAMPLE_PROMPTS.slice(0, phone ? 5 : 8).map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => setText(p)}
						className="h-10 rounded-full bg-white/[0.05] px-4 text-[14px] text-gray-300 ring-1 ring-inset ring-white/[0.08] cursor-pointer outline-none hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{p}
					</button>
				))}
			</div>
		)

	const find =
		asking && titles.found.length === 0 ? (
			<p className="py-3 text-[13px] text-gray-500">{titles.loading ? "Looking…" : "No title by that name"}</p>
		) : (
			<div className={`flex gap-4 ${phone ? "flex-wrap" : "overflow-hidden"} ${titles.loading && asking ? "opacity-70" : ""}`}>
				{cards.map((t, i) => (
					<TitleCard key={t.key} t={t} uses={uses} onUse={() => known.remember(t)} w={phone ? 72 : 96} first={asking && i === 0} />
				))}
			</div>
		)

	const head = (
		<div className={`flex min-w-0 items-center justify-between gap-3 ${phone ? "flex-col items-start" : ""}`}>
			<ModeSwitch mode={mode} onMode={setOverride} />
			{offer}
		</div>
	)
	const body = (
		<motion.div key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14 }} className="min-w-0">
			{mode === "describe" ? describe : find}
		</motion.div>
	)
	// Nothing picked yet: a few titles of this list to thumb up, instead of empty slots.
	const suggest = (
		<SuggestChips
			titles={d.cards.slice(0, 3).map(cardTitle)}
			use="loved"
			onPick={(t) => {
				known.remember(t)
				uses.toggle("loved", t.key)
			}}
		/>
	)
	const tray = <SteerTray uses={uses} known={known.known} empty={suggest} wrap={phone} />

	if (phone)
		return (
			<div className="flex flex-col gap-6">
				{head}
				{body}
				{tray}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-[60px] shrink-0 items-center px-6 pt-2">{head}</div>
			<div className="min-h-0 flex-1 overflow-hidden px-6 py-3">{body}</div>
			<div className="flex h-14 shrink-0 items-center border-t border-white/[0.06] px-6">{tray}</div>
		</div>
	)
}

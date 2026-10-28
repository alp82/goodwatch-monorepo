// PROTOTYPE - throwaway. Round 4 variant 4's More: a short group list on the left (five groups, each with what's set),
// and on the right every filter of the chosen group at once, as a grid of their real controls. The list ends with Find
// a filter, which swaps the right side for matches from every filter. Phones: the groups as a sideways row on top.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { TAP } from "~/ui/filter-bar/motion"
import { CardsGate, type MoreProps, NICHE_ICON, NicheControl, type Pieces, QuietMount, chipsOf, clearCard, nicheValue } from "./R4-4-parts"

interface Item {
	k: CardKey
	title: string
	hint: string
	/** Columns this control spans in the group's grid. */
	span?: 2 | 3
}
interface Group {
	key: string
	title: string
	/** Grid columns on desktop. */
	cols: 1 | 2 | 3
	items: Item[]
}

const GROUPS: Group[] = [
	{
		key: "story",
		title: "Story and form",
		cols: 2,
		items: [
			{ k: "themes", title: "About", hint: "Crime, family, the future", span: 2 },
			{ k: "styles", title: "Style", hint: "Slow burn, fast-paced" },
			{ k: "runtime", title: "Length", hint: "Short movies, short episodes" },
		],
	},
	{
		key: "scores",
		title: "Scores",
		cols: 3,
		items: [
			{ k: "minMatch", title: "Taste match", hint: "How well it fits your taste" },
			{ k: "sourceScores", title: "Scores by source", hint: "IMDb, Rotten Tomatoes, Metacritic" },
			{ k: "scoreGap", title: "Critics vs audiences", hint: "Where they disagree" },
		],
	},
	{
		key: "titles",
		title: "Titles",
		cols: 3,
		items: [
			{ k: "similarTo", title: "Similar to", hint: "Like titles you pick" },
			{ k: "loved", title: "Loved", hint: "Steer toward these" },
			{ k: "disliked", title: "Disliked", hint: "Steer away from these" },
		],
	},
	{
		key: "people",
		title: "Cast and crew",
		cols: 1,
		items: [{ k: "people", title: "Cast and crew", hint: "Actors and directors" }],
	},
	{
		key: "origin",
		title: "Origin and age",
		cols: 2,
		items: [
			{ k: "productionCountries", title: "Production country", hint: "Where it was made" },
			{ k: "ageLimit", title: "Age and content", hint: "Age rating, violence, language" },
		],
	},
]
const FIND = "find"
const NO_BAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
const COLS: Record<Group["cols"], string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" }
const SPAN: Record<2 | 3, string> = { 2: "col-span-2", 3: "col-span-3" }

function groupsFor(pieces: Pieces): Group[] {
	return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.k !== "ageLimit" || pieces.groups.ladder) })).filter(
		(g) => g.items.length,
	)
}
const setIn = (pieces: Pieces, g: Group) => g.items.filter((i) => chipsOf(pieces, i.k).length > 0).length

function Badge({ n }: { n: number }) {
	if (!n) return null
	return (
		<span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold tabular-nums text-gray-950">
			{n}
		</span>
	)
}

/** One filter of the group: its name and value on top, its real control below. */
function Control({ d, pieces, item, phone }: { d: MoreProps["d"]; pieces: Pieces; item: Item; phone: boolean }) {
	const Icon = NICHE_ICON[item.k]
	const value = nicheValue(pieces, item.k)
	return (
		<section
			aria-label={item.title}
			className={`min-w-0 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${!phone && item.span ? SPAN[item.span] : ""}`}
		>
			<header className="mb-3 flex min-h-8 items-center gap-2.5">
				{Icon && <Icon className={`h-4 w-4 shrink-0 ${value ? "text-amber-300" : "text-gray-500"}`} aria-hidden />}
				<h4 className="shrink-0 text-[14px] font-semibold text-gray-100">{item.title}</h4>
				<span className={`min-w-0 flex-1 truncate text-[12.5px] ${value ? "font-medium text-amber-300" : "text-gray-500"}`}>
					{value || item.hint}
				</span>
				{value && (
					<button
						type="button"
						onClick={() => clearCard(d, pieces, item.k)}
						className="h-7 shrink-0 rounded-md px-2 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</header>
			<NicheControl d={d} pieces={pieces} k={item.k} />
		</section>
	)
}

function GroupBody({ d, pieces, group, phone }: { d: MoreProps["d"]; pieces: Pieces; group: Group; phone: boolean }) {
	return (
		<CardsGate pieces={pieces}>
			<QuietMount>
				<div className={`grid auto-rows-min gap-3 ${phone ? "grid-cols-1" : COLS[group.cols]}`}>
					{group.items.map((it) => (
						<Control key={it.k} d={d} pieces={pieces} item={it} phone={phone} />
					))}
				</div>
			</QuietMount>
		</CardsGate>
	)
}

function FindBody({ pieces, text, onText }: { pieces: Pieces; text: string; onText: (t: string) => void }) {
	const field = useRef<HTMLInputElement>(null)
	useEffect(() => {
		field.current?.focus({ preventScroll: true })
	}, [])
	return (
		<div>
			<FilterSearchField value={text} onChange={onText} inputRef={field} />
			{text.trim() !== "" && (
				<div className="mt-5">
					<FilterGroups data={pieces.groups} query={text} />
				</div>
			)}
		</div>
	)
}

function NavItem({
	on,
	onClick,
	title,
	sub,
	badge,
	icon,
}: { on: boolean; onClick: () => void; title: string; sub?: string; badge?: number; icon?: React.ReactNode }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			aria-current={on || undefined}
			className={`relative flex h-14 w-full min-w-0 items-center gap-2.5 rounded-xl px-3 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on ? "" : "hover:bg-white/[0.045]"
			}`}
		>
			{on && (
				<motion.span
					layoutId="r44-nav"
					transition={{ type: "spring", stiffness: 520, damping: 44 }}
					className="absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.1]"
				/>
			)}
			{icon && <span className="relative shrink-0">{icon}</span>}
			<span className="relative min-w-0 flex-1">
				<span className={`block truncate text-[14px] font-semibold ${on ? "text-white" : "text-gray-200"}`}>{title}</span>
				{sub && <span className={`block truncate text-[12px] ${badge ? "text-amber-300/90" : "text-gray-500"}`}>{sub}</span>}
			</span>
			{badge ? (
				<span className="relative">
					<Badge n={badge} />
				</span>
			) : null}
		</motion.button>
	)
}

export function MoreSideGroups({ d, pieces, phone, more, setMore }: MoreProps) {
	const groups = groupsFor(pieces)
	const firstSet = groups.find((g) => setIn(pieces, g) > 0)?.key
	const shown = more.group && (more.group === FIND || groups.some((g) => g.key === more.group)) ? more.group : (firstSet ?? groups[0].key)
	const group = groups.find((g) => g.key === shown)
	const top = useRef<HTMLDivElement>(null)
	const pick = (key: string) => {
		setMore({ group: key })
		if (phone) top.current?.scrollIntoView({ block: "nearest" })
	}
	const subOf = (g: Group) => {
		const values = g.items.map((i) => nicheValue(pieces, i.k)).filter(Boolean)
		return values.length ? values.join(", ") : g.items.length > 1 ? g.items.map((i) => i.title).join(", ") : g.items[0].hint
	}
	const body = (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={shown}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.14 }}
			>
				{shown === FIND ? (
					<FindBody pieces={pieces} text={more.find} onText={(find) => setMore({ find })} />
				) : (
					group && <GroupBody d={d} pieces={pieces} group={group} phone={phone} />
				)}
			</motion.div>
		</AnimatePresence>
	)

	if (phone)
		return (
			<div>
				<div ref={top} className="h-0 scroll-mt-4" aria-hidden />
				<div className={`sticky top-0 z-10 -mx-5 mb-3 flex gap-1.5 overflow-x-auto bg-gray-950/95 px-5 pt-1 pb-2.5 ${NO_BAR}`}>
					{groups.map((g) => {
						const on = shown === g.key
						return (
							<motion.button
								key={g.key}
								type="button"
								whileTap={TAP}
								onClick={() => pick(g.key)}
								className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
									on ? "bg-white text-gray-950" : "bg-white/[0.05] text-gray-200 ring-1 ring-white/[0.07]"
								}`}
							>
								{g.title}
								<Badge n={setIn(pieces, g)} />
							</motion.button>
						)
					})}
					<motion.button
						type="button"
						whileTap={TAP}
						onClick={() => pick(FIND)}
						className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
							shown === FIND ? "bg-white text-gray-950" : "bg-white/[0.05] text-gray-200 ring-1 ring-white/[0.07]"
						}`}
					>
						<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
						Find a filter
					</motion.button>
				</div>
				{body}
			</div>
		)

	return (
		<div className="grid h-full min-h-0 grid-cols-[264px_minmax(0,1fr)]">
			<nav aria-label="More filters" className="flex min-h-0 flex-col gap-1 border-r border-white/[0.06] bg-black/20 px-3 py-4">
				{groups.map((g) => (
					<NavItem key={g.key} on={shown === g.key} onClick={() => pick(g.key)} title={g.title} sub={subOf(g)} badge={setIn(pieces, g)} />
				))}
				<div className="mx-3 my-2 h-px bg-white/[0.07]" />
				<NavItem
					on={shown === FIND}
					onClick={() => pick(FIND)}
					title="Find a filter"
					sub="Horror, a title, a name"
					icon={<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" aria-hidden />}
				/>
			</nav>
			<div className="min-h-0 overflow-y-auto overscroll-contain px-6 py-5">{body}</div>
		</div>
	)
}

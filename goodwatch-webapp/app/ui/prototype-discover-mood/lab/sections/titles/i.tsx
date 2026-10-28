// PROTOTYPE (Discover lab, titles i "One sentence"): the current search reads back as one sentence of chips
// ("Funny · more like Fleabag · less like Friends · with Zendaya"), each part removable. Unrun text from the bar shows
// as a dashed part at its place (tap or Enter runs it). Below, what the text can add: titles (like, more like, less
// like), people (with), filters (moods, genres). Each add-on is the words it would add.
import { ArrowTurnDownLeftIcon, FilmIcon, PlusIcon, UserIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { type TitleKey, parseTitleKey } from "~/utils/title-key"
import { TAGS, tagId } from "../../../kit"
import { type FoundTitle, PRIVATE, PosterThumb, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { Face, NAME_EXAMPLES, type Person, roleOf, usePeople } from "../people/shared"
import { type FilterMatch, FilterMatchChip, STEER, STEER_ORDER, chipStyle, useFilterMatches } from "./ghi-parts"
import { EXAMPLE_KEYS, SECTION_LABEL, type TitleUses, type Use, useKnown, useTitleUses } from "./shared"

const PURPLE = "#c084fc"
const AMBER = "#fbbf24"
const MOOD_SUGGESTIONS = TAGS.filter((t) => t.group === "moods").slice(0, 5)

export function TitlesI({ d, phone, text, setText, runSearch }: SectionProps) {
	const typed = text.trim()
	const pending = typed !== "" && typed !== d.q
	const asking = typed.length >= 2 && pending
	const titles = useQuickTitles(asking ? text : "")
	const people = usePeople(d, asking ? text : "")
	const matches = useFilterMatches(d, pending ? typed : "", 6)
	const uses = useTitleUses(d)
	const known = useKnown([...uses.picked.map((p) => p.key), ...EXAMPLE_KEYS.slice(0, 4).map((e) => e.key)])
	const s = d.filters.state

	// The sentence: search, moods/themes/styles, genres, steering titles, people.
	const parts: { id: string; node: ReactNode }[] = []
	if (pending)
		parts.push({
			id: "q",
			node: (
				<motion.button
					type="button"
					whileTap={TAP}
					onClick={() => runSearch(typed)}
					className="inline-flex h-11 max-w-[520px] shrink-0 items-center gap-2 rounded-full border-2 border-dashed border-amber-400/60 bg-amber-400/[0.06] pr-2.5 pl-4 cursor-pointer outline-none hover:bg-amber-400/[0.12] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className={`brand-header truncate text-[19px] text-amber-50 ${PRIVATE}`}>{typed}</span>
					<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400 text-gray-950">
						<ArrowTurnDownLeftIcon className="h-4 w-4" aria-hidden />
					</span>
				</motion.button>
			),
		})
	else if (d.q)
		parts.push({
			id: "q",
			node: (
				<Part color={AMBER} onRemove={() => d.setQ(null)} label={d.q}>
					<span className={`brand-header text-[19px] ${PRIVATE}`}>{d.q}</span>
				</Part>
			),
		})
	for (const t of d.picked)
		parts.push({
			id: tagId(t),
			node: (
				<Part color={t.color} onRemove={() => d.toggle(t)} label={t.name}>
					<span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
					{t.name}
				</Part>
			),
		})
	for (const g of s.genres)
		parts.push({
			id: `genre:${g}`,
			node: (
				<Part color="#94a3b8" onRemove={() => d.filters.set({ genres: s.genres.filter((x) => x !== g) })} label={g}>
					{g}
				</Part>
			),
		})
	for (const u of STEER_ORDER)
		for (const k of uses.listOf(u)) {
			const t = known.known(k)
			parts.push({
				id: `${u}:${k}`,
				node: (
					<Part color={STEER[u].color} onRemove={() => uses.toggle(u, k)} label={t?.title ?? "title"}>
						<span className={`[&>svg]:h-4 [&>svg]:w-4 ${STEER[u].text}`}>{STEER[u].icon}</span>
						<span className="font-normal text-white/70">{STEER[u].word}</span>
						<span className="max-w-[220px] truncate">{t?.title ?? "…"}</span>
					</Part>
				),
			})
		}
	for (const id of people.chosen) {
		const p = people.known(id)
		parts.push({
			id: `person:${id}`,
			node: (
				<Part color={PURPLE} onRemove={() => people.remove(id)} label={p?.name ?? "person"} face={p?.profile ?? null}>
					<span className="font-normal text-white/70">with</span>
					<span className="max-w-[200px] truncate">{p?.name ?? "…"}</span>
				</Part>
			),
		})
	}

	const sentence = (
		<div className={`flex min-w-0 items-center gap-x-2 gap-y-2.5 ${phone ? "flex-wrap" : "flex-wrap"}`} style={phone ? undefined : { maxHeight: 104, overflow: "hidden" }}>
			{parts.length === 0 && <span className="brand-header text-[22px] text-gray-500">Everything</span>}
			<AnimatePresence initial={false}>
				{parts.map((p, i) => (
					<motion.span
						key={p.id}
						layout="position"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
						transition={{ duration: 0.14 }}
						className="flex min-w-0 items-center gap-2"
					>
						{i > 0 && <span className="text-[20px] text-gray-600" aria-hidden>·</span>}
						{p.node}
					</motion.span>
				))}
			</AnimatePresence>
			{d.total != null && (
				<span className="ml-1 flex shrink-0 items-baseline gap-1.5 text-[15px] text-gray-400 tabular-nums">
					<span className="text-gray-600">=</span>
					<RollingNumber value={d.total} className="font-semibold text-gray-200" />
					titles
				</span>
			)}
		</div>
	)

	const addTitles = (
		<Column icon={<FilmIcon />} head="Titles">
			{asking ? (
				titles.found.length ? (
					titles.found.slice(0, 4).map((t) => <TitleAdd key={t.key} t={t} uses={uses} remember={known.remember} phone={phone} />)
				) : (
					<Quiet>{titles.loading ? "Looking…" : "None by that name"}</Quiet>
				)
			) : (
				EXAMPLE_KEYS.slice(0, 4).map((e) => {
					const k = known.known(e.key)
					const t: FoundTitle = {
						key: e.key,
						title: k?.title ?? e.title,
						year: k?.year ?? "",
						poster: k?.poster ?? null,
						...parseTitleKey(e.key),
					}
					return <TitleAdd key={e.key} t={t} uses={uses} remember={known.remember} phone={phone} />
				})
			)}
		</Column>
	)
	const addPeople = (
		<Column icon={<UserIcon />} head="People">
			{asking ? (
				people.found.length ? (
					people.found.slice(0, 4).map((p) => <PersonAdd key={p.id} p={p} on={people.has(p.id)} onToggle={() => people.toggle(p)} />)
				) : (
					<Quiet>{people.loading ? "Looking…" : "No one by that name"}</Quiet>
				)
			) : (
				<div className="flex flex-wrap gap-1.5 px-1">
					{NAME_EXAMPLES.slice(0, 4).map((n) => (
						<AddWords key={n} color={PURPLE} onClick={() => setText(n)}>
							<span className="font-normal text-gray-400">with</span>
							{n}
						</AddWords>
					))}
				</div>
			)}
		</Column>
	)
	const fallbackMoods: FilterMatch[] = MOOD_SUGGESTIONS.map((t) => ({
		id: tagId(t),
		label: t.name,
		color: t.color,
		group: "Mood",
		on: d.isOn(t),
		count: d.countFor(t),
		toggle: () => d.toggle(t),
	}))
	const shown = (matches.length ? matches : fallbackMoods).filter((m) => !m.on)
	const addFilters = (
		<Column icon={<span className="block h-2 w-2 rounded-full bg-gray-400" />} head="Filters">
			<div className={`flex gap-1.5 px-1 ${phone ? "overflow-x-auto" : "flex-wrap"}`}>
				{shown.map((m) => (
					<FilterMatchChip key={m.id} m={m} />
				))}
				{shown.length === 0 && <Quiet>None for this</Quiet>}
			</div>
		</Column>
	)

	if (phone)
		return (
			<div className="flex flex-col gap-6">
				<div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.07]">{sentence}</div>
				{addTitles}
				{addPeople}
				{addFilters}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center border-b border-white/[0.06] px-7 py-5" style={{ minHeight: 120 }}>
				{sentence}
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-8 px-7 py-4">
				<div className="min-h-0 overflow-y-auto overscroll-contain">{addTitles}</div>
				<div className="min-h-0 overflow-y-auto overscroll-contain">{addPeople}</div>
				<div className="min-h-0 overflow-y-auto overscroll-contain">{addFilters}</div>
			</div>
		</div>
	)
}

/** One removable part of the sentence. */
function Part({
	color,
	onRemove,
	label,
	face,
	children,
}: {
	color: string
	onRemove: () => void
	label: string
	face?: string | null
	children: ReactNode
}) {
	return (
		<span
			className="inline-flex h-11 min-w-0 shrink-0 items-center rounded-full text-[16px] font-semibold whitespace-nowrap text-white"
			style={chipStyle(color)}
		>
			<span className={`flex min-w-0 items-center gap-2 ${face !== undefined ? "pl-1.5" : "pl-4"}`}>
				{face !== undefined && <Face src={face} size={32} />}
				{children}
			</span>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${label}`}
				className="grid h-full w-9 shrink-0 place-items-center rounded-r-full text-white/50 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-4 w-4" />
			</button>
		</span>
	)
}

function Column({ icon, head, children }: { icon: ReactNode; head: string; children: ReactNode }) {
	return (
		<div>
			<h3 className={`${SECTION_LABEL} mb-2 flex h-5 items-center gap-1.5 px-1 text-gray-500 [&>svg]:h-3.5 [&>svg]:w-3.5`}>
				{icon}
				{head}
			</h3>
			<div className="flex flex-col gap-1">{children}</div>
		</div>
	)
}

function Quiet({ children }: { children: ReactNode }) {
	return <p className="px-1 py-2 text-[13px] text-gray-500">{children}</p>
}

/** A ghost chip showing the words it would add: "+ more like Fleabag". */
function AddWords({ color, onClick, on = false, children }: { color: string; onClick: () => void; on?: boolean; children: ReactNode }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={onClick}
			className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${
				on ? "text-white" : "border border-dashed text-gray-200 hover:bg-white/[0.06]"
			}`}
			style={on ? chipStyle(color) : { borderColor: `${color}66` }}
		>
			{on ? <XMarkIcon className="text-white/60" /> : <PlusIcon style={{ color }} />}
			{children}
		</motion.button>
	)
}

function TitleAdd({ t, uses, remember, phone }: { t: FoundTitle; uses: TitleUses; remember: (t: FoundTitle) => void; phone: boolean }) {
	const add = (u: Use, k: TitleKey) => {
		remember(t)
		uses.toggle(u, k)
	}
	return (
		<div className={`flex min-w-0 rounded-xl px-1 py-1 ${phone ? "flex-col gap-2" : "items-center gap-3"}`}>
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<PosterThumb poster={t.poster} title={t.title} className="h-[42px] w-7" />
				<span className="min-w-0">
					<span className="block truncate text-[14px] font-semibold text-gray-100">{t.title}</span>
					<span className="block text-[12px] text-gray-500">{[t.year, t.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · ")}</span>
				</span>
			</div>
			<div className={`flex shrink-0 gap-1.5 ${phone ? "pl-10" : ""}`}>
				{(["similarTo", "loved", "disliked"] as Use[]).map((u) => (
					<AddWords key={u} color={STEER[u].color} on={uses.has(u, t.key)} onClick={() => add(u, t.key)}>
						<span className={STEER[u].text}>{STEER[u].icon}</span>
						{STEER[u].word}
					</AddWords>
				))}
			</div>
		</div>
	)
}

function PersonAdd({ p, on, onToggle }: { p: Person; on: boolean; onToggle: () => void }) {
	return (
		<div className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-1">
			<Face src={p.profile} size={36} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[14px] font-semibold text-gray-100">{p.name}</span>
				<span className="block text-[12px] text-gray-500">{roleOf(p.department)}</span>
			</span>
			<AddWords color={PURPLE} on={on} onClick={onToggle}>
				with
			</AddWords>
		</div>
	)
}

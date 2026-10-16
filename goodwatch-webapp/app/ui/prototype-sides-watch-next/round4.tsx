// PROTOTYPE - throwaway (#659, round 4). The filters' moods, themes, and styles together with the member's taste
// groups, in the mood picker. Groups show by trait name only; titles say "Fits your taste" or "Close to your taste".
// - presets:   a group is a preset: its tile picks the mood, and the theme or style, that set it apart.
// - refine:    pick a group (or a mood), then words that bring titles up without hiding any.
// - vocab:     one vocabulary: groups, moods, themes, and styles as one kind of tile; every pick narrows.
// - yours:     only the words your taste holds, each with the groups it carries; the rest behind More words.
// - insideall: round 3's inside, for every word: a word your taste carries is picked in your taste, and widens.
// - sorts:     the moods, then themes and styles; your taste only sorts, fits first.
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { MAX_MOODS, type MoodKey } from "~/domain/moods"
import type { WatchNextTierSize } from "~/domain/watch-next"
import type { WatchNextTitle } from "~/server/watch-next.server"
import type { MoodControl, MoodGroups } from "~/ui/watch-next/MoodPicker"
import { backdropUrl } from "~/ui/watch-next/style"
import { useParam } from "./bits"
import { TASTE } from "./label"
import type { SwnView, SwnWord, SwnWords } from "./model"
import { WORD_BY_ID, type Word } from "./words"

/** Round 4's part of the view: always there in the round 4 variants, which are the only callers. */
const wordsOf = (view: SwnView) => view.words as SwnWords
const isGroupId = (id: string) => /^g\d+$/.test(id)
const groupName = (view: SwnView, id: string) =>
	view.groups.find((g) => g.id === id)?.name ?? ""
/** A pick's name: a group's trait name, or the word's. */
export const pickName = (view: SwnView, id: string) =>
	isGroupId(id) ? groupName(view, id) : (WORD_BY_ID[id]?.name ?? id)

const wordOf = (w: SwnWords, id: string) => w.words.find((x) => x.id === id)
const narrowedWord = (view: SwnView, id: string) => {
	const w = view.words
	if (!w || view.variant !== "insideall" || isGroupId(id)) return false
	return (wordOf(w, id)?.groups.length ?? 0) > 0 && !w.wide.includes(id)
}

/** Picks and unpicks, in the URL; a fourth pick is refused with the hint. */
function usePicks(view: SwnView, refuse: () => void) {
	const set = useParam()
	const w = wordsOf(view)
	const write = (picks: string[], extra: Record<string, string | null> = {}) =>
		set({
			pick: picks.join(",") || null,
			// A word unpicked forgets that it was widened; a preset holds while all of its words are picked.
			widen: w.wide.filter((x) => picks.includes(x)).join(",") || null,
			from:
				w.from && w.presets[w.from]?.words.every((x) => picks.includes(x))
					? w.from
					: null,
			...extra,
		})
	const toggle = (id: string) => {
		if (w.picks.includes(id)) return write(w.picks.filter((p) => p !== id))
		if (w.picks.length >= MAX_MOODS) return refuse()
		write([...w.picks, id])
	}
	/** "presets": a group's tile puts its words in place of the picks. */
	const preset = (id: string) => {
		if (w.from === id) return write([], { from: null })
		set({
			pick: w.presets[id].words.join(",") || null,
			from: id,
			widen: null,
		})
	}
	const clear = () => set({ pick: null, widen: null, up: null, from: null })
	const toggleWide = (id: string) => {
		const wide = w.wide.includes(id)
			? w.wide.filter((x) => x !== id)
			: [...w.wide, id]
		set({ widen: wide.join(",") || null })
	}
	const toggleUp = (id: string) => {
		const up = w.boost.includes(id)
			? w.boost.filter((x) => x !== id)
			: [...w.boost, id].slice(-MAX_MOODS)
		set({ up: up.join(",") || null })
	}
	return { toggle, preset, clear, toggleWide, toggleUp }
}
type Picks = ReturnType<typeof usePicks>

// ---------- tiles ----------

/** A tile's picture: a title's backdrop, darkened, with no color of its own. */
function Art({
	path,
	className = "",
}: { path: string | null; className?: string }) {
	return (
		<span
			className={`absolute inset-0 -z-10 overflow-hidden bg-gray-800 ${className}`}
			aria-hidden
		>
			{path && (
				<img
					src={backdropUrl(path, "w300")}
					alt=""
					loading="lazy"
					className="absolute inset-0 h-full w-full object-cover opacity-80"
				/>
			)}
			<span className="absolute inset-0 bg-linear-to-r from-gray-950/90 via-gray-950/60 to-gray-950/10" />
			<span className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
		</span>
	)
}

function Tick({ on }: { on: boolean }) {
	return (
		<span
			className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`}
			aria-hidden
		>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

/** One choice as a mood tile: the same size, picture, tick, and lines, with no color. */
export function Tile({
	id,
	name,
	sub,
	foot,
	on,
	full,
	dim,
	art,
	dense,
	label,
	onClick,
	action,
}: {
	id: string
	name: string
	sub?: string | null
	foot: ReactNode
	on: boolean
	full: boolean
	dim?: boolean
	art: string | null
	dense: boolean
	label: string
	onClick: () => void
	action?: ReactNode
}) {
	const tile = (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a poster tile that acts as a checkbox, as the moods'
			role="checkbox"
			aria-checked={on}
			aria-disabled={full || dim || undefined}
			aria-label={label}
			data-mood={id}
			onClick={onClick}
			whileTap={{ scale: full ? 1 : 0.97 }}
			className={`group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dense ? "h-[4.75rem]" : "h-[6.5rem] md:h-28"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${full || dim ? "opacity-40" : ""}`}
		>
			<Art
				path={art}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				<span
					className={`line-clamp-2 font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)] ${dense && name.length > 18 ? "text-[13px]" : "text-[15px]"}`}
				>
					{name}
				</span>
				<Tick on={on} />
			</span>
			<span className="block min-w-0 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{sub && !dense && (
					<span className="line-clamp-1 text-xs leading-snug text-white/90">
						{sub}
					</span>
				)}
				{foot}
			</span>
		</motion.button>
	)
	return action ? (
		<div className="relative grid">
			{tile}
			{action}
		</div>
	) : (
		tile
	)
}

const Foot = ({ children }: { children: ReactNode }) => (
	<span className="mt-0.5 block truncate text-[11px] font-semibold tabular-nums text-white/75">
		{children}
	</span>
)

const n = (count: number, scope: string) => `${count} ${scope}`

/** A word as a tile, with what the variant says about it. */
function WordTile({
	view,
	control,
	picks,
	word,
	dense,
	foot,
	sub,
	dim,
	action,
}: {
	view: SwnView
	control: MoodControl
	picks: Picks
	word: SwnWord
	dense: boolean
	foot?: ReactNode
	sub?: string | null
	dim?: boolean
	action?: ReactNode
}) {
	const w = wordsOf(view)
	const def = WORD_BY_ID[word.id] as Word
	const on = w.picks.includes(word.id)
	const full = !on && w.picks.length >= MAX_MOODS
	return (
		<Tile
			id={word.id}
			name={def.name}
			sub={sub === undefined ? def.description : sub}
			foot={foot ?? <Foot>{n(word.count, control.countScope)}</Foot>}
			on={on}
			full={full}
			dim={dim}
			art={word.backdrop}
			dense={dense}
			label={`${def.name}. ${n(word.count, control.countScope)}.`}
			onClick={() => picks.toggle(word.id)}
			action={action}
		/>
	)
}

/** A taste group as a tile, by its trait name. */
function GroupTile({
	view,
	control,
	id,
	dense,
	sub,
	foot,
	on,
	onClick,
	dim,
}: {
	view: SwnView
	control: MoodControl
	id: string
	dense: boolean
	sub?: string | null
	foot?: ReactNode
	on: boolean
	onClick: () => void
	dim?: boolean
}) {
	const group = view.groups.find((g) => g.id === id)
	if (!group) return null
	const full =
		!on && wordsOf(view).picks.length >= MAX_MOODS && !wordsOf(view).from
	return (
		<Tile
			id={id}
			name={group.name}
			sub={sub ?? TASTE.heading}
			foot={foot ?? <Foot>{n(group.count, control.countScope)}</Foot>}
			on={on}
			full={view.variant === "presets" ? false : full}
			dim={dim}
			art={group.backdrop}
			dense={dense}
			label={`${group.name}, ${TASTE.inline}. ${n(group.count, control.countScope)}.`}
			onClick={onClick}
		/>
	)
}

// ---------- chips in the strip ----------

/** A pick that isn't a mood, as the strip's picked-mood chips are: picture, name, count, remove. */
function Chip({
	view,
	control,
	picks,
	id,
	count,
}: {
	view: SwnView
	control: MoodControl
	picks: Picks
	id: string
	count: number
}) {
	const group = isGroupId(id) ? view.groups.find((g) => g.id === id) : null
	const art = group
		? group.backdrop
		: (wordOf(wordsOf(view), id)?.backdrop ?? null)
	const name = pickName(view, id)
	const narrowed = narrowedWord(view, id)
	return (
		<motion.span
			layout
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className="relative isolate inline-flex h-9 max-w-[17rem] shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgba(0,0,0,.6)]"
			data-pick={id}
		>
			<Art path={art} />
			<button
				type="button"
				data-moodbutton
				aria-haspopup="dialog"
				aria-expanded={control.open}
				onClick={() => control.setOpen(!control.open)}
				className="inline-flex h-full min-w-0 cursor-pointer items-center gap-2 pl-2.5 pr-1"
			>
				{narrowed && <TasteMark />}
				<span className="truncate">{name}</span>
				{narrowed && <span className="sr-only">{TASTE.inline}</span>}
				<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">
					{count}
				</span>
			</button>
			<button
				type="button"
				aria-label={`Remove ${name}`}
				onClick={() => picks.toggle(id)}
				className="mr-1.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/25 hover:bg-black/50"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}

function pickCount(view: SwnView, id: string) {
	const w = wordsOf(view)
	if (isGroupId(id)) return view.groups.find((g) => g.id === id)?.count ?? 0
	const word = wordOf(w, id)
	if (!word) return 0
	return narrowedWord(view, id) ? word.inTaste : word.count
}

// ---------- "insideall": the taste a word carries ----------

/** A picked word taken in your taste: the switch's tick, before its name in the chip. */
function TasteMark() {
	return (
		<span
			className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-black"
			title={TASTE.in}
			aria-hidden
		>
			<CheckIcon className="h-3 w-3" />
		</span>
	)
}

function InsideFoot({
	view,
	word,
	dense,
}: { view: SwnView; word: SwnWord; dense: boolean }) {
	const on = wordsOf(view).picks.includes(word.id)
	if (!word.groups.length) return null
	if (on && word.inTaste < word.count)
		return (
			<span className={`mt-1 block ${dense ? "h-4" : "h-6"}`} aria-hidden />
		)
	return (
		<Foot>
			{word.inTaste} of {word.count} fit your taste
		</Foot>
	)
}

/** On a picked word your taste carries: "In your taste" as a switch (on: the word in your taste; off: all of it). */
function InsideAction({
	view,
	picks,
	word,
	dense,
}: { view: SwnView; picks: Picks; word: SwnWord; dense: boolean }) {
	const w = wordsOf(view)
	if (!word.groups.length || !w.picks.includes(word.id)) return null
	if (word.inTaste >= word.count) return null
	const narrowed = !w.wide.includes(word.id)
	const names = word.groups.map((g) => groupName(view, g)).join(" or ")
	return (
		<span
			className={`pointer-events-none absolute flex items-center justify-between gap-2 ${dense ? "inset-x-2 bottom-2" : "inset-x-2.5 bottom-2.5"}`}
		>
			<button
				type="button"
				role="switch"
				aria-checked={narrowed}
				aria-label={`${WORD_BY_ID[word.id].name} ${TASTE.inline}: ${names}`}
				title={names}
				onClick={() => picks.toggleWide(word.id)}
				className={`pointer-events-auto inline-flex min-w-0 ${dense ? "h-5" : "h-6"} cursor-pointer items-center gap-1.5 rounded-full pl-1 pr-2 text-[11px] font-bold ring-1 transition-colors ${narrowed ? "bg-white text-black ring-white" : "bg-black/35 text-white/85 ring-white/40 hover:bg-black/50"}`}
			>
				<span
					className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${narrowed ? "bg-black text-white" : "ring-1 ring-white/60"}`}
					aria-hidden
				>
					{narrowed && <CheckIcon className="h-3 w-3" />}
				</span>
				<span className="truncate">{TASTE.in}</span>
			</button>
			<span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{narrowed ? word.inTaste : word.count}
			</span>
		</span>
	)
}

// ---------- "refine": words that bring titles up ----------

function BringUp({ view, picks }: { view: SwnView; picks: Picks }) {
	const w = wordsOf(view)
	if (!w.picks.length) return null
	// The words the fitting titles hold, most first, leaving out what is picked.
	const words = w.words
		.filter((x) => !w.picks.includes(x.id) && (w.boostCounts[x.id] ?? 0) > 0)
		.sort((a, b) => (w.boostCounts[b.id] ?? 0) - (w.boostCounts[a.id] ?? 0))
		.slice(0, 12)
	if (!words.length) return null
	return (
		<div className="col-span-full mt-1 rounded-xl bg-white/5 p-2.5 ring-1 ring-white/8">
			<p className="mb-2 text-sm text-gray-300">
				<span className="font-semibold text-white">Bring up</span>
				<span className="hidden sm:inline">
					. Titles with these go first; none are hidden.
				</span>
			</p>
			<div className="flex flex-wrap gap-1.5">
				{words.map((x) => {
					const on = w.boost.includes(x.id)
					return (
						<button
							key={x.id}
							type="button"
							aria-pressed={on}
							onClick={() => picks.toggleUp(x.id)}
							className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold ring-1 transition-colors ${on ? "bg-white text-black ring-white" : "bg-black/30 text-white ring-white/20 hover:bg-white/10"}`}
						>
							{on && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}
							{WORD_BY_ID[x.id].name}
							<span
								className={`text-xs tabular-nums ${on ? "text-black/60" : "text-white/60"}`}
							>
								{w.boostCounts[x.id]}
							</span>
						</button>
					)
				})}
			</div>
		</div>
	)
}

// ---------- the variants ----------

const MOODS_OF = (w: SwnWords) =>
	w.picks.filter((p) => p.startsWith("m:")).map((p) => p.slice(2) as MoodKey)

const words = (w: SwnWords, kinds: Word["kind"][]) =>
	w.words.filter((x) => kinds.includes(WORD_BY_ID[x.id].kind))

/** "yours": the rest of the words, behind one tile. */
function MoreWords({
	view,
	control,
	picks,
	dense,
	shown,
}: {
	view: SwnView
	control: MoodControl
	picks: Picks
	dense: boolean
	shown: Set<string>
}) {
	const w = wordsOf(view)
	const rest = w.words
		.filter((x) => !shown.has(x.id))
		.sort((a, b) => b.count - a.count)
	// Picked words from the rest stay open.
	const [open, setOpen] = useState(rest.some((x) => w.picks.includes(x.id)))
	if (!rest.length) return null
	if (!open)
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`flex cursor-pointer flex-col items-start justify-between rounded-xl bg-white/5 p-2.5 text-left text-white ring-1 ring-white/10 hover:bg-white/10 ${dense ? "h-[4.75rem]" : "h-[6.5rem] md:h-28"}`}
			>
				<span className="text-[15px] font-bold leading-tight">More words</span>
				<span className="text-[11px] font-semibold text-white/70">
					{rest.length} moods, themes, and styles outside your taste
				</span>
			</button>
		)
	return (
		<>
			{rest.map((x) => (
				<WordTile
					key={x.id}
					view={view}
					control={control}
					picks={picks}
					word={x}
					dense={dense}
					sub={null}
				/>
			))}
		</>
	)
}

/**
 * The mood control's round 4 parts for a variant: the picked moods stay production's chips and tiles where the
 * variant keeps the moods as they are; everything else is round 4's.
 */
export function round4Control(
	view: SwnView,
	base: MoodControl,
	setRefused: (r: MoodControl["refused"]) => void,
	picks: Picks,
): MoodControl {
	const w = wordsOf(view)
	const control: MoodControl = { ...base }
	const moodPicks = MOODS_OF(w)
	control.moods = moodPicks
	control.toggle = (mood) => {
		const id = `m:${mood}`
		if (!w.picks.includes(id) && w.picks.length >= MAX_MOODS)
			setRefused({ mood, at: Date.now() })
		else picks.toggle(id)
	}
	control.clear = picks.clear
	const others = w.picks.filter((p) => !p.startsWith("m:"))
	const chipsFor = (ids: string[]) => (
		<>
			{ids.map((id) => (
				<Chip
					key={id}
					view={view}
					control={control}
					picks={picks}
					id={id}
					count={pickCount(view, id)}
				/>
			))}
		</>
	)
	const groups: MoodGroups = {
		picked: others.length,
		narrowing: w.picks.length > 0,
		chips: chipsFor(others),
		head: "Pick up to three",
		refuse: () =>
			setRefused({
				mood: moodPicks[0] ?? "funny",
				at: Date.now(),
				text: "Three is the most. Remove one to add this one.",
			}),
		short: w.picks.length
			? `${pickName(view, w.picks[0])}${w.picks.length > 1 ? ` +${w.picks.length - 1}` : ""}`
			: null,
	}
	control.groups = groups
	// Every pick shows as a round 4 chip in variants that don't keep production's mood tiles.
	const ownGrid = view.variant === "vocab" || view.variant === "yours"
	if (ownGrid) {
		control.moods = []
		groups.picked = w.picks.length
		groups.chips = chipsFor(w.picks)
	}

	if (view.variant === "presets") {
		groups.sub =
			". A title fits when it has one pick of each kind: mood, theme, style."
		groups.before = (dense) => (
			<>
				{view.groups.map((g) => {
					const p = w.presets[g.id]
					if (!p?.words.length) return null
					return (
						<GroupTile
							key={g.id}
							view={view}
							control={control}
							id={g.id}
							dense={dense}
							sub={p.words.map((x) => WORD_BY_ID[x].name).join(" + ")}
							foot={
								<Foot>
									{p.count} {control.countScope}, {p.inGroup} fit your taste
								</Foot>
							}
							on={w.from === g.id}
							onClick={() => picks.preset(g.id)}
						/>
					)
				})}
			</>
		)
		// The theme or style a preset picks shows with the moods' tiles, so it can be seen and removed.
		groups.tiles = (dense) => (
			<>
				{w.picks
					.filter((p) => !p.startsWith("m:"))
					.map((id) => {
						const word = wordOf(w, id)
						return word ? (
							<WordTile
								key={id}
								view={view}
								control={control}
								picks={picks}
								word={word}
								dense={dense}
								sub={WORD_BY_ID[id].kind === "theme" ? "Theme" : "Style"}
							/>
						) : null
					})}
			</>
		)
	}

	if (view.variant === "refine") {
		groups.sub = ". A title fits when it is in any of them."
		groups.before = (dense) => (
			<>
				{view.groups.map((g) => (
					<GroupTile
						key={g.id}
						view={view}
						control={control}
						id={g.id}
						dense={dense}
						on={w.picks.includes(g.id)}
						onClick={() => picks.toggle(g.id)}
					/>
				))}
			</>
		)
		groups.tiles = () => <BringUp view={view} picks={picks} />
	}

	if (view.variant === "vocab") {
		groups.sub = ". Each pick narrows the list."
		const all = [
			...view.groups.map((g) => ({
				id: g.id,
				count: g.count,
				leaves: w.groupLeaves[g.id] ?? 0,
			})),
			// Then the words, most titles first.
			...[...w.words].sort((a, b) => b.count - a.count),
		]
		groups.grid = (dense) => (
			<>
				{all.map((x) => {
					const on = w.picks.includes(x.id)
					const footText =
						w.picks.length && !on
							? `${x.leaves} left with this`
							: n(x.count, control.countScope)
					const dim = !on && w.picks.length > 0 && x.leaves === 0
					return isGroupId(x.id) ? (
						<GroupTile
							key={x.id}
							view={view}
							control={control}
							id={x.id}
							dense={dense}
							foot={<Foot>{footText}</Foot>}
							on={on}
							dim={dim}
							onClick={() => picks.toggle(x.id)}
						/>
					) : (
						<WordTile
							key={x.id}
							view={view}
							control={control}
							picks={picks}
							word={x as SwnWord}
							dense={dense}
							foot={<Foot>{footText}</Foot>}
							sub={null}
							dim={dim}
						/>
					)
				})}
			</>
		)
	}

	if (view.variant === "yours") {
		const mine = w.words
			.filter((x) => x.groups.length && x.inTaste > 0)
			.sort((a, b) => b.inTaste - a.inTaste)
		const shown = new Set(mine.map((x) => x.id))
		groups.grid = (dense) => (
			<>
				{mine.map((x) => (
					<WordTile
						key={x.id}
						view={view}
						control={control}
						picks={picks}
						word={x}
						dense={dense}
						sub={`${groupName(view, x.groups[0])}${x.groups.length > 1 ? ` +${x.groups.length - 1}` : ""}`}
						foot={
							<Foot>
								{x.inTaste} of {x.count} fit your taste
							</Foot>
						}
					/>
				))}
				<MoreWords
					view={view}
					control={control}
					picks={picks}
					dense={dense}
					shown={shown}
				/>
			</>
		)
	}

	if (view.variant === "insideall" || view.variant === "sorts") {
		const inside = view.variant === "insideall"
		if (inside) {
			groups.tileFoot = (mood, dense) => {
				const word = wordOf(w, `m:${mood}`)
				return word?.groups.length ? (
					<InsideFoot view={view} word={word} dense={dense} />
				) : null
			}
			groups.tileAction = (mood, dense) => {
				const word = wordOf(w, `m:${mood}`)
				return word ? (
					<InsideAction view={view} picks={picks} word={word} dense={dense} />
				) : null
			}
			groups.chipMark = (mood) => {
				const id = `m:${mood}`
				const word = wordOf(w, id)
				if (!word || !narrowedWord(view, id)) return null
				return { mark: <TasteMark />, count: word.inTaste }
			}
		}
		groups.tiles = (dense) => (
			<>
				{words(w, ["theme", "style"]).map((x) => (
					<WordTile
						key={x.id}
						view={view}
						control={control}
						picks={picks}
						word={x}
						dense={dense}
						sub={WORD_BY_ID[x.id].kind === "theme" ? "Theme" : "Style"}
						foot={
							inside && x.groups.length ? (
								<InsideFoot view={view} word={x} dense={dense} />
							) : undefined
						}
						action={
							inside ? (
								<InsideAction
									view={view}
									picks={picks}
									word={x}
									dense={dense}
								/>
							) : undefined
						}
					/>
				))}
			</>
		)
	}
	return control
}

export { usePicks }

// ---------- what the page says ----------

/** The line above the hero: "Best match for Dark, psychological thrillers tonight". */
export function round4Phrase(view: SwnView): string | null {
	const w = view.words
	if (!w?.picks.length) return null
	if (w.from) return groupName(view, w.from)
	const join = w.combine === "any" ? "or" : "and"
	const list = (names: string[]) =>
		names.length > 1
			? `${names.slice(0, -1).join(", ")} ${join} ${names[names.length - 1]}`
			: names[0]
	const narrowed = w.picks.filter((id) => narrowedWord(view, id))
	// "insideall": the words in your taste say so once; a widened word next to them is "all of" it.
	if (narrowed.length) {
		const rest = w.picks.filter((id) => !narrowed.includes(id))
		return [
			`${list(narrowed.map((id) => pickName(view, id)))} ${TASTE.inline}`,
			...rest.map((id) => `all of ${pickName(view, id)}`),
		].join(` ${join} `)
	}
	return list(w.picks.map((id) => pickName(view, id)))
}

/** Under a poster: "Fits your taste" or "Close to your taste", where your taste is picked (or sorts). */
export function badgeMark(view: SwnView) {
	const w = view.words
	if (!w) return undefined
	return (title: WatchNextTitle, size: WatchNextTierSize) => {
		const badge = w.badges[title.key]
		if (!badge) return null
		// The smaller posters' own line says why a title misses; a badge only goes where it says something more.
		if ((size === "md" || size === "sm") && view.misfits[title.key]) return null
		return (
			<span
				className={`mt-1 flex items-center gap-1 truncate px-1 text-xs ${badge === "fits" ? "font-semibold text-white" : "text-gray-400"}`}
			>
				{badge === "fits" && (
					<CheckIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
				)}
				{badge === "fits" ? TASTE.fits : TASTE.close}
			</span>
		)
	}
}

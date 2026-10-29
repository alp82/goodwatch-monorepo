// PROTOTYPE (Discover lab, mood e): mixes that follow your picks. Like c, big picture cards come first, but they are
// built from the current state: with nothing picked they are ready mixes (a member's lean on their taste); after a
// pick every card is "your picks + one more", with its real count, its share of the list and its top title's picture.
// Tapping a card adds that one choice, and the cards narrow again. When few narrowing steps are left, widening steps
// (without a pick, or one more of a picked group) follow, then ready mixes. Moods, About, Style, Genre fold in the
// side column. Round 10: no posters; the picks sit on the top row left of Find a filter (ownFind). Round 11: no
// card leads to nothing (ready mixes fill without a count), "Without X" only from three picks. Round 12: "Without X"
// are slim removal tiles at the end, only when the narrowing steps leave a full row free.
import { motion } from "framer-motion"
import { type ProtoDiscover, TAGS, type Tag, tagId } from "../../../kit"
import type { SectionProps, Viewer } from "../../types"
import { FoldShelf, nextTags } from "./fit"
import { ArtTile, type DropStep, MIXES, MOOD_CHOICES, type Mix, type Moods, PickRow, WithoutRow, type WorldArt, genreUnits, islandOfTag, mixName, showDrops, tagName, useMixes, useMoods, useWorldArt } from "./parts"

const findTag = (id: string): Tag => {
	const [group, key] = id.split(":")
	const t = TAGS.find((x) => x.group === group && x.key === key)
	if (!t) throw new Error(`No tag ${id}`)
	return t
}
const mixOf = (...ids: string[]): Mix => ({ id: ids.join("+"), tags: ids.map(findTag) })

/** A member's starting mixes, leaning on what they loved (Severance, Paddington 2, Knives Out, Past Lives). */
export const MEMBER_MIXES: Mix[] = [
	mixOf("moods:mind", "themes:future"),
	mixOf("moods:feelgood", "themes:family"),
	mixOf("moods:funny", "themes:mystery"),
	mixOf("moods:romance", "styles:talky"),
	mixOf("moods:mind", "styles:nonlinear"),
	mixOf("moods:heavy", "styles:slow"),
	mixOf("moods:feelgood", "styles:animated"),
	mixOf("moods:action", "styles:fast"),
]

/**
 * A card: a whole ready mix, or one step from the picks. "add" narrows (a group with no pick yet), "drop" and "or"
 * widen (without one pick, or one more of a picked group, which Discover matches as either).
 */
interface Card {
	kind: "mix" | "add" | "drop" | "or"
	mix: Mix
	/** The choice the card adds or drops; null for a whole ready mix. */
	tag: Tag | null
}

const ready = (viewer: Viewer) => (viewer === "member" ? MEMBER_MIXES : MIXES).map((mix): Card => ({ kind: "mix", mix, tag: null }))

/** "Without X" cards only from this many picks on (moods, About, Style, Genre and search moods together). */
export const DROP_FROM = 3

/** All picks of the tab, genres and search moods too. */
export const pickCount = (d: ProtoDiscover, m: Moods) => d.picked.length + m.words.length + genreUnits(d).filter((u) => u.on).length

/** A card with its count; `n` null shows no count. */
interface Counted extends Card {
	n: number | null
}

/**
 * The cards, always `all` of them, each leading somewhere: narrowing steps ("+ X", "or X"), then ready mixes, cards
 * that would leave nothing left out; ready mixes fill what's left without a count (so with nothing anywhere, e.g. a
 * search with no results, the grid is the ready mixes at full strength). From three picks, when the "+ X" cards
 * leave a full row free, the "Without X" steps come last, as slim removal tiles in the bottom row. Only picks that
 * widen (the one pick of their group; within a group picks are "any of") can bring titles back.
 */
function useCards(d: ProtoDiscover, m: Moods, viewer: Viewer, all: number, cols: number): { cards: Counted[]; drops: DropStep[] } {
	const mixes = ready(viewer)
	const narrowing = d.picked.length > 0 || m.used > 0
	const ids = d.picked.map(tagId)
	const step = (kind: Card["kind"], t: Tag, tags: Tag[]): Card => ({ kind, tag: t, mix: { id: `${kind}:${tags.map(tagId).join("+")}`, tags } })
	const add = narrowing ? nextTags(d, m, 99).map((t) => step("add", t, [...d.picked, t])) : []
	// Only a group's one pick widens when it goes.
	const alone = (t: Tag) => d.picked.filter((p) => p.group === t.group).length === 1
	const drop = narrowing && pickCount(d, m) >= DROP_FROM ? d.picked.filter(alone).map((t) => step("drop", t, d.picked.filter((p) => p !== t))) : []
	const groupFull = (g: Tag["group"]) => (g === "moods" ? m.full : d.picked.filter((p) => p.group === g).length >= 3)
	const or = narrowing
		? TAGS.filter(
				(t) => d.picked.some((p) => p.group === t.group) && !groupFull(t.group) && !ids.includes(tagId(t)) && (t.group !== "moods" || MOOD_TAG_KEYS.has(t.key)),
			)
				.sort((a, b) => (d.countFor(b) ?? 0) - (d.countFor(a) ?? 0))
				.map((t) => step("or", t, [...d.picked, t]))
		: []
	// Drops and mixes are counted as whole recipes; "+ X" and "or X" use Discover's own option counts.
	const whole = [...drop, ...mixes]
	const x = useMixes(
		d,
		whole.map((c) => c.mix),
	)
	const countOf = (c: Card) => (c.tag && c.kind !== "drop" ? d.countFor(c.tag) : x.count(whole.indexOf(c)).total)
	const seen = new Set<string>()
	const once = (c: Card) => !seen.has(c.mix.id) && seen.add(c.mix.id)
	// Unknown counts (a running search) stay in while the list has titles; zeros go.
	const leads = (c: Counted) => (c.n === null ? d.total !== 0 : c.n > 0)
	const steps = [...add, ...or].map((c) => ({ ...c, n: countOf(c) })).filter((c) => leads(c) && once(c))
	// A drop's count is what it brings back: the list without that pick, less the list now.
	const back = (n: number | null) => (n === null || d.total === null ? null : n - d.total)
	const drops = drop
		.map((c) => ({ ...c, n: back(countOf(c)) }))
		.filter((c) => c.n === null || c.n > 0)
		.sort((p, q) => (q.n ?? 0) - (p.n ?? 0))
		.map((c): DropStep => ({ id: c.mix.id, name: c.tag ? tagName(c.tag) : "", color: c.tag?.color ?? "#9ca3af", n: c.n, tap: () => c.tag && d.toggle(c.tag) }))
	// The row rule counts the narrowing "+ X" cards; "or X" widen like the drops and give way to them.
	const shown = showDrops(steps.filter((c) => c.kind === "add").length, drops.length, all, cols) ? drops : []
	const counted = mixes.map((c) => ({ ...c, n: countOf(c) })).filter((c) => leads(c) && once(c))
	const fill = mixes.filter(once).map((c) => ({ ...c, n: null }))
	return { cards: [...steps, ...counted, ...fill].slice(0, all), drops: shown }
}

const MOOD_TAG_KEYS = new Set(MOOD_CHOICES.flatMap((c) => (c.tag ? [c.tag.key] : [])))

/**
 * The grid: two rows (desktop 4 x 2, phones 2 x 3) at a fixed height. With removal tiles the last row splits into
 * compact cards over one slim row of them, so the grid keeps its height.
 */
function Cards({ d, m, art, viewer, phone }: { d: ProtoDiscover; m: Moods; art: WorldArt; viewer: Viewer; phone: boolean }) {
	const cols = phone ? 2 : 4
	const all = phone ? 6 : 8
	const { cards, drops } = useCards(d, m, viewer, all, cols)
	const x = useMixes(
		d,
		cards.map((c) => c.mix),
	)
	const total = d.total
	const slim = drops.length > 0
	const rows = phone ? (slim ? "grid-rows-[5.5rem_5.5rem_2.5rem_2.5rem]" : "grid-rows-[5.5rem_5.5rem_5.5rem]") : slim ? "grid-rows-[10.75rem_7.5rem_2.75rem]" : "grid-rows-[10.75rem_10.75rem]"
	return (
		<div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-4"} ${rows}`}>
			{cards.map((card, i) => {
				const c = x.count(i)
				const t = card.tag
				const left = card.n
				const on = card.kind === "mix" && x.isOn(card.mix)
				// The last row's cards when removal tiles take the bottom: name only on phones.
				const compact = slim && i >= all - cols
				const bare = compact && phone
				const share = card.kind === "add" && left !== null && total && !bare ? Math.round((left / total) * 100) : null
				const foot =
					left === null || bare ? "" : card.kind === "add" && total !== null ? `${left.toLocaleString("en")} of ${total.toLocaleString("en")}` : `${left.toLocaleString("en")} titles`
				const name = !t ? mixName(card.mix) : card.kind === "or" ? `or ${tagName(t)}` : `+ ${tagName(t)}`
				return (
					<motion.div key={card.mix.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.02 }} className="relative flex min-w-0">
						<ArtTile
							name={name}
							line={c.top && !compact ? `Like ${c.top}` : null}
							hues={t ? [t.color, d.picked[0]?.color ?? t.color] : card.mix.tags.map((g) => g.color)}
							path={c.path ?? art.get(islandOfTag(t ?? card.mix.tags[0]))?.path ?? null}
							on={on}
							foot={foot}
							onClick={() => (t ? d.toggle(t) : x.toggle(card.mix))}
							small={compact}
							className={`h-full w-full ${bare ? "py-1.5" : ""}`}
						/>
						{share !== null && (
							<span className="pointer-events-none absolute inset-x-2.5 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-white/15" aria-hidden>
								<span
									className="block h-full w-full origin-left rounded-full bg-white/80 transition-transform duration-300 motion-reduce:transition-none"
									style={{ transform: `scaleX(${Math.min(1, share / 100)})` }}
								/>
							</span>
						)}
					</motion.div>
				)
			})}
			{slim && (
				<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="col-span-full min-w-0">
					<WithoutRow drops={drops} cols={cols} className="h-full" />
				</motion.div>
			)}
		</div>
	)
}

export function MoodE({ d, phone, viewer, find }: SectionProps) {
	const m = useMoods(d)
	const art = useWorldArt()
	const narrowing = d.picked.length > 0 || m.used > 0
	const empty = <span className="text-sm font-semibold text-white">{viewer === "member" ? "From your taste" : "Mixes"}</span>
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<PickRow d={d} m={m} art={art} empty={empty} />
				{find?.field}
				{find?.results ?? (
					<>
						{narrowing && nextTags(d, m, 1).length > 0 && <span className="-mb-2 text-sm font-semibold text-gray-300">Narrow it</span>}
						<Cards d={d} m={m} art={art} viewer={viewer} phone />
						<FoldShelf d={d} m={m} phone first={null} />
					</>
				)}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* The shell's row: the picks, then Find a filter on the right. */}
			<div className="flex h-12 shrink-0 items-center gap-4 border-b border-white/[0.07] px-6">
				<div className="min-w-0 flex-1">
					<PickRow d={d} m={m} art={art} empty={empty} />
				</div>
				<div className="w-[min(320px,34%)] shrink-0">{find?.field}</div>
			</div>
			{find?.results ? (
				<div className="min-h-0 flex-1">{find.results}</div>
			) : (
				<div className="flex min-h-0 flex-1">
					<div className="min-w-0 flex-1 px-6 py-4">
						<Cards d={d} m={m} art={art} viewer={viewer} phone={false} />
					</div>
					<aside className="flex w-[420px] shrink-0 flex-col gap-4 border-l border-white/[0.06] px-5 py-4">
						<FoldShelf d={d} m={m} phone={false} />
					</aside>
				</div>
			)}
		</div>
	)
}

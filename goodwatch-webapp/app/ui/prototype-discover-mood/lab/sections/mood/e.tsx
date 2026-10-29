// PROTOTYPE (Discover lab, mood e): mixes that follow your picks. Like c, big picture cards come first, but they are
// built from the current state: with nothing picked they are ready mixes (a member's lean on their taste); after a
// pick every card is "your picks + one more", with its real count, its share of the list and its top title's picture.
// Tapping a card adds that one choice, and the cards narrow again. When few narrowing steps are left, widening steps
// (without a pick, or one more of a picked group) fill the row and the list's top posters take the second row; at a
// dead end, more ways back. Moods, About, Style, Genre fold in the side column.
import { motion } from "framer-motion"
import { type ProtoDiscover, TAGS, type Tag, tagId } from "../../../kit"
import { TypeControl } from "../../shell-parts"
import type { SectionProps, Viewer } from "../../types"
import { FoldShelf, nextTags } from "./fit"
import { ArtTile, MIXES, MOOD_CHOICES, type Mix, type Moods, PickRow, TypeSwitch, type WorldArt, islandOfTag, mixName, tagName, useMixes, useMoods, useWorldArt } from "./parts"
import { Posters } from "./posters"

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

/** The cards and whether posters take the room after the first `lead` cards. Never fewer than `lead` cards. */
function useCards(d: ProtoDiscover, m: Moods, viewer: Viewer, all: number, lead: number): { cards: Card[]; posters: boolean } {
	const narrowing = d.picked.length > 0 || m.used > 0
	if (!narrowing) return { cards: ready(viewer).slice(0, all), posters: false }
	const ids = d.picked.map(tagId)
	const step = (kind: Card["kind"], t: Tag, tags: Tag[]): Card => ({ kind, tag: t, mix: { id: `${kind}:${tags.map(tagId).join("+")}`, tags } })
	const add = nextTags(d, m, all).map((t) => step("add", t, [...d.picked, t]))
	if (add.length >= all) return { cards: add, posters: false }
	const drop = d.picked.length > 1 ? d.picked.map((t) => step("drop", t, d.picked.filter((p) => p !== t))) : []
	const groupFull = (g: Tag["group"]) => (g === "moods" ? m.full : d.picked.filter((p) => p.group === g).length >= 3)
	const or = TAGS.filter(
		(t) => d.picked.some((p) => p.group === t.group) && !groupFull(t.group) && !ids.includes(tagId(t)) && (t.group !== "moods" || MOOD_TAG_KEYS.has(t.key)),
	)
		.sort((a, b) => (d.countFor(b) ?? 0) - (d.countFor(a) ?? 0))
		.map((t) => step("or", t, [...d.picked, t]))
	const steps = [...add, ...drop, ...or]
	// With titles left, the second row shows them; at a dead end it shows more ways back (or ready mixes).
	const posters = d.cards.some((c) => c.poster_path)
	const cards = posters ? steps.slice(0, lead) : [...steps, ...ready(viewer)].slice(0, all)
	return { cards: cards.length < lead ? [...cards, ...ready(viewer)].slice(0, lead) : cards, posters }
}

const MOOD_TAG_KEYS = new Set(MOOD_CHOICES.flatMap((c) => (c.tag ? [c.tag.key] : [])))

function Cards({ d, m, art, viewer, cols, tile, all, lead, posterCols, slots }: { d: ProtoDiscover; m: Moods; art: WorldArt; viewer: Viewer; cols: string; tile: string; all: number; lead: number; posterCols: string; slots: number }) {
	const { cards, posters } = useCards(d, m, viewer, all, lead)
	const x = useMixes(
		d,
		cards.map((c) => c.mix),
	)
	const total = d.total
	return (
		<>
			<div className={`grid gap-2 ${cols}`}>
				{cards.map((card, i) => {
					const c = x.count(i)
					const t = card.tag
					// A narrowing or "or" card's count is Discover's own option count: exact, also while a search runs.
					const left = card.kind === "add" || card.kind === "or" ? (t ? d.countFor(t) : null) : c.total
					const on = card.kind === "mix" && x.isOn(card.mix)
					const share = card.kind === "add" && left !== null && total ? Math.round((left / total) * 100) : null
					const foot =
						left === null ? "" : card.kind === "add" && total !== null ? `${left.toLocaleString("en")} of ${total.toLocaleString("en")}` : `${left.toLocaleString("en")} titles`
					const name = !t ? mixName(card.mix) : card.kind === "drop" ? `Without ${tagName(t)}` : card.kind === "or" ? `or ${tagName(t)}` : `+ ${tagName(t)}`
					return (
						<motion.div key={card.mix.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.02 }} className="relative flex">
							<ArtTile
								name={name}
								line={c.top ? `Like ${c.top}` : null}
								hues={t ? [t.color, (card.kind === "drop" ? card.mix.tags[0] : d.picked[0])?.color ?? t.color] : card.mix.tags.map((g) => g.color)}
								path={c.path ?? art.get(islandOfTag(t ?? card.mix.tags[0]))?.path ?? null}
								on={on}
								dim={left === 0}
								foot={foot}
								onClick={() => (t ? d.toggle(t) : x.toggle(card.mix))}
								className={`w-full ${tile}`}
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
			</div>
			{posters && <Posters cards={d.cards} slots={slots} className={posterCols} busy={d.loading} />}
		</>
	)
}

export function MoodE({ d, phone, viewer }: SectionProps) {
	const m = useMoods(d)
	const art = useWorldArt()
	const narrowing = d.picked.length > 0 || m.used > 0
	const empty = <span className="text-sm font-semibold text-white">{viewer === "member" ? "From your taste" : "Mixes"}</span>
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<PickRow d={d} m={m} art={art} empty={empty} />
				{narrowing && nextTags(d, m, 1).length > 0 && <span className="-mb-2 text-sm font-semibold text-gray-300">Narrow it</span>}
				<div className="flex flex-col gap-2">
					<Cards d={d} m={m} art={art} viewer={viewer} cols="grid-cols-2" tile="h-[5.5rem]" all={6} lead={4} posterCols="grid-cols-5" slots={5} />
				</div>
				<TypeControl d={d} />
				<FoldShelf d={d} m={m} phone first={null} />
			</div>
		)
	return (
		<div className="flex h-full min-h-0">
			<div className="flex min-w-0 flex-1 flex-col gap-3 px-6 py-4">
				<PickRow d={d} m={m} art={art} empty={empty} right={<TypeSwitch d={d} />} />
				<div className="flex flex-col gap-2">
					<Cards d={d} m={m} art={art} viewer={viewer} cols="grid-cols-4" tile="h-[8.25rem]" all={8} lead={4} posterCols="grid-cols-9" slots={9} />
				</div>
			</div>
			<aside className="flex w-[420px] shrink-0 flex-col gap-4 border-l border-white/[0.06] px-5 py-4">
				<FoldShelf d={d} m={m} phone={false} />
			</aside>
		</div>
	)
}

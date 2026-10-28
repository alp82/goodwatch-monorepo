// PROTOTYPE (Discover lab, mood e): mixes that follow your picks. Like c, big picture cards come first, but they are
// built from the current state: with nothing picked they are ready mixes (a member's lean on their taste); after a
// pick every card is "your picks + one more", with its real count, its share of the list and its top title's picture.
// Tapping a card adds that one choice, and the cards narrow again. Moods, About, Style, Genre fold in the side column.
import { motion } from "framer-motion"
import { type ProtoDiscover, TAGS, type Tag, tagId } from "../../../kit"
import { TypeControl } from "../../shell-parts"
import type { SectionProps, Viewer } from "../../types"
import { FoldShelf, nextTags } from "./fit"
import { ArtTile, MIXES, type Mix, type Moods, PickRow, TypeSwitch, type WorldArt, islandOfTag, mixName, tagName, useMixes, useMoods, useWorldArt } from "./parts"

const findTag = (id: string): Tag => {
	const [group, key] = id.split(":")
	const t = TAGS.find((x) => x.group === group && x.key === key)
	if (!t) throw new Error(`No tag ${id}`)
	return t
}
const mixOf = (...ids: string[]): Mix => ({ id: ids.join("+"), tags: ids.map(findTag) })

/** A member's starting mixes, leaning on what they loved (Severance, Paddington 2, Knives Out, Past Lives). */
const MEMBER_MIXES: Mix[] = [
	mixOf("moods:mind", "themes:future"),
	mixOf("moods:feelgood", "themes:family"),
	mixOf("moods:funny", "themes:mystery"),
	mixOf("moods:romance", "styles:talky"),
	mixOf("moods:mind", "styles:nonlinear"),
	mixOf("moods:heavy", "styles:slow"),
	mixOf("moods:feelgood", "styles:animated"),
	mixOf("moods:action", "styles:fast"),
]

interface Card {
	mix: Mix
	/** The one choice the card adds to the picks; null for a whole ready mix. */
	adds: Tag | null
}

function useCards(d: ProtoDiscover, m: Moods, viewer: Viewer, n: number): Card[] {
	const narrowing = d.picked.length > 0 || m.used > 0
	if (!narrowing) return (viewer === "member" ? MEMBER_MIXES : MIXES).slice(0, n).map((mix) => ({ mix, adds: null }))
	return nextTags(d, m, n).map((t) => ({ mix: { id: [...d.picked.map(tagId), tagId(t)].join("+"), tags: [...d.picked, t] }, adds: t }))
}

function Cards({ d, m, art, viewer, cols, tile, n }: { d: ProtoDiscover; m: Moods; art: WorldArt; viewer: Viewer; cols: string; tile: string; n: number }) {
	const cards = useCards(d, m, viewer, n)
	const x = useMixes(
		d,
		cards.map((c) => c.mix),
	)
	const total = d.total
	return (
		<div className={`grid gap-2 ${cols}`}>
			{cards.map((card, i) => {
				const c = x.count(i)
				const t = card.adds
				// A narrowing card's count is Discover's own option count: exact, also while a search runs.
				const left = t ? d.countFor(t) : c.total
				const on = !t && x.isOn(card.mix)
				const share = t && left !== null && total ? Math.round((left / total) * 100) : null
				const foot =
					left === null ? "" : t && total !== null ? `${left.toLocaleString("en")} of ${total.toLocaleString("en")}` : `${left.toLocaleString("en")} titles`
				return (
					<motion.div key={card.mix.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, delay: i * 0.02 }} className="relative flex">
						<ArtTile
							name={t ? `+ ${tagName(t)}` : mixName(card.mix)}
							line={c.top ? `Like ${c.top}` : null}
							hues={t ? [t.color, d.picked[0]?.color ?? t.color] : card.mix.tags.map((g) => g.color)}
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
				{narrowing && <span className="-mb-2 text-sm font-semibold text-gray-300">Narrow it</span>}
				<Cards d={d} m={m} art={art} viewer={viewer} cols="grid-cols-2" tile="h-[5.5rem]" n={6} />
				<TypeControl d={d} />
				<FoldShelf d={d} m={m} phone first={null} />
			</div>
		)
	return (
		<div className="flex h-full min-h-0">
			<div className="flex min-w-0 flex-1 flex-col gap-3 px-6 py-4">
				<PickRow d={d} m={m} art={art} empty={empty} right={<TypeSwitch d={d} />} />
				<Cards d={d} m={m} art={art} viewer={viewer} cols="grid-cols-4" tile="h-[8.25rem]" n={8} />
			</div>
			<aside className="flex w-[420px] shrink-0 flex-col gap-4 border-l border-white/[0.06] px-5 py-4">
				<FoldShelf d={d} m={m} phone={false} />
			</aside>
		</div>
	)
}

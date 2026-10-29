// Watch > Budget. Budget (Indie to Blockbuster) on the left; Box office ($100M+ to $1B+) with Hit and Flop on the
// right. Writes `budget`, `boxOffice` and `returns`. These are movie facts: the block dims while the list holds only
// shows, and a choice keeps only movies with the fact known.
//
// Counts come with `counts=budget` (optionCounts.budget). Each heading says how many movies here have the fact
// (`known:budget`, `known:boxOffice`), so a sparse fact never looks like a broken filter. Without counts the tiles show
// none.
import { RETURNS_LABELS } from "~/domain/title-scales"
import type { SubTabView } from "../DiscoverControls"
import { appliedStateOf } from "../tabs"
import { GlyphTile, HUES, SteppedBlock, hueGlyph } from "./glyph-tiles"
import { ReturnsGlyph } from "./glyphs"
import { tabPad } from "./parts"
import { factNote } from "./stepped-choices"

const RETURNS = ["hit", "flop"] as const

export function BudgetTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const { state, update } = view.filters
	const applied = appliedStateOf(state, view.data.context)
	const budget = view.counts?.optionCounts.budget ?? null
	const off = state.type === "show"
	const typeCounts = view.counts?.optionCounts.type
	const movies = state.type === "show" ? null : (typeCounts?.movie ?? null)
	const blockSet = Boolean(
		applied.budget || applied.boxOffice || applied.returns,
	)
	const block = `flex min-w-0 flex-col transition-opacity ${off ? "opacity-45" : ""}`
	return (
		<div
			className={`${tabPad(phone)} ${phone ? "flex flex-col gap-7" : "grid grid-cols-2 gap-10"}`}
		>
			<section aria-label="Budget" className={block}>
				<SteppedBlock
					view={view}
					field="budget"
					title="Budget"
					note={factNote("budget", budget, movies, blockSet)}
					cols={["grid-cols-2", "grid-cols-2"]}
				/>
			</section>
			<section aria-label="Box office" className={block}>
				<SteppedBlock
					view={view}
					field="boxOffice"
					title="Box office"
					note={factNote("boxOffice", budget, movies, blockSet)}
					cols={["grid-cols-3", "grid-cols-3"]}
				/>
				<div className="mt-4 grid grid-cols-2 gap-2">
					{RETURNS.map((returns) => {
						const active = applied.returns === returns
						const hue = HUES[returns]
						return (
							<GlyphTile
								key={returns}
								label={RETURNS_LABELS[returns].label}
								note={RETURNS_LABELS[returns].note}
								count={budget ? (budget[`returns:${returns}`] ?? 0) : null}
								active={active}
								onClick={() =>
									update((st) => ({
										...st,
										returns: st.returns === returns ? undefined : returns,
									}))
								}
								hue={hue}
								strength={0.8}
								glyph={(s) =>
									hueGlyph(hue, s, <ReturnsGlyph returns={returns} />)
								}
							/>
						)
					})}
				</div>
			</section>
		</div>
	)
}

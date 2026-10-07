// PROTOTYPE - throwaway (#369, round 4). One design and three experiments around its open points. The design: the
// section starts as a small matrix (level 0), a press on a season row opens that season's rows in place (level 1),
// a press on a row opens it (level 2).
//   A: the design. A white line under watched cells; on a phone the seasons stand in two columns.
//   B: the watched mark as a tick in every watched cell, on cells big enough to carry it (12 a line on a phone).
//   C: how small is small: one strip for the whole show that opens to A's matrix.
//   D: watched cells faded; all seasons as thin rows on a phone, the open one enlarged; on a wide screen the open
//      season beside the matrix.
// A limited series gets no matrix in any of them.
import { ChevronUpIcon } from "@heroicons/react/24/solid"
import { useEffect, useState } from "react"
import { FOCUS, Hero, RatingsSection } from "~/ui/prototype-episode-list-2/shared"
import { DenseList, NumberingNote, SeasonHead } from "~/ui/prototype-episode-list-3/shared"
import { plural } from "~/ui/prototype-episode-list/model"
import { SURFACE } from "~/ui/prototype-episode-list/parts"
import { useStore } from "~/ui/prototype-episode-list/store"
import { Matrix, type Setup, ShowStrip, Tools, useNav4, useSetup } from "./matrix"

export const SETUPS = {
	A: { mark: "line", fit: "cols", strip: false },
	B: { mark: "tick", fit: "wrap", strip: false },
	C: { mark: "line", fit: "cols", strip: true },
	D: { mark: "fade", fit: "zoom", strip: false },
} as const satisfies Record<string, Setup>

const LINK = `cursor-pointer text-sm text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-white ${FOCUS}`

/** The ratings grid in IMDb's numbering, folded to a link: the matrix already shows every rating. */
function RatingsLink() {
	const [open, setOpen] = useState(false)
	return (
		<div data-ratings-link>
			<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={LINK}>
				{open ? "Hide the ratings grid" : "All ratings as one grid, in IMDb's numbering"}
			</button>
			{open && (
				<div className="mt-3">
					<RatingsSection />
				</div>
			)}
		</div>
	)
}

function Design({ base }: { base: Setup }) {
	const setup = useSetup(base)
	const nav = useNav4()
	const { d, st } = useStore()
	const { many, season } = nav
	// The strip is the start only for a member who tracks the show; everyone else starts at the matrix, which is
	// their ratings overview.
	const [folded, setFolded] = useState(() => setup.strip && (d.started || st.seenMarked))
	useEffect(() => {
		if (nav.open != null) setFolded(false)
	}, [nav.open])
	const level = !many ? "rows" : folded ? "strip" : nav.open == null ? "matrix" : "season"
	return (
		<div className="flex flex-col gap-8">
			<Hero onOpen={() => nav.jumpNext(true)} />
			{/* Everything under the hero. Its height is what the notes measure. */}
			<div data-content data-level={level} className="flex flex-col gap-6">
				<section id="episodes" className="scroll-mt-20">
					<Tools nav={nav} />
					<div className="mt-2">
						{!many ? (
							<div className={`max-w-3xl min-w-0 overflow-hidden rounded-xl border border-white/[0.06] ${SURFACE}`}>
								<SeasonHead season={season} label={plural(season.episodes.length, "episode")} />
								<NumberingNote season={season} />
								<DenseList key={season.number} season={season} target={nav.target} layout="fold" limit={12} chips />
							</div>
						) : folded ? (
							<ShowStrip onOpen={() => setFolded(false)} />
						) : (
							<Matrix
								nav={nav}
								setup={setup}
								action={
									setup.strip && (
										<button
											type="button"
											data-strip-fold
											onClick={() => {
												nav.close()
												setFolded(true)
											}}
											className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-semibold text-gray-300 hover:bg-white/10 ${FOCUS}`}
										>
											<ChevronUpIcon className="h-3.5 w-3.5" /> Fold to one strip
										</button>
									)
								}
							/>
						)}
					</div>
				</section>
				<RatingsLink />
			</div>
		</div>
	)
}

export const VariantA = () => <Design base={SETUPS.A} />
export const VariantB = () => <Design base={SETUPS.B} />
export const VariantC = () => <Design base={SETUPS.C} />
export const VariantD = () => <Design base={SETUPS.D} />

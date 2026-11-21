// The genres index: on a laptop a list of every genre
// runs down the left like a table of contents (color, name, count, the word that sets it apart) and the picked genre
// opens beside it, so switching genres never moves the page. A phone gets the chip row above the card instead.
import { kindLabel, kindNoun } from "~/domain/browse/address"
import { FOCUS, wash } from "~/ui/browse/index"
import { GLIDE_T } from "~/ui/browse/motion"
import type { BrowseViewProps } from "~/ui/browse/view"
import type { AtlasData } from "~/server/browse/genres.server"
import { genreCount } from "~/ui/browse/genres/bits"
import { GenreName } from "~/ui/browse/genres/pieces"
import { ChipRow } from "~/ui/browse/genres/ChipRow"
import { onlyOf } from "~/ui/browse/genres/shared"
import { GenreStage, type PickerProps, tabProps, tellingWord } from "~/ui/browse/genres/stage"

function Contents(p: PickerProps) {
	return (
		<>
			<div className="lg:hidden">
				<ChipRow {...p} />
			</div>
			<div
				role="tablist"
				aria-label="Genres"
				aria-orientation="vertical"
				className="hidden max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl bg-white/[0.02] p-1.5 ring-1 ring-white/[0.07] [scrollbar-width:thin] lg:block"
			>
				{p.genres.map((g) => {
					const on = g.place.slug === p.at
					const w = tellingWord(g)
					return (
						<button
							key={g.place.slug}
							{...tabProps(p, g.place.slug)}
							aria-label={`${g.place.label}, ${genreCount(g)} ${kindNoun(p.kind)}`}
							className={`group/r relative flex w-full items-center gap-3 rounded-xl py-2 pr-3 pl-3.5 text-left ${GLIDE_T} ${FOCUS} ${on ? "" : "hover:bg-white/[0.05]"}`}
							style={on ? { background: wash(g.color, 22) } : undefined}
						>
							<span
								aria-hidden
								className={`w-[3px] shrink-0 self-stretch rounded-full ${GLIDE_T} ${on ? "" : "opacity-40 group-hover/r:opacity-80"}`}
								style={{ background: g.color }}
							/>
							<span className="min-w-0 flex-1">
								<span
									className={`block truncate text-[15px] leading-tight font-semibold ${on ? "text-white" : "text-gray-200"}`}
								>
									<GenreName label={g.place.label} only={onlyOf(p.kind, g.place.slug)} />
								</span>
								{w && (
									<span
										className="mt-0.5 block truncate text-xs font-semibold"
										style={{ color: w.color }}
									>
										{w.word}
									</span>
								)}
							</span>
							<span
								className={`shrink-0 text-[13px] tabular-nums ${on ? "text-white/80" : "text-gray-500"}`}
							>
								{genreCount(g)}
							</span>
						</button>
					)
				})}
			</div>
		</>
	)
}

export function GenresPage(props: BrowseViewProps<AtlasData>) {
	const kind = props.address.kind
	return (
		<GenreStage
			{...props}
			kicker={`${kindLabel(kind)} by genre`}
			title="Pick a genre"
			lede={`Every genre with how many ${kindNoun(kind)} it holds. Pick one to see the kinds inside it.`}
			Picker={Contents}
			layout="side"
		/>
	)
}

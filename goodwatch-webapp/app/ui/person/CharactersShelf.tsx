// The person page's Characters: the characters a person played, as a sideways row of 2:3 TheTVDB portrait cards with
// the poster card's band (character, then "Title · year"), best-known titles first, with arrows on a wide screen and
// "See all" laying them out as a grid. Each card is a link to the title page; a plain click opens the character quick
// view, whose grid then shows the title's other characters.
import { useState } from "react"
import type { CharacterRole } from "~/domain/character-portraits"
import {
	type CharacterEntry,
	CharacterLink,
} from "~/ui/character-quick-view/context"
import { PortraitImg, TvdbCredit } from "~/ui/character-quick-view/parts"
import { roleEntry } from "~/ui/character-quick-view/portraits"
import { RowArrows, useStepRow } from "~/ui/row-arrows"

export function CharactersShelf({
	person,
	roles,
}: {
	person: { id: number; name: string; profilePath: string | null }
	/** One per title, best known first. */
	roles: CharacterRole[]
}) {
	const [all, setAll] = useState(false)
	const row = useStepRow<HTMLDivElement>([all, roles.length])
	if (!roles.length) return null
	const shelf = roles.map((role) => ({ role, entry: roleEntry(role, person) }))
	const entries = shelf.map((s) => s.entry)
	return (
		<section data-feedback-area="characters" className="min-w-0">
			<div className="flex items-center gap-3">
				<h2 className="text-xl font-bold">Characters</h2>
				<span className="text-gray-400">{roles.length}</span>
				<div className="ml-auto flex items-center gap-3">
					{(all || row.scrolls) && (
						<button
							type="button"
							onClick={() => setAll((v) => !v)}
							className="cursor-pointer text-sm font-semibold text-amber-400 hover:underline"
						>
							{all ? "Show fewer" : `See all ${roles.length}`}
						</button>
					)}
					{!all && <RowArrows row={row} label="characters" />}
				</div>
			</div>
			<p className="mt-0.5 text-sm text-gray-400">
				The characters {person.name} played, best-known titles first.
			</p>
			<div
				ref={all ? undefined : row.ref}
				onScroll={all ? undefined : row.measure}
				className={
					all
						? "mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6"
						: "-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:none] lg:-mx-1.5 lg:scroll-px-1.5 lg:px-1.5 [&::-webkit-scrollbar]:hidden"
				}
			>
				{shelf.map(({ role, entry }) => (
					<div
						key={entry.anchor}
						className={
							all ? "min-w-0" : "w-32 shrink-0 snap-start sm:w-36 lg:w-40"
						}
					>
						<RoleCard role={role} entry={entry} siblings={entries} />
					</div>
				))}
			</div>
			<TvdbCredit className="mt-1" />
		</section>
	)
}

/** A 2:3 character card with the poster card's band: character, then "Title · year". */
function RoleCard({
	role,
	entry,
	siblings,
}: {
	role: CharacterRole
	entry: CharacterEntry
	siblings: CharacterEntry[]
}) {
	const line = `${role.title}${role.year ? ` · ${role.year}` : ""}`
	return (
		<span className="group/card @container/card relative block w-full min-w-0">
			<CharacterLink
				entry={entry}
				siblings={siblings}
				label={`${role.character} in ${role.title}`}
				className="block w-full select-none overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-900 text-left can-hover:hover:border-amber-700/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white @min-[8rem]/card:border-4"
			>
				<span className="relative block aspect-[2/3]">
					<PortraitImg
						src={role.image}
						alt={`${entry.personName} as ${role.character}`}
						className="absolute inset-0 h-full w-full"
					/>
					<span
						aria-hidden
						className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-950 via-gray-950/85 to-transparent px-1.5 pt-6 pb-1.5 @min-[7.5rem]/card:px-2 @min-[7.5rem]/card:pt-8 @min-[7.5rem]/card:pb-2"
					>
						<span className="line-clamp-2 text-[0.6875rem] leading-tight font-semibold text-white @min-[7.5rem]/card:text-xs">
							{role.character}
						</span>
						<span className="block truncate text-[0.625rem] text-gray-300 @min-[7.5rem]/card:text-xs">
							{line}
						</span>
					</span>
				</span>
			</CharacterLink>
		</span>
	)
}

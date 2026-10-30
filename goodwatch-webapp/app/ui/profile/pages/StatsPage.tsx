// The profile's Stats tab: the numbers of a taste (genres, people, eras, world, facts, rating style). A signed-in visitor
// sees their usual score in Rating style; the rest of the comparison is on the Taste tab. The summary of the taste
// (viewer type, print, groups, against everyone) is on the Taste profile tab too. The owner also gets the import call to
// action.
import { SparklesIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useMemo } from "react"
import { tastePath } from "~/domain/member-paths"
import type { ProfileShell } from "~/domain/profile"
import type { MemberCompare } from "~/domain/profile-taste"
import { WRAP } from "~/ui/my-pages/bits"
import { ImportCta } from "../ImportCta"
import { AMBER_BUTTON, TILE } from "../parts"
import {
	Eras,
	Facts,
	Genres,
	type NamedTasteStats,
	People,
	RatingStyle,
	World,
} from "../taste/Stats"
import {
	type ProfileTaste,
	TasteContext,
	tasteContextValue,
} from "../taste/model"

export function StatsPage({
	shell,
	taste,
	stats,
	compare,
}: {
	shell: ProfileShell
	taste: ProfileTaste
	stats: NamedTasteStats | null
	compare: MemberCompare | null
}) {
	const owner = shell.viewer === "owner"
	const value = useMemo(
		() => tasteContextValue(taste, stats, compare, shell.handle, owner),
		[taste, stats, compare, shell.handle, owner],
	)

	if (taste.status !== "ready")
		return (
			<div className={`${WRAP} pt-2 pb-32`}>
				<div
					className={`${TILE} flex flex-col items-center gap-3 px-6 py-14 text-center`}
				>
					<SparklesIcon className="size-7 text-amber-400" aria-hidden />
					<p className="text-lg font-bold text-gray-100">
						{taste.status === "unavailable"
							? "The taste numbers are loading. Try again in a moment."
							: owner
								? "Rate a few more titles you love and your numbers show here."
								: `@${shell.handle}'s taste is still forming.`}
					</p>
					{owner && taste.status === "empty" && (
						<Link to={tastePath(shell.handle, "rate")} className={AMBER_BUTTON}>
							Rate titles
						</Link>
					)}
				</div>
			</div>
		)

	return (
		<TasteContext.Provider value={value}>
			<div className={`${WRAP} flex flex-col gap-12 pt-2 pb-32 text-white`}>
				<ImportCta shell={shell} what="ratings" />
				<div className="flex flex-col gap-16 sm:gap-20">
					<Genres />
					<People />
					<Eras />
					<World />
					<Facts />
					<RatingStyle />
				</div>
			</div>
		</TasteContext.Provider>
	)
}

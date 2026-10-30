// The Taste page for a member with a taste: one page around the fingerprint drawing. The viewer type beside the drawing,
// what pulls you, the taste groups (each a way into For you), you vs everyone, the titles that are most you, their tags
// with the way to their tropes, and ways to sharpen it. Spec: docs/implementation/taste-redesign.md.
import { Link } from "@remix-run/react"
import { useMemo } from "react"
import { member, ratePath } from "~/domain/member-paths"
import type { TastePortraitData } from "~/server/taste-portrait/page.server"
import { IMPORTS_PATH } from "~/ui/imports/shared"
import { WRAP } from "~/ui/my-pages/bits"
import { SubNav, type SubNavItem } from "~/ui/navigation/SubNav"
import { profileTabPath } from "~/ui/profile/links"
import { QUIET_BUTTON } from "~/ui/profile/parts"
import {
	TasteContext,
	tasteContextValue,
	useTaste,
} from "~/ui/profile/taste/model"
import { PANEL, SectionHead } from "~/ui/profile/taste/parts"
import { TasteBanner } from "../tabs/TasteBanner"
import { Explorer } from "./Explorer"
import { TasteGroups } from "./Groups"
import { TasteHero } from "./Hero"
import { MostYou } from "./MostYou"
import { TasteTags, hasTags } from "./Tags"
import { VsEveryone } from "./VsEveryone"
import { usePrintState } from "./print-state"

/** `side`: the taste group the address asks for (`?side=`), already checked to be one of the member's; null for none. */
export function TastePortrait({
	data,
	side = null,
}: { data: TastePortraitData; side?: string | null }) {
	const value = useMemo(
		() => tasteContextValue(data.taste, null, null, data.handle ?? "", true),
		[data.taste, data.handle],
	)
	return (
		<TasteContext.Provider value={value}>
			<Page
				handle={data.handle}
				averageYear={data.averageYear}
				tags={data.tags}
				side={side}
			/>
		</TasteContext.Provider>
	)
}

function Page({
	handle,
	averageYear,
	tags,
	side,
}: {
	handle: string | null
	averageYear: number | null
	tags: TastePortraitData["tags"]
	side: string | null
}) {
	const state = usePrintState()
	const { taste } = useTaste()
	const sections = useMemo(() => {
		const list: [string, string][] = [
			["viewer-type", "Type"],
			["fingerprint", "What pulls you"],
		]
		if (taste.sides.list.length) list.push(["sides", "Groups"])
		if (taste.crowd.status === "ready") list.push(["everyone", "Vs everyone"])
		if (taste.mostYou.length) list.push(["most-you", "Most you"])
		if (hasTags(tags) || handle) list.push(["tags", "Tags"])
		return list.map(
			([id, label]): SubNavItem => ({ key: id, label, href: `#${id}` }),
		)
	}, [taste, handle, tags])
	return (
		<div className="pb-32 text-white">
			<SubNav label="Taste sections" items={sections} sections />
			<TasteBanner member />
			<div className={`${WRAP} flex flex-col gap-16 pt-6 pb-8 sm:gap-20`}>
				<TasteHero state={state} averageYear={averageYear} />
				<section aria-labelledby="fingerprint" className="flex flex-col gap-5">
					<SectionHead
						id="fingerprint"
						eyebrow="74 attributes, 5 families"
						lead="What"
						accent="pulls you"
					/>
					<div className={`${PANEL} p-4 sm:p-6`}>
						<Explorer state={state} />
					</div>
				</section>
				<TasteGroups requested={side} />
				<VsEveryone />
				<div id="most-you" className="scroll-mt-44">
					<MostYou />
				</div>
				<TasteTags tags={tags} handle={handle} />
				<div className="flex flex-col gap-3">
					<Sharpen handle={handle} />
					{handle && (
						<Link
							to={profileTabPath(handle, "stats")}
							className="inline-flex min-h-11 items-center text-sm font-semibold text-gray-400 underline-offset-4 hover:text-white hover:underline"
						>
							Genres, eras, people, and more in your Stats →
						</Link>
					)}
				</div>
			</div>
		</div>
	)
}

/** Rate more (on the profile, or /taste/quiz before a handle), or bring ratings from elsewhere. */
function Sharpen({ handle }: { handle: string | null }) {
	return (
		<div className={`${PANEL} flex flex-wrap items-center gap-3 p-3 sm:p-4`}>
			<p className="mr-auto text-sm font-bold text-gray-200">
				Sharpen your taste
			</p>
			<Link to={ratePath(member(handle))} className={QUIET_BUTTON}>
				Rate more
			</Link>
			<Link to={IMPORTS_PATH} className={QUIET_BUTTON}>
				Import ratings
			</Link>
		</div>
	)
}

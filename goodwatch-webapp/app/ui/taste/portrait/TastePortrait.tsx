// The Taste page for a member with a taste: one page around the fingerprint drawing. The viewer type beside the drawing,
// what pulls you, the taste groups (each a way into For you), you vs everyone, the titles that are most you, the way to
// the member's tropes, and ways to sharpen it. Spec: docs/implementation/taste-redesign.md.
import { Link } from "@remix-run/react"
import { useMemo } from "react"
import type { TastePortraitData } from "~/server/taste-portrait/page.server"
import { IMPORTS_PATH } from "~/ui/imports/shared"
import { WRAP } from "~/ui/my-pages/bits"
import { profileTabPath } from "~/ui/profile/links"
import { QUIET_BUTTON } from "~/ui/profile/parts"
import { MostYou } from "~/ui/profile/taste/Hero"
import {
	TasteContext,
	tasteContextValue,
	useTaste,
} from "~/ui/profile/taste/model"
import { PANEL, SectionHead } from "~/ui/profile/taste/parts"
import { QUIZ_PATH } from "~/ui/taste-quiz/TasteQuizPage"
import { TasteBanner } from "../tabs/TasteBanner"
import { Explorer } from "./Explorer"
import { TasteGroups } from "./Groups"
import { TasteHero } from "./Hero"
import { type Section, SectionChips } from "./SectionChips"
import { TropesLink } from "./Tropes"
import { VsEveryone } from "./VsEveryone"
import { usePrintState } from "./print-state"

export function TastePortrait({ data }: { data: TastePortraitData }) {
	const value = useMemo(
		() => tasteContextValue(data.taste, null, null, data.handle ?? "", true),
		[data.taste, data.handle],
	)
	return (
		<TasteContext.Provider value={value}>
			<Page handle={data.handle} averageYear={data.averageYear} />
		</TasteContext.Provider>
	)
}

function Page({
	handle,
	averageYear,
}: { handle: string | null; averageYear: number | null }) {
	const state = usePrintState()
	const { taste } = useTaste()
	const sections = useMemo(() => {
		const list: Section[] = [
			{ id: "viewer-type", label: "Type" },
			{ id: "fingerprint", label: "What pulls you" },
		]
		if (taste.sides.list.length) list.push({ id: "sides", label: "Groups" })
		if (taste.crowd.status === "ready")
			list.push({ id: "everyone", label: "Vs everyone" })
		if (taste.mostYou.length) list.push({ id: "most-you", label: "Most you" })
		if (handle) list.push({ id: "tropes", label: "Tropes" })
		return list
	}, [taste, handle])
	return (
		<div className="pb-32 text-white">
			<TasteBanner member />
			<SectionChips sections={sections} />
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
				<TasteGroups />
				<VsEveryone />
				<div id="most-you" className="scroll-mt-44">
					<MostYou />
				</div>
				{handle && <TropesLink handle={handle} />}
				<div className="flex flex-col gap-3">
					<Sharpen />
					{handle && (
						<Link
							to={profileTabPath(handle, "taste")}
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

/** Rate more, or bring ratings from elsewhere. */
function Sharpen() {
	return (
		<div className={`${PANEL} flex flex-wrap items-center gap-3 p-3 sm:p-4`}>
			<p className="mr-auto text-sm font-bold text-gray-200">
				Sharpen your taste
			</p>
			<Link to={QUIZ_PATH} className={QUIET_BUTTON}>
				Rate more
			</Link>
			<Link to={IMPORTS_PATH} className={QUIET_BUTTON}>
				Import ratings
			</Link>
		</div>
	)
}

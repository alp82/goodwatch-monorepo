// The Scores tab: /u/:handle/scores and its pages. The owner gets the SubNav between Scored (/scores) and Not rated
// (/scores/not-rated), right under the tab row, then the head. Rate more (/scores/rate) is the owner's own tab after
// Scores (ui/navigation/areas.ts) and has its own head.
// Visitors, and the owner with ?as=visitor, get the public Scores page under a plain head.
import { Outlet, useLocation } from "@remix-run/react"
import { useMemo } from "react"
import { libraryCounts } from "~/domain/my-library"
import { useUserData } from "~/routes/api.user-data"
import { useProfileLayout } from "~/routes/u.$handle"
import { SubNav } from "~/ui/navigation/SubNav"
import { scoresSwitch } from "~/ui/navigation/areas"
import { ProfileTabPage, TabHead } from "~/ui/profile/ProfileFrame"
import { asGuestSees } from "~/ui/profile/ProfileHeader"
import { count } from "~/ui/profile/parts"

export { pageHeaders as headers } from "~/utils/headers"

export default function ProfileScoresLayout() {
	const layout = useProfileLayout()
	const { pathname, search } = useLocation()
	const { data } = useUserData()
	const unrated = useMemo(
		() => (data ? libraryCounts(data).unrated : undefined),
		[data],
	)
	if (!layout) return <Outlet />
	const real = layout.shell
	const asVisitor =
		real.viewer === "owner" &&
		new URLSearchParams(search).get("as") === "visitor"
	const shell = asVisitor ? asGuestSees(real) : real
	const average =
		shell.counts.average != null ? `, average ${shell.counts.average}` : ""

	if (shell.viewer !== "owner")
		return (
			<ProfileTabPage
				shell={shell}
				part="scores"
				title="Scores"
				line={`${count(shell.counts.rated)} titles${average}.`}
			>
				<Outlet />
			</ProfileTabPage>
		)

	if (pathname.replace(/\/$/, "").endsWith("/scores/rate"))
		return (
			<>
				<TabHead
					title="Rate more"
					line="Titles you've likely seen, best guesses first."
				/>
				<Outlet />
			</>
		)

	const notRated = pathname.replace(/\/$/, "").endsWith("/scores/not-rated")
	const choices = scoresSwitch(shell.handle, pathname, {
		scored: shell.counts.rated,
		notRated: unrated,
	})
	return (
		<>
			{choices && <SubNav label={choices.label} items={choices.choices} />}
			<TabHead
				title="Scores"
				line={
					notRated
						? "What you've seen without a score yet."
						: `${count(shell.counts.rated)} titles${average}. Change any score right in the list.`
				}
			/>
			<Outlet />
		</>
	)
}

// PROTOTYPE - throwaway. User feedback, contact and data corrections (#762, #765, #767). Rounds 2-3: variant C (the owner's
// pick) is the default, with one global Feedback tab (FeedbackDock) as the only entry point; round 1's A and B stay
// reachable with ?variant=A|B. Also ?screen=title|person|feedback|contact|staff, ?as=guest|member|trusted, ?tab=2.
// Real title and person page parts on fixtures (app/ui/prototype-feedback/*.json); everything happens in memory.
// Run it with ./prototype-feedback.sh (no production settings, outbound connections blocked).
import { json } from "@remix-run/node"
import type { MetaFunction } from "@remix-run/react"
import ContactPage from "~/ui/prototype-feedback/ContactPage"
import {
	FeedbackDock,
	type FixPath,
} from "~/ui/prototype-feedback/FeedbackDock"
import FeedbackTab from "~/ui/prototype-feedback/FeedbackTab"
import { FixLayer, revealArea } from "~/ui/prototype-feedback/FixLayer"
import PersonPage from "~/ui/prototype-feedback/PersonPage"
import { ReportFlow } from "~/ui/prototype-feedback/ReportFlow"
import StaffPost from "~/ui/prototype-feedback/StaffPost"
import { Switcher } from "~/ui/prototype-feedback/Switcher"
import TitlePage from "~/ui/prototype-feedback/TitlePage"
import fixture from "~/ui/prototype-feedback/fixture-title.json"
import { AREAS, type Area } from "~/ui/prototype-feedback/model"
import { FeedbackProvider, useFeedback } from "~/ui/prototype-feedback/store"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	// The title page's genre links read their query cache from the route's dehydrated state, as on the real page.
	return json({ dehydratedState: fixture.dehydratedState })
}

export const meta: MetaFunction = () => [
	{ title: "Feedback prototype | GoodWatch" },
	{ name: "robots", content: "noindex" },
]

function Screen() {
	const { screen, variant } = useFeedback()
	if (screen === "person")
		return (
			<div data-feedback-page>
				<PersonPage />
			</div>
		)
	if (screen === "contact") return <ContactPage />
	if (screen === "staff") return <StaffPost />
	return (
		<div data-feedback-page>
			<TitlePage />
			{screen === "feedback" && variant !== "C" && <FeedbackTab />}
		</div>
	)
}

/**
 * C: the global Feedback tab, here with the fix path on pages with correctable data (title, person). The staff post is
 * a Discord mock, not a GoodWatch page, so it has no tab. The root layout mounts the plain tab on every other page.
 */
/** The choosable blocks per screen, in page order. */
const PAGE_AREAS: Partial<Record<string, Area[]>> = {
	title: ["scores", "watch", "analysis", "episodes", "details", "cast"],
	feedback: ["scores", "watch", "analysis", "episodes", "details", "cast"],
	person: ["person", "credits"],
}

function ProtoDock() {
	const {
		variant,
		screen,
		viewer,
		fixMode,
		setFixMode,
		open,
		setOpen,
		hot,
		setHot,
	} = useFeedback()
	if (variant !== "C" || screen === "staff") return null
	const area = open && open !== "pick" ? open : null
	const fix: FixPath | undefined =
		screen === "contact"
			? undefined
			: {
					on: fixMode,
					setOn: (on) => {
						setFixMode(on)
						if (!on) setOpen(null)
					},
					trusted: viewer === "trusted",
					picked: area
						? {
								title: `${AREAS[area].problems.every((p) => p.flag) ? "Flag" : "Fix"} ${AREAS[area].what}`,
								flow: (
									<ReportFlow
										key={area}
										area={area}
										layout="chips"
										onClose={() => setOpen(null)}
									/>
								),
							}
						: null,
					closePicked: () => setOpen(null),
					areas: (PAGE_AREAS[screen] ?? []).map((a) => ({
						id: a,
						label: AREAS[a].label,
						flagOnly: AREAS[a].problems.every((p) => p.flag),
					})),
					hot,
					setHot: (id) => setHot(id as Area | null),
					pick: (id) => setOpen(id as Area),
					reveal: revealArea,
				}
	return (
		<FeedbackDock
			key={screen}
			fix={fix}
			guest={viewer === "guest"}
			startWith={screen === "feedback" ? "send" : undefined}
		/>
	)
}

export default function FeedbackPrototype() {
	return (
		<FeedbackProvider>
			{/* The query devtools' floating button (development only) sits where the feedback tabs and sheets go. */}
			<style>{".tsqd-parent-container{display:none}"}</style>
			<Screen />
			<ProtoDock />
			<FixLayer />
			<Switcher />
		</FeedbackProvider>
	)
}

// PROTOTYPE - throwaway. User feedback, contact and data corrections (#762, #765, #767): three variants of every
// surface, switchable with ?variant=A|B|C, ?screen=title|person|feedback|contact|staff and ?as=guest|member|trusted.
// Real title and person page parts on fixtures (app/ui/prototype-feedback/*.json); everything happens in memory.
// Run it with ./prototype-feedback.sh (no production settings, outbound connections blocked).
import { json } from "@remix-run/node"
import type { MetaFunction } from "@remix-run/react"
import ContactPage from "~/ui/prototype-feedback/ContactPage"
import FeedbackTab from "~/ui/prototype-feedback/FeedbackTab"
import PersonPage from "~/ui/prototype-feedback/PersonPage"
import StaffPost from "~/ui/prototype-feedback/StaffPost"
import { FeedbackProvider, useFeedback } from "~/ui/prototype-feedback/store"
import { Switcher } from "~/ui/prototype-feedback/Switcher"
import TitlePage from "~/ui/prototype-feedback/TitlePage"
import fixture from "~/ui/prototype-feedback/fixture-title.json"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	// The title page's genre links read their query cache from the route's dehydrated state, as on the real page.
	return json({ dehydratedState: fixture.dehydratedState })
}

export const meta: MetaFunction = () => [{ title: "Feedback prototype | GoodWatch" }, { name: "robots", content: "noindex" }]

function Screen() {
	const { screen } = useFeedback()
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
			{screen === "feedback" && <FeedbackTab />}
		</div>
	)
}

export default function FeedbackPrototype() {
	return (
		<FeedbackProvider>
			{/* The query devtools' floating button (development only) sits where the feedback tabs and sheets go. */}
			<style>{".tsqd-parent-container{display:none}"}</style>
			<Screen />
			<Switcher />
		</FeedbackProvider>
	)
}

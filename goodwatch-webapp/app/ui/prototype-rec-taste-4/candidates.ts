// PROTOTYPE - throwaway. Round 4's candidates for the third view, in switcher order (?variant=<key>).
// Sides of you and You vs everyone are fixed; only the third tab changes.
import type { ComponentType } from "react"
import type { Payload4 } from "./model"
import Canon from "./views/Canon"
import Dealbreakers from "./views/Dealbreakers"
import Edges from "./views/Edges"
import Gems from "./views/Gems"
import People from "./views/People"

export type Candidate = {
	name: string // the third tab's label
	style: "existing" | "bolder"
	View: ComponentType<{ data: Payload4 }>
}

export const CANDIDATES: Record<string, Candidate> = {
	edges: { name: "Your edges", style: "existing", View: Edges },
	people: { name: "Your people", style: "existing", View: People },
	gems: { name: "Hidden gems", style: "bolder", View: Gems },
	canon: { name: "Your canon", style: "existing", View: Canon },
	dealbreakers: {
		name: "What loses you",
		style: "existing",
		View: Dealbreakers,
	},
}

export const DEFAULT_CANDIDATE = Object.keys(CANDIDATES)[0]

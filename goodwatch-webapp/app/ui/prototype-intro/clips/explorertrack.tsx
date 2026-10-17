// PROTOTYPE - throwaway. Intro clips of group "explorertrack": the Explorer, and what GoodWatch keeps track of for a
// member. Built from explorertrack/explorer.tsx and explorertrack/tracking.tsx; styles in explorertrack.css.
import type { Clip } from "../clip"
import { ExplorerBridge, ExplorerFlyover, ExplorerMap, ExplorerPlaced } from "./explorertrack/explorer"
import { TrackingAlerts, TrackingImport, TrackingLands, TrackingShows } from "./explorertrack/tracking"
import "./explorertrack.css"

export const CLIPS: Clip[] = [
	{
		id: "explorer-map",
		section: "explorer",
		name: "The mood map falls into view",
		ms: 6800,
		note: "Twelve real mood islands pop in by size, the camera drifts to Cozy and names what sets it apart.",
		C: ExplorerMap,
	},
	{
		id: "explorer-bridge",
		section: "explorer",
		name: "Two islands, one bridge",
		ms: 7000,
		note: "Cozy and Magical glide together, a dotted bridge forms, the titles on both deal in with the real count.",
		C: ExplorerBridge,
	},
	{
		id: "explorer-flyover",
		section: "explorer",
		name: "Fly over the islands",
		ms: 7000,
		note: "A slow camera pass along eight islands, each with its three best titles fanned on top.",
		C: ExplorerFlyover,
	},
	{
		id: "explorer-placed",
		section: "explorer",
		name: "One title on the map",
		ms: 6600,
		note: "A title lands in the middle, the islands it sits on light up and the rest fall back.",
		C: ExplorerPlaced,
	},
	{
		id: "tracking-alerts",
		section: "tracking",
		name: "Alerts, one at a time",
		ms: 7000,
		note: "Four example member alerts with real titles stack in slowly: lands on a service, new episode, a side, a score.",
		C: TrackingAlerts,
	},
	{
		id: "tracking-lands",
		section: "tracking",
		name: "Want it once, hear the day it lands",
		ms: 6400,
		note: "One press on Want to See, then the service's mark slams onto the poster. The service is real.",
		C: TrackingLands,
	},
	{
		id: "tracking-shows",
		section: "tracking",
		name: "My shows: what's next",
		ms: 5800,
		note: "Three followed shows; the one with a new episode carries the amber New badge. Example states.",
		C: TrackingShows,
	},
	{
		id: "tracking-import",
		section: "tracking",
		name: "Bring your ratings with you",
		ms: 6200,
		note: "The real import sources fly into the G and come out as posters: a taste ready on day one.",
		C: TrackingImport,
	},
]

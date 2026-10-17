// PROTOTYPE - throwaway. Intro clips of group "scorestream": One score, and Where it streams.
import type { Clip } from "../clip"
import { ScoreMerge, ScoreSplit, ScoreVerdict, ScoreWall } from "./scorestream/score"
import { StreamingAlert, StreamingCountries, StreamingDeal, StreamingWays } from "./scorestream/streaming"
import "./scorestream.css"

export const CLIPS: Clip[] = [
	{
		id: "score-merge",
		section: "score",
		name: "Three opinions become one score",
		ms: 6800,
		note: "IMDb, Rotten Tomatoes and Metacritic deal in with their real numbers, gather, and the GoodWatch ring takes their place.",
		C: ScoreMerge,
	},
	{
		id: "score-wall",
		section: "score",
		name: "A wall gets its scores",
		ms: 6500,
		note: "Twelve posters deal in, each gets its ring; the best light up amber, the rest step back.",
		C: ScoreWall,
	},
	{
		id: "score-split",
		section: "score",
		name: "Critics vs audiences",
		ms: 6500,
		note: "The start title where critics and fans differ most, real numbers on each side; GoodWatch sits between.",
		C: ScoreSplit,
	},
	{
		id: "score-verdict",
		section: "score",
		name: "The ring fills, the verdict lands",
		ms: 6000,
		note: "One backdrop, the ring fills slowly, 'Great.' lands huge, then how many ratings it comes from.",
		C: ScoreVerdict,
	},
	{
		id: "streaming-deal",
		section: "streaming",
		name: "Every service deals in, one lights up",
		ms: 6500,
		note: "Germany's biggest services deal in like the sign-up wall; only those carrying the title stay lit.",
		C: StreamingDeal,
	},
	{
		id: "streaming-ways",
		section: "streaming",
		name: "Every way to watch one title",
		ms: 6500,
		note: "Included, free, rent or buy: the real offers for one title in Germany, column by column.",
		C: StreamingWays,
	},
	{
		id: "streaming-countries",
		section: "streaming",
		name: "Where you live",
		ms: 7000,
		note: "The same title on different services in the US, Britain and Germany; the light settles on yours.",
		C: StreamingCountries,
	},
	{
		id: "streaming-alert",
		section: "streaming",
		name: "It tells you when it lands",
		ms: 5500,
		note: "Illustrative member alert: a Wishlist title just landed on a service.",
		C: StreamingAlert,
	},
]

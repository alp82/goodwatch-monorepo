// PROTOTYPE - throwaway. Round 5 intro clips, group "r5map": chapter 7 (Explorer: the mood map with a combination
// demo) and chapter 8 (Streaming: big brands, a huge wall, where you live, and "we'll tell you when it's on").
import type { Clip } from "../clip"
import { ExplorerCombine, ExplorerFans, ExplorerMix, ExplorerPullBack } from "./r5map/explorer"
import { StreamingConveyor, StreamingEverywhere, StreamingPassport, StreamingRain } from "./r5map/streaming"
import "./r5map.css"

export const CLIPS: Clip[] = [
	{
		id: "explorer-combine",
		section: "explorer",
		name: "Mood map, then two islands merge",
		ms: 12000,
		note: "The real Explorer look (glowing blobs on a night sea). The map names itself, two islands glide into the Combine circle and merge; their famous shared titles deal in.",
		C: ExplorerCombine,
	},
	{
		id: "explorer-pullback",
		section: "explorer",
		name: "Pull back from one island, bridge to another",
		ms: 11500,
		note: "Starts close on one island and pulls back to the whole map; a second island lifts, a dotted bridge forms, the shared titles rise.",
		C: ExplorerPullBack,
	},
	{
		id: "explorer-fans",
		section: "explorer",
		name: "Poster fans slide together",
		ms: 10500,
		note: "Islands as fans of their most famous posters. Two fans slide together and deal out what they share.",
		C: ExplorerFans,
	},
	{
		id: "explorer-mix",
		section: "explorer",
		name: "Exploration: slide between two moods",
		ms: 11500,
		note: "Exploration. A slider between two islands: all of one, the overlap, all of the other.",
		C: ExplorerMix,
	},
	{
		id: "streaming-everywhere",
		section: "streaming",
		name: "Big brands, huge wall, where you live, alert",
		ms: 15500,
		note: "Owner's order exactly: the big services big, a pull-back as hundreds pop in faster and faster, the count, a famous title by country with yours lit, then a simple example alert.",
		C: StreamingEverywhere,
	},
	{
		id: "streaming-conveyor",
		section: "streaming",
		name: "Conveyor rows speed up, then your country lights",
		ms: 15000,
		note: "Rows of logos glide by, each new row smaller and faster, then slow to a stop; only your country's services stay lit. Then the alert.",
		C: StreamingConveyor,
	},
	{
		id: "streaming-passport",
		section: "streaming",
		name: "Wall, then a title travels country by country",
		ms: 15500,
		note: "After the wall, country cards flip past for a famous title and land on yours. Then the alert.",
		C: StreamingPassport,
	},
	{
		id: "streaming-rain",
		section: "streaming",
		name: "Exploration: logos rain into one answer",
		ms: 15500,
		note: "Exploration. Logos fall, slowly and then in a downpour, into one card: where the title streams where you live. Then the alert.",
		C: StreamingRain,
	},
]

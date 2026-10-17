// The film the start page's TV plays for a guest (docs/implementation/home-intro.md): one scene per chapter, in the
// chapters' order (CHAPTERS in scene.ts). To reorder the film, reorder CHAPTERS; to change a chapter, change its scene.
import { CHAPTERS, type ChapterId, type Scene } from "./scene"
import { CHAT_MS, Chat } from "./scenes/chat"
import { EXPLORER_MS, Explorer } from "./scenes/explorer"
import { Filters } from "./scenes/filters"
import { HowItFeels, howItFeelsMs } from "./scenes/how-it-feels"
import { ONE_SCORE_MS, OneScore } from "./scenes/one-score"
import { PICKED_FOR_YOU_MS, PickedForYou } from "./scenes/picked-for-you"
import { QUIZ_MS, Quiz } from "./scenes/quiz"
import { RATINGS_MS, Ratings } from "./scenes/ratings"
import { Search } from "./scenes/search"
import { STREAMING_MS, Streaming } from "./scenes/streaming"
import { Tracking } from "./scenes/tracking"

const SCENES: Record<ChapterId, Omit<Scene, "section">> = {
	// Deals in as the boot screen leaves.
	opener: { id: "chat", ms: CHAT_MS, enter: "deal", C: Chat },
	score: { id: "one-score", ms: ONE_SCORE_MS, C: OneScore },
	streaming: { id: "streaming", ms: STREAMING_MS, C: Streaming },
	// Ends on the pick's poster, which "How it feels" continues from.
	recommendations: {
		id: "picked-for-you",
		ms: PICKED_FOR_YOU_MS,
		C: PickedForYou,
	},
	fingerprint: {
		id: "how-it-feels",
		ms: howItFeelsMs(4),
		enter: "cut",
		C: HowItFeels,
	},
	// "a mind-blowing space adventure": the typing time of the phrase decides the length.
	search: { id: "search", ms: 5940, C: Search },
	// The last result lands at 6,070 ms, then a 2,600 ms hold with a slow push-in.
	filters: { id: "filters", ms: 8700, C: Filters },
	explorer: { id: "explorer", ms: EXPLORER_MS, C: Explorer },
	// Ends as its last card lands: the next chapter starts under its closing line.
	tracking: { id: "tracking", ms: 6100, C: Tracking },
	imports: { id: "ratings", ms: RATINGS_MS, C: Ratings },
	// The quiz waits for the visitor.
	closer: { id: "quiz", ms: QUIZ_MS, enter: "wipe", C: Quiz },
}

export const FILM: Scene[] = CHAPTERS.map((chapter) => ({
	section: chapter.id,
	...SCENES[chapter.id],
}))

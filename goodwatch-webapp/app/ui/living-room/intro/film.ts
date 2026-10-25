// The film the start page's TV plays for a guest (docs/implementation/home-intro.md): one scene per chapter, in the
// chapters' order (CHAPTERS in scene.ts). To reorder the film, reorder CHAPTERS; to change a chapter, change its scene.
import { CHAPTERS, type ChapterId, type Scene } from "./scene"
import { USE_WITH_AI_MS, UseWithAi } from "./scenes/ai/use-with-ai"
import { CHAT_MS, Chat } from "./scenes/chat"
import { DISCORD_MS, DiscordBot } from "./scenes/discord/discord"
import { Filters } from "./scenes/filters"
import { FOR_YOU_MS, ForYou } from "./scenes/for-you/for-you"
import { ONE_SCORE_MS, OneScore } from "./scenes/one-score"
import { QUIZ_MS, Quiz } from "./scenes/quiz"
import { RATINGS_MS, Ratings } from "./scenes/ratings"
import { Search } from "./scenes/search"
import { STREAMING_MS, Streaming } from "./scenes/streaming"
import { TASTE_MS, YourTaste } from "./scenes/taste/taste"
import { Tracking } from "./scenes/tracking"

const SCENES: Record<ChapterId, Omit<Scene, "section">> = {
	// Deals in as the boot screen leaves.
	opener: { id: "chat", ms: CHAT_MS, enter: "deal", C: Chat },
	score: { id: "one-score", ms: ONE_SCORE_MS, C: OneScore },
	streaming: { id: "streaming", ms: STREAMING_MS, C: Streaming },
	recommendations: { id: "for-you", ms: FOR_YOU_MS, C: ForYou },
	fingerprint: { id: "your-taste", ms: TASTE_MS, C: YourTaste },
	// "a mind-blowing space adventure": the typing time of the phrase decides the length.
	search: { id: "search", ms: 5940, C: Search },
	// The last result lands at 6,070 ms, then a 2,600 ms hold with a slow push-in.
	filters: { id: "filters", ms: 8700, C: Filters },
	// Ends as its last card lands: the next chapter starts under its closing line.
	tracking: { id: "tracking", ms: 6100, C: Tracking },
	imports: { id: "ratings", ms: RATINGS_MS, C: Ratings },
	ai: { id: "use-with-ai", ms: USE_WITH_AI_MS, C: UseWithAi },
	discord: { id: "discord-bot", ms: DISCORD_MS, C: DiscordBot },
	// The quiz waits for the visitor.
	closer: { id: "quiz", ms: QUIZ_MS, enter: "wipe", C: Quiz },
}

export const FILM: Scene[] = CHAPTERS.map((chapter) => ({
	section: chapter.id,
	...SCENES[chapter.id],
}))

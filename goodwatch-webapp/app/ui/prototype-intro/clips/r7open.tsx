// PROTOTYPE - throwaway. Round 7 intro clips, group "r7open": chapter 1 (the problem) and chapter 2 (one score).
// Chapter 1 refines round 6's opener-receipts (no app chrome, the question stays in view with its answer); chapter 2
// refines round 6's score-cards-fan (the hand rises and shrinks over the ring, the cards fly in one by one, the ring
// centres and the clip ends on round 5's RingEnd hand-over frame).
import type { Clip } from "../clip"
import "./r5score.css"
import "./r6score.css"
import { OpenerChat } from "./r7open/opener"
import { SCORE_HAND_MS, ScoreHand } from "./r7open/score"
import "./r7open.css"

export const CLIPS: Clip[] = [
	{
		id: "opener-bubbles",
		section: "opener",
		name: "Just the bubbles, a time under every message, then the wall",
		ms: 10000,
		note: "Round 6's receipts with no app chrome: no name, avatar, window or message field, larger bubbles floating on the TV. Each answer lands with its suggestion still in view above it. Same messages, times, pacing and wall.",
		C: OpenerChat,
	},
	{
		id: "score-hand",
		section: "score",
		name: "A hand of brand cards rises, flies into the ring, the ring centres",
		ms: SCORE_HAND_MS,
		note: "The fanned hand of five brand cards; as the ring comes up right below, the hand moves up and shrinks a little; the cards fly into the ring one by one while it fills; then the ring glides to the centre (RingEnd).",
		C: ScoreHand,
	},
]

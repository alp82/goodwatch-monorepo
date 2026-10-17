// PROTOTYPE - throwaway. Round 5 intro clips, group "r5feel": chapter 4 (how it feels, starting on the hero hand-over
// frame) and chapter 5 (search by feeling).
import type { Clip } from "../clip"
import {
	AttributesBurst,
	AttributesCard,
	AttributesReel,
	AttributesStack,
	BURST_MS,
	CARD_MS,
	REEL_MS,
	STACK_MS,
} from "./r5feel/attributes"
import { BIG_MS, CHAT_MS, LIVE_MS, SearchBig, SearchChat, SearchLive, SearchTop, TOP_MS } from "./r5feel/search"
import "./r5feel.css"

export const CLIPS: Clip[] = [
	{
		id: "fingerprint-burst",
		section: "fingerprint",
		name: "Feelings burst out of the poster",
		ms: BURST_MS,
		enter: "cut",
		note: "From the hero frame: the poster steps back, four huge feelings burst out of it to the corners, bars slam full.",
		C: AttributesBurst,
	},
	{
		id: "fingerprint-stack",
		section: "fingerprint",
		name: "Four huge feelings slam in",
		ms: STACK_MS,
		enter: "cut",
		note: "Round 4's favourite, bolder: the poster slides left, the backdrop comes alive, four big lines slam in with thick bars.",
		C: AttributesStack,
	},
	{
		id: "fingerprint-reel",
		section: "fingerprint",
		name: "One feeling at a time, huge",
		ms: REEL_MS,
		enter: "cut",
		note: "Each feeling fills the right side on its own, then all four together: \"That's Interstellar.\"",
		C: AttributesReel,
	},
	{
		id: "fingerprint-card",
		section: "fingerprint",
		name: "Exploration: the feel card",
		ms: CARD_MS,
		enter: "cut",
		note: "The poster flips over like a trading card to how it feels; The Dark Knight and Game of Thrones flip beside it.",
		C: AttributesCard,
	},
	{
		id: "search-live",
		section: "search",
		name: "Read as builds while typing",
		ms: LIVE_MS,
		note: "\"a mind-blowing space adventure\" types fast; each chip appears as its word lands; famous results deal in.",
		C: SearchLive,
	},
	{
		id: "search-big",
		section: "search",
		name: "Huge phrase, then lifts for results",
		ms: BIG_MS,
		note: "Round 4's favourite look: \"an epic fantasy adventure\" types huge, chips pop in live, it lifts, results rise.",
		C: SearchBig,
	},
	{
		id: "search-top",
		section: "search",
		name: "Top match takes the screen",
		ms: TOP_MS,
		note: "Typing and live chips, then the best-known match fills the screen with its backdrop and score.",
		C: SearchTop,
	},
	{
		id: "search-chat",
		section: "search",
		name: "Exploration: just ask",
		ms: CHAT_MS,
		note: "\"something funny for date night\" sent as a message; GoodWatch answers with what it heard and three picks.",
		C: SearchChat,
	},
]

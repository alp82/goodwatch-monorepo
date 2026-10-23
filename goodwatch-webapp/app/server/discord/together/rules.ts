export type Vote = "yep" | "nope"
export interface Ballot {
	titleId: string
	vote: Vote
}
export interface VotingState {
	deck: string[]
	votes: Record<string, Ballot[]>
}
export interface Summary {
	participantCount: number
	stillVoting: number
	matches: string[]
	possibleMatches: { titleId: string; waitingFor: number }[]
}
export const DECK_STEP = 30
export const MAX_DECK = 120
export const MAX_PARTICIPANTS = 12
export function nextTitle(state: VotingState, user: string) {
	const voted = new Set((state.votes[user] ?? []).map((v) => v.titleId))
	return state.deck.find((id) => !voted.has(id))
}
export function summarize(state: VotingState): Summary {
	const participants = Object.keys(state.votes).filter(
		(u) => state.votes[u].length,
	)
	const summary: Summary = {
		participantCount: participants.length,
		stillVoting: participants.filter((u) => nextTitle(state, u) !== undefined)
			.length,
		matches: [],
		possibleMatches: [],
	}
	for (const titleId of state.deck) {
		const votes = participants.map(
			(u) => state.votes[u].find((v) => v.titleId === titleId)?.vote,
		)
		const yep = votes.filter((v) => v === "yep").length
		if (!yep || votes.includes("nope")) continue
		if (yep === participants.length) summary.matches.push(titleId)
		else
			summary.possibleMatches.push({
				titleId,
				waitingFor: participants.length - yep,
			})
	}
	return summary
}
export function shouldGrow(state: VotingState) {
	return (
		state.deck.length < MAX_DECK &&
		Object.values(state.votes).some(
			(v) => v.length > 0 && state.deck.length - v.length <= 5,
		)
	)
}
export type Action =
	| { kind: "join" | "leave"; user: string }
	| { kind: "vote"; user: string; titleId: string; vote: Vote }
	| { kind: "undo"; user: string; titleId: string }
/** Stale cards cannot skip a title, change a recorded vote, or undo twice. */
export function applyAction(state: VotingState, action: Action): VotingState {
	const votes = { ...state.votes }
	const ballot = [...(votes[action.user] ?? [])]
	if (
		(action.kind === "join" || action.kind === "vote") &&
		!ballot.length &&
		summarize(state).participantCount >= MAX_PARTICIPANTS
	)
		throw new Error("This session is full")
	if (action.kind === "leave") delete votes[action.user]
	else if (
		action.kind === "vote" &&
		nextTitle(state, action.user) === action.titleId
	) {
		votes[action.user] = [
			...ballot,
			{ titleId: action.titleId, vote: action.vote },
		]
	} else if (
		action.kind === "undo" &&
		ballot.at(-1)?.titleId === action.titleId
	) {
		ballot.pop()
		if (ballot.length) votes[action.user] = ballot
		else delete votes[action.user]
	}
	return { deck: state.deck, votes }
}
/** Append only; existing titles never move when the popularity catalog changes. */
export function growDeck(deck: string[], candidates: string[]) {
	return [
		...deck,
		...[...new Set(candidates)].filter((id) => !deck.includes(id)),
	].slice(0, Math.min(MAX_DECK, deck.length + DECK_STEP))
}
/** Lua objects have no stable property order; compare only this ordered public projection. */
export const summarySignature = (s: Summary) =>
	JSON.stringify([
		s.participantCount,
		s.stillVoting,
		s.matches,
		s.possibleMatches.map((p) => [p.titleId, p.waitingFor]),
	])

// What "On <service>" on the TV says and asks for: the screen a streaming key of the Remote and a service's tile
// on home open, with titles to watch on that one service. Pure, so the words and the rules stay in one place and
// have tests.
//
// The titles are Discover's own results for that one service, asked for as the Discover page asks:
// `/api/discover/results?services=<TMDB provider id>`. `services=<id>` is Discover's parameter; it turns On my
// services off and keeps the titles of that service. So the titles on the TV are the first ones on the page the
// Expand key opens (`/discover?services=<id>`), in the same order. The request returns Discover's first page of 40
// cards and the row pages through the first twelve.
//
// With the service screen's chunk: nothing here is in the start page's first view.
import type { TitleCard } from "~/server/title-cards.server"
import {
	brandName,
	getShorterProviderLabel,
} from "../../../utils/streaming-links.ts"
import type { TvService } from "./tv-home.ts"
import { SERVICE_TITLES } from "./tv-machine.ts"
import { titleKicker } from "./tv-title.ts"

/** The filter bar's query for one service, as the Discover page writes it for that one filter. */
export const serviceQuery = (id: number) => `services=${id}`

/** The titles the row pages through: the first twelve of Discover's results. */
export const serviceCards = (cards: readonly TitleCard[]) =>
	cards.slice(0, SERVICE_TITLES)

/**
 * The service on screen. One of the person's own two is known at once. Any other (a link names it) is named by
 * the titles, whose cards say where they stream; until they are there, and when none names it, nobody knows its
 * name.
 */
export function serviceOnScreen(
	id: number,
	own: readonly TvService[],
	cards: readonly Pick<TitleCard, "services">[],
): TvService | null {
	const mine = own.find((service) => service.id === id)
	if (mine) return mine
	for (const card of cards) {
		const named = card.services?.find((service) => service.id === id)
		if (named)
			return {
				id,
				name: brandName(getShorterProviderLabel(named.name)),
				logo_path: named.logo_path || null,
			}
	}
	return null
}

/**
 * What the top bar says beside the service's mark. On the desktop the screen's name and how many titles
 * Discover has for the service. On the phone there is room for a few words: a drawn mark says the service's
 * name itself, so the words say what the list is; any other service is named.
 */
export function serviceWords(on: {
	service: Pick<TvService, "name"> | null
	/** How many titles Discover has for the service; null until it has answered. */
	total: number | null
	phone: boolean
	/** The Remote has a drawn mark for the service: the mark says its name. */
	drawn: boolean
}): { name: string; crumb?: string } {
	const name = on.service ? `On ${on.service.name}` : "On this service"
	if (on.phone) return { name: on.drawn ? "To watch" : name }
	return {
		name,
		crumb: on.total
			? `${on.total.toLocaleString("en-US")} ${on.total === 1 ? "title" : "titles"}`
			: undefined,
	}
}

/** For a screen reader, when the screen changes: "On Netflix". */
export const serviceScreenName = (service: Pick<TvService, "name"> | null) =>
	serviceWords({ service, total: null, phone: false, drawn: false }).name

/**
 * A title's line of facts under its name: "2001 · Movie · 1h 56m · 82 score · 91% match". Where it streams is
 * the screen's own subject and is not repeated. A fact nobody knows is left out.
 */
export function serviceFacts(
	card: Pick<
		TitleCard,
		| "media_type"
		| "release_year"
		| "runtime"
		| "goodwatch_overall_score_normalized_percent"
		| "match"
	>,
): string {
	const score = card.goodwatch_overall_score_normalized_percent
	return [
		titleKicker(card),
		score == null ? null : `${Math.round(score)} score`,
		card.match == null ? null : `${card.match}% match`,
	]
		.filter(Boolean)
		.join(" · ")
}

/** What the list says in the titles' place: while they are on their way, and when there are none. */
export const serviceEmptyLine = (
	waiting: boolean,
	service: Pick<TvService, "name"> | null,
) =>
	waiting
		? "Titles are on their way."
		: service
			? `Nothing to watch on ${service.name} right now.`
			: "Nothing to watch here right now."

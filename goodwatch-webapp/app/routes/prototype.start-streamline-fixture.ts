// PROTOTYPE (start-streamline, prototype branch only): the offline harness's title cards for the start page's fixture
// search (ui/start/proto-streamline/fixture.ts). Reads the local fixture files the harness points at; never shipped.
import { readFileSync } from "node:fs"
import { json } from "@remix-run/node"

type Card = Record<string, unknown> & { key: number; poster_path?: string }

const read = (path: string | undefined) => {
	if (!path) return null
	try {
		return JSON.parse(readFileSync(path, "utf8"))
	} catch {
		return null
	}
}

export async function loader() {
	const cards = new Map<number, Card>()
	const add = (card: Card | undefined) => {
		if (card?.key && card.poster_path) cards.set(Number(card.key), card)
	}
	const member = read(
		process.env.START_STEP8_MEMBERS
			? `${process.env.START_STEP8_MEMBERS}/full.json`
			: undefined,
	)
	if (member) {
		for (const t of member.wishlist?.titles ?? []) add(t)
		for (const t of member.forYou?.titles ?? []) add(t)
		for (const t of member.continue?.titles ?? []) add(t.card)
		for (const t of member.hot?.titles ?? []) add(t.card)
	}
	const titles = read(process.env.START_PAGE_LOCAL_TITLES) ?? []
	for (const t of titles) {
		const key = (t.media_type === "movie" ? 1e12 : 2e12) + t.tmdb_id
		add({
			...t,
			key,
			backdrop_path: t.poster_path,
			services: [],
			reasons: [],
			match: 80,
			genres: [],
		})
	}
	return json({ cards: [...cards.values()] })
}

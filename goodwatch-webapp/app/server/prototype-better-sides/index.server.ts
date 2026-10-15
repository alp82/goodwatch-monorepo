// PROTOTYPE - throwaway (#657). Builds the better-sides prototype's view for one member and one variant: the engine's
// sides, the titles they name with the Taste page's display fields, and production's view for the reference variant.
// Lists of unseen titles inside a side are ordered by the member's personal order when it loads (sides group,
// personal order ranks); otherwise they keep the engine's order.
import { getCardServices, getServiceList } from "~/server/title-cards.server"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import { lovedTitles } from "~/server/taste-portrait/sides.server"
import { buildSides } from "~/server/taste-portrait/sides.server"
import { round1 } from "~/server/taste-portrait/person.server"
import type { PortraitTitle, SidesView } from "~/server/taste-portrait/view"
import type { ProtoView, VariantKey } from "~/ui/prototype-better-sides/model"
import { getUserIdFromRequest } from "~/utils/auth"
import { parseTitleKey, type TitleKey } from "~/utils/title-key"
import { buildAnchored, buildMoods, buildTighter, projection, type Built } from "./engine.server"
import { protoMembers } from "./members.server"
import { protoPerson } from "./person.server"

const CARD_REASONS = 2

export async function protoView(request: Request, variant: VariantKey, slot: string | null): Promise<ProtoView | null> {
	const startedAt = performance.now()
	const members = await protoMembers()
	const me = await getUserIdFromRequest({ request }).catch(() => null)
	const list = [...(me ? [{ slot: "me", label: "You (signed in)", userId: me, ratings: 0 }] : []), ...members]
	const member = list.find((m) => m.slot === slot) ?? list[0]
	const proto = await protoPerson(member.userId)
	if (!proto) return null
	const { person } = proto

	let built: Built | null = null
	let production: SidesView | null = null
	if (variant === "today") {
		const sides = buildSides(person)
		production = { ...sides, subject: { kind: "member", rated: person.rated.length, usual: round1(person.mu) }, titles: {}, services: [] }
	} else if (variant === "tighter" || variant === "map") built = buildTighter(person)
	else if (variant === "anchored") built = buildAnchored(person)
	else built = buildMoods(person)

	// Sides group, personal order ranks.
	if (built)
		for (const side of built.sides) {
			side.moreOfThis = proto.order(side.moreOfThis)
			for (const edge of side.edges) edge.suggestions = proto.order(edge.suggestions)
		}

	if (built && variant === "map") {
		const place = projection(person)
		// Side centers where the projection puts them, pushed apart until each side has room; every title keeps its
		// place relative to its side's center (scaled down), so close dots inside a side are still alike.
		const raw = built.sides.map((_, i) => {
			const dots = built!.memberKeys[i].flatMap((key) => {
				const z = person.zOf(key)
				return z ? [{ key, ...place(z) }] : []
			})
			const cx = dots.reduce((s, d) => s + d.x, 0) / Math.max(1, dots.length)
			const cy = dots.reduce((s, d) => s + d.y, 0) / Math.max(1, dots.length)
			return { dots, cx, cy }
		})
		const centers = raw.map((r) => ({ x: r.cx, y: r.cy }))
		const MIN = built.sides.length > 4 ? 0.36 : 0.42
		for (let it = 0; it < 200; it++) {
			for (let i = 0; i < centers.length; i++)
				for (let j = i + 1; j < centers.length; j++) {
					const dx = centers[j].x - centers[i].x || 0.01 * (j - i)
					const dy = centers[j].y - centers[i].y || 0.01
					const d = Math.hypot(dx, dy)
					if (d >= MIN) continue
					const push = (MIN - d) / 2
					centers[i].x -= (dx / d) * push
					centers[i].y -= (dy / d) * push
					centers[j].x += (dx / d) * push
					centers[j].y += (dy / d) * push
				}
			for (const c of centers) {
				c.x = Math.max(0.2, Math.min(0.8, c.x))
				c.y = Math.max(0.2, Math.min(0.8, c.y))
			}
		}
		const SCALE = 0.4
		const clamp = (x: number) => Math.max(0.04, Math.min(0.96, x))
		built.sides.forEach((side, i) => {
			const { dots, cx, cy } = raw[i]
			const moved = (p: { x: number; y: number }) => ({ x: clamp(centers[i].x + SCALE * (p.x - cx)), y: clamp(centers[i].y + SCALE * (p.y - cy)) })
			const placed = dots.map((d) => ({ key: d.key, ...moved(d) }))
			side.x = centers[i].x
			side.y = centers[i].y
			// The most typical titles first, so the page can show the first few as posters.
			side.dots = [...side.here.flatMap((k) => placed.filter((d) => d.key === k)), ...placed.filter((d) => !side.here.includes(d.key))]
			side.edges.forEach((edge, e) => {
				// Its titles' direction from the side, at the side's rim.
				const spots = edge.suggestions.slice(0, 4).flatMap((key) => {
					const z = person.zOf(key)
					return z ? [place(z)] : []
				})
				const ex = spots.reduce((s, d) => s + d.x, 0) / Math.max(1, spots.length)
				const ey = spots.reduce((s, d) => s + d.y, 0) / Math.max(1, spots.length)
				let angle = Math.atan2(ey - cy, ex - cx)
				if (Math.hypot(ex - cx, ey - cy) < 0.02) angle = Math.atan2(centers[i].y - 0.5, centers[i].x - 0.5)
				angle += (e - (side.edges.length - 1) / 2) * 0.5
				edge.x = clamp(centers[i].x + Math.cos(angle) * 0.17)
				edge.y = clamp(centers[i].y + Math.sin(angle) * 0.17)
			})
		})
	}

	// The titles the view names.
	const keys = new Set<TitleKey>()
	const add = (list: (TitleKey | null | undefined)[]) => {
		for (const key of list) if (key != null) keys.add(key)
	}
	if (production)
		for (const side of production.sides) {
			add([...side.here, side.image, ...side.moreOfThis])
			for (const edge of side.edges) add([...edge.rated, ...edge.suggestions, edge.image])
		}
	if (built)
		for (const side of built.sides) {
			add([...side.here, side.image, side.anchor, ...side.moreOfThis, ...(side.dots ?? []).slice(0, 40).map((d) => d.key)])
			for (const edge of side.edges) add([...edge.rated, ...edge.suggestions, edge.image])
		}
	const titles = await enrich(person, keys)
	// One per franchise in every row ("The Lord of the Rings: ..." three times reads as one title).
	const franchise = (key: TitleKey) =>
		(titles[key]?.title ?? String(key))
			.toLowerCase()
			.replace(/^(the|a|an) /, "")
			.split(/:| part | \d| - /)[0]
			.trim()
			.split(/\s+/)
			.slice(0, 3)
			.join(" ")
	const onePer = (list: TitleKey[]) => {
		const seen = new Set<string>()
		return list.filter((key) => {
			const f = franchise(key)
			if (seen.has(f)) return false
			seen.add(f)
			return true
		})
	}
	if (built)
		for (const side of built.sides) {
			side.here = onePer(side.here)
			side.moreOfThis = onePer(side.moreOfThis)
			for (const edge of side.edges) {
				edge.rated = onePer(edge.rated)
				edge.suggestions = onePer(edge.suggestions)
			}
		}
	const services = await getServiceList(person.input.services)
	if (production) production = { ...production, titles, services }
	const loved = lovedTitles(person).length
	return {
		variant,
		member: { slot: member.slot, label: member.label, ratings: member.ratings || person.rated.length, rated: person.rated.length, loved, usual: round1(person.mu) },
		members: list.map(({ slot, label, ratings }) => ({ slot, label, ratings })),
		production,
		sides: built?.sides ?? [],
		loose: built?.loose ?? 0,
		headline: built?.headline ?? null,
		notes: built?.notes ?? [],
		titles,
		services,
		hasServices: person.input.services.length > 0,
		personalOrder: { on: proto.personalOrder, note: proto.personalOrderNote },
		computedMs: Math.round(performance.now() - startedAt),
	}
}

export async function enrich(person: NonNullable<Awaited<ReturnType<typeof protoPerson>>>["person"], keys: Set<TitleKey>) {
	const { input, snapshot } = person
	const displays = await titleDisplays(keys)
	const unseen = [...keys].filter((key) => !input.scores.has(key))
	const matches = person.match(unseen)
	const unseenServices = new Map((await getCardServices(input.country, unseen, input.services)).map((services, i) => [unseen[i], services]))
	const titles: Record<string, PortraitTitle> = {}
	for (const key of keys) {
		const display = displays.get(key)
		if (!display) continue
		const { mediaType, tmdbId } = parseTitleKey(key)
		const mine = input.scores.get(key) ?? null
		const seen = mine !== null || input.chosen.has(key)
		const facts = snapshot.facts(key)
		titles[key] = {
			key,
			mediaType,
			anime: facts?.anime ?? false,
			tmdbId,
			...display,
			score: facts?.score ?? null,
			mine,
			match: seen ? null : (matches.get(key) ?? null),
			onMyServices: seen ? null : person.onMyServices(key),
			reasons: seen || matches.get(key) == null ? [] : input.taste.reasons(key, CARD_REASONS),
			services: seen ? null : (unseenServices.get(key) ?? null),
		}
	}
	return titles
}

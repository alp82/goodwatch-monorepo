// The profile header's data (routes/u.$handle.tsx, Settings and list pages for a member with a handle): the shell as
// the viewer sees it, the viewer type and the taste print when they may see the taste, and a few facts for the
// header's essence (ui/profile/header/facts.ts). The owner's shell stays the owner's while they view their profile as
// a visitor: the header cuts that view itself, facts included.
//
// Cost: the header runs on every profile, Settings and list page, so the facts come from caches only. The crowd
// agreement and the Taste tab's numbers are read from their summary caches and never computed here; a cold cache
// leaves those facts out until the Taste or Stats tab has built them. The facts are kept in process memory for
// FACTS_KEEP_MS per owner.
import type { ProfileShell } from "~/domain/profile"
import { seesPart } from "~/domain/profile"
import type { TasteStats } from "~/domain/profile-taste"
import type {
	EveryoneView,
	FingerprintView,
} from "~/server/taste-portrait/view"
import type { HeaderFact } from "~/ui/profile/header/facts"
import type { WhorlAttribute } from "~/ui/profile/taste/Whorl"
import { loadProfileShell } from "./page.server"
import { getProfilePortrait } from "./portrait.server"
import { readSummary } from "./summary-cache.server"
import { readCachedTasteStats } from "./taste-stats-cache.server"

const FACTS_KEEP_MS = 2 * 60_000
const MAX_KEPT = 200

export interface ProfileHeaderData {
	shell: ProfileShell
	/** The viewer type, when the viewer may see the taste and it is ready. */
	identity: string | null
	/** The taste print's attributes, under the same rule as `identity`. */
	print: WhorlAttribute[] | null
	/** The cached facts the viewer may see; the header adds the ones the shell holds. */
	facts: HeaderFact[]
}

export async function loadProfileHeader(
	request: Request,
	handle: string,
): Promise<
	| { header: ProfileHeaderData; ownerId: string; viewerId: string | null }
	| Response
> {
	const loaded = await loadProfileShell(request, handle, { asVisitor: false })
	if (loaded instanceof Response) return loaded
	const { shell, ownerId, viewerId } = loaded
	// The viewer type, the print and the facts are extras: the header shows without them when they fail.
	const [fingerprint, cached] = await Promise.all([
		seesPart(shell, "taste")
			? getProfilePortrait(ownerId, "fingerprint", {
					scores: seesPart(shell, "scores"),
					summary: true,
					request,
				}).catch((error) => {
					console.error("[profile] header: viewer type failed", error)
					return null
				})
			: null,
		cachedFacts(ownerId).catch((error) => {
			console.error("[profile] header: facts failed", error)
			return []
		}),
	])
	const ready = fingerprint?.status === "ready" ? fingerprint : null
	const facts = [...(ready ? pullFacts(ready) : []), ...cached].filter((f) =>
		f.parts.every((part) => seesPart(shell, part)),
	)
	return {
		header: {
			shell,
			identity: ready?.identity?.name ?? null,
			print:
				ready?.attributes.map((a) => ({
					key: a.key,
					label: a.label,
					family: a.family,
					edge: a.edge,
				})) ?? null,
			facts,
		},
		ownerId,
		viewerId,
	}
}

/** "drawn to the surreal": the strongest attribute the member seeks. */
function pullFacts(view: FingerprintView): HeaderFact[] {
	const top = view.attributes.find((a) => a.key === view.seek[0])
	return top
		? [{ key: "pull", lead: "drawn to", value: top.phrase, parts: ["taste"] }]
		: []
}

const kept = new Map<string, { at: number; facts: Promise<HeaderFact[]> }>()

/** The facts from the summary caches, for every viewer; the loader cuts them to what this one may see. */
function cachedFacts(ownerId: string): Promise<HeaderFact[]> {
	const hit = kept.get(ownerId)
	if (hit && Date.now() - hit.at < FACTS_KEEP_MS) return hit.facts
	const facts = readFacts(ownerId)
	kept.delete(ownerId)
	kept.set(ownerId, { at: Date.now(), facts })
	facts.catch(() => kept.delete(ownerId))
	for (const key of kept.keys()) {
		if (kept.size <= MAX_KEPT) break
		kept.delete(key)
	}
	return facts
}

async function readFacts(ownerId: string): Promise<HeaderFact[]> {
	const [everyone, stats] = await Promise.all([
		readSummary<EveryoneView>("portrait-everyone", ownerId),
		readCachedTasteStats(ownerId),
	])
	return [
		...crowdFacts(everyone?.value ?? null),
		...statsFacts(stats?.value ?? null),
	]
}

/** How often the member's scores go with the GoodWatch score, in the Vs everyone tab's three steps. */
function crowdFacts(view: EveryoneView | null): HeaderFact[] {
	if (view?.status !== "ready" || view.counted < 20) return []
	const often =
		view.agreement > 0.6
			? "mostly"
			: view.agreement > 0.35
				? "half the time"
				: "rarely"
	return [
		{
			key: "crowd",
			value: often,
			tail: "agrees with everyone",
			parts: ["scores"],
		},
	]
}

/** The top genre and the decade with the most titles, from the Taste tab's numbers. */
function statsFacts(stats: TasteStats | null): HeaderFact[] {
	if (!stats) return []
	const out: HeaderFact[] = []
	const genre = stats.genres[0]
	if (genre && genre.count >= 5)
		out.push({
			key: "genre",
			lead: "top genre",
			value: genre.name,
			parts: ["taste"],
		})
	const decade = [...stats.eras.decades].sort((a, b) => b.count - a.count)[0]
	if (decade && decade.count >= 5)
		out.push({
			key: "decade",
			lead: "top decade",
			value: `${decade.decade}s`,
			parts: ["taste"],
		})
	return out
}

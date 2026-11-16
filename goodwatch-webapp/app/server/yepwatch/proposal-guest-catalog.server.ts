import type { CountryServices } from "../availability-index.server.ts"
import { matchingIdeaIds } from "./proposal-redesign.ts"
import { rankDeck, RANKER_VERSION, type Ranked } from "./proposal-ranker.ts"
import {
	MAX_RANKED,
	passesFloor,
	qualityPriors,
	poolStepOf,
	poolQualityOf,
	unitFingerprint,
} from "./proposal-pool.ts"
import { roundFeedback, feedbackAdjustment, reorderTail } from "./proposal-feedback.ts"
import type { RoomTasteSource } from "./proposal-person-signal.ts"
import type { ProposalRoom, ProposalCatalog } from "./proposal-types.ts"
import type { TitleSnapshot } from "../title-snapshot/snapshot.server.ts"
import { VALID_FINGERPRINT_KEYS } from "../utils/fingerprint.ts"
import { rankedKey } from "./proposal-redesign.ts"
import { createContinuousCatalog } from "./continuous-catalog.ts"
import { goodwatchCatalog, goodwatchReads } from "./goodwatch.server.ts"
import { enrichContinuousCandidates, warmEnrichment } from "./continuous-presentation.server.ts"
import { proposalCatalog } from "./proposal-catalog.server.ts"
import type { ContinuousMembers } from "./continuous-members.server.ts"
import { sharedSavedContinuations } from "./continuous-saved-progress.ts"
import { titleKeySet } from "./ranked-keys-cache.ts"
import { roomExclusions } from "./proposal-member-exclusions.ts"
import { timed, timedSync } from "./server-timing.ts"
import type { CatalogReads } from "./catalog-adapter.ts"
// Each read of a deck build under its own mark (PreparedDecks logs a slow build with them).
const reads: CatalogReads = {
	...goodwatchReads,
	rankedKeys: (room, limit) => goodwatchReads.rankedKeys(room, limit),
	displays: (keys) => timed("displays", goodwatchReads.displays(keys)),
	availability: async (titles, screens, fresh) => {
		const offers = await timed("availability", goodwatchReads.availability(titles, screens, fresh))
		// Titles every screen can watch are the deck's likely cards: their extras are read meanwhile, for the page's
		// enrichment once the deck is chosen.
		if (!fresh)
			warmEnrichment(
				titles.filter((t) => {
					const rows = offers.get(t.key)
					return rows?.length === screens.length && rows.every((r) => r.state === "watchable")
				}),
			)
		return offers
	},
	// Summed over a batch's parallel reads: time spent reading, not elapsed time.
	episodes: (showId) => timed("episodes", goodwatchReads.episodes(showId)),
}
/** Full catalog/evidence reads, with optional remote saved progress; no issuer or local fixtures. */
export function guestProposalCatalog(
	members?: ContinuousMembers,
	profiles?: RoomTasteSource,
): ProposalCatalog {
	const exclusions = roomExclusions(members, profiles)
	let inputsChanged: (roomId: string) => void = () => {}
	const inputRevision = (room: ProposalRoom) =>
		JSON.stringify(
			room.participants
				.filter((p) => p.leftAt == null)
				.map((p) => [
					(p.member.state === "linked" ? members?.tasteStored(room, p.id)?.revision : null) ?? null,
					profiles?.stored(room, p)?.revision ?? null,
				]),
		)
	let snapshot: TitleSnapshot | null = null
	const indexes = new Map<string, CountryServices>()
	const plain = proposalCatalog(
		createContinuousCatalog(
			reads,
			goodwatchCatalog.metadata,
			members
				? {
						savedContinuations: async (room) =>
							sharedSavedContinuations(
								await Promise.all(room.participants.map((p) => members.progress(room, p.id))),
							),
					}
				: {},
		),
	)
	return {
		...plain,
		...exclusions,
		inputRevision,
		onInputsChanged(listener) {
			inputsChanged = listener
		},
		// Tastes are read and built here, in setup and in the background. A deck prepared before one landed was ranked
		// without it: it is prepared again, so Start still finds a deck for the room as it is.
		refreshExcludedKeys(room) {
			exclusions.refreshExcludedKeys(room)
			const before = inputRevision(room)
			const linked = room.participants.filter(
				(p) => p.leftAt == null && p.member.state === "linked",
			)
			void Promise.all([
				...linked.map((p) => members?.refreshTaste(room, p.id)),
				profiles?.prepare(room).catch(() => {}),
			])
				.then(() => profiles?.prepare(room))
				.then(() => {
					if (inputRevision(room) !== before) inputsChanged(room.id)
				})
				.catch(() => {})
		},
		ideaReadingSize(room, keys) {
			const index = indexes.get(room.screens[0]?.country ?? "")
			if (!index) return keys.length
			const wanted = new Set(
				room.screens.flatMap((s) => s.serviceIds).map((id) => index.indexOfService(id)),
			)
			return keys.filter((key) => {
				const row = index.rowOf(key)
				if (row < 0) return false
				for (let i = index.offsets[row]; i < index.offsets[row + 1]; i++)
					if (wanted.has(index.entries[i])) return true
				return false
			}).length
		},
		roundEnded: profiles?.roundEnded ? (room) => profiles.roundEnded!(room) : undefined,
		voteCommitted: profiles?.voteCommitted
			? async (room, participantId, candidateId, value, at) => {
					const person = room.participants.find((p) => p.id === participantId),
						card = room.candidates.find((c) => c.id === candidateId)
					if (person && card)
						await profiles.voteCommitted!(room, person, rankedKey(card), value, at)
				}
			: undefined,
		reorderTail(room) {
			if (!snapshot) return
			const feedback = roundFeedback(room, snapshot)
			const scores = new Map(
				room.outcome?.map((t) => [(room.dealtKeys ?? room.seenKeys)[t.position], t.score]) ?? [],
			)
			reorderTail(
				room,
				(key) =>
					(scores.get(`${key < 2e12 ? "movie" : "show"}_${key % 1e12}`) ?? 0) +
					feedbackAdjustment(snapshot!, key, feedback, unitFingerprint(snapshot!, key)),
			)
		},
		async page(room, options = {}) {
			const active = room.participants.filter((p) => p.leftAt == null)
			// Both sources prepare/calibrate outside Start's prepared-deck path. Start only uses stored exclusions.
			if (!options.preview) await timed("taste", Promise.all([profiles?.prepare(room)]))
			const sources = active.map((p) => ({
				member: p.member.state === "linked" ? members?.tasteStored(room, p.id) : null,
				profile: profiles?.stored(room, p),
			}))
			// A profile may supply a pre-blended member vector (item 6). Otherwise GoodWatch wins, then profile.
			const now = Date.now()
			const nopeProfiles = sources.flatMap((s) =>
				s.profile
					? [
							new Set(
								[...s.profile.nopes]
									.filter(([, at]) => at <= now && at >= now - 30 * 86400000)
									.map(([key]) => key),
							),
						]
					: [],
			)
			let people = sources.flatMap((s) => {
				const taste =
					s.profile?.taste?.source === "member"
						? s.profile.taste
						: (s.member?.taste ?? s.profile?.taste)
				return taste ? [taste] : []
			})
			let tasteSources = {
				member: people.filter((p) => p.source === "member").length,
				profile: people.filter((p) => p.source === "profile").length,
				none: active.length - people.length,
			}
			const wishlist = new Map<number, number>()
			for (const source of sources) {
				for (const key of source.member?.wishlist ?? [])
					wishlist.set(key, (wishlist.get(key) ?? 0) + 1)
			}
			const excluded = titleKeySet([
				...(await exclusions.excludedKeys(
					room,
					options.preview ? { stored: true, readMissing: false } : undefined,
				)),
				...room.seenKeys,
			])
			const ranked = new Map<number, Ranked>()
			let poolSize = 0,
				poolStep = 0
			const country = room.screens[0]?.country ?? "US"
			const [{ getTitleSnapshot }, { countryServices }, { maskOfMoods }] = await Promise.all([
				import("../title-snapshot/index.server"),
				import("~/server/availability-index.server"),
				import("../../domain/moods"),
			])
			snapshot = getTitleSnapshot()
			const current = snapshot
			people = people.filter((p) => p.snapshotVersion === current?.version && p.confidence > 0)
			tasteSources = {
				member: people.filter((p) => p.source === "member").length,
				profile: people.filter((p) => p.source === "profile").length,
				none: active.length - people.length,
			}
			const index = countryServices(country)
			if (index) {
				indexes.set(country, index)
				while (indexes.size > 12) indexes.delete(indexes.keys().next().value!)
			}
			const services = new Set(
				room.screens.flatMap((s) => s.serviceIds).map((id) => index?.indexOfService(id)),
			)
			const carried = (key: number) => {
				if (!index) return null
				const row = index.rowOf(key),
					result = new Set<number>()
				if (row >= 0)
					for (let i = index.offsets[row]; i < index.offsets[row + 1]; i++)
						result.add(index.entries[i])
				return result
			}
			const ideas = (room.ideas ?? [])
				.filter((i) => i.on)
				.map((i) => ({
					id: i.id,
					nickname:
						active.find((p) => p.id === i.authorId)?.nickname ??
						room.participants.find((p) => p.id === i.authorId)?.nickname ??
						"Someone",
					rankedKeys: i.rankedKeys,
					wants: i.attributes.filter((a) => a.kind === "want" && a.key).map((a) => a.key!),
					avoids: i.attributes.filter((a) => a.kind === "avoid" && a.key).map((a) => a.key!),
				}))
			// Preview enriches only its five selected cards; don't warm extras for every scanned title.
			const pageReads = options.preview
				? ({
						...reads,
						availability: (titles, screens, fresh) =>
							timed("availability", goodwatchReads.availability(titles, screens, fresh)),
					} satisfies CatalogReads)
				: reads
			const base = createContinuousCatalog(pageReads, goodwatchCatalog.metadata, {
				...(members
					? {
							savedContinuations: async (r) =>
								sharedSavedContinuations(
									await Promise.all(r.participants.map((p) => members.progress(r, p.id))),
								),
						}
					: {}),
				rank: async (_r, base, limit) => {
					if (!current) return base.filter((k) => !excluded.has(k))
					const moodMask = maskOfMoods(room.constraints.moods as Parameters<typeof maskOfMoods>[0])
					poolStep = poolStepOf(base)
					const eligible = (key: number) => {
						const row = current.rowOf(key),
							kind = key < 2e12 ? "movie" : "show_start"
						const on = carried(key)
						return (
							row >= 0 &&
							room.constraints.kinds.includes(kind) &&
							(!moodMask || (current.columns.moods[row] & moodMask) !== 0) &&
							passesFloor(current, key, poolStep, true) &&
							(!on || [...on].some((id) => services.has(id)))
						)
					}
					// Idea titles first, each idea's best in turn, at most half the ranker's budget: the ranker scores the first
					// MAX_RANKED keys of the pool (the base pool is ordered by quality), and an idea's own titles, let in one
					// floor step lower, would otherwise be the ones cut from a large pool.
					const lanes = ideas.map((i) => i.rankedKeys.filter(eligible)),
						ideaKeys = new Set<number>()
					for (
						let at = 0;
						ideaKeys.size < MAX_RANKED / 2 && lanes.some((lane) => at < lane.length);
						at++
					)
						for (const lane of lanes) if (at < lane.length) ideaKeys.add(lane[at])
					const pool = [...new Set([...ideaKeys, ...base])]
					const known = poolQualityOf(base)
					const quality =
						known && [...ideaKeys].every((key) => known.has(key))
							? known
							: timedSync("intent", () => qualityPriors(current, pool))
					poolSize = pool.length
					const shared = new Map<number, string>()
					const picked = active.filter((p) => p.serviceIds?.length)
					if (index && picked.length) {
						const common = [...services].filter(
							(id): id is number =>
								id !== undefined &&
								id >= 0 &&
								picked.every((p) =>
									p.serviceIds!.some((service) => index.indexOfService(service) === id),
								),
						)
						const names = new Map(
							(await goodwatchCatalog.metadata(country)).services.map((s) => [s.id, s.name]),
						)
						for (const key of pool) {
							const on = carried(key)
							const service = common.find((id) => on?.has(id))
							if (service !== undefined)
								shared.set(key, names.get(index.services[service]) ?? "your service")
						}
					}
					const result = timedSync("rank", () =>
						rankDeck(
							{
								pool,
								snapshot: current,
								people,
								nopeProfiles,
								ideas,
								wishlist,
								sharedServiceKeys: shared,
								excluded,
								seed: room.id,
								peopleCount: active.length,
								refill: room.phase === "choosing",
								quality,
								fingerprintKeys: VALID_FINGERPRINT_KEYS,
								feedback: roundFeedback(room, current),
							},
							limit ?? 3000,
						),
					)
					for (const r of result) ranked.set(r.key, r)
					return result.map((r) => r.key)
				},
			})
			const page = await proposalCatalog(base).page(room, options)
			const attributed = page.candidates.map((c) => ({
				...c,
				ideaIds: matchingIdeaIds(room, c),
				reason: ranked.get(rankedKey(c))?.reason ?? null,
			}))
			const enriched = await timed("enrich", enrichContinuousCandidates(attributed, country))
			const candidates = attributed.map((c, i) => ({ ...c, ...enriched[i] }))
			const ranking = Object.fromEntries(
				candidates.flatMap((c) => {
					const r = ranked.get(rankedKey(c))
					return r ? [[c.id, r]] : []
				}),
			)
			const median = (values: number[]) => {
				values.sort((a, b) => a - b)
				return values.length ? values[Math.floor(values.length / 2)] : null
			}
			const diagnostics = {
				rankerVersion: RANKER_VERSION,
				poolSize,
				poolStep,
				medianScore: median(
					candidates.flatMap((c) => (c.goodwatchScore == null ? [] : [c.goodwatchScore])),
				),
				medianVotes: median(
					candidates.flatMap((c) => {
						const row = current?.rowOf(rankedKey(c))
						return row != null && row >= 0 ? [current!.columns.votes[row]] : []
					}),
				),
				tasteShare: candidates.length
					? Object.values(ranking).filter((r) => r.parts.taste > 0).length / candidates.length
					: 0,
				reasons: Object.fromEntries(
					[...new Set(candidates.map((c) => c.reason?.code))]
						.filter(Boolean)
						.map((code) => [code, candidates.filter((c) => c.reason?.code === code).length]),
				),
			}
			return {
				...page,
				candidates,
				ranking,
				tasteSources,
				diagnostics,
				inputRevision: JSON.stringify(
					sources.map((s) => [s.member?.revision ?? null, s.profile?.revision ?? null]),
				),
			}
		},
	}
}

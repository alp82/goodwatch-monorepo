import type { EpisodeIdentity } from "../../../packages/yepwatch-contracts/continuous.ts";
import { createDeckAdapter, type CatalogReads } from "./catalog-adapter.ts";
import type { CatalogPort, Room } from "./types.ts";
import {
	CONTINUOUS_LIMITS as L,
	type ContinuousCatalog,
	type ContinuousRoom,
} from "./continuous-types.ts";
import { RoomError } from "./errors.ts";
/** Structural adapter only; existing GoodWatch filters/evidence/episode rules remain authoritative. */
export function catalogRoom(room: ContinuousRoom): Room {
	return {
		format: 1,
		id: room.id,
		revision: room.revision,
		expiresAt: room.expiresAt,
		hostId: room.hostId,
		inviteHash: room.inviteHash,
		phase: "setup",
		rosterVersion: room.rosterVersion,
		contextVersion: room.contextVersion,
		roundVersion: 0,
		participants: room.participants.map((p) => ({
			...p,
			progress: [],
			complete: false,
			preference: null,
			consent: null,
			admissionCommand: "",
		})),
		screens: room.screens,
		constraints: room.constraints,
		episodeProposals: [],
		round: null,
		candidates: room.candidates,
		shortlist: null,
		shortlistVersion: 0,
		proposalVersion: 0,
		proposedId: null,
		decision: null,
		tickets: [],
	};
}
export function createContinuousCatalog(
	reads: CatalogReads,
	metadata: CatalogPort["metadata"],
	options: {
		rank?: (room: ContinuousRoom, keys: number[]) => Promise<number[]>;
		savedContinuations?: (
			room: ContinuousRoom,
		) => Promise<ReadonlyMap<number, EpisodeIdentity>>;
	} = {},
): ContinuousCatalog {
	return {
		metadata,
		async page(room) {
			const seen = new Set(room.seenKeys);
			let complete = false;
			const saved = room.constraints.kinds.includes("show_continue")
				? await options.savedContinuations?.(room)
				: undefined;
			if (room.constraints.kinds.includes("show_continue") && !saved)
				throw new RoomError(
					"member_required",
					"Sign in with GoodWatch saved progress",
					403,
				);
			const adapter = createDeckAdapter(
				{
					...reads,
					rankedKeys: async (old) => {
						const base = await reads.rankedKeys(old);
						const ranked = options.rank ? await options.rank(room, base) : base;
						const continued = saved
							? [...saved.keys()]
									.map((id) => 2_000_000_000_000 + id)
									.filter((key) => ranked.includes(key))
							: [];
						return [...new Set([...continued, ...ranked])].filter(
							(key) =>
								!seen.has(
									`${key >= 2_000_000_000_000 ? "show" : "movie"}_${key % 1_000_000_000_000}`,
								),
						);
					},
				},
				{
					limit: Math.min(
						L.page,
						L.active - room.candidates.length,
						L.seen - room.seenKeys.length,
					),
					onComplete: (value) => {
						complete = value;
					},
					savedContinuations: saved,
					excludeTitleKeys: seen,
				},
			);
			try {
				return {
					candidates: await adapter.candidates(catalogRoom(room)),
					exhausted: complete,
				};
			} catch (e) {
				if (e instanceof RoomError && e.code === "no_intersection")
					return { candidates: [], exhausted: true };
				throw e;
			}
		},
		async refresh(room) {
			const ids = new Set(room.participants.map((p) => p.screenId));
			const screens = room.screens.filter(
				(s) => ids.has(s.id) && s.confirmed && s.country && s.serviceIds.length,
			);
			const keys = room.candidates.map(
				(c) =>
					(c.identity.kind === "movie"
						? 1_000_000_000_000
						: 2_000_000_000_000) + c.identity.tmdbId,
			);
			try {
				const displays = await reads.displays(keys);
				const evidence = await reads.availability(
					[...displays.values()],
					screens,
					false,
				);
				return room.candidates.map((c, i) => ({
					...c,
					availability: evidence.get(keys[i]) ?? [],
				}));
			} catch {
				return room.candidates.map((c) => ({ ...c, availability: [] }));
			} // Unknown evidence removes matches; admission never invents a usable offer.
		},
		async recheck(room, candidate) {
			const saved =
				candidate.identity.kind === "show_continue"
					? await options.savedContinuations?.(room)
					: undefined;
			if (candidate.identity.kind === "show_continue" && !saved)
				throw new RoomError(
					"member_required",
					"Verified saved progress required",
					403,
				);
			return createDeckAdapter(reads, { savedContinuations: saved }).recheck(
				catalogRoom(room),
				candidate,
			);
		},
	};
}

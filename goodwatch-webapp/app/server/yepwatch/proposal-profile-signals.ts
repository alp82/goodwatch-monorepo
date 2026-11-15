import type { ContinuousMembers } from "./continuous-members.server.ts"
import type { PersonalSignals, RoomTasteSource } from "./proposal-person-signal.ts"
import type { TasteProfiles } from "./proposal-taste-profile.ts"
import type { ProposalParticipant, ProposalRoom } from "./proposal-types.ts"

const NO_KEYS: ReadonlySet<number> = new Set()

/**
 * Device taste profiles as the ranker's taste source (RoomTasteSource).
 *
 * `prepare` runs in a deck build (in setup, in the background): one batched profile read for whoever isn't held, then
 * each person's taste is built once per profile revision and snapshot. `stored` only looks up what is held, so the
 * ranker, the deck identity (ProposalCatalog.inputRevision) and Start's exclusions never read or calculate.
 *
 * Someone with a profile and no GoodWatch taste is ranked on their YepWatch answers (source "profile", confidence
 * from the answer count). A linked member whose GoodWatch taste is held keeps that vector with their YepWatch answers
 * blended in (profileTaste's bounded blend), counted once as source "member". A member without YepWatch answers gets
 * no taste here, so the catalog falls back to their GoodWatch taste unchanged.
 *
 * The answered titles count as seen (left out unless the person shows seen titles), "haven't seen" answers as the
 * unseen set. Profiles have no hidden titles or wishlist; explicit Nope history belongs to this profile.
 */
export function profileTasteSource(
	profiles: TasteProfiles,
	members?: Pick<ContinuousMembers, "tasteStored">
): RoomTasteSource {
	const profiled = (room: ProposalRoom) => room.participants.filter((p) => p.leftAt == null && p.profileId)
	const memberTaste = (room: ProposalRoom, p: ProposalParticipant) =>
		(p.member.state === "linked" ? members?.tasteStored(room, p.id)?.taste : null) ?? null
	/** One signals object per held taste: the catalog reads it several times a build. */
	const built = new WeakMap<object, PersonalSignals>()
	return {
		voteCommitted(_room, participant, key, value, at) {
			return participant.profileId ? profiles.recordVote(participant.profileId, key, value, at) : Promise.resolve()
		},
		async prepare(room) {
			const people = profiled(room)
			if (!people.length) return
			await profiles.signals(people.map((p) => p.profileId!))
			for (const p of people) {
				const own = await profiles.signal(p.profileId!)
				const member = memberTaste(room, p)
				if (member && own.seen.size) await profiles.signal(p.profileId!, member.vector)
			}
		},
		stored(room, participant) {
			const id = participant.profileId
			if (!id || participant.leftAt != null) return null
			const own = profiles.held(id)
			if (!own) return null
			const member = memberTaste(room, participant)
			const blend = member && own.seen.size ? profiles.held(id, member.vector) : null
			const from = blend ?? own
			const cached = built.get(from.quantiles ?? from.seen)
			const revision = `${own.revision}:${own.snapshotVersion}:${blend ? `blend:${member!.confidence}` : member ? "member" : "own"}`
			const nopes = profiles.nopesHeld(id)
			if (cached?.revision === revision && cached.nopes.size === nopes.size && [...nopes].every(([key, at]) => cached.nopes.get(key) === at)) return cached
			// A member's own taste already ranks them: their answers add to it only through the blend.
			const taste =
				from.vector && from.quantiles && (blend || !member)
					? {
							vector: from.vector,
							quantiles: from.quantiles,
							confidence: blend ? Math.min(1, member!.confidence + own.own) : own.confidence,
							unseen: own.unseen,
							source: blend ? ("member" as const) : ("profile" as const),
							snapshotVersion: from.snapshotVersion,
					  }
					: null
			const signals: PersonalSignals = { revision, taste, seen: own.seen, hidden: NO_KEYS, wishlist: NO_KEYS, nopes }
			built.set(from.quantiles ?? from.seen, signals)
			return signals
		},
	}
}

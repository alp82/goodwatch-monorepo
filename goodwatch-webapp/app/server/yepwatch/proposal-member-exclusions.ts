import type { ContinuousMembers } from "./continuous-members.server.ts"
import type { ExcludedKeysOptions, ProposalRoom } from "./proposal-types.ts"

/** Members whose seen titles a room leaves out: present, linked, and not showing what they've seen. */
const excluding = (room: ProposalRoom) =>
	room.participants.filter((p) => p.leftAt == null && p.member.state === "linked" && !p.showSeen)

/** A catalog's member exclusions (ProposalCatalog.excludedKeys and refreshExcludedKeys) from members' seen titles. */
export function memberExclusions(members: ContinuousMembers) {
	return {
		async excludedKeys(room: ProposalRoom, options?: ExcludedKeysOptions) {
			return (
				await Promise.all(
					excluding(room).map((p) => (options?.stored ? members.seenStored(room, p.id, { read: options.readMissing !== false }) : members.seenOrNone(room, p.id)))
				)
			).flat()
		},
		refreshExcludedKeys(room: ProposalRoom) {
			for (const p of excluding(room)) members.refreshSeen(room, p.id)
		},
	}
}

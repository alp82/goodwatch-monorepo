// The taste picker on Watch next and My movies (#677, decided in #659): the member's taste groups for it. The rule and
// the words are domain/taste-picker.ts, the numbers taste-picker-counts.ts.
//
// Taste groups are the Taste page's, as Discover shows them (discover-sides.server.ts, kept per member for 10
// minutes): a title is in a group by production's rule, its nearest group when at least 0.3 close and the group's
// name describes it. Guests and members with fewer than two groups pick among moods, themes, and styles only.
import { groupChoice } from "~/domain/taste-picker"
import {
	type MemberSides,
	memberSides,
	sideOf,
} from "~/server/discover-sides.server"
import type { Taste } from "~/server/taste/index.server"
import type { TitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { TitleKey } from "~/utils/title-key"
import {
	type PickerGroup,
	describeGroups,
	masksOf,
} from "./taste-picker-counts"

/** A member's taste groups for the picker, and the group of any title on their list. */
export interface TasteGroups {
	groups: PickerGroup[]
	/** The group a title is in (1 for the largest), or null. */
	groupOf: (key: TitleKey) => number | null
	/** A loved title of each group, for its picture when none of its titles is on the list. */
	lovedPicture: (number: number) => TitleKey | null
}

const describedGroups = new WeakMap<MemberSides, PickerGroup[]>()

/** The member's taste groups, or null for a guest or a member with fewer than two. */
export async function tasteGroupsFor(
	ctx: ViewerContext,
	taste: Taste,
	snapshot: TitleSnapshot,
): Promise<TasteGroups | null> {
	const member = await memberSides(ctx, taste, snapshot)
	if (!member) return null
	let groups = describedGroups.get(member)
	if (!groups) {
		groups = describeGroups(
			member.named.sides.map((group) =>
				group.members.flatMap((m) => masksOf(snapshot, m.key) ?? []),
			),
		).map((g, i) => ({
			...g,
			id: groupChoice(i + 1),
			name: member.sides[i].name ?? "",
		}))
		describedGroups.set(member, groups)
	}
	return {
		groups,
		groupOf: (key) => {
			const index = sideOf(member, key)
			return index === null ? null : index + 1
		},
		lovedPicture: (number) => member.sides[number - 1]?.here[0]?.key ?? null,
	}
}

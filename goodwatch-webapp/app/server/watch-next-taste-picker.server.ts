// The taste picker on Watch next and My movies (#677, decided in #659): the member's taste groups for it. The rule and
// the words are domain/taste-picker.ts, the numbers taste-picker-counts.ts.
//
// Taste groups are the Taste page's, as Discover shows them (discover-sides.server.ts, kept per member for 10
// minutes): a title is in a group by production's rule, its nearest group when at least 0.3 close and the group's
// name describes it. Guests and members with fewer than two groups pick among moods, themes, and styles only.
//
// - Close to your taste (#680): with a group picked, a title close to it (not in it) by the title page's rule (#672):
//   in a place or a step just past the group, or between it and another group, with the bars members read
//   (MEMBER_BARS). The groups' edges are built here, not read from the Taste page's view: the edges alone cost about
//   30 ms for the largest history (the full view about 400 ms with its reads), and they are the Taste page's own. They
//   are built on the first request with a group picked and kept with the groups.
// - Saved links: a group's key in the URL is the loved title closest to its center. It names the group that title is
//   in now, so a link keeps its group when the groups change size or order.
import {
	groupChoice,
	groupKeyOf,
	legacyGroupNumber,
	titleOfGroupKey,
} from "~/domain/taste-picker"
import {
	type MemberSides,
	memberSides,
	sideOf,
} from "~/server/discover-sides.server"
import { portraitInput } from "~/server/taste-portrait/index.server"
import { readPerson, titleZ } from "~/server/taste-portrait/person.server"
import {
	MEMBER_BARS,
	type SideEdges,
	closeSides,
	sideAnchor,
	sideEdges,
	sideOfAnchor,
} from "~/server/taste-portrait/sides.server"
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
	/** The groups a title is close to, not in (Close to your taste); the edges are built on first use. */
	closeTo: (key: TitleKey) => number[]
	/** The group a URL names by its key (or, in older links, its size order); null when it names none. */
	numberOf: (ref: string) => number | null
	/** A loved title of each group, for its picture when none of its titles is on the list. */
	lovedPicture: (number: number) => TitleKey | null
}

const describedGroups = new WeakMap<MemberSides, PickerGroup[]>()
const builtEdges = new WeakMap<
	MemberSides,
	{ hiddenKey: string; edges: SideEdges[] }
>()

/** The groups' edges, built once per member's groups and Not interested titles (the unseen titles they suggest from). */
function edgesOf(member: MemberSides, ctx: ViewerContext, taste: Taste) {
	const hiddenKey = [...ctx.hidden].sort((a, b) => a - b).join(",")
	const kept = builtEdges.get(member)
	if (kept?.hiddenKey === hiddenKey) return kept.edges
	const person = readPerson(
		member.snapshot,
		portraitInput("member", ctx, taste),
	)
	const edges = sideEdges(person, member.named)
	builtEdges.set(member, { hiddenKey, edges })
	return edges
}

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
			key: groupKeyOf(sideAnchor(member.named.sides[i])),
			name: member.sides[i].name ?? "",
		}))
		describedGroups.set(member, groups)
	}
	const count = groups.length
	return {
		groups,
		groupOf: (key) => {
			const index = sideOf(member, key)
			return index === null ? null : index + 1
		},
		closeTo: (key) => {
			const z = titleZ(member.snapshot, key)
			const facts = member.snapshot.facts(key)
			if (!z || !facts) return []
			const edges = edgesOf(member, ctx, taste)
			const inGroup = sideOf(member, key)
			return closeSides(member.named, edges, z, facts, MEMBER_BARS)
				.filter((index) => index !== inGroup)
				.map((index) => index + 1)
		},
		numberOf: (ref) => {
			const legacy = legacyGroupNumber(ref)
			if (legacy !== null) return legacy <= count ? legacy : null
			const key = titleOfGroupKey(ref)
			if (key === null) return null
			const z = titleZ(member.snapshot, key)
			const facts = member.snapshot.facts(key)
			const index = sideOfAnchor(
				member.named,
				key,
				z && facts ? { z, facts } : null,
			)
			return index === null ? null : index + 1
		},
		lovedPicture: (number) => member.sides[number - 1]?.here[0]?.key ?? null,
	}
}

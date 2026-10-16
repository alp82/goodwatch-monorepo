// PROTOTYPE - throwaway (#659). The member's taste inside the mood picker, as one way of choosing. Round 3:
// - beside: each group a tile among the moods, right after the mood it is mostly made of, in that mood's color.
// - inside: no group tiles; a mood the member's taste is mostly made of carries that taste's loved posters, and is
//   picked as that mood in your taste, with "In your taste" on the picked tile to widen it to the whole mood.
// Round 2's "moods" and round 3's "first" are gone (commit 9b0c01ea has them). Words come from label.ts; a
// group is told apart by the posters of titles the member loved, and by its trait name only with the names on. No
// color tells groups apart: beside a mood a group takes that mood's color, elsewhere none.
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { MAX_MOODS, MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { type MoodControl, pickedCount } from "~/ui/watch-next/MoodPicker"
import { backdropUrl, posterUrl } from "~/ui/watch-next/style"
import { useParam } from "./bits"
import { TASTE, groupTitle } from "./label"
import type { SwnGroup, SwnView } from "./model"

const groupOf = (view: SwnView, id: string | null | undefined) =>
	view.groups.find((g) => g.id === id) ?? null

/** For screen readers, and as the posters' tooltip: the loved titles a group is shown by. */
const lovedLine = (posters: SwnGroup["posters"]) =>
	`like ${posters.map((p) => p.title).join(", ")}, which you loved`
export const groupLabel = (view: SwnView, group: SwnGroup) =>
	view.names ? group.name : `${TASTE.in}, ${lovedLine(group.posters)}`

/** The mood a group takes its color from: the one it sits beside ("beside" only). */
const hueOf = (view: SwnView, group: SwnGroup) =>
	view.variant === "beside" && group.at ? MOOD_BY_KEY[group.at].hue : null

/** Picks or unpicks a group; a fourth pick (moods and groups together) is not taken. */
export function useToggleGroup(
	view: SwnView,
	moods: readonly MoodKey[],
	refuse?: () => void,
) {
	const set = useParam()
	return (id: string | null) => {
		if (id === null) return set({ like: null })
		const on = view.picked.includes(id)
		const like =
			(on ? view.picked.filter((g) => g !== id) : [...view.picked, id]).join(
				",",
			) || null
		if (on || moods.length + view.picked.length < MAX_MOODS) set({ like })
		else refuse?.()
	}
}

const POSTER_W = { xs: "w-4", sm: "w-6", md: "w-9" } as const

type Poster = SwnGroup["posters"][number]

/** Loved posters, fanned: how a group is told apart before the words test. */
export function Posters({
	posters,
	size = "sm",
	className = "",
}: { posters: Poster[]; size?: keyof typeof POSTER_W; className?: string }) {
	return (
		<span
			className={`inline-flex shrink-0 items-center ${className}`}
			title={posters.map((p) => p.title).join(", ")}
			aria-hidden
		>
			{posters.map((p, i) => (
				<img
					key={p.key}
					src={posterUrl(p.poster, "w92")}
					alt=""
					className={`${POSTER_W[size]} aspect-[2/3] rounded-[3px] object-cover shadow-md shadow-black/50 ring-1 ring-black/40 ${i ? (size === "md" ? "-ml-3" : "-ml-1.5") : ""}`}
				/>
			))}
		</span>
	)
}

// A group's picture: the backdrop of a title they loved, darkened like a mood's; washed in a mood's color beside it.
function GroupArt({
	path,
	hue,
	className = "",
}: { path: string | null; hue: string | null; className?: string }) {
	return (
		<span
			className={`absolute inset-0 -z-10 overflow-hidden bg-gray-800 ${className}`}
			aria-hidden
			style={hue ? { background: hue } : undefined}
		>
			{path && (
				<img
					src={backdropUrl(path, "w300")}
					alt=""
					loading="lazy"
					className="absolute inset-0 h-full w-full object-cover opacity-85"
				/>
			)}
			{hue ? (
				<span
					className="absolute inset-0"
					style={{
						background: `linear-gradient(90deg, ${hue}f0 0%, ${hue}a6 40%, ${hue}1f 100%)`,
					}}
				/>
			) : (
				<span className="absolute inset-0 bg-linear-to-r from-gray-950/90 via-gray-950/60 to-gray-950/5" />
			)}
			<span className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
		</span>
	)
}

/** The picked groups as the strip's picked-mood chips: posters, words, count, and a remove button. */
export function GroupChips({
	view,
	control,
}: { view: SwnView; control: MoodControl }) {
	const toggle = useToggleGroup(view, control.moods)
	return (
		<>
			{view.picked.map((id) => {
				const group = groupOf(view, id)
				if (!group) return null
				const hue = hueOf(view, group)
				return (
					<motion.span
						layout
						key={id}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className={`relative isolate inline-flex h-9 shrink-0 ${view.names ? "max-w-[16rem]" : ""} items-center overflow-hidden rounded-xl text-sm font-bold text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgba(0,0,0,.6)]`}
						style={hue ? { boxShadow: `0 4px 18px -6px ${hue}` } : undefined}
						data-group-chip={id}
					>
						<GroupArt path={group.backdrop} hue={hue} />
						<button
							type="button"
							data-moodbutton
							aria-haspopup="dialog"
							aria-expanded={control.open}
							aria-label={groupLabel(view, group)}
							onClick={() => control.setOpen(!control.open)}
							className="inline-flex h-full min-w-0 cursor-pointer items-center gap-2 pl-1.5 pr-1"
						>
							<Posters posters={group.posters} size="xs" />
							<span className={view.names ? "truncate" : "whitespace-nowrap"}>
								{groupTitle(group, view.names)}
							</span>
							<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">
								{group.count}
							</span>
						</button>
						<button
							type="button"
							aria-label={`Remove ${groupLabel(view, group)}`}
							onClick={() => toggle(id)}
							className="mr-1.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-black/25 hover:bg-black/50"
						>
							<XMarkIcon className="h-3.5 w-3.5" />
						</button>
					</motion.span>
				)
			})}
		</>
	)
}

function Tick({ on }: { on: boolean }) {
	return (
		<span
			className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`}
			aria-hidden
		>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

/** One group as a mood tile: its posters (or trait name), "In your taste", and its count. */
function GroupTile({
	view,
	control,
	group,
	dense,
}: { view: SwnView; control: MoodControl; group: SwnGroup; dense: boolean }) {
	const toggle = useToggleGroup(view, control.moods, control.groups?.refuse)
	const on = view.picked.includes(group.id)
	const full = !on && pickedCount(control) >= MAX_MOODS
	const count = `${group.count} ${control.countScope}`
	const hue = hueOf(view, group)
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a poster tile that acts as a checkbox, as the moods'
			role="checkbox"
			aria-checked={on}
			aria-disabled={full || undefined}
			aria-label={`${groupLabel(view, group)}. ${count}.`}
			data-group={group.id}
			onClick={() => toggle(group.id)}
			whileTap={{ scale: full ? 1 : 0.97 }}
			className={`group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dense ? "h-[4.75rem]" : "h-[6.5rem] md:h-28"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${full ? "opacity-40" : ""}`}
			style={{ boxShadow: on && hue ? `0 8px 28px -8px ${hue}` : undefined }}
		>
			<GroupArt
				path={group.backdrop}
				hue={hue}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				{view.names ? (
					<span className="line-clamp-2 text-[15px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
						{group.name}
					</span>
				) : (
					<Posters posters={group.posters} size={dense ? "xs" : "md"} />
				)}
				<Tick on={on} />
			</span>
			<span className="block [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{(!dense || !view.names) && (
					<span className="block truncate text-xs font-semibold leading-snug text-white">
						{TASTE.in}
					</span>
				)}
				<span className="mt-0.5 block text-[11px] font-semibold tabular-nums text-white/75">
					{count}
				</span>
			</span>
		</motion.button>
	)
}

/** "Beside its moods": the groups that sit after a mood (the ones with no mood after the last). */
export function GroupsAfter({
	view,
	control,
	mood,
	dense,
}: { view: SwnView; control: MoodControl; mood: MoodKey; dense: boolean }) {
	const last = mood === "growing"
	return (
		<>
			{view.groups
				.filter((g) => g.at === mood || (last && !g.at))
				.map((group) => (
					<GroupTile
						key={group.id}
						view={view}
						control={control}
						group={group}
						dense={dense}
					/>
				))}
		</>
	)
}

/** The phone's Moods button with groups picked: the first pick and "+n". */
export function groupsShort(view: SwnView, moodNames: string[]): string | null {
	if (!view.picked.length) return null
	const names = [
		...moodNames,
		...view.picked.map((id) =>
			view.names ? (groupOf(view, id)?.name ?? "") : TASTE.heading,
		),
	]
	return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
}

// ---------- "Inside the moods" ----------

/** A mood's taste: its groups, their loved posters (up to three, from each group in turn), and how many titles. */
export function tasteOf(view: SwnView, mood: MoodKey) {
	const t = view.rule === "inside" ? view.tasteMoods[mood] : undefined
	if (!t) return null
	const groups = t.groups.flatMap((id) => groupOf(view, id) ?? [])
	const posters: Poster[] = []
	for (let i = 0; i < 3; i++)
		for (const g of groups)
			if (g.posters[i] && posters.length < 3) posters.push(g.posters[i])
	const words = view.names ? groups.map((g) => g.name).join(" or ") : TASTE.in
	return {
		groups,
		posters,
		count: t.count,
		words,
		narrowed: view.data.moods.includes(mood) && !view.wide.includes(mood),
		/** Every title of the mood is in your taste: narrowing changes nothing. */
		same: t.count === view.data.moodCounts[mood],
	}
}

/** Widens a picked mood to the whole mood, or narrows it back to your taste. */
function useToggleWide(view: SwnView) {
	const set = useParam()
	return (mood: MoodKey) => {
		const wide = view.wide.includes(mood)
			? view.wide.filter((m) => m !== mood)
			: [...view.wide, mood]
		set({ wide: wide.join(",") || null })
	}
}

/**
 * Inside a mood tile the member's taste is mostly made of: the taste's loved posters and "12 of 30 in your taste".
 * Picked, the line makes room for the "In your taste" switch over it.
 */
export function InsideFoot({
	view,
	control,
	mood,
	dense,
}: { view: SwnView; control: MoodControl; mood: MoodKey; dense: boolean }) {
	const t = tasteOf(view, mood)
	if (!t) return null
	if (control.moods.includes(mood) && !t.same)
		return (
			<span className={`mt-1 block ${dense ? "h-4" : "h-6"}`} aria-hidden />
		)
	return (
		<span className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold tabular-nums text-white/85">
			<Posters posters={dense ? t.posters.slice(0, 2) : t.posters} size="xs" />
			<span className={dense ? "truncate tracking-tight" : "truncate"}>
				{t.count} of {control.counts[mood]}{" "}
				{view.names ? `in ${t.words.toLowerCase()}` : TASTE.inline}
			</span>
		</span>
	)
}

/** On a picked mood tile that carries your taste: "In your taste" as a switch (on: the mood in your taste; off: all of it). */
export function InsideAction({
	view,
	control,
	mood,
	dense,
}: { view: SwnView; control: MoodControl; mood: MoodKey; dense: boolean }) {
	const toggle = useToggleWide(view)
	const t = tasteOf(view, mood)
	// Nothing to widen when every title of the mood is in your taste.
	if (!t || !control.moods.includes(mood) || t.same) return null
	const { name } = MOOD_BY_KEY[mood]
	return (
		<span
			className={`pointer-events-none absolute flex items-center justify-between gap-2 ${dense ? "inset-x-2 bottom-2" : "inset-x-2.5 bottom-2.5"}`}
		>
			<button
				type="button"
				role="switch"
				aria-checked={t.narrowed}
				aria-label={`${name}, ${view.names ? `in ${t.words}` : `${TASTE.inline}, ${lovedLine(t.posters)}`}`}
				onClick={() => toggle(mood)}
				className={`pointer-events-auto inline-flex min-w-0 ${dense ? "h-5" : "h-6"} cursor-pointer items-center gap-1.5 rounded-full pl-1 pr-2 text-[11px] font-bold ring-1 transition-colors ${t.narrowed ? "bg-white text-black ring-white" : "bg-black/35 text-white/85 ring-white/40 hover:bg-black/50"}`}
			>
				{dense ? (
					<span
						className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${t.narrowed ? "bg-black text-white" : "ring-1 ring-white/60"}`}
						aria-hidden
					>
						{t.narrowed && <CheckIcon className="h-3 w-3" />}
					</span>
				) : (
					<Posters
						posters={t.posters}
						size="xs"
						className={t.narrowed ? "" : "opacity-70"}
					/>
				)}
				<span className="truncate">{view.names ? t.words : TASTE.in}</span>
			</button>
			<span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{t.narrowed ? t.count : control.counts[mood]}
			</span>
		</span>
	)
}

/** A picked mood's chip in your taste: the taste's posters before its name, and the narrowed count. */
export function insideChip(view: SwnView, mood: MoodKey) {
	const t = tasteOf(view, mood)
	if (!t?.narrowed) return null
	return { mark: <Posters posters={t.posters} size="xs" />, count: t.count }
}

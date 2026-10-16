// PROTOTYPE - throwaway (#659). The groups of titles a member loves, inside Watch next's own controls: as chips and
// tiles in the mood picker (variants "moods" and "because"), as one more choice next to How long? (variant "filter"),
// and as a quiet line under a pick (variant "because"). Every group is worded in label.ts; no colors tell them apart.
import { CheckIcon, ChevronDownIcon, HeartIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import type React from "react"
import { MAX_MOODS, type MoodKey } from "~/domain/moods"
import type { WatchNextTitle } from "~/server/watch-next.server"
import { type MoodControl, pickedCount } from "~/ui/watch-next/MoodPicker"
import { backdropUrl } from "~/ui/watch-next/style"
import { useParam } from "./bits"
import type { SwnGroup, SwnView } from "./model"

const groupOf = (view: SwnView, id: string | null | undefined) => view.groups.find((g) => g.id === id) ?? null

/**
 * Picks or unpicks a group. Under "any" a fourth pick (moods and groups together) is not taken; with `replace` (the
 * Because line, which has no room to say so) it takes the last mood's place instead.
 */
export function useToggleGroup(view: SwnView, moods: readonly MoodKey[], replace = false) {
	const set = useParam()
	return (id: string | null) => {
		if (id === null) return set({ like: null })
		if (view.rule === "also") return set({ like: view.picked.includes(id) ? null : id })
		const on = view.picked.includes(id)
		const like = (on ? view.picked.filter((g) => g !== id) : [...view.picked, id]).join(",") || null
		if (on || moods.length + view.picked.length < MAX_MOODS) return set({ like })
		if (replace && moods.length) set({ like, moods: moods.slice(0, -1).join(",") || null })
	}
}

// A group's picture: the backdrop of a title they loved, darkened like a mood's but in no color of its own.
function GroupArt({ path, className = "" }: { path: string | null; className?: string }) {
	return (
		<span className={`absolute inset-0 -z-10 overflow-hidden bg-gray-800 ${className}`} aria-hidden>
			{path && <img src={backdropUrl(path, "w300")} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-90" />}
			<span className="absolute inset-0 bg-linear-to-r from-gray-950/90 via-gray-950/60 to-gray-950/5" />
			<span className="absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent" />
		</span>
	)
}

/** The picked groups as the strip's picked-mood chips: picture, label, count, and a remove button. */
export function GroupChips({ view, control, pinned }: { view: SwnView; control: MoodControl; pinned?: boolean }) {
	const toggle = useToggleGroup(view, control.moods)
	return (
		<>
			{view.picked.map((id) => {
				const group = groupOf(view, id)
				if (!group) return null
				return (
					<motion.span
						layout
						key={id}
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						className={`relative isolate inline-flex max-w-[18rem] shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgba(0,0,0,.6)] ${pinned ? "h-8" : "h-9"}`}
						data-group-chip={id}
					>
						<GroupArt path={group.backdrop} />
						<button
							type="button"
							data-moodbutton
							aria-haspopup="dialog"
							aria-expanded={control.open}
							onClick={() => control.setOpen(!control.open)}
							className="inline-flex h-full min-w-0 cursor-pointer items-center gap-2 pl-2.5 pr-1"
						>
							<span className="truncate">{group.words.like}</span>
							<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">{group.count}</span>
						</button>
						<button
							type="button"
							aria-label={`Remove ${group.words.like}`}
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
		<span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`} aria-hidden>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

/** "From what you love": the groups as tiles after the eleven moods, in the dropdown and the phone drawer. */
export function GroupTiles({ view, control, dense }: { view: SwnView; control: MoodControl; dense: boolean }) {
	const toggle = useToggleGroup(view, control.moods)
	if (!view.groups.length) return null
	return (
		<>
			<p className="col-span-full mt-2 px-0.5 text-sm text-gray-300">
				<span className="font-semibold text-white">From what you love</span>
				<span className="hidden sm:inline">. Titles close to ones you loved; they count toward the three.</span>
			</p>
			{view.groups.map((group) => {
				const on = view.picked.includes(group.id)
				const full = !on && pickedCount(control) >= MAX_MOODS
				const count = `${group.count} ${control.countScope}`
				return (
					<motion.button
						key={group.id}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a poster tile that acts as a checkbox, as the moods'
						role="checkbox"
						aria-checked={on}
						aria-disabled={full || undefined}
						aria-label={`${group.words.like}. ${count}.`}
						data-group={group.id}
						onClick={() => toggle(group.id)}
						whileTap={{ scale: full ? 1 : 0.97 }}
						className={`group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dense ? "h-[4.75rem]" : "h-[6.5rem] md:h-28"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${full ? "opacity-40" : ""}`}
					>
						<GroupArt path={group.backdrop} className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
						<span className="flex items-start justify-between gap-2">
							<span className="line-clamp-2 text-[15px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">{group.words.like}</span>
							<Tick on={on} />
						</span>
						<span className="block text-[11px] font-semibold tabular-nums text-white/75">{count}</span>
					</motion.button>
				)
			})}
		</>
	)
}

/** The phone's Moods button with groups picked: "Like Se7en and Zodiac", or the first pick and "+n". */
export function groupsShort(view: SwnView, moodNames: string[]): string | null {
	if (!view.picked.length) return null
	const names = [...moodNames, ...view.picked.map((id) => groupOf(view, id)?.words.like ?? "")]
	return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
}

/** Desktop: one more choice in the strip, the How long? select's twin. */
export function GroupSelect({ view }: { view: SwnView }) {
	const toggle = useToggleGroup(view, [])
	const id = view.picked[0] ?? ""
	return (
		<label
			className={`relative flex h-9 max-w-[15rem] shrink-0 items-center rounded-xl pl-3 text-sm font-bold ring-1 transition-colors focus-within:ring-2 focus-within:ring-amber-400 ${id ? "bg-amber-400/15 text-amber-200 ring-amber-400/50" : "bg-white/[0.06] text-gray-200 ring-white/10 hover:ring-white/20"}`}
		>
			<span className="sr-only">From what you love</span>
			<select
				value={id}
				onChange={(event) => toggle(event.target.value || null)}
				data-groups
				className="h-full w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-8 font-bold outline-none"
			>
				<option value="" className="bg-gray-900 text-gray-100">
					Like what you love? Any
				</option>
				{view.groups.map((group) => (
					<option key={group.id} value={group.id} className="bg-gray-900 text-gray-100">
						{group.words.like} ({group.count})
					</option>
				))}
			</select>
			<ChevronDownIcon className="pointer-events-none absolute right-2 h-4 w-4 opacity-70" aria-hidden />
		</label>
	)
}

/** Phones: the drawer behind the fifth button, How long?'s radio tiles with each group's picture. */
export function GroupDrawer({ view, scope }: { view: SwnView; scope: string }) {
	const toggle = useToggleGroup(view, [])
	const tile = (on: boolean) =>
		`relative isolate flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl px-3 text-left text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"}`
	return (
		<div className="grid gap-2" role="radiogroup" aria-label="From what you love">
			<button
				type="button"
				// biome-ignore lint/a11y/useSemanticElements: a tile list, as the time drawer's
				role="radio"
				aria-checked={!view.picked.length}
				onClick={() => toggle(null)}
				className={`${tile(!view.picked.length)} ${view.picked.length ? "bg-white/[0.05] text-white" : "bg-white text-black"}`}
			>
				Any
			</button>
			{view.groups.map((group) => {
				const on = view.picked.includes(group.id)
				return (
					<button
						key={group.id}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a tile list, as the time drawer's
						role="radio"
						aria-checked={on}
						onClick={() => toggle(group.id)}
						className={`${tile(on)} text-white [text-shadow:0_1px_6px_rgba(0,0,0,.6)]`}
					>
						<GroupArt path={group.backdrop} />
						<span className="min-w-0">
							<span className="line-clamp-2 block">{group.words.like}</span>
							<span className="block text-[11px] font-semibold text-white/75">
								{group.count} {scope}
							</span>
						</span>
						<Tick on={on} />
					</button>
				)
			})}
		</div>
	)
}

export const groupButtonIcon = (on: boolean) => <HeartIcon className={`h-4 w-4 ${on ? "text-amber-300" : "text-gray-400"}`} aria-hidden />

/**
 * "Because you loved Se7en and Zodiac": under the hero, each Then title, and the bigger posters. Tapping it narrows
 * to the group as a mood would (and again, lets go of it). Titles that fit no group get no line.
 */
export function BecauseLine({ view, title, where }: { view: SwnView; title: WatchNextTitle; where: "hero" | "then" | "poster" }) {
	const toggle = useToggleGroup(view, view.data.moods, true)
	const group = groupOf(view, view.groupOf[title.key])
	if (!group) return null
	const on = view.picked.includes(group.id)
	const act = (event: React.SyntheticEvent) => {
		// Then's titles are links: the line acts on its own.
		event.preventDefault()
		event.stopPropagation()
		toggle(group.id)
	}
	const cls =
		where === "hero" ? "mt-2 text-sm text-gray-200" : where === "then" ? "mt-0.5 text-[11px] text-gray-400" : "mt-1 px-1 text-xs text-gray-400"
	const look = `${cls} max-w-full cursor-pointer text-left underline decoration-dotted decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white/70 ${on ? "text-amber-200 decoration-amber-300/60" : ""}`
	const label = on ? `${group.words.because}. Showing titles like these; tap to show all.` : `${group.words.because}. Tap for more like these.`
	if (where === "then")
		return (
			// biome-ignore lint/a11y/useSemanticElements: inside Then's link; a prototype shortcut
			<span role="button" tabIndex={0} aria-pressed={on} aria-label={label} onClick={act} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && act(e)} className={`${look} line-clamp-2`}>
				{group.words.because}
			</span>
		)
	return (
		<button type="button" aria-pressed={on} aria-label={label} onClick={act} className={`${look} ${where === "poster" ? "line-clamp-2" : "block"}`}>
			{group.words.because}
		</button>
	)
}

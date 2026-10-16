// PROTOTYPE - throwaway (#659). The member's taste, inside Watch next's own controls: each group of titles they love
// as chips and tiles in the mood picker (variants "moods" and "because"), as one more choice next to How long?
// (variant "filter"), and as a quiet line under a pick (variant "because"). Words come from label.ts: "In your
// taste", "Close to your taste"; a group is told apart by the posters of titles the member loved, and by its trait
// name only with the names on. No colors tell groups apart.
import { CheckIcon, ChevronDownIcon, HeartIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { MAX_MOODS, type MoodKey } from "~/domain/moods"
import type { WatchNextTitle } from "~/server/watch-next.server"
import { type MoodControl, pickedCount } from "~/ui/watch-next/MoodPicker"
import { backdropUrl, posterUrl } from "~/ui/watch-next/style"
import { useParam } from "./bits"
import { TASTE, groupTitle } from "./label"
import type { SwnGroup, SwnView } from "./model"

const groupOf = (view: SwnView, id: string | null | undefined) => view.groups.find((g) => g.id === id) ?? null

/** For screen readers, and as the posters' tooltip: the loved titles a group is shown by. */
const lovedLine = (group: SwnGroup) => `like ${group.posters.map((p) => p.title).join(", ")}, which you loved`
export const groupLabel = (view: SwnView, group: SwnGroup) => (view.names ? group.name : `${TASTE.in}, ${lovedLine(group)}`)

/**
 * Picks or unpicks a group. Under "any" a fourth pick (moods and groups together) is not taken; with `replace` (the
 * line under a pick, which has no room to say so) it takes the last mood's place instead.
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

const POSTER_W = { xs: "w-4", sm: "w-6", md: "w-9" } as const

/** A group's loved posters, fanned: how it is told apart before the words test. */
export function Posters({ group, size = "sm", className = "" }: { group: SwnGroup; size?: keyof typeof POSTER_W; className?: string }) {
	return (
		<span className={`inline-flex shrink-0 items-center ${className}`} title={group.posters.map((p) => p.title).join(", ")} aria-hidden>
			{group.posters.map((p, i) => (
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

/** The picked groups as the strip's picked-mood chips: posters, words, count, and a remove button. */
export function GroupChips({ view, control }: { view: SwnView; control: MoodControl }) {
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
						className="relative isolate inline-flex h-9 max-w-[13rem] shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgba(0,0,0,.6)]"
						data-group-chip={id}
					>
						<GroupArt path={group.backdrop} />
						<button
							type="button"
							data-moodbutton
							aria-haspopup="dialog"
							aria-expanded={control.open}
							aria-label={groupLabel(view, group)}
							onClick={() => control.setOpen(!control.open)}
							className="inline-flex h-full min-w-0 cursor-pointer items-center gap-2 pl-1.5 pr-1"
						>
							<Posters group={group} size="xs" />
							<span className="truncate">{groupTitle(group, view.names)}</span>
							<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">{group.count}</span>
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
		<span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`} aria-hidden>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

/** "Your taste": the groups as tiles after the eleven moods, in the dropdown and the phone drawer. */
export function GroupTiles({ view, control, dense }: { view: SwnView; control: MoodControl; dense: boolean }) {
	const toggle = useToggleGroup(view, control.moods)
	if (!view.groups.length) return null
	return (
		<>
			<p className="col-span-full mt-2 px-0.5 text-sm text-gray-300">
				<span className="font-semibold text-white">{TASTE.heading}</span>
				<span className="hidden sm:inline">. Each is shown by titles you loved; they count toward the three.</span>
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
						aria-label={`${groupLabel(view, group)}. ${count}.`}
						data-group={group.id}
						onClick={() => toggle(group.id)}
						whileTap={{ scale: full ? 1 : 0.97 }}
						className={`group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${dense ? "h-[4.75rem]" : "h-[6.5rem] md:h-28"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${full ? "opacity-40" : ""}`}
					>
						<GroupArt path={group.backdrop} className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
						<span className="flex items-start justify-between gap-2">
							{view.names ? (
								<span className="line-clamp-2 text-[15px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">{group.name}</span>
							) : (
								<Posters group={group} size={dense ? "sm" : "md"} />
							)}
							<Tick on={on} />
						</span>
						<span className="block text-[11px] font-semibold tabular-nums text-white/75">{count}</span>
					</motion.button>
				)
			})}
		</>
	)
}

/** The phone's Moods button with groups picked: the first pick and "+n". */
export function groupsShort(view: SwnView, moodNames: string[]): string | null {
	if (!view.picked.length) return null
	const names = [...moodNames, ...view.picked.map((id) => (view.names ? (groupOf(view, id)?.name ?? "") : TASTE.heading))]
	return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`
}

/** One group as a row: posters, its words, and how many of its titles there are. */
function GroupRow({ view, group, scope }: { view: SwnView; group: SwnGroup; scope: string }) {
	return (
		<span className="flex min-w-0 items-center gap-3">
			<Posters group={group} size="md" />
			{/* With the names off every row would say "In your taste": the posters tell them apart, the head says it once. */}
			<span className="min-w-0">
				{view.names && <span className="line-clamp-2 text-sm font-bold">{group.name}</span>}
				<span className={`block ${view.names ? "text-[11px] text-white/70" : "text-sm text-white"} font-semibold`}>
					{group.count} {scope}
				</span>
			</span>
		</span>
	)
}

/** Desktop: one more choice in the strip, built like How long? but opening a short list with each group's posters. */
export function GroupMenu({ view, scope }: { view: SwnView; scope: string }) {
	const toggle = useToggleGroup(view, [])
	const [open, setOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	const picked = groupOf(view, view.picked[0])
	useEffect(() => {
		if (!open) return
		const outside = (event: PointerEvent) => !box.current?.contains(event.target as Node) && setOpen(false)
		const escape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false)
		window.addEventListener("pointerdown", outside)
		window.addEventListener("keydown", escape)
		return () => {
			window.removeEventListener("pointerdown", outside)
			window.removeEventListener("keydown", escape)
		}
	}, [open])
	const pick = (id: string | null) => {
		if (id === null || id !== picked?.id) toggle(id)
		setOpen(false)
	}
	const row = (on: boolean) =>
		`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white/10" : ""}`
	return (
		<div ref={box} className="relative shrink-0">
			<button
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-label={picked ? `${TASTE.heading}: ${groupLabel(view, picked)}` : `${TASTE.heading}: any`}
				onClick={() => setOpen(!open)}
				data-groups
				className={`flex h-9 max-w-[11rem] cursor-pointer items-center gap-2 rounded-xl text-sm font-bold ring-1 transition-colors ${picked ? "bg-amber-400/15 pl-1.5 pr-2 text-amber-200 ring-amber-400/50" : "bg-white/[0.06] pl-3 pr-2 text-gray-200 ring-white/10 hover:ring-white/20"}`}
			>
				{picked && <Posters group={picked} size="xs" />}
				<span className="truncate">{picked ? groupTitle(picked, view.names) : `${TASTE.heading}: Any`}</span>
				<ChevronDownIcon className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
			</button>
			{open && (
				<div role="listbox" aria-label={TASTE.heading} className="absolute right-0 top-11 z-50 w-80 rounded-2xl bg-gray-900/95 p-1.5 shadow-[0_24px_70px_-12px_rgba(0,0,0,.95)] ring-1 ring-white/12">
					<p className="px-2.5 pb-1 pt-1.5 text-xs text-gray-400">{TASTE.in}, shown by titles you loved</p>
					<button type="button" role="option" aria-selected={!picked} onClick={() => pick(null)} className={`${row(!picked)} min-h-11 text-sm font-bold`}>
						Any
						{!picked && <CheckIcon className="h-4 w-4" aria-hidden />}
					</button>
					{view.groups.map((group) => {
						const on = picked?.id === group.id
						return (
							<button key={group.id} type="button" role="option" aria-selected={on} aria-label={groupLabel(view, group)} onClick={() => pick(group.id)} className={row(on)}>
								<GroupRow view={view} group={group} scope={scope} />
								{on && <CheckIcon className="h-4 w-4 shrink-0" aria-hidden />}
							</button>
						)
					})}
				</div>
			)}
		</div>
	)
}

/** Phones: the drawer behind the fifth button, How long?'s radio tiles with each group's posters. */
export function GroupDrawer({ view, scope }: { view: SwnView; scope: string }) {
	const toggle = useToggleGroup(view, [])
	const tile = (on: boolean) =>
		`relative isolate flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl px-3 py-2 text-left text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"}`
	return (
		<div className="grid gap-2" role="radiogroup" aria-label={TASTE.heading}>
			<p className="text-xs text-gray-400">{TASTE.in}, shown by titles you loved</p>
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
						aria-label={groupLabel(view, group)}
						onClick={() => toggle(group.id)}
						className={`${tile(on)} text-white [text-shadow:0_1px_6px_rgba(0,0,0,.6)]`}
					>
						<GroupArt path={group.backdrop} />
						<GroupRow view={view} group={group} scope={scope} />
						<Tick on={on} />
					</button>
				)
			})}
		</div>
	)
}

/** The phone's fifth button: the picked group's posters, or a heart. */
export function groupButtonIcon(view: SwnView) {
	const picked = groupOf(view, view.picked[0])
	return picked ? <Posters group={picked} size="xs" className="h-4 overflow-hidden" /> : <HeartIcon className="h-4 w-4 text-gray-400" aria-hidden />
}

/**
 * "In your taste" or "Close to your taste", with the group's posters: under the hero, each Then title, and the bigger
 * posters. Tapping it narrows to that group as a mood would (and again, lets go of it). Titles near no group get none.
 */
export function TasteLine({ view, title, where }: { view: SwnView; title: WatchNextTitle; where: "hero" | "then" | "poster" }) {
	const toggle = useToggleGroup(view, view.data.moods, true)
	const place = view.placeOf[title.key]
	const group = groupOf(view, place?.id)
	if (!place || !group) return null
	const on = view.picked.includes(group.id)
	const act = (event: React.SyntheticEvent) => {
		// Then's titles are links: the line acts on its own.
		event.preventDefault()
		event.stopPropagation()
		toggle(group.id)
	}
	const words = place.how === "in" ? TASTE.in : TASTE.close
	const text = view.names ? `${words}: ${group.name}` : words
	const cls =
		where === "hero" ? "mt-2 gap-2 text-sm text-gray-200" : where === "then" ? "mt-1 gap-1.5 text-[11px] text-gray-400" : "mt-1 gap-1.5 px-1 text-xs text-gray-400"
	const look = `${cls} flex max-w-full cursor-pointer items-center text-left hover:text-white ${on ? "text-amber-200" : ""}`
	const label = `${view.names ? text : `${words}, ${lovedLine(group)}`}. ${on ? "Showing these; tap to show all." : "Tap for more like these."}`
	const inner = (
		<>
			<Posters group={group} size={where === "hero" ? "sm" : "xs"} />
			<span className={`min-w-0 underline decoration-dotted decoration-white/30 underline-offset-4 ${where === "hero" ? "" : "line-clamp-2"} ${on ? "decoration-amber-300/60" : ""}`}>{text}</span>
		</>
	)
	if (where === "then")
		return (
			// biome-ignore lint/a11y/useSemanticElements: inside Then's link; a prototype shortcut
			<span role="button" tabIndex={0} aria-pressed={on} aria-label={label} onClick={act} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && act(e)} className={look}>
				{inner}
			</span>
		)
	return (
		<button type="button" aria-pressed={on} aria-label={label} onClick={act} className={look}>
			{inner}
		</button>
	)
}

// PROTOTYPE - throwaway. Round 8 taste (d, e, f): Your taste without title boxes (Titles steers by titles now), as a
// home for the filters that read the member's taste. Real: Taste match (minMatch), Best match (sort=match), For you
// (foryou=0|1), the member's strongest moods, themes and styles as the real tags, Not seen yet. Simulated (kept in a
// page store, the grid doesn't follow): taste groups (Discover's `side=`), Outside your usual (low match), Wishlist
// and Seen before as list scopes. Guests see the same blocks faint, with one sign-up way in.
import { CheckIcon, EyeIcon, EyeSlashIcon, LockClosedIcon, UserPlusIcon } from "@heroicons/react/20/solid"
import { BookmarkIcon, FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import { type ReactNode, useSyncExternalStore } from "react"
import { MIN_MATCHES, type MinMatch } from "~/domain/filter-state"
import { compactCount } from "~/ui/filter-bar/labels"
import { Knob, SHELL, TAP } from "~/ui/filter-bar/motion"
import { Chip } from "~/ui/filter-bar/SheetControls"
import { ChoiceArt } from "~/ui/watch-next/TasteShelf"
import { useAuthHref } from "~/utils/auth-href"
import { type ProtoDiscover, TAGS, type Tag, tagId } from "../../../kit"
import type { Viewer } from "../../types"
import { POSTER } from "./parts"

// ---------------------------------------------------------------------------------------------------------------
// The simulated member's taste (names follow the group-name rule: two traits and a noun, at most 29 characters)

const tag = (id: string) => TAGS.find((t) => tagId(t) === id) as Tag

export interface Shot {
	title: string
	poster: string
	backdrop: string
}
const SHOTS = {
	severance: { title: "Severance", poster: "/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg", backdrop: "/ixgFmf1X59PUZam2qbAfskx2gQr.jpg" },
	arrival: { title: "Arrival", poster: "/pEzNVQfdzYDzVK0XqxERIw2x2se.jpg", backdrop: "/8MUZz7oPXQftFTslZpRP3CVMOoq.jpg" },
	dark: { title: "Dark", poster: "/wiiyc3m6HKaQhFBYeuM7ySCNQsG.jpg", backdrop: "/3jDXL4Xvj3AzDOF6UH1xeyHW8MH.jpg" },
	spirited: { title: "Spirited Away", poster: "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg", backdrop: "/m4TUa2ciEWSlk37rOsjiSIvZDXE.jpg" },
	howl: { title: "Howl's Moving Castle", poster: "/13kOl2v0nD2OLbVSHnHk8GUFEhO.jpg", backdrop: "/nv5wwZou159v5OC61i4ElR7OqyY.jpg" },
	bear: { title: "The Bear", poster: "/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg", backdrop: "/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg" },
	succession: { title: "Succession", poster: "/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg", backdrop: "/d87JXX3DLkRJMfm5StCmmnmhHuX.jpg" },
	parasite: { title: "Parasite", poster: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg", backdrop: "/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg" },
	pastLives: { title: "Past Lives", poster: "/k3waqVXSnvCZWfJYNtdamTgTtTA.jpg", backdrop: "/7HR38hMBl23lf38MAN63y4pKsHz.jpg" },
	interstellar: { title: "Interstellar", poster: "/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg", backdrop: "/8sNiAPPYU14PUepFNeSNGUTiHW.jpg" },
	dune: { title: "Dune", poster: "/v1tRXZ4JtD2Iv6fjkPvT4GiwslV.jpg", backdrop: "/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg" },
	perfectDays: { title: "Perfect Days", poster: "/tvUHVSTJV9ITON3oyHaWp7oaAc8.jpg", backdrop: "/7WBIaphEm09Z8WFBo85kWGxYYkk.jpg" },
} satisfies Record<string, Shot>

export interface TasteGroup {
	id: string
	name: string
	/** The words that set it apart (its colors). */
	words: Tag[]
	/** Loved titles that stand for it; the first one is its picture. */
	loved: Shot[]
	/** Share of a list that sits in it. */
	share: number
}

export const GROUPS: TasteGroup[] = [
	{ id: "g1", name: "Eerie, cerebral sci-fi", words: [tag("moods:mind"), tag("themes:future")], loved: [SHOTS.severance, SHOTS.arrival, SHOTS.dark], share: 0.07 },
	{ id: "g2", name: "Sharp, tense family drama", words: [tag("themes:family"), tag("moods:heavy")], loved: [SHOTS.bear, SHOTS.succession, SHOTS.parasite], share: 0.06 },
	{ id: "g3", name: "Gentle, magical animation", words: [tag("moods:worlds"), tag("styles:animated")], loved: [SHOTS.spirited, SHOTS.howl], share: 0.04 },
	{ id: "g4", name: "Quiet, tender romance", words: [tag("moods:romance"), tag("styles:slow")], loved: [SHOTS.pastLives], share: 0.03 },
]
/** Titles in a list that sit in no group (Discover's `side=none`). */
export const NO_GROUP_SHARE = 0.8

/** The words the member's taste carries most, with a picture each. */
export const STRONG: { tag: Tag; shot: Shot }[] = [
	{ tag: tag("moods:mind"), shot: SHOTS.dark },
	{ tag: tag("themes:future"), shot: SHOTS.interstellar },
	{ tag: tag("moods:worlds"), shot: SHOTS.dune },
	{ tag: tag("themes:family"), shot: SHOTS.succession },
	{ tag: tag("styles:slow"), shot: SHOTS.perfectDays },
	{ tag: tag("styles:animated"), shot: SHOTS.howl },
]

const MATCH_SHARE: Record<string, number> = { outside: 0.18, 0: 1, 70: 0.46, 80: 0.21, 90: 0.06 }
const WISHLIST = 38
const UNSEEN_SHARE = 0.985
const SEEN = 214
export const MAX_PICKS = 3

// ---------------------------------------------------------------------------------------------------------------
// What the grid doesn't follow yet, kept for the page's life

export type ListScope = "all" | "unseen" | "wishlist" | "seen"
interface Extras {
	groups: string[]
	outside: boolean
	list: "wishlist" | "seen" | null
}
let extras: Extras = { groups: [], outside: false, list: null }
const subs = new Set<() => void>()
const subscribe = (f: () => void) => {
	subs.add(f)
	return () => subs.delete(f)
}
const setExtras = (patch: Partial<Extras>) => {
	extras = { ...extras, ...patch }
	for (const f of subs) f()
}

export type MatchStep = MinMatch | "outside"
export const MATCH_STEPS: MatchStep[] = ["outside", ...(MIN_MATCHES as readonly MinMatch[])]
export const matchName = (v: MatchStep) => (v === "outside" ? "Outside your usual" : v ? `${v}%+` : "Any")

export function useTaste(d: ProtoDiscover, viewer: Viewer) {
	const member = viewer === "member"
	const x = useSyncExternalStore(subscribe, () => extras, () => extras)
	const [params] = useSearchParams()
	const total = d.total ?? 0
	const s = d.filters.state
	const plainSort = d.filters.searching ? "relevance" : "popular"

	const strongOn = STRONG.filter((w) => d.isOn(w.tag)).length
	const picks = x.groups.length + strongOn
	const full = picks >= MAX_PICKS

	const match: MatchStep = x.outside ? "outside" : s.minMatch
	const list: ListScope = x.list ?? (s.notSeenYet ? "unseen" : "all")
	const unseenCount = member ? (total ? Math.round(total * UNSEEN_SHARE) : null) : (d.counts?.optionCounts.notSeenYet?.on ?? null)

	return {
		member,
		total,
		picks,
		full,
		groups: {
			all: GROUPS,
			isOn: (g: TasteGroup) => x.groups.includes(g.id),
			toggle: (g: TasteGroup) =>
				setExtras({ groups: x.groups.includes(g.id) ? x.groups.filter((id) => id !== g.id) : [...x.groups, g.id].slice(-MAX_PICKS) }),
			count: (g: TasteGroup) => (total ? Math.max(1, Math.round(total * g.share)) : null),
			clear: () => setExtras({ groups: [] }),
		},
		words: {
			all: STRONG,
			isOn: (t: Tag) => d.isOn(t),
			toggle: (t: Tag) => d.toggle(t),
			count: (t: Tag) => d.countFor(t),
			clear: () => {
				for (const w of STRONG) if (d.isOn(w.tag)) d.toggle(w.tag)
			},
		},
		match: {
			value: match,
			set: (v: MatchStep) => {
				setExtras({ outside: v === "outside" })
				d.filters.set({ minMatch: v === "outside" ? 0 : v })
			},
			// The live counts are a guest's (no taste), so a member's are a plausible share of the list.
			count: (v: MatchStep) => (total ? Math.round(total * (MATCH_SHARE[String(v)] ?? 1)) : null),
			share: (v: MatchStep) => MATCH_SHARE[String(v)] ?? 1,
		},
		order: {
			best: d.filters.sort === "match",
			setBest: (on: boolean) => d.filters.setSort(on ? "match" : plainSort),
			forYou: params.get("foryou") !== "0",
			setForYou: (on: boolean) => d.filters.setSort(d.filters.sort, (p) => p.set("foryou", on ? "1" : "0")),
		},
		list: {
			value: list,
			set: (v: ListScope) => {
				setExtras({ list: v === "wishlist" || v === "seen" ? v : null })
				d.filters.set({ notSeenYet: v === "unseen" })
			},
			count: (v: ListScope): number | null =>
				v === "all" ? total || null : v === "unseen" ? unseenCount : !member ? null : Math.min(v === "wishlist" ? WISHLIST : SEEN, total || SEEN),
		},
		/** Everything this tab set, back to plain. */
		clearAll: () => {
			setExtras({ groups: [], outside: false, list: null })
			for (const w of STRONG) if (d.isOn(w.tag)) d.toggle(w.tag)
			d.filters.set({ minMatch: 0, notSeenYet: false })
		},
		any: picks > 0 || match !== 0 || list !== "all",
	}
}
export type Taste = ReturnType<typeof useTaste>

// ---------------------------------------------------------------------------------------------------------------
// Pieces

/** The app's sign-up chip (SignUpPrompt "chip" look). */
export function SignUpChip({ label = "Sign up" }: { label?: string }) {
	const authHref = useAuthHref()
	return (
		<Link
			rel="nofollow"
			to={authHref("sign-up")}
			className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-amber-500/15 px-3 text-xs font-bold text-amber-200 ring-1 ring-amber-500/40 outline-none transition-colors hover:bg-amber-500/25 focus-visible:ring-2 focus-visible:ring-amber-300"
		>
			<UserPlusIcon className="h-4 w-4 shrink-0" aria-hidden />
			{label}
		</Link>
	)
}

export function BlockHead({ children, note, locked, right }: { children: ReactNode; note?: ReactNode; locked?: boolean; right?: ReactNode }) {
	return (
		<div className="mb-2.5 flex min-h-8 items-center gap-2">
			<h4 className={`text-[14px] font-semibold ${locked ? "text-gray-400" : "text-gray-100"}`}>{children}</h4>
			{locked && <LockClosedIcon className="h-3.5 w-3.5 text-amber-500/70" aria-label="With an account" />}
			{note && <span className="truncate text-[12px] text-gray-500">{note}</span>}
			{right && <span className="ml-auto flex shrink-0 items-center gap-2">{right}</span>}
		</div>
	)
}

export function ClearLink({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			Clear
		</button>
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

/** A picture tile that acts as a checkbox, like Watch next's taste shelf. */
export function ArtTile({
	name,
	line,
	hues,
	path,
	on,
	dim,
	foot,
	onClick,
	className = "h-[88px]",
}: {
	name: string
	line?: string | null
	hues: string[]
	path: string | null
	on: boolean
	dim?: boolean
	foot: ReactNode
	onClick: () => void
	className?: string
}) {
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a picture tile that acts as a checkbox
			role="checkbox"
			aria-checked={on}
			aria-disabled={dim || undefined}
			onClick={() => !dim && onClick()}
			whileTap={{ scale: dim ? 1 : 0.97 }}
			className={`group relative isolate flex min-w-0 cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${dim ? "opacity-40" : ""}`}
			style={{ boxShadow: on ? `0 8px 28px -8px ${hues[0]}` : undefined }}
		>
			<ChoiceArt
				hues={hues}
				path={path}
				split={hues.length > 1}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				<span className="line-clamp-2 min-w-0 font-bold leading-tight text-[14px] [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">{name}</span>
				<Tick on={on} />
			</span>
			<span className="block min-w-0 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{line && <span className="line-clamp-1 text-xs leading-snug text-white/90">{line}</span>}
				<span className="mt-0.5 block truncate text-[11px] font-semibold tabular-nums text-white/75">{foot}</span>
			</span>
		</motion.button>
	)
}

/** A guest's stand-in tile: the shape, no taste. */
export function LockedTile({ className = "h-[88px]", i = 0 }: { className?: string; i?: number }) {
	return (
		<span aria-hidden className={`relative flex flex-col justify-between overflow-hidden rounded-xl bg-white/[0.035] p-2.5 ring-1 ring-white/[0.06] ${className}`}>
			<span className="h-3 rounded bg-white/[0.07]" style={{ width: `${62 - i * 9}%` }} />
			<span className="flex items-center gap-1.5">
				<FingerPrintIcon className="h-4 w-4 text-amber-500/30" />
				<span className="h-2 w-10 rounded bg-white/[0.05]" />
			</span>
		</span>
	)
}

export const groupHues = (g: TasteGroup) => g.words.map((w) => w.color)
export const groupLine = (g: TasteGroup) => g.words.map((w) => w.name).join(" · ")
const n = (v: number | null) => (v == null ? "" : compactCount(v))
export const titlesFoot = (v: number | null) => (v == null ? "" : `${n(v)} titles`)

/** A taste word as the sheet's calm chip with its hue and what it leaves. */
export function WordChip({ taste, t, dim }: { taste: Taste; t: Tag; dim?: boolean }) {
	return (
		<Chip
			o={{
				id: tagId(t),
				label: t.name,
				active: taste.words.isOn(t),
				count: taste.words.count(t),
				toggle: () => taste.words.toggle(t),
				disabled: dim && !taste.words.isOn(t),
				swatch: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />,
			}}
		/>
	)
}

/** A guest's stand-in chip. */
export function LockedChip({ w = 88 }: { w?: number }) {
	return <span aria-hidden className="h-8 shrink-0 rounded-full bg-white/[0.035] ring-1 ring-inset ring-white/[0.06]" style={{ width: w }} />
}

/** Taste match as an "and up" scale, with Outside your usual at the low end. Faint and inert for a guest. */
export function MatchSteps({ taste, compact = false, outside = true, phone = false }: { taste: Taste; compact?: boolean; outside?: boolean; phone?: boolean }) {
	const steps = outside ? MATCH_STEPS : MATCH_STEPS.filter((v) => v !== "outside")
	const value = taste.match.value
	const locked = !taste.member
	return (
		<div role="radiogroup" aria-label="Taste match" aria-disabled={locked || undefined} className={`grid gap-1.5 ${outside ? "grid-cols-[1.35fr_1fr_1fr_1fr_1fr]" : "grid-cols-4"}`}>
			{steps.map((v, i) => {
				const on = !locked && v === value
				const lit = !locked && typeof v === "number" && typeof value === "number" && value !== 0 && v >= value
				const low = v === "outside"
				const count = locked ? null : taste.match.count(v)
				return (
					<motion.button
						key={String(v)}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: an "and up" scale; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						disabled={locked}
						whileTap={locked ? undefined : TAP}
						onClick={() => taste.match.set(v)}
						className={`relative flex flex-col items-start justify-between overflow-hidden rounded-xl px-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${compact ? "h-12 py-1.5" : "h-14 py-2"} ${locked ? "cursor-default bg-white/[0.03]" : "cursor-pointer"} ${on ? (low ? "ring-2 ring-inset ring-sky-200" : "ring-2 ring-inset ring-amber-200") : ""} ${
							locked ? "" : lit ? (on ? "bg-amber-500/55" : "bg-amber-500/25") : on ? (low ? "bg-sky-500/35" : "bg-white/[0.1]") : "bg-white/[0.05] hover:bg-white/[0.09]"
						}`}
					>
						<span
							className={`font-bold leading-none ${low ? "text-[12px]" : `tabular-nums ${compact ? "text-[15px]" : "text-[16px]"}`} ${locked ? "text-gray-600" : lit || on ? "text-white" : "text-gray-300"}`}
						>
							{low ? (phone ? "Outside" : "Outside your usual") : matchName(v)}
						</span>
						<span className={`text-[11px] tabular-nums ${lit || on ? "text-white/80" : "text-gray-500"}`}>{count != null ? compactCount(count) : ""}</span>
						<span
							aria-hidden
							className={`absolute right-0 bottom-0 left-0 h-1 ${low ? "bg-sky-400" : "bg-amber-400"}`}
							style={{ opacity: v === 0 ? 0 : low ? (locked ? 0.12 : 0.45) : (locked ? 0.1 : 0.15) + (0.6 * (i - (outside ? 1 : 0))) / 3 }}
						/>
					</motion.button>
				)
			})}
		</div>
	)
}

/** The For you switch's look, without its explanation popover. */
export function TasteSwitch({
	label,
	on,
	onChange,
	locked,
	icon,
	tone = "amber",
	className = "",
}: {
	label: string
	on: boolean
	onChange: (on: boolean) => void
	locked?: boolean
	icon?: ReactNode
	tone?: "amber" | "blue"
	className?: string
}) {
	const lit = on && !locked
	const ring = tone === "amber" ? "bg-amber-500/[0.14] ring-1 ring-amber-500/45" : "bg-blue-500/[0.12] ring-1 ring-blue-400/40"
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={lit}
			disabled={locked}
			whileTap={locked ? undefined : TAP}
			onClick={() => onChange(!on)}
			className={`flex h-11 min-w-0 items-center gap-2 rounded-2xl px-3 text-[13px] font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				locked ? "cursor-default bg-white/[0.03] text-gray-600 ring-1 ring-white/[0.06]" : lit ? `cursor-pointer text-white ${ring}` : `cursor-pointer text-gray-400 hover:text-gray-200 ${SHELL}`
			} ${className}`}
		>
			{icon}
			<span className="min-w-0 flex-1 truncate text-left">{label}</span>
			<Knob on={lit} onClass={tone === "blue" ? "bg-blue-400" : undefined} />
		</motion.button>
	)
}

export const LIST_SCOPES: { id: ListScope; label: string }[] = [
	{ id: "all", label: "Everything" },
	{ id: "unseen", label: "Not seen yet" },
	{ id: "wishlist", label: "Your Wishlist" },
	{ id: "seen", label: "Seen before" },
]

export function ScopeIcon({ id, className = "h-4 w-4" }: { id: ListScope; className?: string }) {
	if (id === "unseen") return <EyeSlashIcon className={`${className} text-blue-400`} aria-hidden />
	if (id === "wishlist") return <BookmarkIcon className={`${className} text-amber-400`} aria-hidden />
	if (id === "seen") return <EyeIcon className={`${className} text-emerald-400`} aria-hidden />
	return <span aria-hidden className={`${className} rounded-full border border-white/25`} />
}

/** Which of your lists to look in, as radio rows. */
export function ScopeRows({ taste, rowClass = "h-11" }: { taste: Taste; rowClass?: string }) {
	return (
		<div role="radiogroup" aria-label="Your lists" className="flex flex-col gap-1">
			{LIST_SCOPES.map((o) => {
				const on = taste.list.value === o.id
				const c = taste.list.count(o.id)
				return (
					<motion.button
						key={o.id}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: rows that act as radios
						role="radio"
						aria-checked={on}
						whileTap={TAP}
						onClick={() => taste.list.set(o.id)}
						className={`flex items-center gap-3 rounded-xl px-3 text-[13px] cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${rowClass} ${on ? "bg-white/[0.1] font-semibold text-white ring-1 ring-inset ring-white/20" : "text-gray-300 hover:bg-white/[0.05]"}`}
					>
						<ScopeIcon id={o.id} />
						<span className="min-w-0 flex-1 truncate text-left">{o.label}</span>
						<span className="text-[12px] tabular-nums text-gray-500">{c != null ? compactCount(c) : ""}</span>
					</motion.button>
				)
			})}
		</div>
	)
}

/** Loved titles of a group as a small overlapping poster stack. */
export function PosterStack({ shots, h = 36 }: { shots: Shot[]; h?: number }) {
	const w = Math.round((h * 2) / 3)
	return (
		<span className="flex shrink-0 items-center" aria-hidden style={{ width: w + (2 * w) / 2 }}>
			{shots.slice(0, 3).map((s, i) => (
				<img
					key={s.title}
					src={`${POSTER}${s.poster}`}
					alt=""
					loading="lazy"
					className="rounded-[4px] object-cover ring-2 ring-gray-950"
					style={{ height: h, width: w, marginLeft: i ? -w / 2 : 0, zIndex: 3 - i }}
				/>
			))}
		</span>
	)
}

// PROTOTYPE - throwaway. Your taste f, "Taste in this list": bars, like the Mood tab's d. Your taste groups as rows
// with their loved posters and how much of this list sits in each (plus the titles in none of them), Taste match as
// rows from 90%+ down to Outside your usual with each step's share, and the order and your lists as switches.
// A guest sees the rows faint, with one Sign up; Order and Your lists are locked too (round 13: Not seen yet as well).
import { BarsArrowDownIcon, CheckIcon, LockClosedIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { compactCount } from "~/ui/filter-bar/labels"
import { hiddenShort } from "~/ui/filter-bar/controls"
import { Knob, SHELL, TAP } from "~/ui/filter-bar/motion"
import type { SectionProps } from "../../types"
import {
	BlockHead,
	ClearLink,
	GROUPS,
	MATCH_STEPS,
	type MatchStep,
	NO_GROUP_SHARE,
	PosterStack,
	ScopeIcon,
	SignUpChip,
	type Taste,
	type TasteGroup,
	TasteSwitch,
	groupLine,
	matchName,
	useTaste,
} from "./def-parts"

const TOP_SHARE = Math.max(...GROUPS.map((g) => g.share))

function Bar({ share, hues, faint }: { share: number; hues: string[]; faint?: boolean }) {
	const [a, b = a] = hues
	return (
		<span className="relative block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
			{!faint && (
				<span
					className="absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-300 motion-reduce:transition-none"
					style={{ transform: `scaleX(${Math.min(1, share)})`, background: `linear-gradient(90deg, ${a}, ${b})` }}
				/>
			)}
		</span>
	)
}

function Box({ on }: { on: boolean }) {
	return (
		<span
			aria-hidden
			className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${on ? "bg-white text-gray-950" : "ring-1 ring-inset ring-white/25"}`}
		>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

function GroupRow({ taste, g, phone }: { taste: Taste; g: TasteGroup; phone: boolean }) {
	const on = taste.groups.isOn(g)
	const dim = taste.full && !on
	const c = taste.groups.count(g)
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a row that acts as a checkbox
			role="checkbox"
			aria-checked={on}
			aria-disabled={dim || undefined}
			whileTap={dim ? undefined : TAP}
			onClick={() => !dim && taste.groups.toggle(g)}
			className={`flex h-[52px] w-full min-w-0 items-center gap-3 rounded-xl px-2.5 text-left cursor-pointer outline-none transition-[background-color,opacity] focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white/[0.08] ring-1 ring-inset ring-white/25" : "hover:bg-white/[0.04]"} ${dim ? "opacity-40" : ""}`}
		>
			<PosterStack shots={g.loved} h={phone ? 34 : 40} />
			<span className={`min-w-0 ${phone ? "flex-1" : "w-[190px] shrink-0"}`}>
				<span className="block truncate text-[14px] font-semibold text-gray-100">{g.name}</span>
				{phone ? (
					<span className="mt-1.5 flex">
						<Bar share={g.share / TOP_SHARE} hues={g.words.map((w) => w.color)} />
					</span>
				) : (
					<span className="flex items-center gap-1.5 truncate text-[12px] text-gray-500">
						{g.words.map((w) => (
							<span key={w.key} className="h-2 w-2 shrink-0 rounded-full" style={{ background: w.color }} />
						))}
						<span className="truncate">{groupLine(g)}</span>
					</span>
				)}
			</span>
			{!phone && <Bar share={g.share / TOP_SHARE} hues={g.words.map((w) => w.color)} />}
			<span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-gray-400">{c != null ? compactCount(c) : ""}</span>
			<Box on={on} />
		</motion.button>
	)
}

function LockedRow({ i }: { i: number }) {
	return (
		<span aria-hidden className="flex h-[52px] items-center gap-3 px-2.5">
			<span className="h-10 w-[54px] shrink-0 rounded-[4px] bg-white/[0.04]" />
			<span className="w-[150px] shrink-0 space-y-1.5">
				<span className="block h-3 rounded bg-white/[0.07]" style={{ width: `${80 - i * 12}%` }} />
				<span className="block h-2 w-20 rounded bg-white/[0.04]" />
			</span>
			<span className="h-2 flex-1 rounded-full bg-white/[0.04]" />
		</span>
	)
}

function MatchRow({ taste, v }: { taste: Taste; v: MatchStep }) {
	const value = taste.match.value
	const locked = !taste.member
	const on = !locked && v === value
	const low = v === "outside"
	const lit = !locked && typeof v === "number" && typeof value === "number" && value !== 0 && v >= value
	const c = locked ? null : taste.match.count(v)
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: rows of an "and up" scale; the buttons carry the radio role
			role="radio"
			aria-checked={on}
			disabled={locked}
			whileTap={locked ? undefined : TAP}
			onClick={() => taste.match.set(v)}
			className={`flex h-10 w-full min-w-0 items-center gap-3 rounded-xl px-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${locked ? "cursor-default" : "cursor-pointer"} ${
				on ? (low ? "bg-sky-500/20 ring-1 ring-inset ring-sky-300/50" : "bg-amber-500/20 ring-1 ring-inset ring-amber-300/50") : lit ? "bg-amber-500/[0.08]" : locked ? "" : "hover:bg-white/[0.04]"
			}`}
		>
			<span className={`w-[124px] shrink-0 truncate text-[13px] font-semibold ${locked ? "text-gray-600" : on || lit ? "text-white" : "text-gray-300"}`}>
				{matchName(v)}
			</span>
			<Bar share={taste.match.share(v)} hues={[low ? "#38bdf8" : "#f59e0b"]} faint={locked} />
			<span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-gray-400">{c != null ? compactCount(c) : ""}</span>
		</motion.button>
	)
}

/** Production's NotSeenSwitch look (size sm): icon, label, what it hides, the switch; amber outline when on. */
function ListPill({
	id,
	label,
	on,
	hides,
	onChange,
	locked,
}: {
	id: "unseen" | "wishlist" | "seen"
	label: string
	on: boolean
	hides: number | null
	onChange: (on: boolean) => void
	locked: boolean
}) {
	const lit = on && !locked
	return (
		<motion.button
			type="button"
			role="switch"
			aria-checked={lit}
			aria-label={lit && hides ? `${label}, hides ${hides.toLocaleString("en")} titles` : label}
			disabled={locked}
			whileTap={locked ? undefined : TAP}
			onClick={() => onChange(!on)}
			className={`relative flex h-9 w-full min-w-0 items-center gap-2 px-3 text-sm font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${SHELL} ${
				locked ? "cursor-default text-gray-600" : lit ? "cursor-pointer text-white" : "cursor-pointer text-gray-400 hover:text-gray-200"
			}`}
		>
			<span
				aria-hidden
				className={`pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-amber-400/70 transition-opacity duration-200 ${lit ? "opacity-100" : "opacity-0"}`}
			/>
			{locked ? <LockClosedIcon className="h-3.5 w-3.5 shrink-0 text-amber-500/70" aria-label="With an account" /> : <ScopeIcon id={id} className="h-4 w-4 shrink-0" />}
			<span className="min-w-0 flex-1 truncate text-left">{label}</span>
			{hides !== null && (
				<span aria-hidden className={`shrink-0 text-right text-xs tabular-nums transition-colors ${lit ? "text-blue-300/80" : "text-gray-500"}`}>
					{hiddenShort(hides)}
				</span>
			)}
			<Knob on={lit} onClass="bg-blue-600 shadow-[0_0_14px_rgba(37,99,235,.6)]" />
		</motion.button>
	)
}

export function TasteF({ d, phone, viewer }: SectionProps) {
	const taste = useTaste(d, viewer)
	const { member } = taste
	const locked = !member
	const none = taste.total ? Math.round(taste.total * NO_GROUP_SHARE) : null

	const groups = (
		<section className="min-w-0">
			<BlockHead
				locked={locked}
				note={member ? "In this list" : undefined}
				right={locked ? <SignUpChip label="Sign up for your taste" /> : taste.groups.all.some(taste.groups.isOn) && <ClearLink onClick={taste.groups.clear} />}
			>
				Your taste groups
			</BlockHead>
			<div className="flex flex-col gap-1">
				{member ? taste.groups.all.map((g) => <GroupRow key={g.id} taste={taste} g={g} phone={phone} />) : [0, 1, 2, 3].map((i) => <LockedRow key={i} i={i} />)}
				<div className="flex h-10 items-center gap-3 px-2.5 text-[13px] text-gray-500">
					<span className={locked ? "text-gray-600" : ""}>In none of them</span>
					<span className="ml-auto w-12 text-right text-[12px] tabular-nums">{member && none != null ? compactCount(none) : ""}</span>
					<span className="w-5" />
				</div>
			</div>
		</section>
	)
	const match = (
		<section className="min-w-0">
			<BlockHead locked={locked}>
				<span className="flex items-center gap-2">
					<FingerPrintIcon className="h-5 w-5 text-amber-500" aria-hidden />
					Taste match
				</span>
			</BlockHead>
			<div role="radiogroup" aria-label="Taste match" className="flex flex-col gap-1">
				{[...MATCH_STEPS].reverse().map((v) => (
					<MatchRow key={String(v)} taste={taste} v={v} />
				))}
			</div>
		</section>
	)
	const switches = (
		<div className="flex min-w-0 flex-col gap-5">
			<section>
				<BlockHead locked={locked}>Order</BlockHead>
				<div className="flex flex-col gap-2">
					<TasteSwitch
						label="For you"
						on={taste.order.forYou}
						onChange={taste.order.setForYou}
						locked={locked}
						icon={<FingerPrintIcon className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />}
					/>
					<TasteSwitch
						label="Best match first"
						on={taste.order.best}
						onChange={taste.order.setBest}
						locked={locked}
						icon={<BarsArrowDownIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />}
					/>
				</div>
			</section>
			<section>
				{/* Round 13: several lists at once, all need an account. Round 14: production's Not seen yet pill, wishlist last. */}
				<BlockHead>Your lists</BlockHead>
				<div className="flex flex-col gap-2">
					{(
						[
							["unseen", "Not seen yet"],
							["seen", "Seen before"],
							["wishlist", "On your wishlist"],
						] as const
					).map(([id, label]) => (
						<ListPill key={id} id={id} label={label} on={taste.list.has(id)} hides={taste.list.hides(id)} onChange={(on) => taste.list.turn(id, on)} locked={locked} />
					))}
				</div>
			</section>
		</div>
	)

	if (phone)
		return (
			<div className="space-y-6">
				{groups}
				{match}
				{switches}
			</div>
		)
	return (
		<div className="grid h-full grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(17.5rem,0.62fr)] gap-8 px-7 py-5">
			{groups}
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{match}</div>
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{switches}</div>
		</div>
	)
}

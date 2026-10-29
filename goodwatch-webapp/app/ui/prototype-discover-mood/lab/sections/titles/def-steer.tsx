// PROTOTYPE (Discover lab, titles d/e/f): steering a list with titles, shaped like a filter instead of a rating.
// - SteerButtons: the colored thumbs (more / less like this) and Similar to, as one compact pill group.
// - Once picked, a title becomes a SteerChip, the same pill-with-× as every other active filter: the row shows the
//   chip in place of its buttons, and the SteerTray lists every chip with a funnel, so a pick reads as "part of this
//   list's filters", never as a score saved somewhere.
import { FunnelIcon, HandThumbDownIcon, HandThumbUpIcon, Square2StackIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import type { TitleKey } from "~/utils/title-key"
import { type FoundTitle, POSTER_SM, keyParts } from "../../shell-parts"
import { EXAMPLE_KEYS, type TitleUses, type Use, type useKnown } from "./shared"

export const STEER: Record<Use, { icon: ReactNode; chip: (name: string) => string; tint: string; icn: string; btn: string }> = {
	loved: {
		icon: <HandThumbUpIcon />,
		chip: (n) => `More like ${n}`,
		tint: "bg-emerald-400/[0.14] text-emerald-50 ring-emerald-300/50",
		icn: "text-emerald-300",
		btn: "hover:bg-emerald-400/20 hover:text-emerald-200",
	},
	disliked: {
		icon: <HandThumbDownIcon />,
		chip: (n) => `Less like ${n}`,
		tint: "bg-red-500/[0.14] text-red-50 ring-red-400/50",
		icn: "text-red-400",
		btn: "hover:bg-red-500/20 hover:text-red-300",
	},
	similarTo: {
		icon: <Square2StackIcon />,
		chip: (n) => `Similar to ${n}`,
		tint: "bg-rose-400/[0.14] text-rose-50 ring-rose-300/50",
		icn: "text-rose-300",
		btn: "hover:bg-rose-400/20 hover:text-rose-200",
	},
}
const CHIP_ORDER: Use[] = ["loved", "disliked", "similarTo"]

/** A pick as an active-filter chip: icon, label, ×. */
export function SteerChip({
	use,
	name,
	onRemove,
	size = "md",
	bare = false,
}: { use: Use; name: string; onRemove: () => void; size?: "md" | "sm"; /** Icon and × only. */ bare?: boolean }) {
	const s = STEER[use]
	return (
		<motion.span
			layout="position"
			initial={{ opacity: 0, scale: 0.85 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.85 }}
			transition={{ duration: 0.14 }}
			className={`inline-flex max-w-full shrink-0 items-center rounded-full font-semibold whitespace-nowrap ring-1 ring-inset ${s.tint} ${size === "md" ? "h-8 text-[13px]" : "h-7 text-[12px]"}`}
		>
			<span className={`flex min-w-0 items-center gap-1.5 pl-2.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0`}>
				<span className={`${s.icn} [&>svg]:h-3.5 [&>svg]:w-3.5`}>{s.icon}</span>
				{!bare && <span className="truncate">{s.chip(name)}</span>}
			</span>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${s.chip(name)}`}
				className="grid h-full w-7 shrink-0 place-items-center rounded-r-full text-white/50 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}

/** The steering buttons for one title, or its chips once it steers. */
export function SteerButtons({
	t,
	uses,
	onUse,
	compact = false,
	similar = true,
}: {
	t: { key: TitleKey; title: string }
	uses: TitleUses
	onUse?: () => void
	/** Icons only (no Similar to label). */
	compact?: boolean
	similar?: boolean
}) {
	const on = uses.usesOf(t.key)
	const thumb = on.find((u) => u !== "similarTo")
	const sim = on.includes("similarTo")
	const tap = (u: Use) => {
		onUse?.()
		uses.toggle(u, t.key)
	}
	const name = "this"
	return (
		<div className="flex min-w-0 shrink-0 items-center gap-1.5">
			{thumb ? (
				<SteerChip use={thumb} name={compact ? t.title : name} size="sm" bare={compact} onRemove={() => uses.toggle(thumb, t.key)} />
			) : (
				<span className="flex h-7 shrink-0 items-center rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/10">
					{(["loved", "disliked"] as const).map((u, i) => (
						<motion.button
							key={u}
							type="button"
							whileTap={TAP}
							onClick={() => tap(u)}
							aria-label={STEER[u].chip(t.title)}
							title={STEER[u].chip(t.title)}
							className={`grid h-7 w-8 place-items-center text-gray-400 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-4 [&>svg]:w-4 ${STEER[u].btn} ${i === 0 ? "rounded-l-full" : "rounded-r-full border-l border-white/10"}`}
						>
							{STEER[u].icon}
						</motion.button>
					))}
				</span>
			)}
			{similar &&
				(sim ? (
					!compact && <SteerChip use="similarTo" name={name} size="sm" onRemove={() => uses.toggle("similarTo", t.key)} />
				) : (
					<motion.button
						type="button"
						whileTap={TAP}
						onClick={() => tap("similarTo")}
						aria-label={STEER.similarTo.chip(t.title)}
						title={compact ? STEER.similarTo.chip(t.title) : undefined}
						className={`flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/[0.06] text-[12px] font-semibold text-gray-300 ring-1 ring-inset ring-white/10 cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 [&>svg]:h-3.5 [&>svg]:w-3.5 ${STEER.similarTo.btn} ${compact ? "w-8 justify-center" : "px-2.5"}`}
					>
						{STEER.similarTo.icon}
						{!compact && "Similar to"}
					</motion.button>
				))}
			{similar && compact && sim && (
				<motion.button
					type="button"
					whileTap={TAP}
					onClick={() => tap("similarTo")}
					aria-label={`Remove ${STEER.similarTo.chip(t.title)}`}
					className={`grid h-7 w-8 shrink-0 place-items-center rounded-full ring-1 ring-inset [&>svg]:h-3.5 [&>svg]:w-3.5 cursor-pointer ${STEER.similarTo.tint}`}
				>
					{STEER.similarTo.icon}
				</motion.button>
			)}
		</div>
	)
}

/** Every pick as chips behind a funnel, the way active filters look. `extra` adds more chips (people). */
export function SteerTray({
	uses,
	known,
	extra,
	empty,
	wrap = false,
	className = "",
}: {
	uses: TitleUses
	known: ReturnType<typeof useKnown>["known"]
	extra?: ReactNode
	/** Shown while nothing is picked (for example a few titles to tap). */
	empty?: ReactNode
	wrap?: boolean
	className?: string
}) {
	const picks = CHIP_ORDER.flatMap((u) => uses.listOf(u).map((k) => ({ u, k })))
	const any = picks.length > 0 || !!extra
	return (
		<div className={`flex min-w-0 items-center gap-2 ${className}`}>
			<span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${any ? "bg-amber-400/15 text-amber-300" : "bg-white/[0.04] text-gray-600"}`}>
				<FunnelIcon className="h-4 w-4" aria-hidden />
			</span>
			<div
				className={`flex min-w-0 flex-1 items-center gap-2 ${wrap ? "flex-wrap" : "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}`}
			>
				<AnimatePresence initial={false} mode="popLayout">
					{picks.map(({ u, k }) => (
						<SteerChip key={`${u}:${k}`} use={u} name={known(k)?.title ?? "…"} onRemove={() => uses.toggle(u, k)} />
					))}
				</AnimatePresence>
				{extra}
				{!any && empty}
			</div>
		</div>
	)
}

/** Well-known titles with posters, for an empty field. */
export function useExampleTitles(n = EXAMPLE_KEYS.length): FoundTitle[] {
	const keys = EXAMPLE_KEYS.slice(0, n)
	const names = useTitleNames(
		keys.map((t) => t.key),
		"",
	)
	return keys.map((t) => {
		const nm = names.byKey.get(t.key)
		const { mediaType, tmdbId } = keyParts(t.key)
		return { key: t.key, title: t.title, year: String(nm?.year ?? ""), poster: nm?.poster ?? null, mediaType, tmdbId }
	})
}

/** A poster, fixed size, with an optional ring for its pick. */
export function Poster({ t, w, use, className = "" }: { t: { title: string; poster: string | null }; w: number; use?: Use; className?: string }) {
	const ring = use === "loved" ? "ring-2 ring-emerald-300/80" : use === "disliked" ? "ring-2 ring-red-400/80" : use === "similarTo" ? "ring-2 ring-rose-300/80" : "ring-1 ring-white/10"
	return (
		<span className={`block shrink-0 overflow-hidden rounded-lg bg-white/[0.06] ${ring} ${className}`} style={{ width: w, height: Math.round(w * 1.5) }}>
			{t.poster ? (
				<img src={`${POSTER_SM}${t.poster}`} alt="" loading="lazy" className={`h-full w-full object-cover ${use === "disliked" ? "opacity-50 grayscale" : ""}`} />
			) : (
				<span className="grid h-full place-items-center p-1 text-center text-[10px] leading-tight text-gray-500">{t.title}</span>
			)}
		</span>
	)
}

const norm = (s: string) =>
	s
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[^\p{L}\p{N} ]/gu, "")
		.replace(/^the /, "")
		.replace(/\s+/g, " ")
		.trim()

/** Whether `text` looks like the name of one of the found titles (exact, or a long enough start of it). */
export function looksLikeTitle(text: string, found: { title: string }[]): boolean {
	const t = norm(text)
	if (t.length < 2 || t.split(" ").length > 6) return false
	return found.slice(0, 3).some((f) => {
		const n = norm(f.title)
		return n === t || (n.startsWith(t) && t.length >= 4 && t.length / n.length >= 0.5)
	})
}

export const metaLine = (t: Pick<FoundTitle, "year" | "mediaType">) => [t.year, t.mediaType === "movie" ? "Movie" : "Show"].filter(Boolean).join(" · ")

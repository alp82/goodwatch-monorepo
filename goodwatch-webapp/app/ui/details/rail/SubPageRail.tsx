// A sub-page's rail: "Back to details" (exactly where the title page was left), then the sub-page's own entry of the
// title page's "On this page" (its name and gist as the title page last showed them), selected, with the sub-page's
// parts indented under it. The entry itself goes to its section on the title page.
// - useSubParts: the sub-page's parts, the one being read, and a jump to one. At a glance: its rows (published by
//   at-a-glance/AtAGlancePage.tsx). Tropes: Signature tropes and Every trope, A to Z (the tropes page's two panes; the
//   open trope is the second's), from the tropes page's own state. The fingerprint has no parts.
import {
	DocumentTextIcon,
	FingerPrintIcon,
	TagIcon,
} from "@heroicons/react/24/outline"
import { type ComponentType, type MouseEvent, useEffect, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { CAPTION, fmt } from "~/ui/details/page-ui"
import { SUB_HEADER_BOTTOM } from "~/ui/details/sub-page/SubPageHeader"
import { SUB, type SubKind } from "~/ui/details/sub-page/paths"
import type { WayBack } from "~/ui/details/sub-page/way-back"
import { reducedMotion, writeJump } from "~/ui/details/sub-page/way-in"
import { LETTERS } from "~/ui/details/tropes/model"
import { useHydrated } from "~/utils/hydrated"
import { type NavChild, type NavEntry, RailNav } from "./RailNav"
import {
	type KeptEntry,
	type RailPart,
	keptEntries,
	keptIcons,
	useGlanceParts,
	useTropesBridge,
} from "./rail-model"
import { useSpy } from "./spy"

type Media = MovieResult | ShowResult

export interface SubParts {
	parts: RailPart[]
	current: string | null
	select: (id: string) => void
}

export function useSubParts(kind: SubKind): SubParts {
	const glance = kind === "at-a-glance"
	const rows = useGlanceParts()
	const spied = glance ? (rows ?? []) : []
	const spyCurrent = useSpy(
		spied.map((p) => p.id),
		(id) => document.getElementById(id),
		SUB_HEADER_BOTTOM,
		glance,
	)
	const t = useTropesBridge()
	if (glance)
		return {
			parts: spied,
			current: spyCurrent ?? spied[0]?.id ?? null,
			select: (id) => {
				const el = document.getElementById(id)
				if (!el) return
				el.scrollIntoView({
					block: "start",
					behavior: reducedMotion() ? "auto" : "smooth",
				})
				window.history.replaceState(
					window.history.state,
					"",
					`${window.location.pathname}${window.location.search}#${id}`,
				)
			},
		}
	if (kind === "tropes")
		return {
			parts: [
				{
					id: "tropes-signature",
					label: "Signature tropes",
					meta: t?.signature ? String(t.signature) : null,
				},
				{
					id: "tropes-a-z",
					label: t?.open ? t.open.name : "Every trope, A to Z",
					meta: t?.total ? fmt(t.total) : null,
				},
			],
			current: t ? (t.open ? "tropes-a-z" : "tropes-signature") : null,
			select: (id) =>
				id === "tropes-signature"
					? t?.showSignature()
					: t?.open
						? undefined
						: t?.openFirst(),
		}
	return { parts: [], current: null, select: () => {} }
}

const FALLBACK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
	fingerprint: FingerPrintIcon,
	"at-a-glance": DocumentTextIcon,
	tropes: TagIcon,
}

/** The title page's entry for this sub-page as it last showed it (sessionStorage), or its plain name. */
function useOwnEntry(media: Media, kind: SubKind): KeptEntry | null {
	const hydrated = useHydrated()
	const key = `${media.mediaType}-${media.details.tmdb_id}`
	const find = () => keptEntries(key)?.find((e) => e.id === kind) ?? null
	const [entry, setEntry] = useState<KeptEntry | null>(() =>
		hydrated ? find() : null,
	)
	useEffect(() => {
		const kept = find()
		if (kept) setEntry(kept)
	}, [key, kind])
	return entry
}

export function SubPageRail({
	media,
	kind,
	back,
	sub,
}: { media: Media; kind: SubKind; back: WayBack; sub: SubParts }) {
	const kept = useOwnEntry(media, kind)
	const t = useTropesBridge()
	const base = back.to.split("#")[0]
	const children: NavChild[] = sub.parts.map((p) => ({
		id: p.id,
		label: p.label,
		meta: p.meta,
		onSelect: () => sub.select(p.id),
		extra:
			p.id === "tropes-a-z" && t ? (
				<Letters has={t.letters} onPick={t.jumpLetter} />
			) : undefined,
		// At a glance's rows are blocks on the page: the line spans what is on screen.
		...(kind === "tropes"
			? {}
			: { target: () => document.getElementById(p.id) }),
	}))
	const peek =
		kept?.peek ??
		(kind === "tropes" && t?.total ? `${fmt(t.total)} from TV Tropes` : null)
	const own: NavEntry = {
		id: kind,
		label: kept?.label ?? SUB[kind].label,
		icon: keptIcons.get(kind) ?? FALLBACK_ICONS[kind] ?? DocumentTextIcon,
		peek,
		selected: true,
		progress: `sub-${kind}`,
		href: `${base}#${SUB[kind].section}`,
		onSelect: (e) => {
			// The title page lands on the section, not where it was left.
			writeJump(new URL(base, window.location.href).pathname, SUB[kind].section)
			back.onClick?.(e as MouseEvent<HTMLAnchorElement>)
		},
		children,
		activeChild: sub.current,
		spanTop: () => SUB_HEADER_BOTTOM,
	}
	return (
		<>
			<h2 className={`${CAPTION} px-2.5`}>On this page</h2>
			<div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.25rem),transparent)] [scrollbar-width:none]">
				<RailNav
					back={{
						label: "Back to details",
						href: back.to,
						onClick: back.onClick,
					}}
					entries={[own]}
				/>
			</div>
		</>
	)
}

/** The tropes' letters, small, under "Every trope, A to Z": they move the list. */
function Letters({
	has,
	onPick,
}: { has: Set<string>; onPick: (l: string) => void }) {
	return (
		<fieldset className="mt-0.5 mb-1 grid min-w-0 grid-cols-9 gap-px border-0 pr-1 pl-2.5">
			<legend className="sr-only">Jump to a letter</legend>
			{LETTERS.map((l) => (
				<button
					key={l}
					type="button"
					disabled={!has.has(l)}
					onClick={() => onPick(l)}
					className="h-6 cursor-pointer rounded text-[11px] font-semibold text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-amber-300 disabled:cursor-default disabled:text-gray-700 disabled:hover:bg-transparent"
				>
					{l}
				</button>
			))}
		</fieldset>
	)
}

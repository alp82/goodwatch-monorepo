// PROTOTYPE OPTIONS (member nav, round 11): what a click on the orbit opens in the header (nav-options.ts `reveal`): the
// fingerprint's key facts (the viewer type, the strongest families, the top attributes, since when). pill (a half-round
// pill slides out from behind the picture), panel (the name and facts give way to family bars in place), morph (the
// picture shrinks and the orbit grows into the print, the facts beside it) and card (a card slides in from the picture
// over the header's right side). Every state keeps the header's height; motion is transform and opacity only. The
// header (Layouts.tsx) owns the open state; these draw the layers and their close key.
import { ArrowRightIcon, XMarkIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { DISPLAY } from "~/ui/my-pages/bits"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { FAMILY_COLOR } from "../taste/model"
import type { FamilyPull, KeyFacts } from "./facts"

export type RevealLook = NavOptions["reveal"]

export interface RevealProps {
	open: boolean
	id: string
	handle: string
	identity: string | null
	since: string | null
	facts: KeyFacts
	/** The Taste tab, for the card's link. */
	tasteHref: string
	own: boolean
	onClose: () => void
}

/** `inert` while hidden, so its links leave the tab order (React 18 passes the attribute through as a string). */
export const inertUnless = (shown: boolean) =>
	(shown ? {} : { inert: "" }) as Record<string, string>

const FADE = "transition-[opacity,transform] duration-300 ease-out"

function CloseKey({
	onClose,
	className = "",
}: { onClose: () => void; className?: string }) {
	return (
		<button
			type="button"
			onClick={onClose}
			aria-label="Close taste facts"
			className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white ${className}`}
		>
			<XMarkIcon className="size-5" aria-hidden />
		</button>
	)
}

/** The families as chips: a colored dot and the name, stronger ones brighter. */
function FamilyChips({
	families,
	className = "",
}: { families: FamilyPull[]; className?: string }) {
	return (
		<span className={`flex min-w-0 gap-1.5 overflow-hidden ${className}`}>
			{families.map((f) => (
				<span
					key={f.id}
					className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-2 text-xs font-bold text-gray-100 ring-1 ring-white/10"
					style={{ boxShadow: `inset 0 0 0 1px ${FAMILY_COLOR[f.id]}33` }}
				>
					<span
						aria-hidden
						className="size-2 rounded-full"
						style={{ background: FAMILY_COLOR[f.id] }}
					/>
					{f.name}
				</span>
			))}
		</span>
	)
}

/** "Seeks dread · moral weight · slow burn". */
function AttributeLine({
	facts,
	className = "",
}: { facts: KeyFacts; className?: string }) {
	if (!facts.attributes.length) return null
	return (
		<p className={`truncate text-gray-400 ${className}`}>
			Seeks{" "}
			{facts.attributes.map((a, i) => (
				<span key={a.key}>
					{i > 0 && <span className="text-gray-600"> · </span>}
					<b className="font-semibold text-gray-200">{a.label}</b>
				</span>
			))}
		</p>
	)
}

/** The five families as small bars, as long as each one's pull. */
function FamilyBars({ facts }: { facts: KeyFacts }) {
	return (
		<div className="grid grid-cols-5 gap-2 sm:gap-3">
			{facts.pulls.map((f) => (
				<div key={f.id} className="min-w-0">
					<p className="truncate text-[10px] leading-3 font-bold text-gray-300 sm:text-xs sm:leading-4">
						{f.name}
					</p>
					<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08] sm:h-2">
						<div
							className="h-full origin-left rounded-full"
							style={{
								background: FAMILY_COLOR[f.id],
								transform: `scaleX(${Math.max(0.04, Math.round(f.strength * 100) / 100)})`,
							}}
						/>
					</div>
				</div>
			))}
		</div>
	)
}

const Small = ({ handle }: { handle: string }) => (
	<p className="truncate text-[11px] leading-4 font-semibold text-gray-400 sm:text-xs">
		@{handle}
	</p>
)

const Since = ({ since }: { since: string | null }) =>
	since ? (
		<p className="truncate text-[11px] leading-4 text-gray-500 max-sm:hidden sm:text-xs">
			{since}
		</p>
	) : null

/** A layer over the content column that fades in when open. */
function Layer({
	open,
	id,
	className,
	children,
}: { open: boolean; id: string; className: string; children: ReactNode }) {
	return (
		<section
			id={id}
			aria-label="Taste at a glance"
			aria-hidden={!open}
			{...inertUnless(open)}
			className={`absolute ${FADE} ${open ? "opacity-100" : "pointer-events-none opacity-0"} ${className}`}
		>
			{children}
		</section>
	)
}

// OPTION reveal=pill
/**
 * The pill's background, behind the picture: closed, only its round end sits under the picture (hidden); open, it
 * slides out to the right across the content column. `ring` is the picture's box width for the closed offset.
 */
export function PillBackground({ open }: { open: boolean }) {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute top-1/2 left-0 h-[88px] w-full -translate-y-1/2 overflow-hidden rounded-full sm:h-[132px]"
		>
			<span
				className={`absolute inset-0 rounded-full bg-linear-to-r from-white/[0.1] via-white/[0.06] to-white/[0.04] ring-1 ring-white/10 ring-inset transition-[transform,opacity] duration-500 ease-out ${
					open
						? "translate-x-0 opacity-100"
						: "-translate-x-[calc(100%-88px)] opacity-0 sm:-translate-x-[calc(100%-132px)]"
				}`}
			/>
		</span>
	)
}

/** The pill's facts, in the content column. */
export function PillFacts(props: RevealProps) {
	const { open, facts } = props
	return (
		<Layer
			open={open}
			id={props.id}
			className={`inset-0 flex items-center gap-2 pr-1 delay-100 sm:pr-3 ${open ? "translate-x-0" : "-translate-x-4"}`}
		>
			<div className="min-w-0 flex-1">
				<div className="min-w-0 sm:flex sm:items-baseline sm:gap-2">
					<Small handle={props.handle} />
					{props.identity && (
						<p className="truncate text-sm font-bold text-violet-200 sm:text-base">
							{props.identity}
						</p>
					)}
				</div>
				<FamilyChips families={facts.families} className="mt-1 sm:mt-1.5" />
				<AttributeLine
					facts={facts}
					className="mt-1 text-xs sm:mt-1.5 sm:text-sm"
				/>
				<Since since={props.since} />
			</div>
			<CloseKey onClose={props.onClose} />
		</Layer>
	)
}

// OPTION reveal=panel
/** The name and facts give way to a fingerprint panel: the handle small above it, then the five family bars. */
export function PanelFacts(props: RevealProps) {
	const { open, facts } = props
	return (
		<Layer
			open={open}
			id={props.id}
			className={`inset-0 flex flex-col justify-center ${open ? "translate-y-0" : "translate-y-1.5"}`}
		>
			<div className="flex min-w-0 items-center gap-2">
				<div className="min-w-0 flex-1">
					<Small handle={props.handle} />
					<p className="truncate text-sm font-bold text-violet-200 sm:text-lg sm:leading-6">
						{props.identity ?? "Taste print"}
					</p>
				</div>
				<CloseKey onClose={props.onClose} className="-mr-1" />
			</div>
			<div className="mt-1.5 max-w-xl sm:mt-2">
				<FamilyBars facts={facts} />
			</div>
			<AttributeLine
				facts={facts}
				className="mt-1.5 text-xs sm:mt-2 sm:text-sm"
			/>
		</Layer>
	)
}

// OPTION reveal=morph
/** Beside the grown print: the strongest families as the headline, the viewer type and the top attributes. */
export function MorphFacts(props: RevealProps) {
	const { open, facts } = props
	// Two families fit a phone's line.
	const names = facts.families.slice(0, 2).map((f) => f.name)
	return (
		<Layer
			open={open}
			id={props.id}
			className={`inset-0 flex items-center gap-2 pl-2 delay-150 sm:pl-5 ${open ? "translate-x-0" : "-translate-x-6"}`}
		>
			<div className="min-w-0 flex-1">
				<Small handle={props.handle} />
				<p
					className={`${DISPLAY} truncate text-lg leading-6 text-white sm:text-[1.75rem] sm:leading-9`}
				>
					{names.length ? (
						<>
							Mostly{" "}
							{names.map((name, i) => (
								<span key={name}>
									{i > 0 && (i === names.length - 1 ? " and " : ", ")}
									<span style={{ color: FAMILY_COLOR[facts.families[i].id] }}>
										{name}
									</span>
								</span>
							))}
						</>
					) : (
						"A print still forming"
					)}
				</p>
				{props.identity && (
					<p className="truncate text-xs font-semibold text-violet-200/80 sm:text-sm">
						{props.identity}
					</p>
				)}
				<AttributeLine
					facts={facts}
					className="mt-0.5 text-xs sm:mt-1 sm:text-sm"
				/>
				<Since since={props.since} />
			</div>
			<CloseKey onClose={props.onClose} />
		</Layer>
	)
}

// OPTION reveal=card
/** A card that slides in from the picture over the header's right side, with the facts and a way to the Taste tab. */
export function CardFacts(props: RevealProps) {
	const { open, facts } = props
	return (
		<section
			id={props.id}
			aria-label="Taste at a glance"
			aria-hidden={!open}
			{...inertUnless(open)}
			className={`absolute inset-y-3 right-4 left-[calc(88px+1.75rem)] z-30 flex flex-col justify-center rounded-2xl bg-gray-900 px-3.5 py-2 shadow-2xl ring-1 ring-white/12 sm:inset-y-4 sm:right-6 sm:left-auto sm:w-[27rem] sm:px-5 lg:right-8 transition-[opacity,transform] duration-300 ease-out ${
				open
					? "translate-x-0 opacity-100"
					: "pointer-events-none -translate-x-1/4 opacity-0"
			}`}
			data-reveal-card
		>
			<div className="flex min-w-0 items-center gap-2">
				<div className="min-w-0 flex-1">
					<Small handle={props.handle} />
					<p className="truncate text-sm font-bold text-violet-200 sm:text-base">
						{props.identity ?? "Taste print"}
					</p>
				</div>
				<CloseKey onClose={props.onClose} className="-mr-2" />
			</div>
			<FamilyChips families={facts.families} className="mt-1 sm:mt-1.5" />
			<AttributeLine facts={facts} className="mt-1.5 text-sm max-sm:hidden" />
			<div className="mt-1 flex items-center justify-between gap-3 sm:mt-1.5">
				<Since since={props.since} />
				<Link
					to={props.tasteHref}
					prefetch="intent"
					className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200 sm:text-sm"
				>
					{props.own ? "See your taste" : "See their taste"}
					<ArrowRightIcon className="size-3.5" aria-hidden />
				</Link>
			</div>
		</section>
	)
}

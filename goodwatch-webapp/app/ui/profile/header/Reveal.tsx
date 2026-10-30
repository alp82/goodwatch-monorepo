// What a click on the orbit opens in the header: the fingerprint's key facts (the viewer type, the strongest families,
// the top attributes) on a half-round pill that slides out from behind the picture across the name and facts. The
// header keeps its height; motion is transform and opacity only. The header (Layouts.tsx) owns the open state; this
// draws the pill and its close key.
import { XMarkIcon } from "@heroicons/react/24/outline"
import type { ReactNode } from "react"
import { FAMILY_COLOR } from "../taste/model"
import type { FamilyPull, KeyFacts } from "./facts"

export interface RevealProps {
	open: boolean
	id: string
	handle: string
	identity: string | null
	facts: KeyFacts
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

const Small = ({ handle }: { handle: string }) => (
	<p className="truncate text-[11px] leading-4 font-semibold text-gray-400 sm:text-xs">
		@{handle}
	</p>
)

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

/**
 * The pill's background, behind the picture: closed, only its round end sits under the picture (hidden); open, it
 * slides out to the right across the content column.
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
			</div>
			<CloseKey onClose={props.onClose} />
		</Layer>
	)
}

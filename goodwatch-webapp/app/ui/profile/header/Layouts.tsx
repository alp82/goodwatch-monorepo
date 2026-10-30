// The profile header: the orbit round the picture (Ring.tsx), the handle with the join date under it, the facts, and one
// control cluster (Controls.tsx). It has one height per width (BOX) on every profile tab, list page and Settings page,
// and the handle strip uses the same one. The orbit is a key: hover, touch or focus wakes it, a click opens the
// fingerprint's key facts on a pill over the name and facts (Reveal.tsx), and a second click, Escape or the close key
// goes back. The header keeps its height in every state. For a member on someone else's profile it shows their match
// with you (Compare.tsx).
// PROTOTYPE OPTIONS (member nav, round 12): where the match chip sits, nav-options.ts `chip`.
import { Link } from "@remix-run/react"
import {
	type ReactNode,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react"
import type { ProfileShell } from "~/domain/profile"
import type { HeaderMatch } from "~/server/profile/header.server"
import { DISPLAY, WRAP } from "~/ui/my-pages/bits"
import type { NavOptions } from "~/ui/navigation/nav-options"
import type { WhorlAttribute } from "../taste/Whorl"
import { MatchChip } from "./Compare"
import { ClusterControls, type ControlsProps } from "./Controls"
import { PillBackground, PillFacts, inertUnless } from "./Reveal"
import { type OrbitMotion, OrbitRing } from "./Ring"
import { type HeaderFact, keyFacts } from "./facts"

/** The header's one height: phones, then from sm up. */
export const BOX = "h-[120px] sm:h-[164px]"
const RING = "size-[88px] sm:size-[132px]"

export interface HeaderProps {
	/** The shell as the viewer sees it (for the owner's visitor view, `asGuestSees`). */
	shell: ProfileShell
	/** The viewer type, for the open key facts. */
	identity: string | null
	print: WhorlAttribute[] | null
	/** Movies seen, shows seen, watch time. */
	facts: HeaderFact[]
	/** The join date's month under the handle, "October 2026". */
	since: string | null
	controls: ControlsProps
	/** The signed-in visitor's match, on someone else's profile. */
	match: HeaderMatch | null
	/** The amber ring while the owner views as a visitor. */
	ring: boolean
	options: Pick<NavOptions, "chip">
}

/**
 * Header chrome the header and the handle strip share: the fixed height and the visitor ring. While the Share menu is
 * open the header rises over the sticky tab row and the page, so the menu shows whole.
 */
export function Frame({
	ring,
	children,
	strip = false,
}: {
	ring: boolean
	children: ReactNode
	strip?: boolean
}) {
	return (
		<header
			className={`relative isolate shrink-0 ${BOX} has-[[data-share-menu]]:z-40`}
			data-profile-header
			data-handle-strip={strip || undefined}
		>
			<div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
				<div className="absolute inset-0 bg-linear-to-b from-gray-900/70 to-gray-950" />
			</div>
			{ring && (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-0 z-40 ring-2 ring-amber-400 ring-inset"
				/>
			)}
			{children}
		</header>
	)
}

/** The fact as inline text: "**344 days** watch time". On a phone the movies' "seen" waits for the shows'. */
function FactText({ fact }: { fact: HeaderFact }) {
	const body = (
		<>
			<b className="font-bold text-gray-100">{fact.value}</b>{" "}
			{fact.key === "movies" ? (
				<span className="max-sm:hidden">{fact.label}</span>
			) : (
				fact.label
			)}
		</>
	)
	return fact.to ? (
		<Link
			to={fact.to}
			prefetch="intent"
			preventScrollReset
			className="whitespace-nowrap hover:text-white"
			data-header-fact={fact.key}
		>
			{body}
		</Link>
	) : (
		<span className="whitespace-nowrap" data-header-fact={fact.key}>
			{body}
		</span>
	)
}

/**
 * The facts on one line. Items that don't fit wrap onto a hidden second line, so the row keeps its height. `lead` goes
 * first (the match chip, when it sits in the facts); the line then has the chip's height.
 */
function FactLine({ facts, lead }: { facts: HeaderFact[]; lead?: ReactNode }) {
	if (!facts.length && !lead) return null
	return (
		<p
			className={`mt-1 flex flex-wrap items-center overflow-hidden text-xs leading-4 text-gray-400 sm:mt-2 sm:text-sm sm:leading-5 [&>*+*]:before:mx-2 [&>*+*]:before:text-gray-600 [&>*+*]:before:content-['·'] ${lead ? "h-6 sm:h-7" : "h-4 sm:h-5"}`}
		>
			{lead}
			{facts.map((fact) => (
				<FactText key={fact.key} fact={fact} />
			))}
		</p>
	)
}

/** The orbit's motion: open with the key facts; awake on hover with a mouse, a touch (for a moment) or keyboard focus. */
function useMotion(open: boolean): {
	motion: OrbitMotion
	handlers: React.HTMLAttributes<HTMLElement>
} {
	const [hover, setHover] = useState(false)
	const [focus, setFocus] = useState(false)
	const [touched, setTouched] = useState(false)
	useEffect(() => {
		if (!touched) return
		const timer = setTimeout(() => setTouched(false), 2400)
		return () => clearTimeout(timer)
	}, [touched])
	return {
		motion: open ? "open" : hover || focus || touched ? "wake" : "rest",
		handlers: {
			onPointerEnter: (e: React.PointerEvent) =>
				e.pointerType === "mouse" && setHover(true),
			onPointerLeave: () => setHover(false),
			onPointerDown: (e: React.PointerEvent) =>
				e.pointerType !== "mouse" && setTouched(true),
			onFocus: (e: React.FocusEvent<HTMLElement>) =>
				setFocus(e.currentTarget.matches(":focus-visible")),
			onBlur: () => setFocus(false),
		},
	}
}

export function InlineHeader(props: HeaderProps) {
	const { shell, match, print, options } = props
	const [open, setOpen] = useState(false)
	const key = useRef<HTMLButtonElement>(null)
	const id = useId()
	const facts = useMemo(() => (print ? keyFacts(print) : null), [print])
	const { motion, handlers } = useMotion(open)
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			setOpen(false)
			key.current?.focus()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [open])
	// Another profile starts closed.
	useEffect(() => setOpen(false), [shell.handle])
	const close = () => {
		setOpen(false)
		key.current?.focus()
	}
	const covers = open && !!facts

	// PROTOTYPE OPTIONS (round 12): where the match chip sits.
	const at = match ? options.chip : null
	const chip = (
		short: "phone" | "always",
		{ small = false, className = "" } = {},
	) =>
		match && (
			<MatchChip
				handle={shell.handle}
				match={match}
				short={short}
				small={small}
				className={className}
			/>
		)

	const ring = (
		<OrbitRing shell={shell} print={print} motion={motion} className={RING} />
	)

	return (
		<Frame ring={props.ring}>
			<div
				className={`${WRAP} relative flex h-full items-center gap-3 sm:gap-6`}
			>
				<div className="relative flex h-full min-w-0 flex-1 items-center gap-3 sm:gap-6">
					{facts && <PillBackground open={open} />}
					<div className="relative z-10 shrink-0">
						{facts ? (
							<button
								ref={key}
								type="button"
								aria-expanded={open}
								aria-controls={id}
								aria-label={
									open
										? "Close taste facts"
										: `Show @${shell.handle}'s taste at a glance`
								}
								onClick={() => setOpen((o) => !o)}
								{...handlers}
								className="block cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
								data-orbit-key
							>
								{ring}
							</button>
						) : (
							ring
						)}
						{/* OPTION chip=ring: a badge on the orbit's lower right edge. */}
						{at === "ring" &&
							chip("always", {
								small: true,
								className:
									"absolute right-0 bottom-0 z-10 sm:bottom-1.5 sm:translate-x-1/5",
							})}
						{/* OPTION chip=below: a line under the picture, on the orbit's lower margin, down to the header's edge. */}
						{at === "below" && (
							<span className="absolute top-full left-1/2 z-10 -mt-2 flex -translate-x-1/2">
								{chip("phone", { small: true })}
							</span>
						)}
					</div>
					<div className="relative h-full min-w-0 flex-1">
						<div
							aria-hidden={covers || undefined}
							{...inertUnless(!covers)}
							className={`absolute inset-0 flex items-center transition-opacity duration-300 ease-out ${covers ? "pointer-events-none opacity-0" : "opacity-100"}`}
						>
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 items-center gap-2 sm:gap-3">
									<h1
										className={`${DISPLAY} min-w-0 truncate text-xl leading-7 text-white sm:text-[2.125rem] sm:leading-10`}
									>
										@{shell.handle}
									</h1>
									{/* OPTION chip=name: next to the handle. */}
									{at === "name" && chip("phone")}
								</div>
								{props.since && (
									<p
										className="truncate text-xs leading-4 text-gray-400 sm:text-sm sm:leading-5"
										data-header-since
									>
										{/* Phones say "Since October 2026", so the year still fits beside the controls. */}
										<span className="max-sm:hidden">On GoodWatch since</span>
										<span className="sm:hidden">Since</span> {props.since}
									</p>
								)}
								{/* OPTION chip=facts: the first item of the facts line. */}
								<FactLine
									facts={props.facts}
									lead={at === "facts" && chip("phone")}
								/>
							</div>
						</div>
						{facts && (
							<PillFacts
								open={open}
								id={id}
								handle={shell.handle}
								identity={props.identity}
								facts={facts}
								onClose={close}
							/>
						)}
					</div>
				</div>
				{/* On a phone the open facts take the controls' room too. */}
				<div className={covers ? "max-sm:hidden" : ""}>
					{/* OPTION chip=controls: inside the control cluster, before Share. */}
					<ClusterControls
						{...props.controls}
						lead={at === "controls" && chip("phone")}
					/>
				</div>
			</div>
		</Frame>
	)
}

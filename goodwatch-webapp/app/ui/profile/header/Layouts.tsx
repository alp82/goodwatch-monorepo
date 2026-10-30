// The profile header: the orbit round the picture (Ring.tsx), the handle with the viewer type, the facts and since when,
// and one control cluster (Controls.tsx). It has one height per width (BOX) on every profile tab, list page and Settings
// page, and the handle strip uses the same one. The orbit is a key: hover, touch or focus sets it moving, a click opens
// the fingerprint's key facts in the header (Reveal.tsx), and a second click, Escape or the close key goes back. The
// header keeps its height in every state. For a member on someone else's profile it shows their match with you
// (Compare.tsx).
// PROTOTYPE OPTIONS (member nav, round 11): nav-options.ts `orbit`, `reveal` and `compare`.
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
import { Whorl, type WhorlAttribute } from "../taste/Whorl"
import { CompareRow, CompareSlot, HalvesBadge, MatchChip } from "./Compare"
import { ClusterControls, type ControlsProps } from "./Controls"
import {
	CardFacts,
	MorphFacts,
	PanelFacts,
	PillBackground,
	PillFacts,
	type RevealProps,
	inertUnless,
} from "./Reveal"
import { OrbitRing } from "./Ring"
import { type HeaderFact, keyFacts } from "./facts"

/** The header's one height: phones, then from sm up. */
export const BOX = "h-[120px] sm:h-[164px]"
const RING = "size-[88px] sm:size-[132px]"

export interface HeaderProps {
	/** The shell as the viewer sees it (for the owner's visitor view, `asGuestSees`). */
	shell: ProfileShell
	identity: string | null
	print: WhorlAttribute[] | null
	/** Movies seen, shows seen, watch time. */
	facts: HeaderFact[]
	/** "On GoodWatch since October 2026". */
	since: string | null
	controls: ControlsProps
	/** The signed-in visitor's match, on someone else's profile. */
	match: HeaderMatch | null
	/** The amber ring while the owner views as a visitor. */
	ring: boolean
	options: Pick<NavOptions, "orbit" | "reveal" | "compare">
	/** The Taste tab, in the viewer's view. */
	tasteHref: string
	/** The owner in their own view. */
	own: boolean
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

/** The facts on one line. Items that don't fit wrap onto a hidden second line, so the row keeps its height. */
function FactLine({ facts }: { facts: HeaderFact[] }) {
	if (!facts.length) return null
	return (
		<p className="mt-1 flex h-4 flex-wrap overflow-hidden text-xs leading-4 text-gray-400 sm:mt-2 sm:h-5 sm:text-sm sm:leading-5 [&>*+*]:before:mx-2 [&>*+*]:before:text-gray-600 [&>*+*]:before:content-['·']">
			{facts.map((fact) => (
				<FactText key={fact.key} fact={fact} />
			))}
		</p>
	)
}

/** The orbit's live state: hover with a mouse, a touch (for a moment), keyboard focus, or the key facts open. */
function useLive(open: boolean) {
	const [hover, setHover] = useState(false)
	const [focus, setFocus] = useState(false)
	const [touched, setTouched] = useState(false)
	useEffect(() => {
		if (!touched) return
		const timer = setTimeout(() => setTouched(false), 2400)
		return () => clearTimeout(timer)
	}, [touched])
	return {
		live: open || hover || focus || touched,
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
	const { live, handlers } = useLive(open)
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

	const reveal = facts ? options.reveal : null
	const covers = open && reveal !== "card"
	const morphed = open && reveal === "morph"
	const halves = match?.yours && print && options.compare === "halves"
	const compare = match
		? { look: options.compare, handle: shell.handle, match, theirs: print }
		: null
	const layer: RevealProps | null = facts && {
		open,
		id,
		handle: shell.handle,
		identity: props.identity,
		since: props.since,
		facts,
		tasteHref: props.tasteHref,
		own: props.own,
		onClose: close,
	}

	const ring = (
		<OrbitRing
			look={options.orbit}
			shell={shell}
			print={print}
			live={live}
			split={halves ? match.yours : null}
			className={RING}
			orbitClassName={morphed ? "scale-[1.18] opacity-25!" : ""}
			pictureClassName={`transition-transform duration-500 ease-out ${morphed ? "translate-x-[62%] translate-y-[62%] scale-[.34]" : ""}`}
		>
			{reveal === "morph" && print && (
				<span
					aria-hidden
					className={`absolute inset-0 transition-[transform,opacity] duration-500 ease-out ${morphed ? "scale-[1.16] opacity-100" : "scale-75 opacity-0"}`}
				>
					<Whorl
						attributes={print}
						turns={10}
						rim={false}
						markers={false}
						labels={false}
						animate={false}
						label={`@${shell.handle}'s taste print`}
						className="size-full"
					/>
				</span>
			)}
		</OrbitRing>
	)

	return (
		<Frame ring={props.ring}>
			<div
				className={`${WRAP} relative flex h-full items-center gap-3 sm:gap-6`}
			>
				<div className="relative flex h-full min-w-0 flex-1 items-center gap-3 sm:gap-6">
					{reveal === "pill" && <PillBackground open={open} />}
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
						{halves && <HalvesBadge match={match} />}
					</div>
					<div className="relative h-full min-w-0 flex-1">
						<div
							aria-hidden={covers || undefined}
							{...inertUnless(!covers)}
							className={`absolute inset-0 flex items-center gap-6 transition-[opacity,transform] duration-300 ease-out ${covers ? "pointer-events-none opacity-0" : "opacity-100"} ${covers && reveal === "panel" ? "-translate-y-1.5" : ""}`}
						>
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 items-center gap-3">
									<h1
										className={`${DISPLAY} min-w-0 truncate text-xl leading-7 text-white sm:text-[2.125rem] sm:leading-10`}
									>
										@{shell.handle}
									</h1>
									{compare?.look === "chip" && (
										<MatchChip
											handle={shell.handle}
											match={compare.match}
											className="max-sm:hidden"
										/>
									)}
								</div>
								{props.identity && (
									<p className="truncate text-xs font-semibold text-violet-200/75 sm:text-sm">
										{props.identity}
									</p>
								)}
								<FactLine facts={props.facts} />
								{props.since && (
									<p
										className={`mt-0.5 truncate text-[11px] leading-4 text-gray-500 sm:mt-1.5 sm:text-xs ${compare ? "max-sm:hidden" : ""}`}
										data-header-since
									>
										{props.since}
									</p>
								)}
								{compare && (
									<div className="mt-1 sm:hidden">
										<CompareRow {...compare} />
									</div>
								)}
							</div>
							{compare && compare.look !== "chip" && (
								<div className="max-sm:hidden">
									<CompareSlot {...compare} />
								</div>
							)}
						</div>
						{layer && reveal === "pill" && <PillFacts {...layer} />}
						{layer && reveal === "panel" && <PanelFacts {...layer} />}
						{layer && reveal === "morph" && <MorphFacts {...layer} />}
					</div>
				</div>
				{/* On a phone the open facts take the controls' room too; the card covers them everywhere. */}
				<div
					{...inertUnless(!(open && reveal === "card"))}
					className={covers ? "max-sm:hidden" : ""}
				>
					<ClusterControls {...props.controls} />
				</div>
				{layer && reveal === "card" && <CardFacts {...layer} />}
			</div>
		</Frame>
	)
}

// PROTOTYPE OPTIONS (member nav, round 9): where Share and View as visitor sit (nav-options.ts `controls`). Guests
// and other members get Share only. The owner gets View as visitor on the profile's pages (never on Settings) and
// Edit profile where it fits each option. View as visitor is a link that adds or drops ?as=visitor (VisitorView.tsx).
import {
	CheckIcon,
	EllipsisHorizontalIcon,
	EyeIcon,
	EyeSlashIcon,
	LinkIcon,
	PencilSquareIcon,
	ShareIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { EDIT_PROFILE_PATH } from "~/domain/member-paths"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { type ViewLinks, toggleView } from "./VisitorView"

export type ControlsLook = NavOptions["controls"]

export interface ControlsProps {
	handle: string
	/** The owner's view links on the profile's pages; null for everyone else and on Settings. */
	view: ViewLinks | null
	/** Edit profile, for the owner in their own view. */
	edit: boolean
}

/** Share on a phone opens the share sheet; elsewhere, and for Copy link, the link goes to the clipboard. */
function useShare(handle: string) {
	const [copied, setCopied] = useState(false)
	const url = `https://goodwatch.app/u/${handle}`
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(url)
		} catch {
			return
		}
		setCopied(true)
		setTimeout(() => setCopied(false), 1600)
	}
	const share = async () => {
		if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
			try {
				await navigator.share({ title: `@${handle} on GoodWatch`, url })
			} catch {
				// Closed without sharing.
			}
			return
		}
		await copy()
	}
	return { copied, share, copy }
}

const visitorLabel = (on: boolean) =>
	on ? "Back to your view" : "View as visitor"

/** A label under a round key on hover and keyboard focus. The key carries the same name as its aria-label. */
function Tip({ children }: { children: ReactNode }) {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute top-full right-0 z-40 mt-2 rounded-lg bg-gray-800 px-2 py-1 text-xs font-semibold whitespace-nowrap text-gray-100 opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
		>
			{children}
		</span>
	)
}

const ROUND =
	"group relative inline-flex size-10 shrink-0 items-center justify-center rounded-full ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const ROUND_IDLE =
	"bg-white/[0.06] text-gray-200 ring-white/15 hover:bg-white/[0.1] hover:text-white"
const ROUND_ON = "bg-amber-400 text-gray-950 ring-amber-300"

/** A round share key with its tooltip. */
function ShareKey({ handle }: { handle: string }) {
	const { copied, share } = useShare(handle)
	const name = copied ? "Link copied" : "Share profile"
	return (
		<button
			type="button"
			onClick={share}
			aria-label={name}
			className={`${ROUND} ${ROUND_IDLE}`}
		>
			{copied ? (
				<CheckIcon className="size-5" aria-hidden />
			) : (
				<ShareIcon className="size-5" aria-hidden />
			)}
			<Tip>{name}</Tip>
		</button>
	)
}

const QUIET_TEXT =
	"inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-white"

// OPTION controls=buttons
/** Two quiet text buttons at the header's right; phones show their icons only. */
function ButtonsControls({ handle, view, edit }: ControlsProps) {
	const { copied, share } = useShare(handle)
	return (
		<div className="flex shrink-0 items-center gap-1 sm:gap-2">
			<button
				type="button"
				onClick={share}
				aria-label={copied ? "Link copied" : "Share profile"}
				className={`${QUIET_TEXT} text-gray-300 hover:text-white`}
			>
				{copied ? (
					<CheckIcon className="size-5 sm:size-4" aria-hidden />
				) : (
					<ShareIcon className="size-5 sm:size-4" aria-hidden />
				)}
				<span className="max-sm:hidden">
					{copied ? "Link copied" : "Share"}
				</span>
			</button>
			{view && (
				<Link
					to={toggleView(view)}
					replace
					preventScrollReset
					aria-pressed={view.on}
					aria-label={visitorLabel(view.on)}
					className={`${QUIET_TEXT} ${view.on ? "text-amber-300 hover:text-amber-200" : "text-gray-300 hover:text-white"}`}
				>
					<EyeIcon className="size-5 sm:size-4" aria-hidden />
					<span className="max-sm:hidden">
						{view.on ? "Viewing as visitor" : "View as visitor"}
					</span>
				</Link>
			)}
			{edit && (
				<Link
					to={EDIT_PROFILE_PATH}
					prefetch="intent"
					className={`${QUIET_TEXT} text-gray-300 hover:text-white max-lg:hidden`}
				>
					<PencilSquareIcon className="size-4" aria-hidden />
					Edit profile
				</Link>
			)}
		</div>
	)
}

// OPTION controls=icons
/** Round icon keys with tooltips: Share, View as visitor, and Edit profile for the owner. */
function IconsControls({ handle, view, edit }: ControlsProps) {
	return (
		<div className="flex shrink-0 items-center gap-2">
			<ShareKey handle={handle} />
			{view && (
				<Link
					to={toggleView(view)}
					replace
					preventScrollReset
					aria-pressed={view.on}
					aria-label={visitorLabel(view.on)}
					className={`${ROUND} ${view.on ? ROUND_ON : ROUND_IDLE}`}
				>
					<EyeIcon className="size-5" aria-hidden />
					<Tip>{visitorLabel(view.on)}</Tip>
				</Link>
			)}
			{edit && (
				<Link
					to={EDIT_PROFILE_PATH}
					prefetch="intent"
					aria-label="Edit profile"
					className={`${ROUND} ${ROUND_IDLE} max-sm:hidden`}
				>
					<PencilSquareIcon className="size-5" aria-hidden />
					<Tip>Edit profile</Tip>
				</Link>
			)}
		</div>
	)
}

const ITEM =
	"flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm font-semibold text-gray-100 hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none"

// OPTION controls=menu
/** One "⋯" key that opens a small navigation menu. Guests and other members get the share key alone. */
function MenuControls({ handle, view, edit }: ControlsProps) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const key = useRef<HTMLButtonElement>(null)
	const id = useId()
	const { copied, share, copy } = useShare(handle)

	useEffect(() => {
		if (!open) return
		const onDown = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			setOpen(false)
			key.current?.focus({ preventScroll: true })
		}
		document.addEventListener("pointerdown", onDown)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("pointerdown", onDown)
			document.removeEventListener("keydown", onKey)
		}
	}, [open])

	if (!view && !edit) return <ShareKey handle={handle} />
	const close = () => setOpen(false)
	return (
		<div ref={root} className="relative shrink-0">
			<button
				ref={key}
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-controls={open ? id : undefined}
				aria-label="Profile actions"
				className={`${ROUND} ${open ? "bg-white/[0.14] text-white ring-white/25" : view?.on ? ROUND_ON : ROUND_IDLE}`}
			>
				<EllipsisHorizontalIcon className="size-6" aria-hidden />
				{!open && <Tip>Share and more</Tip>}
			</button>
			{open && (
				<nav
					id={id}
					aria-label="Profile actions"
					data-header-menu
					className="absolute top-full right-0 z-40 mt-2 w-60 origin-top-right overflow-hidden rounded-2xl bg-gray-900 py-1.5 shadow-2xl ring-1 ring-white/10 transition-[opacity,transform] duration-150 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none"
				>
					<button
						type="button"
						className={ITEM}
						onClick={async () => {
							await share()
							close()
						}}
					>
						<ShareIcon className="size-5 text-gray-400" aria-hidden />
						Share profile
					</button>
					<button type="button" className={ITEM} onClick={copy}>
						{copied ? (
							<CheckIcon className="size-5 text-amber-300" aria-hidden />
						) : (
							<LinkIcon className="size-5 text-gray-400" aria-hidden />
						)}
						{copied ? "Link copied" : "Copy link"}
					</button>
					{view && (
						<Link
							to={toggleView(view)}
							replace
							preventScrollReset
							onClick={close}
							className={ITEM}
						>
							{view.on ? (
								<EyeSlashIcon className="size-5 text-amber-300" aria-hidden />
							) : (
								<EyeIcon className="size-5 text-gray-400" aria-hidden />
							)}
							{visitorLabel(view.on)}
						</Link>
					)}
					{edit && (
						<>
							<span aria-hidden className="my-1.5 block h-px bg-white/10" />
							<Link
								to={EDIT_PROFILE_PATH}
								prefetch="intent"
								onClick={close}
								className={ITEM}
							>
								<PencilSquareIcon
									className="size-5 text-gray-400"
									aria-hidden
								/>
								Edit profile
							</Link>
						</>
					)}
				</nav>
			)}
		</div>
	)
}

// OPTION controls=row
/** In the header for the row option: Edit profile alone, as a quiet text link, for the owner. */
function RowHeaderControls({ edit }: ControlsProps) {
	if (!edit) return null
	return (
		<Link
			to={EDIT_PROFILE_PATH}
			prefetch="intent"
			aria-label="Edit profile"
			className={`${QUIET_TEXT} text-gray-400 hover:text-white`}
		>
			<PencilSquareIcon className="size-5 sm:size-4" aria-hidden />
			<span className="max-sm:hidden">Edit profile</span>
		</Link>
	)
}

const ROW_ITEM =
	"flex min-h-11 shrink-0 items-center px-2.5 transition-colors lg:min-h-12"

// OPTION controls=row
/** Small icon items at the Profile tab row's end, before the gear: Share, then View as visitor for the owner. */
export function RowControls({ handle, view }: ControlsProps) {
	const { copied, share } = useShare(handle)
	const shareName = copied ? "Link copied" : "Share profile"
	return (
		<>
			<button
				type="button"
				onClick={share}
				aria-label={shareName}
				title={shareName}
				className={`${ROW_ITEM} text-gray-500 hover:text-gray-200`}
			>
				{copied ? (
					<CheckIcon className="size-5" aria-hidden />
				) : (
					<ShareIcon className="size-5" aria-hidden />
				)}
			</button>
			{view && (
				<Link
					to={toggleView(view)}
					replace
					preventScrollReset
					aria-pressed={view.on}
					aria-label={visitorLabel(view.on)}
					title={visitorLabel(view.on)}
					className={`${ROW_ITEM} ${view.on ? "text-amber-300 hover:text-amber-200" : "text-gray-500 hover:text-gray-200"}`}
				>
					{view.on ? (
						<EyeSlashIcon className="size-5" aria-hidden />
					) : (
						<EyeIcon className="size-5" aria-hidden />
					)}
				</Link>
			)}
		</>
	)
}

/** The controls the header draws at its right for each option (the row option puts Share and the eye in the row). */
export const HEADER_CONTROLS: Record<
	ControlsLook,
	(props: ControlsProps) => ReactNode
> = {
	buttons: ButtonsControls,
	icons: IconsControls,
	menu: MenuControls,
	row: RowHeaderControls,
}

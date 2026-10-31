// The profile header's controls, one compact cluster: Share, View as visitor and Edit profile. Share opens a small
// menu that offers the whole profile and, on a tab or a list, the page you're on: each with its link and its card
// image, and Copy link and (where the device has one) Share. Guests and other members get Share only. The owner gets
// View as visitor on the profile's pages (never on Settings) and Edit profile in their own view. View as visitor is a
// link that adds or drops ?as=visitor (VisitorView.tsx).
import {
	CheckIcon,
	EyeIcon,
	EyeSlashIcon,
	LinkIcon,
	PencilSquareIcon,
	ShareIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import { EDIT_PROFILE_PATH } from "~/domain/member-paths"
import { ogImageUrl } from "~/utils/og-image-url"
import { type ViewLinks, toggleView } from "./VisitorView"

/** Something the Share menu offers: the profile, or the tab or list you're on. */
export interface ShareTarget {
	/** "Profile", "Stats tab", "This list". */
	name: string
	/** The page's path on goodwatch.app, without ?as=visitor. */
	path: string
}

export interface ControlsProps {
	handle: string
	/** The owner's view links on the profile's pages; null for everyone else and on Settings. */
	view: ViewLinks | null
	/** Edit profile, for the owner in their own view. */
	edit: boolean
	/** The profile first, then the page you're on when it isn't the profile. */
	share: ShareTarget[]
}

const FOCUS =
	"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"

/** A label under an icon key on hover and keyboard focus; the key carries the same name as its aria-label. */
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

const SEG = `group relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${FOCUS}`
const IDLE = "text-gray-300 hover:bg-white/[0.08] hover:text-white"

/**
 * The cluster. Phones show the icons, and leave Edit profile to the Settings gear.
 */
export function ClusterControls({ handle, view, edit, share }: ControlsProps) {
	return (
		<div
			className="flex shrink-0 items-center rounded-full bg-white/[0.05] p-1 ring-1 ring-white/12 sm:relative"
			data-header-controls="cluster"
		>
			<ShareMenu handle={handle} targets={share} />
			{view && (
				<Link
					to={toggleView(view)}
					replace
					preventScrollReset
					aria-pressed={view.on}
					aria-label="View as visitor"
					className={`${SEG} w-9 sm:w-auto sm:px-3 ${view.on ? "bg-amber-400 text-gray-950" : IDLE}`}
				>
					{view.on ? (
						<EyeSlashIcon className="size-[18px]" aria-hidden />
					) : (
						<EyeIcon className="size-[18px]" aria-hidden />
					)}
					<span className="max-sm:hidden">View as visitor</span>
				</Link>
			)}
			{edit && (
				<>
					<span
						aria-hidden
						className="mx-0.5 h-5 w-px bg-white/12 max-sm:hidden"
					/>
					<Link
						to={EDIT_PROFILE_PATH}
						prefetch="intent"
						aria-label="Edit profile"
						className={`${SEG} ${IDLE} w-9 max-sm:hidden`}
					>
						<PencilSquareIcon className="size-[18px]" aria-hidden />
						<Tip>Edit profile</Tip>
					</Link>
				</>
			)}
		</div>
	)
}

/** The card image's address on this host: the card route serves every host the same card. */
const cardImage = (path: string) => {
	const url = new URL(ogImageUrl(`https://goodwatch.app${path}`))
	return `${url.pathname}${url.search}`
}

/** Share, as a small menu of what to share. */
function ShareMenu({
	handle,
	targets,
}: { handle: string; targets: ShareTarget[] }) {
	const [open, setOpen] = useState(false)
	const [native, setNative] = useState(false)
	const [copied, setCopied] = useState<string | null>(null)
	const box = useRef<HTMLDivElement>(null)
	const trigger = useRef<HTMLButtonElement>(null)
	const [pageImage, setPageImage] = useState<string | null>(null)
	const id = useId()
	useEffect(() => setNative(typeof navigator.share === "function"), [])
	// The page you're on has its own card (a list's is versioned by its content): its og:image, on this host.
	useEffect(() => {
		if (!open) return
		const meta = document.querySelector<HTMLMetaElement>(
			'meta[property="og:image"]',
		)?.content
		if (!meta) return setPageImage(null)
		const url = new URL(meta, window.location.origin)
		setPageImage(`${url.pathname}${url.search}`)
	}, [open])
	const imageOf = (target: ShareTarget) =>
		pageImage && target.path === window.location.pathname.replace(/\/$/, "")
			? pageImage
			: cardImage(target.path)
	useEffect(() => {
		if (!open) return
		const onDown = (e: PointerEvent) => {
			if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			setOpen(false)
			trigger.current?.focus()
		}
		window.addEventListener("pointerdown", onDown)
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("pointerdown", onDown)
			window.removeEventListener("keydown", onKey)
		}
	}, [open])

	const copy = async (target: ShareTarget) => {
		try {
			await navigator.clipboard.writeText(`https://goodwatch.app${target.path}`)
		} catch {
			return
		}
		setCopied(target.path)
		setTimeout(() => setCopied(null), 1600)
	}
	const shareOut = async (target: ShareTarget) => {
		try {
			await navigator.share({
				title:
					target.path === `/u/${handle}`
						? `@${handle} on GoodWatch`
						: `@${handle}'s ${target.name.replace(/ tab$/, "")} on GoodWatch`,
				url: `https://goodwatch.app${target.path}`,
			})
		} catch {
			// Closed without sharing.
		}
	}

	const key = `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-colors ${FOCUS}`
	return (
		<div ref={box} className="sm:relative">
			<button
				ref={trigger}
				type="button"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen((o) => !o)}
				aria-label="Share"
				className={`${SEG} w-9 sm:w-auto sm:px-3 ${open ? "bg-white/[0.1] text-white" : IDLE}`}
			>
				<ShareIcon className="size-[18px]" aria-hidden />
				<span className="max-sm:hidden">Share</span>
			</button>
			{open && (
				<div
					id={id}
					// On a phone the menu spans the header's width (the header row is its box).
					className="absolute top-full right-4 left-4 z-40 mt-2 rounded-2xl bg-gray-900 p-1.5 shadow-2xl ring-1 ring-white/15 sm:right-0 sm:left-auto sm:w-[22rem]"
					data-share-menu
				>
					<p className="px-2.5 pt-1.5 pb-1 text-[11px] font-bold tracking-wider text-gray-500 uppercase">
						Share
					</p>
					<ul className="flex flex-col gap-1">
						{targets.map((target) => (
							<li
								key={target.path}
								className="rounded-xl p-2 hover:bg-white/[0.04]"
								data-share-target={target.path}
							>
								<div className="flex items-center gap-3">
									<img
										src={imageOf(target)}
										alt=""
										width={1200}
										height={630}
										className="aspect-[1200/630] w-24 shrink-0 rounded-md bg-white/5 object-cover ring-1 ring-white/10"
									/>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-bold text-gray-100">
											{target.name}
										</p>
										<p className="truncate text-xs text-gray-400">
											goodwatch.app{target.path}
										</p>
									</div>
								</div>
								<div className="mt-2 flex gap-1.5">
									<button
										type="button"
										onClick={() => copy(target)}
										className={`${key} bg-white/[0.06] text-gray-100 ring-1 ring-white/12 hover:bg-white/[0.1]`}
									>
										{copied === target.path ? (
											<CheckIcon className="size-4" aria-hidden />
										) : (
											<LinkIcon className="size-4" aria-hidden />
										)}
										{copied === target.path ? "Copied" : "Copy link"}
									</button>
									{native && (
										<button
											type="button"
											onClick={() => shareOut(target)}
											className={`${key} bg-white text-gray-950 hover:bg-gray-200`}
										>
											<ShareIcon className="size-4" aria-hidden />
											Share
										</button>
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}

// PROTOTYPE OPTIONS (member nav, round 10): Share, View as visitor and Edit profile, drawn as part of each header
// layout (nav-options.ts `layout`): one control cluster (inline), a centered pill group (centered), small keys in the
// facts panel's corner (split), and the card's bottom toolbar (stacked). Guests and other members get Share only. The
// owner gets View as visitor on the profile's pages (never on Settings) and Edit profile in their own view. View as
// visitor is a link that adds or drops ?as=visitor (VisitorView.tsx).
import {
	CheckIcon,
	EyeIcon,
	EyeSlashIcon,
	PencilSquareIcon,
	ShareIcon,
} from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import { EDIT_PROFILE_PATH } from "~/domain/member-paths"
import { type ViewLinks, toggleView } from "./VisitorView"

export interface ControlsProps {
	handle: string
	/** The owner's view links on the profile's pages; null for everyone else and on Settings. */
	view: ViewLinks | null
	/** Edit profile, for the owner in their own view. */
	edit: boolean
}

/** Share on a phone opens the share sheet; elsewhere the link goes to the clipboard. */
function useShare(handle: string) {
	const [copied, setCopied] = useState(false)
	const url = `https://goodwatch.app/u/${handle}`
	const share = async () => {
		if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
			try {
				await navigator.share({ title: `@${handle} on GoodWatch`, url })
			} catch {
				// Closed without sharing.
			}
			return
		}
		try {
			await navigator.clipboard.writeText(url)
		} catch {
			return
		}
		setCopied(true)
		setTimeout(() => setCopied(false), 1600)
	}
	return { copied, share }
}

const visitorLabel = (on: boolean) =>
	on ? "Back to your view" : "View as visitor"

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

/** The three controls as data, so each layout only draws them. */
function useItems({ handle, view, edit }: ControlsProps) {
	const { copied, share } = useShare(handle)
	return {
		share: {
			name: copied ? "Link copied" : "Share profile",
			short: copied ? "Copied" : "Share",
			icon: copied ? CheckIcon : ShareIcon,
			onClick: share,
		},
		view: view && {
			name: visitorLabel(view.on),
			short: view.on ? "Your view" : "Visitor view",
			icon: view.on ? EyeSlashIcon : EyeIcon,
			to: toggleView(view),
			on: view.on,
		},
		edit,
	}
}

type Items = ReturnType<typeof useItems>

function ViewLink({
	view,
	className,
	children,
}: {
	view: NonNullable<Items["view"]>
	className: string
	children: ReactNode
}) {
	return (
		<Link
			to={view.to}
			replace
			preventScrollReset
			aria-pressed={view.on}
			aria-label={view.name}
			className={className}
		>
			{children}
		</Link>
	)
}

function EditLink({
	className,
	children,
	label = true,
}: { className: string; children: ReactNode; label?: boolean }) {
	return (
		<Link
			to={EDIT_PROFILE_PATH}
			prefetch="intent"
			aria-label={label ? undefined : "Edit profile"}
			className={className}
		>
			{children}
		</Link>
	)
}

// OPTION layout=inline
/** One compact cluster: a single track holding Share, View as visitor and Edit profile. Phones show the icons, and
 * leave Edit profile to the Settings gear. */
export function ClusterControls(props: ControlsProps) {
	const items = useItems(props)
	const Share = items.share.icon
	const seg = `group relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${FOCUS}`
	const idle = "text-gray-300 hover:bg-white/[0.08] hover:text-white"
	return (
		<div
			className="flex shrink-0 items-center rounded-full bg-white/[0.05] p-1 ring-1 ring-white/12"
			data-header-controls="cluster"
		>
			<button
				type="button"
				onClick={items.share.onClick}
				aria-label={items.share.name}
				className={`${seg} ${idle} w-9 sm:w-auto sm:px-3`}
			>
				<Share className="size-[18px]" aria-hidden />
				<span className="max-sm:hidden">{items.share.short}</span>
			</button>
			{items.view && (
				<ViewLink
					view={items.view}
					className={`${seg} w-9 sm:w-auto sm:px-3 ${items.view.on ? "bg-amber-400 text-gray-950" : idle}`}
				>
					<items.view.icon className="size-[18px]" aria-hidden />
					<span className="max-sm:hidden">{items.view.name}</span>
				</ViewLink>
			)}
			{items.edit && (
				<>
					<span
						aria-hidden
						className="mx-0.5 h-5 w-px bg-white/12 max-sm:hidden"
					/>
					<EditLink
						label={false}
						className={`${seg} ${idle} w-9 max-sm:hidden`}
					>
						<PencilSquareIcon className="size-[18px]" aria-hidden />
						<Tip>Edit profile</Tip>
					</EditLink>
				</>
			)}
		</div>
	)
}

// OPTION layout=centered
/** A centered pill group under the facts: Share first, then View as visitor and Edit profile. */
export function PillControls(props: ControlsProps) {
	const items = useItems(props)
	const Share = items.share.icon
	const pill = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors sm:px-4 sm:text-sm ${FOCUS}`
	const quiet =
		"bg-white/[0.06] text-gray-100 ring-1 ring-white/15 hover:bg-white/[0.1]"
	return (
		<div
			className="flex items-center justify-center gap-2"
			data-header-controls="pills"
		>
			<button
				type="button"
				onClick={items.share.onClick}
				className={`${pill} bg-white text-gray-950 hover:bg-gray-200`}
			>
				<Share className="size-4" aria-hidden />
				<span className="sm:hidden">{items.share.short}</span>
				<span className="max-sm:hidden">{items.share.name}</span>
			</button>
			{items.view && (
				<ViewLink
					view={items.view}
					className={`${pill} ${items.view.on ? "bg-amber-400 text-gray-950" : quiet}`}
				>
					<items.view.icon className="size-4" aria-hidden />
					<span className="sm:hidden">{items.view.short}</span>
					<span className="max-sm:hidden">{items.view.name}</span>
				</ViewLink>
			)}
			{items.edit && (
				<EditLink className={`${pill} ${quiet}`}>
					<PencilSquareIcon className="size-4" aria-hidden />
					<span className="sm:hidden">Edit</span>
					<span className="max-sm:hidden">Edit profile</span>
				</EditLink>
			)}
		</div>
	)
}

// OPTION layout=split
/** Small keys in the facts panel's corner, with their names on hover. */
export function CornerControls(props: ControlsProps) {
	const items = useItems(props)
	const Share = items.share.icon
	const key = `group relative inline-flex size-8 items-center justify-center rounded-lg transition-colors ${FOCUS}`
	const idle = "text-gray-400 hover:bg-white/[0.08] hover:text-white"
	return (
		<div className="flex items-center gap-0.5" data-header-controls="corner">
			<button
				type="button"
				onClick={items.share.onClick}
				aria-label={items.share.name}
				className={`${key} ${idle}`}
			>
				<Share className="size-[18px]" aria-hidden />
				<Tip>{items.share.name}</Tip>
			</button>
			{items.view && (
				<ViewLink
					view={items.view}
					className={`${key} ${items.view.on ? "bg-amber-400 text-gray-950" : idle}`}
				>
					<items.view.icon className="size-[18px]" aria-hidden />
					<Tip>{items.view.name}</Tip>
				</ViewLink>
			)}
			{items.edit && (
				<EditLink label={false} className={`${key} ${idle}`}>
					<PencilSquareIcon className="size-[18px]" aria-hidden />
					<Tip>Edit profile</Tip>
				</EditLink>
			)}
		</div>
	)
}

const CELL = `flex h-full min-w-0 flex-1 items-center justify-center gap-2 text-[13px] font-bold transition-colors sm:text-sm ${FOCUS} focus-visible:-outline-offset-2`
const CELL_IDLE = "text-gray-300 hover:bg-white/[0.05] hover:text-white"
/** A toolbar cell for a link the layout adds (Compare). */
export const TOOLBAR_CELL = `${CELL} ${CELL_IDLE}`

// OPTION layout=stacked
/** The card's bottom toolbar: the controls share its width, divided by hairlines. `extra` adds a link (Compare). */
export function ToolbarControls(props: ControlsProps & { extra?: ReactNode }) {
	const items = useItems(props)
	const Share = items.share.icon
	const cell = CELL
	const idle = CELL_IDLE
	return (
		<div
			className="flex h-11 items-stretch divide-x divide-white/[0.08] border-t border-white/[0.08]"
			data-header-controls="toolbar"
		>
			<button
				type="button"
				onClick={items.share.onClick}
				className={`${cell} ${idle}`}
			>
				<Share className="size-[18px] shrink-0" aria-hidden />
				<span className="truncate sm:hidden">{items.share.short}</span>
				<span className="truncate max-sm:hidden">{items.share.name}</span>
			</button>
			{items.view && (
				<ViewLink
					view={items.view}
					className={`${cell} ${items.view.on ? "bg-amber-400 text-gray-950" : idle}`}
				>
					<items.view.icon className="size-[18px] shrink-0" aria-hidden />
					<span className="truncate sm:hidden">{items.view.short}</span>
					<span className="truncate max-sm:hidden">{items.view.name}</span>
				</ViewLink>
			)}
			{items.edit && (
				<EditLink className={`${cell} ${idle}`}>
					<PencilSquareIcon className="size-[18px] shrink-0" aria-hidden />
					<span className="truncate sm:hidden">Edit</span>
					<span className="truncate max-sm:hidden">Edit profile</span>
				</EditLink>
			)}
			{props.extra}
		</div>
	)
}

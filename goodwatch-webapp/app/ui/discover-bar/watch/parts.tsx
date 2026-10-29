// Pieces the Watch sub-tabs share: a block's heading row and its quiet Clear, and the content padding.
import type { ReactNode } from "react"

/** Desktop: the content area's fixed height; phones stack the blocks. */
export const tabPad = (phone: boolean) => (phone ? "py-1" : "h-full px-7 py-5")

/** A block's heading: an optional icon, the name, a quiet note, and something on the right. */
export function BlockHead({
	children,
	icon,
	note,
	right,
	id,
}: {
	children: ReactNode
	icon?: ReactNode
	note?: ReactNode
	right?: ReactNode
	id?: string
}) {
	return (
		<div className="mb-2.5 flex min-h-7 items-center gap-2">
			{icon}
			<h3 id={id} className="text-[14px] font-semibold text-gray-100">
				{children}
			</h3>
			{note && <span className="text-[12px] text-gray-500">{note}</span>}
			{right && <span className="ml-auto">{right}</span>}
		</div>
	)
}

/** Clear for one block. It keeps its place while hidden, so the heading doesn't move. */
export function ClearLink({
	show,
	onClick,
	children = "Clear",
}: {
	show: boolean
	onClick: () => void
	children?: ReactNode
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			tabIndex={show ? 0 : -1}
			aria-hidden={!show || undefined}
			className={`rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${show ? "" : "invisible"}`}
		>
			{children}
		</button>
	)
}

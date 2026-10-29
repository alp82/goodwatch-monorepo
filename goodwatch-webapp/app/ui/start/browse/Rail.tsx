// A browse rail: a native scroll row that snaps to each card, with the title page rows' circular arrows. From 768 px the
// arrows sit over the first and last card and fade out at an end; on phones a small pair sits in the rail's heading
// row. Every arrow is a button, so it works by keyboard; the rail itself scrolls by touch, wheel, and trackpad.
//
// The arrows are in the server HTML in their place (forward on, back off), so nothing moves when scripts start.
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { ChevronRightIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import { railEnds, railTarget } from "./rail-step"

export type RailNav = {
	ref: (el: HTMLUListElement | null) => void
	atStart: boolean
	atEnd: boolean
	step: (dir: 1 | -1) => void
	/** Back to the first card at once, for a rail whose cards were swapped. */
	reset: () => void
}

/**
 * Follows a rail's ends (on scroll, once a frame, and on resize) and steps it. State changes only when an end is
 * reached or left, so scrolling renders nothing.
 */
export function useRailNav(): RailNav {
	const [el, setEl] = useState<HTMLUListElement | null>(null)
	const [ends, setEnds] = useState({ atStart: true, atEnd: false })
	useEffect(() => {
		if (!el) return
		let frame = 0
		const read = () => {
			frame = 0
			const next = railEnds(el.scrollLeft, el.scrollWidth - el.clientWidth)
			setEnds((now) =>
				now.atStart === next.atStart && now.atEnd === next.atEnd ? now : next,
			)
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}
		read()
		el.addEventListener("scroll", later, { passive: true })
		const observer = new ResizeObserver(later)
		observer.observe(el)
		return () => {
			el.removeEventListener("scroll", later)
			observer.disconnect()
			cancelAnimationFrame(frame)
		}
	}, [el])
	const step = useCallback(
		(dir: 1 | -1) => {
			if (!el) return
			const style = getComputedStyle(el)
			const pad = Number.parseFloat(style.paddingLeft) || 0
			const snapPad = Number.parseFloat(style.scrollPaddingLeft) || pad
			const left = el.scrollLeft
			const box = el.getBoundingClientRect()
			const cards = Array.from(el.children, (child) => {
				const rect = child.getBoundingClientRect()
				return {
					at: rect.left - box.left + left - snapPad,
					right: rect.right - box.left + left,
					width: rect.width,
				}
			})
			const target = railTarget(
				{
					left,
					max: el.scrollWidth - el.clientWidth,
					width: el.clientWidth,
					pad,
					gap: Number.parseFloat(style.columnGap) || 0,
				},
				cards,
				dir,
			)
			const reduced = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches
			el.scrollTo({ left: target, behavior: reduced ? "auto" : "smooth" })
		},
		[el],
	)
	const reset = useCallback(() => {
		el?.scrollTo({ left: 0 })
	}, [el])
	return { ref: setEl, ...ends, step, reset }
}

function Arrows({
	nav,
	name,
	edge,
}: { nav: RailNav; name: string; edge: boolean }) {
	return (
		<>
			<button
				type="button"
				aria-label={`Previous: ${name}`}
				disabled={nav.atStart}
				onClick={() => nav.step(-1)}
				className={edge ? "sb-arrow sb-edge sb-prev" : "sb-arrow"}
			>
				<ChevronLeftIcon aria-hidden />
			</button>
			<button
				type="button"
				aria-label={`Next: ${name}`}
				disabled={nav.atEnd}
				onClick={() => nav.step(1)}
				className={edge ? "sb-arrow sb-edge sb-next" : "sb-arrow"}
			>
				<ChevronRightIcon aria-hidden />
			</button>
		</>
	)
}

/** A rail's heading row: the H3 with its line, the phone arrows, and See all to the rail's page. */
export function RailHead({
	id,
	title,
	line,
	href,
	nav,
	children,
}: {
	id: string
	title: string
	line?: string
	href?: string
	nav?: RailNav
	children?: ReactNode
}) {
	return (
		<div className="sb-head">
			<div className="sb-titles">
				<h3 id={id}>{title}</h3>
				{line && <p>{line}</p>}
			</div>
			{children}
			{nav && (
				<span className="sb-pair">
					<Arrows nav={nav} name={title} edge={false} />
				</span>
			)}
			{href && (
				<Link to={href} discover="none" className="sb-all">
					See all <span aria-hidden>→</span>
				</Link>
			)}
		</div>
	)
}

/** The rail: the list, and the edge arrows over its first and last card from 768 px. */
export function Rail({
	nav,
	name,
	className,
	children,
}: {
	nav: RailNav
	/** What the arrows and the list are named after. */
	name: string
	className?: string
	children: ReactNode
}) {
	return (
		<div className="sb-rail">
			<ul
				ref={nav.ref}
				aria-label={name}
				className={className ? `sb-row ${className}` : "sb-row"}
			>
				{children}
			</ul>
			<Arrows nav={nav} name={name} edge />
		</div>
	)
}

// The head of a Browse index page: kicker, title and lede, with an optional aside beside them (the moods lattice and
// the Top page use it). Visible breadcrumbs are left out: the Browse row above already says where you are.
import { type ReactNode, useState } from "react"
import type { TraitWord } from "~/domain/browse/types"
import { FOCUS, TraitSentence, WRAP } from "~/ui/browse/index"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"

export function Head({
	d,
	hue,
	more,
	less,
	traitTo,
	noun,
	aside,
	asideWide = false,
	after,
	children,
}: {
	d: {
		kicker: string
		title: string
		lede: string | null
		crumbs?: { label: string; to?: string }[]
	}
	hue?: string
	more?: TraitWord[]
	less?: TraitWord[]
	traitTo?: (t: TraitWord) => string
	noun?: string
	aside?: ReactNode
	asideWide?: boolean
	/** Next to the title (+ Add). */
	after?: ReactNode
	children?: ReactNode
}) {
	const [open, setOpen] = useState(false)
	return (
		<header className="relative isolate">
			{hue && (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full"
					style={{
						background: `radial-gradient(120% 100% at 15% 0%, color-mix(in oklab, ${hue} 26%, transparent) 0%, transparent 62%)`,
					}}
				/>
			)}
			<div className={`${WRAP} pt-5 pb-6 sm:pt-8 sm:pb-10`}>
				<div
					className={`grid items-start gap-x-12 gap-y-8  ${
						aside
							? asideWide
								? "lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]"
								: "lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]"
							: ""
					}`}
				>
					<div className="min-w-0">
						<Kicker className="flex items-center gap-2">
							{hue && (
								<span
									aria-hidden
									className="h-2 w-2 rounded-full"
									style={{ background: hue, boxShadow: `0 0 12px ${hue}` }}
								/>
							)}
							{d.kicker}
						</Kicker>
						<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
							<PageTitle className="text-4xl leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
								{d.title}
							</PageTitle>
							{after}
						</div>
						{d.lede && (
							<p
								className={`mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-gray-200 ${open ? "" : "max-sm:line-clamp-3"}`}
							>
								{d.lede}
							</p>
						)}
						{d.lede && d.lede.length > 130 && !open && (
							<button
								type="button"
								onClick={() => setOpen(true)}
								className={`mt-1 rounded-sm text-sm font-bold text-gray-400 hover:text-white sm:hidden ${FOCUS}`}
							>
								Read on
							</button>
						)}
						{more && more.length > 0 && (
							<TraitSentence
								more={more}
								less={less}
								to={traitTo}
								noun={noun}
								className="mt-3 max-w-2xl"
							/>
						)}
						{children}
					</div>
					{aside && <div className="min-w-0">{aside}</div>}
				</div>
			</div>
		</header>
	)
}

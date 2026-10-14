// PROTOTYPE - throwaway (#541). Variant C, "Ticker": one line at the top of the section that crawls through the ten
// titles and their reasons, like a news crawl. It stops under the pointer or the keyboard's focus; with reduced
// motion it is a strip to scroll by hand. "Expand" opens the ten as a compact list under it. The lip on the room's
// bottom edge names the first three (route: `lip`), so the room's first screen already says what is hot.
import { Link } from "@remix-run/react"
import { useState } from "react"
import { HOT } from "./data"
import { DISPLAY, Move, WhyChip, WhyIcon, hrefOf, img } from "./kit"

const CRAWL = `
@keyframes sr-crawl { from { transform: translateX(0) } to { transform: translateX(-50%) } }
.sr-crawl { animation: sr-crawl 70s linear infinite; }
.sr-strip:hover .sr-crawl, .sr-strip:focus-within .sr-crawl { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
	.sr-crawl { animation: none; }
	.sr-strip .sr-scroll { overflow-x: auto; }
	.sr-strip .sr-copy { display: none; }
}
`

function Items({ copy = false }: { copy?: boolean }) {
	return (
		<>
			{HOT.map((title, i) => (
				<li key={title.tmdb_id} className={`flex shrink-0 items-center ${copy ? "sr-copy" : ""}`} aria-hidden={copy || undefined}>
					<Link
						to={hrefOf(title)}
						discover="none"
						tabIndex={copy ? -1 : undefined}
						className="group flex h-12 items-center gap-2.5 px-4 text-sm"
					>
						<b className="tabular-nums text-amber-300/80" style={DISPLAY}>
							{i + 1}
						</b>
						<b className="whitespace-nowrap text-white group-hover:text-amber-300" style={DISPLAY}>
							{title.title}
						</b>
						<span className="flex items-center gap-1.5 whitespace-nowrap text-neutral-400">
							<span className="text-neutral-300">
								<WhyIcon kind={title.why.kind} />
							</span>
							{title.why.detail}
						</span>
						<Move move={title.move} />
					</Link>
					<span aria-hidden className="text-neutral-700">
						◆
					</span>
				</li>
			))}
		</>
	)
}

export function VariantTicker() {
	const [open, setOpen] = useState(false)
	return (
		<section aria-labelledby="talked-title" className="mb-12">
			<style>{CRAWL}</style>
			<div className="sr-strip flex h-12 items-stretch overflow-hidden rounded-full bg-black/40 ring-1 ring-inset ring-white/12">
				<h2
					id="talked-title"
					className="flex shrink-0 items-center gap-2 rounded-l-full bg-amber-300 pl-4 pr-3 text-[11px] font-black uppercase tracking-[0.16em] text-black"
					style={{ fontSize: 11, color: "#000" }}
				>
					<i className="h-2 w-2 rounded-full bg-rose-600" aria-hidden />
					<span className="hidden sm:inline">Talked about now</span>
					<span className="sm:hidden">Hot</span>
				</h2>
				<div className="sr-scroll relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-24px),transparent)] [scrollbar-width:none]">
					<ul className="sr-crawl flex w-max">
						<Items />
						<Items copy />
					</ul>
				</div>
				{/* Expand: the frame's corners move outward, as the TV's own exit does. */}
				<button
					type="button"
					onClick={() => setOpen(!open)}
					aria-expanded={open}
					className="group flex shrink-0 items-center gap-2 border-l border-white/10 px-4 text-xs font-semibold text-neutral-200 hover:text-amber-300"
				>
					<svg viewBox="0 0 16 16" className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
						<path
							d={open ? "M5 2v3H2M11 2v3h3M5 14v-3H2M11 14v-3h3" : "M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3"}
							fill="none"
							stroke="currentColor"
							strokeWidth="1.7"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
					<span className="hidden sm:inline">{open ? "Close" : "Expand"}</span>
				</button>
			</div>
			{open && (
				<ol className="mt-3 grid gap-x-8 rounded-2xl bg-white/[0.03] px-4 py-2 ring-1 ring-inset ring-white/10 sm:grid-cols-2">
					{HOT.map((title, i) => (
						<li key={title.tmdb_id} className="border-b border-white/[0.07] last:border-0 sm:[&:nth-last-child(2)]:border-0">
							<Link to={hrefOf(title)} discover="none" className="group flex items-center gap-3 py-2.5">
								<b className="w-6 text-right text-lg tabular-nums text-white/25" style={DISPLAY}>
									{i + 1}
								</b>
								<img
									src={img(title.poster_path, "w92")}
									alt=""
									width={32}
									height={48}
									loading="lazy"
									className="h-12 w-8 rounded object-cover"
								/>
								<span className="min-w-0 flex-1">
									<b className="block truncate text-[15px] text-white group-hover:text-amber-300" style={DISPLAY}>
										{title.title}
									</b>
									<span className="block truncate text-xs text-neutral-400">{title.why.detail}</span>
								</span>
								<span className="hidden sm:block">
									<WhyChip why={title.why} small />
								</span>
								<Move move={title.move} />
							</Link>
						</li>
					))}
				</ol>
			)}
		</section>
	)
}

/** The lip's line for this variant: the top three, so the room's first screen names them. One line, cut short. */
export const TICKER_LIP = (
	<span className="block max-w-[calc(100vw-7rem)] truncate">
		Talked about now: {HOT.slice(0, 3)
			.map((title) => title.title)
			.join(", ")}
	</span>
)

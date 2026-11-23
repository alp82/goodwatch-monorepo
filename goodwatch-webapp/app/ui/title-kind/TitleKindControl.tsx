import { Link } from "@remix-run/react"
import { useId, useRef } from "react"
import type { TitleFormat } from "~/domain/title-type"

type Props = {
	value: TitleFormat
	counts?: Partial<Record<TitleFormat, number | null>>
	pending?: boolean
	label?: string
} & (
	| { hrefs: Record<TitleFormat, string>; onChange?: never }
	| { onChange: (kind: TitleFormat) => void; hrefs?: never }
)

const order = ["movie", "all", "show"] as const
const words = { movie: "Movies", all: "&", show: "Shows" }
const widths = { movie: 70, all: 22, show: 64 }
const slide = "duration-300 ease-out motion-reduce:transition-none"

/** The two words pick a format. The ampersand includes both, or restores the previous single format. */
export function TitleKindControl({
	value,
	hrefs,
	onChange,
	counts,
	pending,
	label = "Movies or shows",
}: Props) {
	const groupName = useId()
	const last = useRef<"movie" | "show">(value === "show" ? "show" : "movie")
	if (value !== "all") last.current = value
	const cells = order.map((kind) => {
		const count = counts?.[kind]?.toLocaleString("en-US")
		const width = Math.max(widths[kind], count ? count.length * 8 + 16 : 0)
		const content = (
			<>
				{words[kind]}
				{count && (
					<small className={`text-[10px] leading-none tabular-nums ${pending ? "invisible" : ""}`}>
						{count}
					</small>
				)}
			</>
		)
		return { kind, width, content }
	})
	const [movie, both, show] = cells
	const left = value === "show" ? movie.width + both.width : 0
	const right = value === "movie" ? both.width + show.width : 0
	const cell =
		"flex h-8 shrink-0 flex-col items-center justify-center rounded-full text-sm leading-tight font-bold"
	const Tag = hrefs ? "nav" : "div"
	return (
		<Tag
			data-kind-filter
			aria-label={hrefs ? "Movies, shows, or both" : label}
			role={hrefs ? undefined : "radiogroup"}
			className="relative inline-flex w-fit shrink-0 rounded-full bg-white/[0.08] p-1 ring-1 ring-white/[0.14] select-none group-data-[kband]:rounded-l-none group-data-[kband]:ring-0 group-data-[kband]:shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-1px_0_rgb(255_255_255/0.14),inset_-1px_0_0_rgb(255_255_255/0.14)]"
		>
			<div className="relative flex rounded-full has-[[data-amp]:hover]:bg-white/10 has-[[data-amp]:focus-visible]:bg-white/10">
				{cells.map(({ kind, width, content }) => {
					const amp = kind === "all"
					const target = amp && value === "all" ? last.current : kind
					const title = amp
						? value === "all"
							? `Only ${words[last.current].toLowerCase()}`
							: "Movies and shows together"
						: `Only ${words[kind].toLowerCase()}`
					const props = {
						style: { width },
						"data-kind": kind,
						"data-amp": amp || undefined,
						title,
						className: `${cell} relative cursor-pointer text-gray-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-amber-400 ${amp ? "z-10 before:absolute before:inset-y-0 before:-inset-x-1.5" : ""}`,
					}
					return hrefs ? (
						<Link
							key={kind}
							{...props}
							aria-label={amp ? title : undefined}
							aria-current={value === kind ? "page" : undefined}
							to={hrefs[target]}
							prefetch="intent"
						>
							{content}
						</Link>
					) : (
						<label key={kind} {...props}>
							<input
								className="sr-only"
								type="radio"
								name={groupName}
								value={kind}
								aria-label={amp ? "Movies and shows together" : undefined}
								checked={value === kind}
								onChange={() => onChange(kind)}
								onClick={() => {
									if (amp && value === "all") onChange(last.current)
								}}
							/>
							{content}
						</label>
					)
				})}
				<div
					aria-hidden
					className={`pointer-events-none absolute inset-0 z-20 flex bg-white text-gray-950 transition-[clip-path] ${slide}`}
					style={{ clipPath: `inset(0 ${right}px 0 ${left}px round 16px)` }}
				>
					{cells.map(({ kind, width, content }) => (
						<span key={kind} className={cell} style={{ width }}>
							{content}
						</span>
					))}
				</div>
				<span
					aria-hidden
					className={`pointer-events-none absolute inset-y-0 z-20 rounded-full ring-2 ring-amber-400 ring-inset transition-[left,right] ${slide}`}
					style={{ left, right }}
				/>
			</div>
		</Tag>
	)
}

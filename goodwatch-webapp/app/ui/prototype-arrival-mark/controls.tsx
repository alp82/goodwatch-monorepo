// PROTOTYPE - throwaway. The prototype's own controls for /prototype/arrival-mark, none of them part of a design
// (white, fuchsia ring): the page, the sample member, the title of the title page, "Next day", the state panel, and
// the pill that switches the variation.
import { useEffect, useState } from "react"
import {
	MEMBERS,
	type MemberKey,
	SERVICES,
	START_DAY,
	TITLES,
	VARIANTS,
	type VariantKey,
	addDays,
	ageWords,
	dayMonth,
	goneWhy,
	serviceNames,
	titleOf,
} from "./model"
import type { Ctx } from "./parts"

export const PAGES = {
	movies: "My movies",
	shows: "My shows",
	want: "Want to See",
	title: "Title page",
} as const
export type PageKey = keyof typeof PAGES

const white =
	"h-9 max-w-[46vw] cursor-pointer rounded-lg bg-white px-2.5 text-xs font-semibold text-black"

export function Controls({
	ctx,
	page,
	titleKey,
	opened,
	set,
	reset,
	hidden,
}: {
	ctx: Ctx
	page: PageKey
	titleKey: string
	opened: ReadonlySet<string>
	set: (next: Record<string, string>) => void
	reset: () => void
	hidden: boolean
}) {
	const { variant, member, day } = ctx
	const [state, setState] = useState(false)
	const [more, setMore] = useState<boolean | null>(null)
	const keys = Object.keys(VARIANTS)
	const cycle = (step: number) =>
		set({
			variant: keys[(keys.indexOf(variant) + step + keys.length) % keys.length],
		})
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (
				(e.target as HTMLElement).closest(
					"input, textarea, select, [contenteditable]",
				)
			)
				return
			if (e.key === "ArrowLeft") cycle(-1)
			if (e.key === "ArrowRight") cycle(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	if (process.env.NODE_ENV === "production") return null
	if (hidden)
		return (
			<button
				type="button"
				onClick={() => set({ chrome: "" })}
				aria-label="Show the prototype controls"
				data-chrome
				className="fixed bottom-[84px] left-2 z-[1050] h-6 w-6 cursor-pointer rounded-full bg-white text-[10px] font-black text-fuchsia-600 opacity-60 ring-2 ring-fuchsia-500 lg:bottom-3"
			>
				P
			</button>
		)
	// Wide screens show everything; a phone shows the pill and opens the rest on request.
	const rest = more === null ? "hidden lg:flex" : more ? "flex" : "hidden"
	return (
		<div
			className="pointer-events-none fixed inset-x-2 bottom-[84px] z-[1050] flex flex-col items-center gap-1.5 lg:bottom-3 [&>*]:pointer-events-auto"
			data-chrome
		>
			{state && <StatePanel ctx={ctx} opened={opened} />}
			<div
				className={`${rest} max-w-full flex-wrap items-center justify-center gap-1.5`}
			>
				<div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl bg-white/95 p-1 shadow-2xl ring-2 ring-fuchsia-500">
					{Object.entries(PAGES).map(([key, name]) => (
						<button
							key={key}
							type="button"
							data-page={key}
							onClick={() => set({ page: key })}
							className={`h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-2.5 text-xs font-bold ${key === page ? "bg-fuchsia-600 text-white" : "text-black hover:bg-neutral-200"}`}
						>
							{name}
						</button>
					))}
				</div>
				<select
					aria-label="Sample member"
					value={member}
					onChange={(e) => set({ member: e.target.value })}
					className={white}
				>
					{Object.entries(MEMBERS).map(([key, m]) => (
						<option key={key} value={key}>
							{m.label}
						</option>
					))}
				</select>
				{page === "title" && (
					<select
						aria-label="The title of the title page"
						value={titleKey}
						onChange={(e) => set({ title: e.target.value })}
						className={white}
					>
						{TITLES.map((title) => (
							<option key={title.key} value={title.key}>
								{title.title}
								{title.key in MEMBERS[member].landed ? " (arrived)" : ""}
							</option>
						))}
					</select>
				)}
				<button
					type="button"
					onClick={() => set({ day: String(day + 1) })}
					className={white}
					data-next-day
				>
					{dayMonth(addDays(START_DAY, day))} · Next day ›
				</button>
				<button
					type="button"
					onClick={() => set({ visit: ctx.firstVisit ? "" : "first" })}
					className={`${white} ${ctx.firstVisit ? "!bg-fuchsia-200" : ""}`}
					title="Also show the line the real pages say on the first visit after a landing"
				>
					First visit
				</button>
				<button
					type="button"
					onClick={() => setState((s) => !s)}
					className={`${white} ${state ? "!bg-fuchsia-200" : ""}`}
					data-state-toggle
				>
					State
				</button>
				<button type="button" onClick={reset} className={white}>
					Reset
				</button>
				<button
					type="button"
					onClick={() => set({ chrome: "off" })}
					className={white}
					title="Hide these controls"
				>
					Hide
				</button>
			</div>
			<div
				className="flex items-center gap-1 rounded-full bg-white px-1.5 py-1 text-xs font-semibold text-black shadow-2xl ring-2 ring-fuchsia-500 lg:text-sm"
				data-switcher
			>
				<button
					type="button"
					onClick={() => setMore(more === null ? true : !more)}
					className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200 lg:hidden"
					aria-label="More prototype controls"
					data-more
				>
					⋯
				</button>
				<button
					type="button"
					onClick={() => cycle(-1)}
					className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200"
					aria-label="Previous variation"
				>
					←
				</button>
				<span className="min-w-28 text-center lg:min-w-36">
					{variant} · {VARIANTS[variant].name}
				</span>
				<button
					type="button"
					onClick={() => cycle(1)}
					className="cursor-pointer rounded-full px-2.5 py-1 hover:bg-neutral-200"
					aria-label="Next variation"
				>
					→
				</button>
			</div>
		</div>
	)
}

/** The full state after every action: what landed, how old it is, and what this variation makes of it. */
function StatePanel({
	ctx,
	opened,
}: { ctx: Ctx; opened: ReadonlySet<string> }) {
	const { variant, member, day, marks } = ctx
	const today = addDays(START_DAY, day)
	const landed = Object.entries(MEMBERS[member].landed)
	return (
		<div
			className="max-h-[62vh] w-[min(94vw,44rem)] overflow-auto rounded-xl bg-white p-3 text-xs text-black shadow-2xl ring-2 ring-fuchsia-500"
			data-state
		>
			<p>
				<b>
					{variant} · {VARIANTS[variant].name}:
				</b>{" "}
				{VARIANTS[variant].bet}
			</p>
			<p className="mt-1">
				<b>Today:</b> {dayMonth(today)} · <b>member:</b> {MEMBERS[member].label}{" "}
				· <b>services:</b>{" "}
				{Object.entries(SERVICES)
					.filter(([key]) => key !== "prime")
					.map(([, service]) => service.name)
					.join(", ")}
			</p>
			<p className="mt-1">
				<b>Marks on screen:</b> {marks.size} of {landed.length} landed ·{" "}
				<b>opened:</b>{" "}
				{opened.size
					? [...opened].map((key) => titleOf(key).title).join(", ")
					: "nothing"}
				{variant === "B" && ` · chip ${ctx.only ? "on" : "off"}`}
				{variant === "C" && ` · sort ${ctx.sort}`}
			</p>
			<table className="mt-2 w-full border-collapse text-left">
				<thead>
					<tr className="border-b border-black/20">
						<th className="py-1 pr-2">Title</th>
						<th className="pr-2">Landed on</th>
						<th className="pr-2">When</th>
						<th>Mark in {variant}</th>
					</tr>
				</thead>
				<tbody>
					{landed.map(([key, { on, ago }]) => {
						const age = ago + day
						const gone = goneWhy(variant, age, opened.has(key))
						return (
							<tr key={key} className="border-b border-black/10 align-top">
								<td className="py-1 pr-2 font-semibold">
									{titleOf(key).title}
								</td>
								<td className="pr-2">{serviceNames(on)}</td>
								<td className="pr-2">
									{dayMonth(addDays(today, -age))}, {ageWords(age)}
								</td>
								<td className={gone ? "" : "font-bold"}>
									{gone
										? `Gone: ${gone}`
										: marks.get(key)?.state === "quiet"
											? "Quiet"
											: "Shown"}
								</td>
							</tr>
						)
					})}
					{!landed.length && (
						<tr>
							<td className="py-1" colSpan={4}>
								Nothing landed.
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	)
}

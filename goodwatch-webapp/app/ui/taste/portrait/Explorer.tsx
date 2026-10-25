import { ProfileCard } from "~/ui/profile/ProfileCard"
// What pulls you: the attribute list flows down columns of seven rows beside the picked attribute's name, meaning and
// numbers, with the titles it defines most across the full width underneath. The list area always holds seven rows
// (below lg it scrolls inside them), the detail always holds two lines of meaning, and the titles always hold six
// slots, so a family switch never moves the page at any width.
import {
	FAMILY_COLOR,
	FAMILY_NAMES,
	FAMILY_ORDER,
	type TasteAttribute,
	pct,
	signed,
	useTaste,
} from "~/ui/profile/taste/model"
import { type PrintState, explorerRows } from "./print-state"

const ROW_REM = 2.5
const PER_COLUMN = 7
const TITLES = 6

export function Explorer({ state }: { state: PrintState }) {
	const { taste, attributeByKey, title } = useTaste()
	const { rows, max } = explorerRows(taste.attributes, state.family)
	const picked = attributeByKey.get(state.key) as TasteAttribute
	const columns = Math.max(1, Math.ceil(rows.length / PER_COLUMN))
	const defining = picked.defining.map(title)
	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-col gap-2">
				<FamilyButtons state={state} />
				<p className="text-xs text-gray-500">
					{state.family
						? FAMILY_NAMES[state.family].line
						: "What sets you apart most, either way."}
				</p>
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
				<ul
					key={state.family ?? "strongest"}
					className="grid h-[var(--box)] auto-rows-[2.5rem] gap-x-4 overflow-y-auto overscroll-contain lg:overflow-visible lg:grid-flow-col lg:grid-rows-[repeat(7,2.5rem)] lg:[grid-template-columns:repeat(var(--cols),minmax(0,1fr))]"
					style={{
						["--box" as string]: `${PER_COLUMN * ROW_REM}rem`,
						["--cols" as string]: columns,
					}}
				>
					{rows.map((a) => (
						<li
							key={a.key}
							className="min-w-0"
							style={{ height: `${ROW_REM}rem` }}
						>
							<button
								type="button"
								onClick={() => state.pickAttribute(a.key)}
								aria-pressed={a.key === state.key}
								className={`grid h-full w-full cursor-pointer grid-cols-[minmax(0,8.5rem)_1fr_2.5rem] items-center gap-2 rounded-lg px-2 text-left text-sm ${a.key === state.key ? "bg-white/10" : "hover:bg-white/5"}`}
							>
								<span className="truncate text-gray-200">
									<span aria-hidden className="mr-1.5">
										{a.emoji}
									</span>
									{a.label}
								</span>
								<Bar edge={a.edge} max={max} color={FAMILY_COLOR[a.family]} />
								<span
									className={`text-right text-xs font-bold tabular-nums ${a.edge > 0 ? "text-gray-200" : "text-gray-500"}`}
								>
									{signed(a.edge)}
								</span>
							</button>
						</li>
					))}
				</ul>
				<div
					className="order-first flex flex-col gap-4 rounded-xl bg-gray-950/60 p-5 ring-1 ring-white/10 lg:order-none lg:h-[17.5rem]"
					aria-live="polite"
				>
					<div>
						<div className="flex items-center gap-3">
							<span className="min-w-0 truncate text-2xl font-black text-white">
								<span aria-hidden className="mr-2">
									{picked.emoji}
								</span>
								{picked.label}
							</span>
							<span
								className="ml-auto shrink-0 text-xs font-semibold"
								style={{ color: FAMILY_COLOR[picked.family] }}
							>
								{FAMILY_NAMES[picked.family].name}
							</span>
						</div>
						<p className="mt-1 line-clamp-2 min-h-[3rem] text-gray-400">
							{picked.meaning}
						</p>
					</div>
					<dl className="mt-auto grid grid-cols-3 gap-2 text-center">
						<Stat label="of your titles" value={pct(picked.share)} />
						<Stat label="of everyone's" value={pct(picked.everyoneShare)} />
						<Stat
							label="your scores vs everyone's"
							value={picked.vs == null ? "–" : signed(picked.vs)}
							tone={picked.vs ?? 0}
						/>
					</dl>
				</div>
			</div>
			<div>
				<p className="mb-2 text-xs text-gray-500">Defined by {picked.label}</p>
				<div className="relative">
					<ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
						{Array.from({ length: TITLES }, (_, i) => {
							const t = defining[i]
							return (
								<li key={t?.key ?? `empty-${i}`}>
									{t ? (
										<ProfileCard title={t} />
									) : (
										<span className="block aspect-[2/3] rounded-lg bg-white/[0.03]" />
									)}
								</li>
							)
						})}
					</ul>
					{defining.length === 0 && (
						<p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-gray-500">
							None of the titles you scored 7 or more stands out for{" "}
							{picked.label} yet.
						</p>
					)}
				</div>
			</div>
		</div>
	)
}

/** Strongest and the five families. */
function FamilyButtons({ state }: { state: PrintState }) {
	return (
		<div
			className="flex flex-wrap gap-1.5"
			// biome-ignore lint/a11y/useSemanticElements: a labelled group of toggle buttons
			role="group"
			aria-label="Families"
		>
			<FamilyButton
				on={!state.family}
				onClick={() => state.pickFamily(null)}
				color="#f59e0b"
			>
				Strongest
			</FamilyButton>
			{FAMILY_ORDER.map((id) => (
				<FamilyButton
					key={id}
					on={state.family === id}
					onClick={() => state.pickFamily(state.family === id ? null : id)}
					color={FAMILY_COLOR[id]}
				>
					{FAMILY_NAMES[id].name}
				</FamilyButton>
			))}
		</div>
	)
}

function Stat({
	label,
	value,
	tone = 0,
}: { label: string; value: string; tone?: number }) {
	return (
		<div className="rounded-lg bg-white/[0.04] px-2 py-2.5">
			<dd
				className={`text-xl font-black tabular-nums ${tone > 0 ? "text-green-400" : tone < 0 ? "text-rose-400" : "text-white"}`}
			>
				{value}
			</dd>
			<dt className="text-[11px] leading-tight text-gray-500">{label}</dt>
		</div>
	)
}

/** A bar from the centre line, right when sought and left when avoided; it grows with transform only. */
function Bar({
	edge,
	max,
	color,
	thin = false,
}: { edge: number; max: number; color: string; thin?: boolean }) {
	const size = Math.min(1, Math.abs(edge) / max)
	return (
		<span
			className={`relative block overflow-hidden rounded-full bg-white/[0.06] ${thin ? "h-1.5" : "h-2.5"}`}
		>
			<span className="absolute inset-y-0 left-1/2 z-10 w-px bg-white/25" />
			<span
				className={`absolute inset-y-0 w-1/2 rounded-full transition-transform duration-500 ease-out ${edge >= 0 ? "left-1/2 origin-left" : "right-1/2 origin-right"}`}
				style={{
					background: color,
					opacity: edge > 0 ? 1 : 0.55,
					transform: `scaleX(${size})`,
				}}
			/>
		</span>
	)
}

function FamilyButton({
	on,
	onClick,
	color,
	children,
}: { on: boolean; onClick: () => void; color: string; children: string }) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-bold ring-1 transition-colors ${on ? "bg-white/10 text-white ring-white/40" : "text-gray-400 ring-white/10 hover:text-white"}`}
		>
			<span
				aria-hidden
				className="size-2.5 rounded-full"
				style={{ background: color }}
			/>
			{children}
		</button>
	)
}

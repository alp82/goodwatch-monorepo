// PROTOTYPE (discover-easy) round 14: other ways to draw Advanced's filter row (Titles & people, Mood, Watch, You).
// tray: today's bar joined to the search as one unit; chips: compact pills that fit their content; cards: four tiles
// with a tinted icon and a large value; icons: today's segments, each led by a tinted icon tile.
import { ChevronDownIcon, FaceSmileIcon, TvIcon, UserGroupIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import type { ComponentType, Ref } from "react"
import { type BarProviders, Lead, TabBadge, ValueText } from "~/ui/discover-bar/DiscoverBar"
import { MAIN_TABS, type MainTab, type TabValue } from "~/ui/discover-bar/tabs"

export type BarLook = "today" | "tray" | "chips" | "cards" | "icons"

const ICON: Record<MainTab, { Icon: ComponentType<{ className?: string }>; tint: string; text: string }> = {
	search: { Icon: UserGroupIcon, tint: "bg-sky-400/15", text: "text-sky-300" },
	mood: { Icon: FaceSmileIcon, tint: "bg-pink-400/15", text: "text-pink-300" },
	watch: { Icon: TvIcon, tint: "bg-emerald-400/15", text: "text-emerald-300" },
	you: { Icon: FingerPrintIcon, tint: "bg-amber-400/15", text: "text-amber-300" },
}

interface Props {
	look: Exclude<BarLook, "today" | "tray">
	values: Record<MainTab, TabValue>
	active: MainTab | null
	onPick: (tab: MainTab) => void
	providers: BarProviders
	barRef?: Ref<HTMLDivElement>
	panelId: string
}

export function BarLookRow({ look, values, active, onPick, providers, barRef, panelId }: Props) {
	if (look === "chips")
		return (
			<div ref={barRef} role="group" aria-label="Discover filters" className="flex flex-wrap items-center gap-2">
				{MAIN_TABS.map((tab) => {
					const v = values[tab]
					const { Icon, text } = ICON[tab]
					const on = active === tab
					const set = !!v.value && !v.locked
					return (
						<button
							key={tab}
							type="button"
							data-tab={tab}
							aria-expanded={on}
							aria-controls={on ? panelId : undefined}
							onClick={() => onPick(tab)}
							className={`flex h-11 cursor-pointer items-center gap-2 rounded-full pr-3 pl-3.5 text-sm ring-1 transition ${
								on
									? "bg-white/[0.12] ring-white/30"
									: set
										? "bg-white/[0.07] ring-white/15 hover:bg-white/[0.1]"
										: "bg-white/[0.035] ring-white/10 hover:bg-white/[0.07]"
							}`}
						>
							<Icon className={`h-4 w-4 ${text}`} />
							<span className="font-semibold text-gray-300">{v.label}</span>
							{set && (
								<span className="flex max-w-56 min-w-0 items-center gap-1.5 border-l border-white/10 pl-2">
									<Lead value={v} providers={providers} phone={false} />
									<ValueText value={v} phone={false} />
								</span>
							)}
							{v.locked && <ValueText value={v} phone={false} />}
							<TabBadge n={v.badge} />
							<ChevronDownIcon className={`h-4 w-4 text-gray-500 transition ${on ? "rotate-180" : ""}`} />
						</button>
					)
				})}
			</div>
		)
	if (look === "cards")
		return (
			<div ref={barRef} role="group" aria-label="Discover filters" className="grid grid-cols-4 gap-3">
				{MAIN_TABS.map((tab) => {
					const v = values[tab]
					const { Icon, tint, text } = ICON[tab]
					const on = active === tab
					return (
						<button
							key={tab}
							type="button"
							data-tab={tab}
							aria-expanded={on}
							aria-controls={on ? panelId : undefined}
							onClick={() => onPick(tab)}
							className={`relative flex min-w-0 cursor-pointer items-center gap-3 rounded-[22px] px-4 py-3.5 text-left ring-1 transition ${
								on ? "bg-white/[0.1] ring-white/30" : "bg-white/[0.035] ring-white/10 hover:bg-white/[0.06]"
							}`}
						>
							<span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${tint}`}>
								<Icon className={`h-5 w-5 ${text}`} />
							</span>
							<span className="flex min-w-0 flex-col">
								<span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-gray-400 uppercase">
									{v.label}
									<TabBadge n={v.badge} />
								</span>
								<span className="mt-0.5 flex min-w-0 items-center gap-2">
									<Lead value={v} providers={providers} phone={false} />
									<ValueText value={v} phone={false} />
								</span>
							</span>
							{on && <span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-amber-400" />}
						</button>
					)
				})}
			</div>
		)
	// icons: one bar, each segment led by a tinted icon tile.
	return (
		<div
			ref={barRef}
			role="group"
			aria-label="Discover filters"
			className="flex h-[72px] items-stretch rounded-full bg-white/[0.045] p-1.5 ring-1 ring-white/10"
		>
			{MAIN_TABS.map((tab, i) => {
				const v = values[tab]
				const { Icon, tint, text } = ICON[tab]
				const on = active === tab
				return (
					<button
						key={tab}
						type="button"
						data-tab={tab}
						aria-expanded={on}
						aria-controls={on ? panelId : undefined}
						onClick={() => onPick(tab)}
						className={`relative flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-full px-3 text-left transition ${
							on ? "bg-white/[0.1] ring-1 ring-white/20" : "hover:bg-white/[0.05]"
						}`}
					>
						<span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tint}`}>
							<Icon className={`h-5 w-5 ${text}`} />
						</span>
						<span className="flex min-w-0 flex-col">
							<span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-gray-400 uppercase">
								{v.label}
								<TabBadge n={v.badge} />
							</span>
							<span className="flex min-w-0 items-center gap-2">
								<Lead value={v} providers={providers} phone={false} />
								<ValueText value={v} phone={false} />
							</span>
						</span>
						{i < MAIN_TABS.length - 1 && !on && active !== MAIN_TABS[i + 1] && (
							<span className="absolute top-1/2 -right-px h-8 w-px -translate-y-1/2 bg-white/10" />
						)}
					</button>
				)
			})}
		</div>
	)
}

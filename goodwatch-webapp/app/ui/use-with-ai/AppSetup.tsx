// The app picker and the selected app's setup, for /use-with-ai. The picker is a tab list (arrow keys move along it);
// the setup is its panel: the button to press first, the app's own steps as bullets (the page's steps are already
// numbered), and the by-hand way behind a disclosure.
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline"
import { Fragment, type KeyboardEvent, useRef } from "react"
import { AppBadge } from "~/ui/connector/AppBadge"
import { CopyField } from "~/ui/connector/CopyField"
import {
	APP_GUIDES,
	type AppGuide,
	type GuideKey,
} from "~/ui/connector/app-guides"
import { More, OpenButton } from "~/ui/connector/help-parts"

export const SETUP_PANEL_ID = "app-setup"
const tabId = (key: GuideKey) => `app-tab-${key}`

function GuideMark({ app }: { app: GuideKey }) {
	if (app !== "other") return <AppBadge app={app} size="sm" />
	return (
		<span
			aria-hidden="true"
			className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-lg font-bold text-gray-300 ring-1 ring-white/15"
		>
			+
		</span>
	)
}

export function AppPicker({
	selected,
	onSelect,
}: { selected: GuideKey; onSelect: (key: GuideKey) => void }) {
	const tabs = useRef<Partial<Record<GuideKey, HTMLButtonElement | null>>>({})

	const onKeyDown = (event: KeyboardEvent, index: number) => {
		const last = APP_GUIDES.length - 1
		const to =
			event.key === "ArrowRight" || event.key === "ArrowDown"
				? index === last
					? 0
					: index + 1
				: event.key === "ArrowLeft" || event.key === "ArrowUp"
					? index === 0
						? last
						: index - 1
					: event.key === "Home"
						? 0
						: event.key === "End"
							? last
							: null
		if (to === null) return
		event.preventDefault()
		const key = APP_GUIDES[to].key
		onSelect(key)
		tabs.current[key]?.focus()
	}

	return (
		<div
			role="tablist"
			aria-label="Pick your app"
			className="grid grid-cols-3 gap-2 sm:grid-cols-5"
		>
			{APP_GUIDES.map((guide, index) => {
				const on = guide.key === selected
				return (
					<button
						key={guide.key}
						ref={(node) => {
							tabs.current[guide.key] = node
						}}
						type="button"
						role="tab"
						id={tabId(guide.key)}
						aria-selected={on}
						aria-controls={SETUP_PANEL_ID}
						tabIndex={on ? 0 : -1}
						onClick={() => onSelect(guide.key)}
						onKeyDown={(event) => onKeyDown(event, index)}
						className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl px-1 py-3 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-amber-950/40 ring-2 ring-amber-500" : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]"}`}
					>
						<GuideMark app={guide.key} />
						<span
							className={`text-xs font-semibold leading-tight sm:text-sm ${on ? "text-white" : "text-gray-300"}`}
						>
							{guide.name}
						</span>
					</button>
				)
			})}
		</div>
	)
}

function Action({ guide }: { guide: AppGuide }) {
	const { action, extraAction, note } = guide
	if (!action)
		return note ? <p className="text-sm text-gray-400">{note}</p> : null
	return (
		<div className="flex flex-col items-start gap-2">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<OpenButton href={action.href} external={action.external}>
					{action.label}
					{action.external && (
						<>
							<ArrowTopRightOnSquareIcon
								className="h-5 w-5"
								aria-hidden="true"
							/>
							<span className="sr-only">(opens in a new tab)</span>
						</>
					)}
				</OpenButton>
				{extraAction && (
					<a
						href={extraAction.href}
						className="text-sm font-semibold text-amber-500 hover:text-amber-400"
					>
						{extraAction.label}
					</a>
				)}
			</div>
			{note && <p className="text-sm text-gray-400">{note}</p>}
		</div>
	)
}

/** The selected app's own part of the setup: what to press, its steps, and the by-hand way. */
export function AppSetup({ guide }: { guide: AppGuide }) {
	const steps = [
		...(guide.commands ?? []).map((command) => (
			<Fragment key={command.text}>
				{command.label}
				<div className="mt-2">
					<CopyField
						text={command.text}
						label={`Copy the ${guide.name} command`}
					/>
				</div>
			</Fragment>
		)),
		...guide.steps,
	]
	return (
		<div
			id={SETUP_PANEL_ID}
			role="tabpanel"
			aria-labelledby={tabId(guide.key)}
			className="flex flex-col gap-5"
		>
			<Action guide={guide} />
			{steps.length > 0 && (
				<ul className="flex flex-col gap-4">
					{steps.map((step, index) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list per app
							key={index}
							className="flex gap-3 leading-relaxed before:mt-2.5 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-amber-500"
						>
							<div className="min-w-0 flex-1">{step}</div>
						</li>
					))}
				</ul>
			)}
			{guide.manual && (
				<More title={guide.manual.title}>{guide.manual.body}</More>
			)}
		</div>
	)
}

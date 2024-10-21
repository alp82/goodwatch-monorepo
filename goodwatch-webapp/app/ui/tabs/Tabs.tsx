import React, { type ComponentType, type HTMLAttributes } from "react"
import UserAction from "~/ui/auth/UserAction"
import { useUser } from "~/utils/auth"

export interface Tab<T> {
	key: T
	label?: string
	icon?: ComponentType<HTMLAttributes<SVGElement>>
	current?: boolean
	requiresLogin?: boolean
}

export interface TabsProps<T> {
	title?: string
	tabs: Tab<T>[]
	pills?: boolean
	size?: "small" | "large"
	onSelect: (tab: Tab<T>) => void
}

export default function Tabs<T extends string>({
	title,
	tabs,
	pills = false,
	size = "large",
	onSelect,
}: TabsProps<T>) {
	const user = useUser()
	const handleClick = () => {}

	const renderedTabs = (
		<div
			className={`
			flex flex-wrap items-center gap-4 sm:gap-6
			${size === "small" && "text-sm sm:text-base md:text-lg"}
			${size === "large" && "text-base sm:text-lg md:text-xl"}
		`}
		>
			{title && <span className="mx-2 text-xs text-gray-300">{title}</span>}
			{tabs.map((tab) => (
				<UserAction
					key={tab.key}
					requiresLogin={tab.requiresLogin}
					instructions={<>Quickly pre-select your streaming services.</>}
				>
					<span
						onClick={() => onSelect(tab)}
						onKeyDown={() => null}
						className={`
            ${
							tab.current
								? "border-indigo-500 text-indigo-200"
								: "border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-300"
						}
            ${pills ? "rounded-md px-2 py-1" : "group border-b-2 py-2 px-1"}
            ${tab.current && pills && "bg-teal-900"}
            cursor-pointer inline-flex items-center font-bold
          `}
						aria-current={tab.current ? "page" : undefined}
					>
						{tab.icon && (
							<tab.icon
								className={`
              -ml-0.5 mr-2 h-5 w-5
            `}
								aria-hidden="true"
							/>
						)}
						<span>{tab.label}</span>
					</span>
				</UserAction>
			))}
		</div>
	)

	return (
		<div>
			{/*<div className="xs:hidden">*/}
			{/*	<label htmlFor="tabs" className="sr-only">*/}
			{/*		Select a tab*/}
			{/*	</label>*/}
			{/*	<select*/}
			{/*		id="tabs"*/}
			{/*		name="tabs"*/}
			{/*		className="block w-full rounded-md border-gray-300 bg-gray-700 py-2 px-3 leading-5 text-gray-300 focus:border-indigo-500 focus:ring-indigo-500"*/}
			{/*		defaultValue={tabs.find((tab) => tab.current)?.key}*/}
			{/*		onChange={(e) => {*/}
			{/*			const tab = tabs.find((tab) => tab.key === e.target.value)*/}
			{/*			if (tab) {*/}
			{/*				onSelect(tab)*/}
			{/*			}*/}
			{/*		}}*/}
			{/*	>*/}
			{/*		{tabs.map((tab) => (*/}
			{/*			<option key={tab.key} value={tab.key}>*/}
			{/*				{tab.label}*/}
			{/*			</option>*/}
			{/*		))}*/}
			{/*	</select>*/}
			{/*</div>*/}
			<div className="block">
				{pills ? (
					<nav className="flex space-x-4" aria-label="Tabs">
						{renderedTabs}
					</nav>
				) : (
					<div className="border-b border-gray-200">
						<nav className="-mb-px flex space-x-8" aria-label="Tabs">
							{renderedTabs}
						</nav>
					</div>
				)}
			</div>
		</div>
	)
}

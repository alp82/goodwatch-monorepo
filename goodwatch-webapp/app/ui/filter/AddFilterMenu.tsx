import { PlusIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useState } from "react"
import UserAction from "~/ui/auth/UserAction"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import type { ColorName } from "~/utils/color"

export interface AddFilterOption<T extends string> {
	key: T
	label: string
	color: ColorName
	loginInstructions?: ReactNode
}

interface AddFilterMenuParams<T extends string> {
	options: AddFilterOption<T>[]
	onSelect: (key: T) => void
}

export default function AddFilterMenu<T extends string>({
	options,
	onSelect,
}: AddFilterMenuParams<T>) {
	const [isOpen, setIsOpen] = useState(false)
	if (!options.length) return null

	return (
		<div className="relative flex">
			<button
				type="button"
				className={`
					flex items-center gap-1 px-2 py-1.5 font-semibold
					border-4 border-dashed rounded-sm cursor-pointer
					${isOpen ? "border-white/50 bg-gray-800" : "border-white/20 hover:border-white/40 hover:bg-gray-900"}
				`}
				aria-expanded={isOpen}
				onClick={() => setIsOpen((prev) => !prev)}
			>
				<PlusIcon className="h-4 w-4" />
				Add filter
			</button>
			{isOpen && (
				<>
					<div
						className="fixed inset-0 z-40"
						onClick={() => setIsOpen(false)}
						onKeyDown={() => null}
					/>
					<div className="absolute left-0 top-full mt-1 w-44 p-1 flex flex-col gap-1 bg-gray-950 border border-gray-700 shadow-xl shadow-black z-50">
						{options.map((option) => (
							<UserAction
								key={option.key}
								requiresLogin={Boolean(option.loginInstructions)}
								instructions={option.loginInstructions}
							>
								<FilterBarSection
									isCompact={true}
									isActive={false}
									color={option.color}
									onClick={() => {
										setIsOpen(false)
										onSelect(option.key)
									}}
								>
									<span className="block px-1.5 py-1 font-semibold">
										{option.label}
									</span>
								</FilterBarSection>
							</UserAction>
						))}
					</div>
				</>
			)}
		</div>
	)
}

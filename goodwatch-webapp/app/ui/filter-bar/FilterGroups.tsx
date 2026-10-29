// Shared filter search field for My movies.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import type { RefObject } from "react"

export function FilterSearchField({
	value,
	onChange,
	inputRef,
	className = "",
}: {
	value: string
	onChange: (value: string) => void
	inputRef?: RefObject<HTMLInputElement>
	className?: string
}) {
	return (
		<label
			className={`flex h-11 items-center gap-2.5 rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 focus-within:ring-amber-500/70 ${className}`}
		>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<span className="sr-only">Find a filter</span>
			<input
				ref={inputRef}
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Find a filter: horror, a title, a name"
				className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear the filter search"
					className="text-gray-500 cursor-pointer hover:text-white"
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

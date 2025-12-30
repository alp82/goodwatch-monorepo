import { FilmIcon } from "@heroicons/react/24/solid"
import { useState } from "react"
import { type StreamingProvider, useStreamingProviders } from "~/routes/api.streaming-providers"
import { useUserSettings } from "~/routes/api.user-settings.get"
import { SearchInput } from "~/ui/form/SearchInput"
import StreamingProviderToggle from "~/ui/onboarding/StreamingProviderToggle"
import { useAutoFocus } from "~/utils/form"

interface StreamingSelectorProps {
	onSelect: (streamingProviderIds: string[]) => void
	onCancel?: () => void
}

export default function StreamingSelector({ onSelect, onCancel }: StreamingSelectorProps) {
	const { data: userSettings } = useUserSettings()
	const { data: streamingProviders } = useStreamingProviders()
	const autoFocusRef = useAutoFocus<HTMLInputElement>()

	// Pre-selection
	const storedStreaming =
		userSettings?.streaming_providers_default ||
		(typeof window !== "undefined" ? localStorage.getItem("withStreamingProviders") : undefined)
	const preselectedStreaming = storedStreaming ? storedStreaming.split(",") : []

	const [selectedStreaming, setSelectedStreaming] = useState<string[]>(preselectedStreaming)
	const [filterText, setFilterText] = useState("")

	const handleFilterByName = (text: string) => {
		setFilterText(text)
	}

	const filteredStreamingProviders = streamingProviders?.filter((provider) => {
		return provider.name.toLowerCase().includes(filterText.toLowerCase())
	})

	const handleToggleProvider = (provider: StreamingProvider, selected: boolean) => {
		setSelectedStreaming((prev) => {
			const providerId = String(provider.id)

			if (selected && !prev.includes(providerId)) {
				return (streamingProviders || [])
					.filter((p) => prev.includes(String(p.id)) || p.id === provider.id)
					.map((p) => String(p.id))
			}

			if (!selected && prev.includes(providerId)) {
				return prev.filter((id) => id !== providerId)
			}

			return prev
		})
	}

	const handleConfirm = () => {
		onSelect(selectedStreaming)
	}

	return (
		<div className="space-y-3">
			{/* Search */}
			<div className="w-full">
				<SearchInput
					id="search-streaming"
					label="Search"
					placeholder="Search Streaming Providers"
					icon={<FilmIcon className="h-5 w-5 text-gray-300" aria-hidden="true" />}
					onChange={handleFilterByName}
					ref={autoFocusRef}
				/>
			</div>

			{/* Provider grid - more compact */}
			<div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-56 md:max-h-72 overflow-y-auto p-1">
				{filteredStreamingProviders?.map((provider) => {
					return (
						<StreamingProviderToggle
							key={provider.id}
							provider={provider}
							selected={selectedStreaming.includes(String(provider.id))}
							onToggle={handleToggleProvider}
						/>
					)
				})}
			</div>

			{/* Selected services + Action buttons in one row */}
			<div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
				<div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
					{selectedStreaming.length > 0 ? (
						selectedStreaming.slice(0, 6).map((providerId) => {
							const provider = streamingProviders?.find(
								(provider) => provider.id === Number.parseInt(providerId)
							)
							if (!provider) return null
							return (
								<div key={provider.id} className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 rounded overflow-hidden bg-white/5">
									<img
										className="w-full h-full object-cover"
										src={`https://www.themoviedb.org/t/p/original/${provider.logo_path}`}
										alt={provider.name}
										title={provider.name}
									/>
								</div>
							)
						})
					) : (
						<span className="text-sm md:text-sm text-gray-300 italic">No services selected</span>
					)}
					{selectedStreaming.length > 6 && (
						<span className="text-sm md:text-sm text-gray-300 self-center">+{selectedStreaming.length - 6}</span>
					)}
				</div>
				<div className="flex items-center gap-2 flex-shrink-0">
					{onCancel && (
						<button
							type="button"
							onClick={onCancel}
							className="px-3 py-2 md:px-4 md:py-2 bg-white/10 text-white hover:bg-white/20 rounded-lg font-semibold text-sm md:text-base transition-colors cursor-pointer"
						>
							Cancel
						</button>
					)}
					<button
						type="button"
						onClick={handleConfirm}
						className="px-4 py-2 md:px-6 md:py-2 bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg font-bold text-sm md:text-base transition-colors shadow-md hover:shadow-lg cursor-pointer"
					>
						Confirm
					</button>
				</div>
			</div>
		</div>
	)
}

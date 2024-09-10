import React from "react"
import {
	useUserSettings,
	useUserStreamingProviders,
} from "~/routes/api.user-settings.get"

export const SubHeader = () => {
	const { data: userSettings } = useUserSettings()
	const userStreamingProviders = useUserStreamingProviders()

	console.log({ userSettings, userStreamingProviders })

	const handleEditClick = () => {
		// Logic to edit streaming services or country
	}

	return (
		// <div className="bg-gray-800">
		<div>
			<div className="mx-auto max-w-7xl py-2 px-2 sm:px-4 lg:px-8 shadow-md flex items-center justify-between">
				<div className="self-stretch" />
				<div className="flex flex-wrap items-center justify-center space-x-4 text-white text-lg">
					<span className="hidden sm:block">You are watching in</span>

					<img
						src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${userSettings?.country_default}.svg`}
						alt={`Watching in ${userSettings?.country_default}`}
						className="h-6 w-8"
					/>

					<span>on</span>

					<div className="flex space-x-2">
						{userStreamingProviders.map((provider) => (
							<div key={provider.id} className="flex items-center">
								<img
									src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
									alt={provider.name}
									className="h-8 w-8 border-2 border-gray-700/50"
								/>
							</div>
						))}
					</div>
				</div>

				{/*<button*/}
				{/*	type="button"*/}
				{/*	className="flex items-center bg-indigo-800 hover:bg-indigo-700 text-white px-3 py-1 rounded-md shadow-md"*/}
				{/*	onClick={handleEditClick}*/}
				{/*>*/}
				{/*	<Cog6ToothIcon className="h-4 w-4 sm:mr-2" />*/}
				{/*	<span className="hidden sm:block">Change</span>*/}
				{/*</button>*/}
			</div>
		</div>
	)
}

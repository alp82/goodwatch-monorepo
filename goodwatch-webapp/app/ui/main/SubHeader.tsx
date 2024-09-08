import { Cog6ToothIcon } from "@heroicons/react/24/solid"
import React from "react"
import { useUserSettings } from "~/routes/api.user-settings.get"

// TODO Placeholder for flag and streaming services data
const streamingServices = [
	{
		name: "Netflix",
		logo: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg",
	},
	{
		name: "Hulu",
		logo: "https://upload.wikimedia.org/wikipedia/commons/e/e4/Hulu_Logo.svg",
	},
	{
		name: "Disney+",
		logo: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg",
	},
]

export const SubHeader = () => {
	const { data: userSettings } = useUserSettings()

	console.log({ userSettings })

	const handleEditClick = () => {
		// Logic to edit streaming services or country
	}

	return (
		<div className="bg-gray-900">
			<div className="mx-auto max-w-7xl py-2 px-2 sm:px-4 lg:px-8 shadow-md flex items-center justify-between">
				<div className="flex flex-wrap items-center justify-center space-x-4 text-white text-lg">
					<span className="hidden sm:block">You are watching in</span>

					<img
						src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${userSettings?.country_default}.svg`}
						alt="Selected Country Flag"
						className="h-6 w-8 rounded"
					/>

					<span>on</span>

					<div className="flex space-x-2">
						{streamingServices.map((service, index) => (
							<div key={index} className="flex items-center">
								<img src={service.logo} alt={service.name} className="h-6" />
							</div>
						))}
					</div>
				</div>

				<button
					type="button"
					className="flex items-center bg-indigo-800 hover:bg-indigo-700 text-white px-3 py-1 rounded-md shadow-md"
					onClick={handleEditClick}
				>
					<Cog6ToothIcon className="h-4 w-4 sm:mr-2" />
					<span className="hidden sm:block">Change</span>
				</button>
			</div>
		</div>
	)
}

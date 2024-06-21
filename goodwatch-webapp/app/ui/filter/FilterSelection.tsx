import React, { type ChangeEventHandler, Fragment, useState } from "react";
import {
	Dialog,
	DialogPanel,
	DialogTitle,
	Transition,
	TransitionChild,
} from "@headlessui/react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import FilterStreamingProviders from "~/ui/filter/FilterStreamingProviders";
import type { DiscoverParams } from "~/server/discover.server";
import FilterCountries from "~/ui/filter/FilterCountries";
import FilterGenres from "~/ui/filter/FilterGenres";
import type { Genre } from "~/server/genres.server";
import NumberInput from "~/ui/form/NumberInput";

interface FilterSelectionParams {
	show: boolean;
	params: DiscoverParams;
	updateParams: (newParams: DiscoverParams) => void;
	onClose: () => void;
}

export default function FilterSelection({
	show,
	params,
	updateParams,
	onClose,
}: FilterSelectionParams) {
	const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
		const target = event.target;
		const newParams = {
			...params,
			[target.name]: target.value,
		};
		updateParams(newParams);
	};

	const handleGenresChange = (
		genresToInclude: Genre[],
		genresToExclude: Genre[],
	) => {
		const newParams = {
			...params,
			withGenres: genresToInclude.map((genre) => genre.name).join(","),
			withoutGenres: genresToExclude.map((genre) => genre.name).join(","),
		};
		updateParams(newParams);
	};

	// const handleKeywordsChange = (keywordsToInclude: Keyword[], keywordsToExclude: Keyword[]) => {
	//   const newParams = {
	//     ...params,
	//     withKeywords: keywordsToInclude.map((keyword) => keyword.name).join(','),
	//     withoutKeywords: keywordsToExclude.map((keyword) => keyword.name).join(','),
	//   }
	//   updateParams(newParams)
	// }

	const thisYear = new Date().getFullYear();
	const [minYear, setMinYear] = useState(params.minYear);
	const [maxYear, setMaxYear] = useState(params.maxYear);
	const handleYearChange = (min?: number, max?: number) => {
		const minValue = (min || "").toString();
		const maxValue = (max || "").toString();
		setMinYear(minValue);
		setMaxYear(maxValue);
		updateParams({
			...params,
			minYear: minValue,
			maxYear: maxValue,
		});
	};

	const isSelectedYear = (min?: number, max?: number) => {
		const minValue = (min || "").toString();
		const maxValue = (max || "").toString();
		return minValue === minYear && maxValue === maxYear;
	};

	const createDivider = (title: string) => (
		<div className="relative my-2 sm:my-4">
			<div className="absolute inset-0 flex items-center" aria-hidden="true">
				<div className="w-full border-t border-slate-500" />
			</div>
			<div className="relative flex justify-center">
				<span className="bg-slate-950 px-2 text-sm text-slate-200 uppercase">
					{title}
				</span>
			</div>
		</div>
	);

	return (
		<Transition show={show} as={Fragment}>
			<Dialog as="div" className="relative z-10 opacity-95" onClose={onClose}>
				<div className="fixed inset-0" />

				<div className="fixed inset-0 overflow-hidden">
					<div className="absolute inset-0 overflow-hidden">
						<div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full pr-10 sm:pr-16">
							<TransitionChild
								as={Fragment}
								enter="transform transition ease-in-out duration-500 sm:duration-700"
								enterFrom="-translate-x-full"
								enterTo="translate-x-0"
								leave="transform transition ease-in-out duration-500 sm:duration-700"
								leaveFrom="translate-x-0"
								leaveTo="-translate-x-full"
							>
								<DialogPanel className="pointer-events-auto w-screen max-w-2xl">
									<form className="flex flex-col h-full bg-slate-900 shadow-xl">
										<div className="flex-1 text-gray-100">
											{/* Header */}
											<div className="mt-16 px-4 py-6 sm:px-6 bg-slate-950">
												<div className="flex items-start justify-between space-x-3">
													<div className="space-y-1">
														<DialogTitle className="text-base font-semibold leading-6">
															Discover Tools
														</DialogTitle>
														<p className="text-sm text-gray-300">
															Narrow down results to your liking
														</p>
													</div>
													<div className="flex h-7 items-center">
														<button
															type="button"
															className="relative text-gray-400 hover:text-gray-500 focus:outline-none"
															onClick={onClose}
														>
															<span className="absolute -inset-2.5" />
															<span className="sr-only">Close filters</span>
															<ArrowLeftIcon
																className="h-6 w-6"
																aria-hidden="true"
															/>
														</button>
													</div>
												</div>
											</div>

											{/* Divider container */}
											<div className="px-4 py-6 sm:px-6 sm:py-0 flex flex-col gap-2 sm:gap-6">
												{/* Streaming block */}
												<div>
													{createDivider("Streaming")}
													<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
														<FilterStreamingProviders
															type={params.type}
															selectedProviders={
																params.withStreamingProviders
																	? params.withStreamingProviders.split(",")
																	: []
															}
															onChange={(newProviders) =>
																updateParams({
																	...params,
																	withStreamingProviders: newProviders,
																})
															}
														/>
														<span className="mt-2 text-sm">in</span>
														<FilterCountries
															type={params.type}
															selectedCountry={params.country}
															onChange={(newCountry) =>
																updateParams({
																	...params,
																	country: newCountry,
																})
															}
														/>
													</div>
												</div>

												{/* Genres block */}
												<div>
													{createDivider("Genres")}
													<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
														<FilterGenres
															type={params.type}
															withGenres={params.withGenres}
															withoutGenres={params.withoutGenres}
															onChange={handleGenresChange}
														/>
													</div>
												</div>

												{/* Release block */}
												<div>
													{createDivider("Release Year")}
													<div className="flex flex-col flex-wrap items-center justify-center gap-2 sm:gap-4">
														<div className="isolate inline-flex rounded-md shadow-sm">
															<button
																type="button"
																className={`${isSelectedYear(thisYear, thisYear) ? "bg-indigo-800" : "bg-gray-800"} relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold text-gray-100 ring-1 ring-inset ring-gray-600 hover:bg-gray-700 focus:z-10`}
																onClick={() =>
																	handleYearChange(thisYear, thisYear)
																}
															>
																This Year
															</button>
															<button
																type="button"
																className={`${isSelectedYear(thisYear - 1, thisYear - 1) ? "bg-indigo-800" : "bg-gray-800"} relative -ml-px inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-100 ring-1 ring-inset ring-gray-600 hover:bg-gray-700 focus:z-10`}
																onClick={() =>
																	handleYearChange(thisYear - 1, thisYear - 1)
																}
															>
																Last Year
															</button>
															<button
																type="button"
																className={`${isSelectedYear(thisYear - 5, thisYear) ? "bg-indigo-800" : "bg-gray-800"} relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold text-gray-100 ring-1 ring-inset ring-gray-600 hover:bg-gray-700 focus:z-10`}
																onClick={() =>
																	handleYearChange(thisYear - 5, thisYear)
																}
															>
																Last 5 Years
															</button>
														</div>

														<div className="isolate inline-flex rounded-md shadow-sm">
															<button
																type="button"
																className={`${isSelectedYear(2000, 2010) ? "bg-indigo-800" : "bg-gray-800"} relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold text-gray-100 ring-1 ring-inset ring-gray-600 hover:bg-gray-700 focus:z-10`}
																onClick={() => handleYearChange(2000, 2010)}
															>
																2000 - 2010
															</button>
															<button
																type="button"
																className={`${isSelectedYear(2010, 2020) ? "bg-indigo-800" : "bg-gray-800"} relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold text-gray-100 ring-1 ring-inset ring-gray-600 hover:bg-gray-700 focus:z-10`}
																onClick={() => handleYearChange(2010, 2020)}
															>
																2010 - 2020
															</button>
														</div>

														<div className="isolate inline-flex rounded-md shadow-sm">
															<button
																type="button"
																className={`${isSelectedYear(undefined, 2023) ? "bg-indigo-800" : "bg-gray-800"} relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold text-gray-100 ring-1 ring-inset ring-gray-600 hover:bg-gray-700 focus:z-10`}
																onClick={() =>
																	handleYearChange(undefined, 2023)
																}
															>
																All Until Today
															</button>
															<button
																type="button"
																className={`${isSelectedYear(1900, 1999) ? "bg-indigo-800" : "bg-gray-800"} relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold text-gray-100 ring-1 ring-inset ring-gray-600 hover:bg-gray-700 focus:z-10`}
																onClick={() => handleYearChange(1900, 1999)}
															>
																1999 and earlier
															</button>
														</div>

														<div className="mt-1 flex gap-3 items-center">
															<NumberInput
																name="minYear"
																placeholder="Min Year"
																value={minYear || ""}
																onBlur={handleChange}
																onChange={(event) =>
																	setMinYear(event.target.value)
																}
															/>
															<span className="italic">to</span>
															<NumberInput
																name="maxYear"
																placeholder="Max Year"
																value={maxYear || ""}
																onBlur={handleChange}
																onChange={(event) =>
																	setMaxYear(event.target.value)
																}
															/>
														</div>
													</div>
												</div>

												{/* Keyword block */}
												{/*<div>*/}
												{/*  {createDivider('Keywords')}*/}
												{/*  <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">*/}
												{/*    <FilterKeywords withKeywords={params.withKeywords} withoutKeywords={params.withoutKeywords} onChange={handleKeywordsChange} />*/}
												{/*  </div>*/}
												{/*</div>*/}
											</div>
										</div>

										{/* Action buttons */}
										<div className="flex-shrink-0 bg-slate-950 px-4 py-5 sm:px-6">
											<div className="flex justify-end space-x-3">
												<button
													type="button"
													className="rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
													onClick={onClose}
												>
													Save Filters
												</button>
											</div>
										</div>
									</form>
								</DialogPanel>
							</TransitionChild>
						</div>
					</div>
				</div>
			</Dialog>
		</Transition>
	);
}

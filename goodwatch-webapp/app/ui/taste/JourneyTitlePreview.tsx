import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
	ArrowLeftIcon,
	BookmarkIcon,
	CheckIcon,
	ForwardIcon,
} from "@heroicons/react/24/outline";
import { Poster } from "~/ui/Poster";
import Button from "~/ui/button/Button";
import type { ScoringMedia } from "~/ui/scoring/types";
import type { TasteInteraction } from "./types";

type PreviewData = {
	media: {
		details: {
			synopsis?: string;
			overview?: string;
			genres?: string[];
			backdrop_path?: string;
		};
	};
};
export default function JourneyTitlePreview({
	media,
	interaction,
	onClose,
	onPlan,
	onSkip,
}: {
	media: ScoringMedia;
	interaction?: TasteInteraction;
	onClose: () => void;
	onPlan: () => void;
	onSkip: () => void;
}) {
	const [watchability, setWatchability] = useState(false);
	const path = `/${media.media_type === "movie" ? "movie" : "show"}/${media.tmdb_id}`;
	const data = useQuery<PreviewData>({
		queryKey: ["journey-prototype-title", media.media_type, media.tmdb_id],
		queryFn: async ({ signal }) => {
			const route =
				media.media_type === "movie" ? "movie.$movieKey" : "show.$showKey";
			const response = await fetch(`${path}?_data=routes/${route}`, { signal });
			if (!response.ok) throw new Error("Could not load title details");
			return response.json();
		},
	});
	const synopsis =
		data.data?.media?.details?.synopsis ||
		data.data?.media?.details?.overview ||
		media.synopsis;
	const genres = data.data?.media?.details?.genres || media.genres || [];
	const backdrop =
		data.data?.media?.details?.backdrop_path || media.backdrop_path;
	return (
		<Dialog open onClose={onClose} className="relative z-[100]">
			<div
				className="fixed inset-0 bg-black/75 backdrop-blur-sm"
				aria-hidden="true"
			/>
			<div className="fixed inset-0 overflow-y-auto">
				<div className="flex min-h-full items-end justify-center md:items-center md:p-8">
					<DialogPanel className="relative w-full max-w-3xl overflow-hidden rounded-t-2xl border border-gray-700 bg-gray-900 shadow-2xl md:rounded-2xl">
						{backdrop && (
							<img
								src={`https://image.tmdb.org/t/p/w780${backdrop}`}
								alt=""
								className="absolute inset-x-0 top-0 h-64 w-full object-cover opacity-25"
							/>
						)}
						<div className="relative p-5 md:p-7">
							<button
								type="button"
								onClick={onClose}
								className="mb-6 flex items-center gap-2 text-sm text-gray-200 hover:text-white"
							>
								<ArrowLeftIcon className="h-4 w-4" />
								Back to exploring
							</button>
							<div className="flex items-start gap-5">
								<div className="w-24 shrink-0 md:w-40">
									<Poster path={media.poster_path} title={media.title} />
								</div>
								<div className="min-w-0">
									<p className="mb-2 text-sm text-gray-400">
										{media.media_type === "movie" ? "Movie" : "Show"}
										{media.release_year && ` · ${media.release_year}`}
									</p>
									<DialogTitle className="text-2xl font-bold text-white md:text-3xl">
										{media.title}
									</DialogTitle>
									<p className="mt-3 text-sm text-gray-300">
										{genres.slice(0, 3).join(" · ")}
									</p>
									<div className="mt-4 hidden md:block">
										<Button
											size="sm"
											highlight="sky"
											mode="dark"
											icon={
												interaction?.type === "plan" ? CheckIcon : BookmarkIcon
											}
											onClick={onPlan}
										>
											{interaction?.type === "plan"
												? "In your Wishlist"
												: "Want to See"}
										</Button>
									</div>
								</div>
							</div>
							<div className="my-5 text-base leading-relaxed text-gray-300">
								{synopsis ? (
									<p>{synopsis}</p>
								) : data.isPending ? (
									<p role="status">Loading the story…</p>
								) : (
									<p>No synopsis available.</p>
								)}
								{data.isError && (
									<button
										type="button"
										onClick={() => data.refetch()}
										className="mt-2 text-sm text-cyan-300"
									>
										Couldn’t load details. Try again
									</button>
								)}
							</div>
							<div className="flex flex-wrap items-center gap-3">
								<div className="md:hidden">
									<Button
										size="xs"
										highlight="sky"
										mode="dark"
										icon={
											interaction?.type === "plan" ? CheckIcon : BookmarkIcon
										}
										onClick={onPlan}
									>
										{interaction?.type === "plan"
											? "In Wishlist"
											: "Want to See"}
									</Button>
								</div>
								<Button
									size="xs"
									highlight="stone"
									mode="dark"
									icon={ForwardIcon}
									onClick={onSkip}
								>
									Skip
								</Button>
								<button
									type="button"
									onClick={() => setWatchability((value) => !value)}
									className="px-2 py-2 text-sm text-cyan-300 hover:text-cyan-200"
									aria-expanded={watchability}
								>
									Where can I watch?
								</button>
							</div>
							{interaction?.type === "plan" && (
								<p role="status" className="mt-3 text-sm text-sky-300">
									Kept in your Wishlist. Continue exploring whenever you’re
									ready.
								</p>
							)}
							{watchability && (
								<div className="mt-5 border-t border-gray-700/50 pt-4">
									<h3 className="font-semibold text-white">
										Check viewing options
									</h3>
									<p className="mt-2 text-sm text-gray-400">
										Check services in your country on the title page. You can
										keep this title in Wishlist even if it’s unavailable.
									</p>
									<a
										href={`${path}#streaming`}
										target="_blank"
										rel="noreferrer"
										className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-200"
									>
										Open viewing options in a new tab ↗
									</a>
								</div>
							)}
							<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-700/50 pt-4">
								<button
									type="button"
									onClick={onClose}
									className="text-sm font-medium text-white hover:text-cyan-300"
								>
									Continue exploring →
								</button>
								<a
									href={path}
									target="_blank"
									rel="noreferrer"
									className="text-sm text-gray-400 hover:text-white"
								>
									Full details in a new tab ↗
								</a>
							</div>
						</div>
					</DialogPanel>
				</div>
			</div>
		</Dialog>
	);
}

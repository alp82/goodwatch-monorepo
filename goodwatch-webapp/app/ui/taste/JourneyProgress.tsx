import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import Button from "~/ui/button/Button";
import { useJourneyPrototype } from "./JourneyPrototypeContext";

export default function JourneyProgress({
	ratingsCount,
}: { ratingsCount: number }) {
	const journey = useJourneyPrototype();
	const [dismissed, setDismissed] = useState(false);
	if (!journey) return null;
	return (
		<div className="mx-auto w-full max-w-6xl px-3 md:px-4">
			{(journey.limitNotice || (ratingsCount >= 10 && !dismissed)) && (
				<aside className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3">
					<div className="min-w-0 flex-1">
						<p className="text-sm font-medium text-white">
							{journey.limitNotice
								? "Keep going with a free account"
								: "Your taste is taking shape"}
						</p>
						<p className="mt-1 text-sm text-gray-400">
							{journey.limitNotice
								? "You’ve rated 20 titles. Sign up to rate more, or keep exploring and adding to Wishlist."
								: `${ratingsCount} ratings worth keeping. Take your taste and Wishlist across devices.`}
						</p>
					</div>
					<Button
						size="xs"
						highlight="sky"
						mode="dark"
						onClick={journey.onSignUp}
					>
						Keep my progress
					</Button>
					<button
						type="button"
						aria-label="Dismiss progress reminder"
						className="p-2 text-gray-400 hover:text-white"
						onClick={() => {
							setDismissed(true);
							journey.dismissLimit();
						}}
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</aside>
			)}
		</div>
	);
}

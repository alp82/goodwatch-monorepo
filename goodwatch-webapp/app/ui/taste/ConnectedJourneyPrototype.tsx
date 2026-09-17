// Throwaway changes inside the existing Taste experience; guest actions use isolated preview storage.
import { useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Link } from "@remix-run/react";
import TasteQuiz from "./TasteQuiz";
import Button from "~/ui/button/Button";
import type { ScoringMedia } from "~/ui/scoring/types";

export default function ConnectedJourneyPrototype({
	titles,
}: { titles: ScoringMedia[] }) {
	const [signup, setSignup] = useState(false);
	return (
		<>
			<TasteQuiz
				availableTitles={titles}
				isAuthenticated={false}
				journeyPrototype
				onSignUp={() => setSignup(true)}
			/>
			<div className="mx-auto max-w-6xl px-4 pb-24 text-right text-xs text-gray-400">
				<Link to="/taste/quiz" className="hover:text-gray-300">
					Preview · Compare with current Taste
				</Link>
			</div>
			<Dialog
				open={signup}
				onClose={() => setSignup(false)}
				className="relative z-[100]"
			>
				<div
					className="fixed inset-0 bg-black/75 backdrop-blur-sm"
					aria-hidden="true"
				/>
				<div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
					<DialogPanel className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
						<DialogTitle className="text-2xl font-bold text-white">
							Keep your taste. Pick up anywhere.
						</DialogTitle>
						<p className="mt-3 leading-relaxed text-gray-300">
							Your ratings, Wishlist and preferences belong together. A free
							account keeps them with you across visits and devices.
						</p>
						<p className="mt-4 text-sm text-gray-400">
							Guest progress stays in this browser. Clearing browser data can
							erase it.
						</p>
						<div className="mt-6">
							<Button
								highlight="sky"
								mode="dark"
								size="sm"
								onClick={() => setSignup(false)}
							>
								Continue exploring
							</Button>
						</div>
						<p className="mt-4 text-xs text-gray-500">
							Signup presentation preview. Account creation and transfer are not
							connected.
						</p>
					</DialogPanel>
				</div>
			</Dialog>
		</>
	);
}

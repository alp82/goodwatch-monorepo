// The prompt a guest sees after pressing an action that needs an account. UserAction.tsx loads this module when the
// prompt first opens.
import {
	Description,
	Dialog,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react";
import type React from "react";
import { SignInButton } from "~/ui/auth/SignInButton";

export default function SignInPrompt({
	onClose,
	position,
	instructions,
}: {
	onClose: () => void;
	position: { top: number; left: number };
	instructions: React.ReactNode;
}) {
	return (
		<Dialog open onClose={onClose}>
			<div className="fixed inset-0 bg-black/30" aria-hidden="true" />
			<div
				className="absolute w-[400px] p-8 z-10 bg-gray-700 border-8 border-gray-600 rounded-lg shadow-2xl z-50"
				style={{ top: position.top, left: position.left }}
			>
				<DialogTitle className="text-xl font-bold text-gray-100">
					Please Sign In
				</DialogTitle>
				<Description className="mt-4 text-lg text-gray-300 leading-6">
					{instructions}
				</Description>
				<DialogPanel className="mt-8 flex flex-col gap-3">
					<SignInButton />
					<div className="text-gray-300 text-xs text-center">
						It's 100% free.
					</div>
				</DialogPanel>
			</div>
		</Dialog>
	);
}

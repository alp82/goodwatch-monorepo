import React, { Suspense, lazy, useState } from "react";

import { useUser } from "~/utils/auth";
import { reloadOnStaleChunk } from "~/utils/stale-chunk";

// Only a guest who presses a member's action sees the prompt. Its code, with the dialog library, loads then.
const SignInPrompt = lazy(
	reloadOnStaleChunk(() => import("~/ui/auth/SignInPrompt")),
);

export interface UserActionProps {
	children: React.ReactElement;
	instructions: React.ReactNode;
	requiresLogin?: boolean;
	onChange?: () => void;
}

export default function UserAction({
	children,
	instructions,
	requiresLogin = true,
	onChange,
}: UserActionProps) {
	const { user } = useUser();
	const isLoggedIn = Boolean(user);

	const [isOpen, setIsOpen] = useState(false);
	const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });

	const handleClick = (e: MouseEvent) => {
		if (isLoggedIn || !requiresLogin) {
			// Perform the intended action
			if (children.props.onClick) {
				children.props.onClick(e);
			}
			if (onChange) {
				onChange();
			}
		} else {
			// Show modal
			const rect = (e.target as HTMLElement).getBoundingClientRect();
			const modalWidth = 400; // Fixed width for the modal
			const modalHeight = 200; // Approximate height for the modal

			let top = rect.bottom + window.scrollY;
			let left = rect.left + window.scrollX;

			// Adjust horizontal position if modal exceeds viewport width
			if (left + modalWidth > window.innerWidth) {
				left = window.innerWidth - modalWidth - 16; // Add some margin
			}

			// Adjust vertical position if modal exceeds viewport height
			if (top + modalHeight > window.innerHeight) {
				top = rect.top + window.scrollY - modalHeight - 16; // Add some margin
			}

			setModalPosition({ top, left });
			setIsOpen(true);
		}
	};

	return (
		<>
			{React.cloneElement(children, { onClick: handleClick })}
			{!isLoggedIn && isOpen && (
				<Suspense fallback={null}>
					<SignInPrompt
						onClose={() => setIsOpen(false)}
						position={modalPosition}
						instructions={instructions}
					/>
				</Suspense>
			)}
		</>
	);
}

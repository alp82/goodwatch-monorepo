import React from "react";
import { useSupabase } from "~/utils/auth";

interface SignOutLinkProps {
	active: boolean;
}

export const SignOutLink = ({ active }: SignOutLinkProps) => {
	const { supabase } = useSupabase();

	const handleSignOut = async () => {
		if (!supabase) return;

		const { error } = await supabase.auth.signOut();
		if (error) console.error(error);
	};

	return (
		<a
			href="#"
			onClick={handleSignOut}
			className={`
        ${active ? "text-white" : "text-gray-300"}
        block px-4 py-2 text-base hover:bg-gray-800 hover:text-white
      `}
		>
			Sign out
		</a>
	);
};

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/auth-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient, parse, serialize } from "@supabase/ssr";

// server

export const getUserFromRequest = async ({ request }: { request: Request }) => {
	const cookies = parse(request.headers.get("Cookie") ?? "");
	const headers = new Headers();
	const supabase = createServerClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(key) {
					return cookies[key];
				},
				set(key, value, options) {
					headers.append("Set-Cookie", serialize(key, value, options));
				},
				remove(key, options) {
					headers.append("Set-Cookie", serialize(key, "", options));
				},
			},
		},
	);
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	return user;
};

export const getUserIdFromRequest = async ({
	request,
}: { request: Request }) => {
	const user = await getUserFromRequest({ request });
	return user?.id;
};

// client

interface AuthContext {
	supabase?: SupabaseClient;
}

export const AuthContext = createContext<AuthContext>({
	supabase: undefined,
});

export function useSupabase() {
	return useContext(AuthContext);
}

export const useSession = () => {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	const { supabase } = useSupabase();
	useEffect(() => {
		if (!supabase) return;

		const fetchSession = async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			setSession(session);
			setLoading(false);
		};

		fetchSession();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			setLoading(false);
		});

		return () => subscription.unsubscribe();
	}, [supabase]);

	return { session, loading };
};

export const useUser = () => {
	const { session, loading } = useSession();
	const { user } = session || {};
	return { user, loading };
};

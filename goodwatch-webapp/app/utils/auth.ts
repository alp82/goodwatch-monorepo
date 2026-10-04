import type { User } from "@supabase/auth-js"
import { createServerClient, parse, serialize } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createContext, useContext } from "react"
import {
	PRIVATE_CACHE_CONTROL,
	SHARED_PAGE_CACHE_CONTROL,
	hasAuthCookie,
} from "./auth-cookie"

// server

export const getAuthFromRequest = async ({ request }: { request: Request }) => {
	const cookies = parse(request.headers.get("Cookie") ?? "")
	const headers = new Headers()
	const member = hasAuthCookie(request.headers.get("Cookie"))
	headers.set(
		"Cache-Control",
		member ? PRIVATE_CACHE_CONTROL : SHARED_PAGE_CACHE_CONTROL,
	)
	if (!member) return { user: null, headers }

	const supabase = createServerClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return Object.entries(cookies).map(([name, value]) => ({
						name,
						value: value ?? "",
					}))
				},
				setAll(updates) {
					for (const { name, value, options } of updates) {
						cookies[name] = value
						headers.append("Set-Cookie", serialize(name, value, options))
					}
				},
			},
		},
	)
	const {
		data: { user },
	} = await supabase.auth.getUser()
	return { user, headers }
}

export const getUserFromRequest = async ({ request }: { request: Request }) => {
	const { user } = await getAuthFromRequest({ request })
	return user
}

export const getUserIdFromRequest = async ({
	request,
}: { request: Request }) => {
	const user = await getUserFromRequest({ request })
	return user?.id
}

// client: the provider owns a single auth subscription for the whole app.

interface AuthContext {
	supabase?: SupabaseClient
	user: User | null
	loading: boolean
}

export const AuthContext = createContext<AuthContext>({
	supabase: undefined,
	user: null,
	loading: true,
})

export function useSupabase() {
	return useContext(AuthContext)
}

export const useUser = () => {
	const { user, loading } = useContext(AuthContext)
	return { user, loading }
}

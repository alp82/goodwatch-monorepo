import type { User } from "@supabase/auth-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createContext, useContext } from "react"
import {
	PRIVATE_CACHE_CONTROL,
	SHARED_PAGE_CACHE_CONTROL,
	hasAuthCookie,
} from "./auth-cookie.ts"

import { resolveSession } from "./auth-session.ts"

// server

type AuthRequest = { request: Request; fresh?: boolean }

export const getAuthFromRequest = async ({ request, fresh }: AuthRequest) => {
	const cookieHeader = request.headers.get("Cookie")
	const { user, setCookies } = await resolveSession(cookieHeader, { fresh })
	const headers = new Headers()
	headers.set(
		"Cache-Control",
		hasAuthCookie(cookieHeader)
			? PRIVATE_CACHE_CONTROL
			: SHARED_PAGE_CACHE_CONTROL,
	)
	for (const cookie of setCookies) headers.append("Set-Cookie", cookie)
	return { user, headers }
}

export const getUserFromRequest = async ({ request, fresh }: AuthRequest) => {
	const { user } = await getAuthFromRequest({ request, fresh })
	return user
}

export const getUserIdFromRequest = async ({ request, fresh }: AuthRequest) => {
	const user = await getUserFromRequest({ request, fresh })
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

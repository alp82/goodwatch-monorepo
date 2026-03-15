import type { Session } from "@supabase/auth-js"
import { createServerClient, parse, serialize } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useState } from "react"

// server

export const getUserFromRequest = async ({ request }: { request: Request }) => {
	const cookies = parse(request.headers.get("Cookie") ?? "")
	const headers = new Headers()
	const supabase = createServerClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(key) {
					return cookies[key]
				},
				set(key, value, options) {
					headers.append("Set-Cookie", serialize(key, value, options))
				},
				remove(key, options) {
					headers.append("Set-Cookie", serialize(key, "", options))
				},
			},
		},
	)
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser()
	return user
}

export const getUserIdFromRequest = async ({
	request,
}: { request: Request }) => {
	const user = await getUserFromRequest({ request })
	return user?.id
}

// client

interface AuthContext {
	supabase?: SupabaseClient
}

export const AuthContext = createContext<AuthContext>({
	supabase: undefined,
})

export function useSupabase() {
	return useContext(AuthContext)
}

export const useSession = () => {
	const [session, setSession] = useState<Session | null>(null)
	const [loading, setLoading] = useState(true)

	const { supabase } = useSupabase()
	useEffect(() => {
		if (!supabase) return

		let isMounted = true

		supabase.auth.getSession().then(({ data, error }) => {
			if (!isMounted) return
			if (error) {
				console.error(error)
				setLoading(false)
				return
			}
			setSession(data.session)
			setLoading(false)
		})

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (!isMounted) return
			setSession(session)
			setLoading(false)
		})

		return () => {
			isMounted = false
			subscription.unsubscribe()
		}
	}, [supabase])

	return { session, loading }
}

export const useUser = () => {
	const { session, loading } = useSession()
	const { user } = session || {}
	return { user, loading }
}

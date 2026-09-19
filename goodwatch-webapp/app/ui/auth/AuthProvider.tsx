import { AuthCallbackError } from "~/ui/auth/AuthCallbackError"
import { cleanupCompletedTransferOnLogout } from "~/utils/account-transfer"
import type { User } from "@supabase/auth-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useRevalidator } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { AuthContext } from "~/utils/auth"

export function AuthProvider({
	supabase,
	initialUser,
	children,
}: {
	supabase: SupabaseClient
	initialUser: User | null
	children: ReactNode
}) {
	const [user, setUser] = useState(initialUser)
	const previousUserId = useRef(initialUser?.id)
	const queryClient = useQueryClient()
	const { revalidate } = useRevalidator()

	useEffect(() => setUser(initialUser), [initialUser])

	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) =>
			setUser(session?.user ?? null),
		)
		return () => subscription.unsubscribe()
	}, [supabase])

	useEffect(() => {
		if (previousUserId.current === user?.id) return
		const oldUserId = previousUserId.current
		previousUserId.current = user?.id
		// Reconcile server-rendered pages on login/logout, including other tabs.
		if (oldUserId) {
			try { cleanupCompletedTransferOnLogout(oldUserId) } catch {}
			queryClient.removeQueries({ queryKey: ["account-transfer-review", oldUserId] })
			queryClient.removeQueries({ queryKey: ["user-data", oldUserId] })
			queryClient.removeQueries({ queryKey: ["user-settings", oldUserId] })
		}
		revalidate()
	}, [user?.id, queryClient, revalidate])

	return (
		<AuthContext.Provider value={{ supabase, user, loading: false }}>
			<AuthCallbackError />
			{children}
		</AuthContext.Provider>
	)
}

import { clearMediaSession, establishMediaSession } from "~/utils/media-session"
import { AuthCallbackError } from "~/ui/auth/AuthCallbackError"
import { cleanupCompletedTransferOnLogout } from "~/utils/account-transfer"
import type { User } from "@supabase/auth-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useRevalidator } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import {
	type ReactNode,
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { AuthContext } from "~/utils/auth"
import { createAuthCookieMatcher } from "~/utils/auth-cookie"
import { keptLoaderData } from "~/utils/loader-request-retry"
import { whenInteractive } from "~/utils/page-interactive"
import { isAuthCallbackUrl, loadSupabaseClient } from "~/utils/supabase-browser"
import {
	requestRootRevalidation,
	rootRevalidated,
} from "~/utils/root-revalidation"

export function AuthProvider({
	supabaseUrl,
	supabaseAnonKey,
	betterAuth = false,
	initialUser,
	children,
}: {
	supabaseUrl: string
	supabaseAnonKey: string
	/** With Better Auth the member is the root loader's alone: no client, and a sign-in reruns the loader. */
	betterAuth?: boolean
	initialUser: User | null
	children: ReactNode
}) {
	const [user, setUser] = useState(initialUser)
	const [supabase, setSupabase] = useState<SupabaseClient>()
	const [sessionUserId, setSessionUserId] = useState<string | null>()
	const establishedUserId = useRef<string>()
	const currentUserId = useRef(user?.id)
	currentUserId.current = user?.id
	const previousUserId = useRef(initialUser?.id)
	const queryClient = useQueryClient()
	const { revalidate } = useRevalidator()

	// The loader's user replaces the browser's only when the person changed. For the same person the browser session
	// is at least as complete: a session verified from the token alone has no identities or creation time.
	useEffect(() => {
		// Data that a failed revalidation kept is not the server's answer about the person. The request stays pending,
		// so the next navigation asks again.
		if (keptLoaderData("root")) return
		rootRevalidated()
		setUser((current) =>
			current && current.id === initialUser?.id ? current : initialUser,
		)
	}, [initialUser])

	// The client's code loads on first use. Whoever asks for the client gets it after the provider has subscribed to
	// its auth changes, so a sign-in that follows can't be missed.
	// The client can arrive while a part of the page still waits to hydrate. Its state changes are transitions, so
	// React hydrates that part first. An urgent change makes React drop the part's server markup, render it again in
	// the browser, and report React error 421.
	const subscription = useRef<{ unsubscribe: () => void }>()
	const mounted = useRef(true)
	const getSupabase = useCallback(async () => {
		if (betterAuth) throw new Error("Supabase sign-in is off")
		const client = await loadSupabaseClient(supabaseUrl, supabaseAnonKey)
		if (mounted.current && !subscription.current) {
			subscription.current = client.auth.onAuthStateChange((event, session) =>
				startTransition(() => {
					setUser(session?.user ?? null)
					if (
						event === "INITIAL_SESSION" ||
						event === "SIGNED_IN" ||
						event === "SIGNED_OUT"
					) {
						setSessionUserId(session?.user.id ?? null)
						if (!session) clearMediaSession()
					}
				}),
			).data.subscription
			startTransition(() => setSupabase(client))
		}
		return client
	}, [supabaseUrl, supabaseAnonKey, betterAuth])

	useEffect(() => {
		if (betterAuth) return
		mounted.current = true
		const load = () => {
			getSupabase().catch(() => {})
		}
		// A member's session is kept fresh by the client, and the answer of a sign-in is read by it: both need it now.
		// An anonymous page needs it when the visitor signs in, or to notice a sign-in in another tab.
		const needsClientNow =
			Boolean(initialUser) ||
			createAuthCookieMatcher(supabaseUrl)(document.cookie) ||
			isAuthCallbackUrl(new URL(window.location.href))
		const cancel = needsClientNow ? load() : whenInteractive(load)
		return () => {
			mounted.current = false
			cancel?.()
			subscription.current?.unsubscribe()
			subscription.current = undefined
		}
		// Decided once, when the page opens: a later sign-in comes through getSupabase.
	}, [getSupabase, betterAuth])

	useEffect(() => {
		const targetUserId = user?.id
		const userChanged = previousUserId.current !== targetUserId
		const establishSession = Boolean(
			targetUserId &&
				(betterAuth || sessionUserId === targetUserId) &&
				establishedUserId.current !== targetUserId,
		)
		if (!userChanged && !establishSession) return
		const oldUserId = previousUserId.current
		previousUserId.current = targetUserId
		establishedUserId.current = targetUserId
		// Reconcile server-rendered pages on login/logout, including other tabs.
		if (userChanged && oldUserId) {
			try {
				cleanupCompletedTransferOnLogout(oldUserId)
			} catch {}
			queryClient.removeQueries({
				queryKey: ["account-transfer-review", oldUserId],
			})
			queryClient.removeQueries({ queryKey: ["user-data", oldUserId] })
			queryClient.removeQueries({ queryKey: ["user-settings", oldUserId] })
		}
		// The per-tab marker skips repeated hard-load adoption; only actual preference/auth changes reload pages.
		const reconcile = async () => {
			let changed = false
			if (targetUserId) {
				try {
					changed = await establishMediaSession(targetUserId, userChanged, {
						isCurrent: () =>
							mounted.current && currentUserId.current === targetUserId,
					})
				} catch {
					/* A failed check cannot prevent sign-in or a later explicit Keep. */
				}
			} else clearMediaSession()
			if (
				(changed || (userChanged && !betterAuth)) &&
				mounted.current &&
				currentUserId.current === targetUserId
			) {
				if (changed)
					void queryClient.invalidateQueries({
						queryKey: ["media-preferences", targetUserId],
						exact: true,
					})
				requestRootRevalidation()
				revalidate()
			}
		}
		void reconcile()
	}, [user?.id, sessionUserId, queryClient, revalidate, betterAuth])

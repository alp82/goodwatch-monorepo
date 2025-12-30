import { useState, useEffect, useRef } from "react"
import { useFetcher } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import type { GuestInteraction } from "~/ui/taste/types"
import { ONBOARDING_RATINGS_KEY, TASTE_PROFILE_FEATURES_KEY } from "~/ui/taste/constants"
import { queryKeyUserData } from "~/routes/api.user-data"

export const useGuestRatingImport = () => {
	const queryClient = useQueryClient()
	const [importProgress, setImportProgress] = useState(0)
	const [importError, setImportError] = useState<string | null>(null)
	const [isComplete, setIsComplete] = useState(false)
	const importFetcher = useFetcher()
	const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
	const resolveRef = useRef<((success: boolean) => void) | null>(null)

	// Watch fetcher state and handle completion
	useEffect(() => {
		if (importFetcher.state === 'idle' && importFetcher.data && resolveRef.current) {
			const response = importFetcher.data as { success?: boolean; error?: string }
			
			// Clear progress interval
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
				progressIntervalRef.current = null
			}

			if (response.success) {
				// Success
				setImportProgress(100)
				setIsComplete(true)
				
				// Clear localStorage on successful import
				localStorage.removeItem(ONBOARDING_RATINGS_KEY)
				localStorage.removeItem(TASTE_PROFILE_FEATURES_KEY)
				
				// Invalidate user data cache so ratings count updates
				queryClient.invalidateQueries({ queryKey: queryKeyUserData })
				
				resolveRef.current(true)
			} else {
				// Error
				setImportError(response.error || "Import failed")
				resolveRef.current(false)
			}
			
			resolveRef.current = null
		}
	}, [importFetcher.state, importFetcher.data])

	const importInteractions = async (interactions: GuestInteraction[]) => {
		// Reset state
		setImportError(null)
		setImportProgress(0)
		setIsComplete(false)
		
		// Simulate smooth progress
		progressIntervalRef.current = setInterval(() => {
			setImportProgress((prev) => {
				if (prev >= 85) return prev
				return prev + 5
			})
		}, 100)

		// Submit to API as JSON
		importFetcher.submit(
			JSON.stringify({ interactions }),
			{
				method: "POST",
				action: "/api/import-guest-interactions",
				encType: "application/json",
			}
		)

		// Return promise that resolves when useEffect detects completion
		return new Promise<boolean>((resolve) => {
			resolveRef.current = resolve
		})
	}

	return {
		importProgress,
		importError,
		importInteractions,
		isImporting: importFetcher.state === 'submitting',
	}
}

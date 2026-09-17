// Throwaway integration hooks; null outside the development-only journey preview.
import { createContext, useContext } from "react";
import type { ScoringMedia } from "~/ui/scoring/types";
export const JourneyPrototypeContext = createContext<{
	openTitle: (title: ScoringMedia) => void;
	wishlist: ScoringMedia[];
	onSignUp: () => void;
	limitNotice: boolean;
	dismissLimit: () => void;
	personalized: boolean
	recommendationStatus: "ready" | "loading" | "error"
	retryRecommendations: () => void;
} | null>(null);
export const useJourneyPrototype = () => useContext(JourneyPrototypeContext);

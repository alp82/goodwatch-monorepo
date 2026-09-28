// One message per taste-dependent feature, in two stages:
// - learn: the guest has no taste yet (fewer than 5 guest ratings), so the feature can't work until it learns it.
// - keep: the feature already works from the guest's ratings, which only this browser holds.
export type SignUpFeature =
	| "forYou"
	| "bestMatch"
	| "tasteMatch"
	| "taste"
	| "watchNext"

export type SignUpStage = "learn" | "keep"

export interface SignUpMessage {
	/** The call to action, on every size. */
	title: string
	/** One more line, on the card size only. */
	detail: string
}

const KEEP_DETAIL =
	"Your ratings live only in this browser. With an account they come with you."

export const SIGN_UP_MESSAGES: Record<
	SignUpFeature,
	Record<SignUpStage, SignUpMessage>
> = {
	forYou: {
		learn: {
			title: "Sign up so For you can learn your taste",
			detail: "For you moves the titles you'll probably like up the list.",
		},
		keep: { title: "Sign up to keep your taste", detail: KEEP_DETAIL },
	},
	bestMatch: {
		learn: {
			title: "Sign up so Best match can learn your taste",
			detail: "Best match puts the titles closest to your taste first.",
		},
		keep: { title: "Sign up to keep your taste", detail: KEEP_DETAIL },
	},
	tasteMatch: {
		learn: {
			title: "Sign up to see how well each title matches your taste",
			detail:
				"Rate a few titles you love and every card shows its taste match.",
		},
		keep: { title: "Sign up to keep your taste match", detail: KEEP_DETAIL },
	},
	taste: {
		learn: {
			title: "Sign up to see your own taste",
			detail:
				"Rate titles you've seen and this page shows what you love in them.",
		},
		keep: { title: "Sign up to keep your taste", detail: KEEP_DETAIL },
	},
	watchNext: {
		learn: {
			title:
				"Sign up to keep your Wishlist and let Best match learn your taste",
			detail: "Your Wishlist and ratings come with you to every device.",
		},
		keep: {
			title: "Sign up to keep your Wishlist and your taste",
			detail: KEEP_DETAIL,
		},
	},
}

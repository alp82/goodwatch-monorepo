// PROTOTYPE - throwaway (#659). The one place that words a group of the titles a member loves: by two titles they
// loved that are most typical of it ("Like Se7en and Zodiac"), with no category noun. Swap the wording here.

export interface GroupWords {
	/** "Se7en and Zodiac" */
	pair: string
	/** The group's label in pickers and chips. */
	like: string
	/** The line under a pick that belongs to the group. */
	because: string
}

export function groupWords(titles: string[]): GroupWords {
	const [a, b] = titles
	const pair = b ? `${a} and ${b}` : (a ?? "")
	return { pair, like: `Like ${pair}`, because: `Because you loved ${pair}` }
}

/** "like Se7en and Zodiac", for the middle of a sentence. */
export const likeInline = (words: GroupWords) => `like ${words.pair}`

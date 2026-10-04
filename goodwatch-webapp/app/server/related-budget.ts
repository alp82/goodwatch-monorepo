export const relatedPrefetchBudgetMs = (isCrawler: boolean): number =>
	isCrawler ? 1000 : 150

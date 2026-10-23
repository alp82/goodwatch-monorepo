// Website labels from domain/themes-styles.ts and ui/filter-bar/labels.ts.
// Keep registration runnable in plain Node without loading the website's module aliases.
export const themeChoices = [
	["crime", "Crime"],
	["mystery", "Mystery"],
	["war", "War"],
	["politics", "Politics"],
	["true", "True stories"],
	["history", "History"],
	["growing", "Growing up"],
	["family", "Family"],
	["mind", "The mind"],
	["showbiz", "Showbiz"],
	["sports", "Sports"],
	["money", "Money"],
	["future", "Future"],
	["fantasy", "Fantasy"],
].map(([value, name]) => ({ value, name }))
export const styleChoices = [
	["animated", "Animated"],
	["documentary", "Documentary"],
	["spectacle", "Spectacle"],
	["stylized", "Stylized"],
	["music", "Music"],
	["slow", "Slow burn"],
	["fast", "Fast-paced"],
	["talky", "Talky"],
	["nonlinear", "Nonlinear"],
	["graphic", "Graphic"],
].map(([value, name]) => ({ value, name }))
export const releasedChoices = [
	["any", "Any year"],
	["recent", "Last 3 years"],
	["2010s", "2010s"],
	["2000s", "2000s"],
	["before2000", "Before 2000"],
].map(([value, name]) => ({ value, name }))

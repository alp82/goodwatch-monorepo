import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type TitleAwardResult,
	awardWinCount,
	awardsLinkLabel,
	awardsRowValue,
	byBody,
	categoryLabel,
	foldsNominations,
	nominationsLabel,
	yearSpan,
} from "./title-award-list.ts"

const r = (
	award: string,
	category: string,
	year: string,
	won: boolean,
): TitleAwardResult => ({ award, category, year, won })

test("the link counts the reported wins and is left out without one", () => {
	const results = [
		r("Academy Awards", "Directing", "2024", true),
		r("Academy Awards", "Writing", "2024", false),
		r("BAFTA Awards", "Editing", "2024", true),
	]
	assert.equal(awardWinCount(results), 2)
	assert.equal(awardsLinkLabel(2), "2 awards")
	assert.equal(awardsLinkLabel(37), "37 awards")
	assert.equal(awardsLinkLabel(1), "1 award")
	assert.equal(awardsLinkLabel(0), null)
	assert.equal(
		awardWinCount([r("Academy Awards", "Writing", "2024", false)]),
		0,
	)
	assert.equal(awardWinCount([]), 0)
})

test("results group by body: bodies with a win first by prestige, wins first and newest in each", () => {
	const groups = byBody([
		r("Critics' Choice Awards", "Best Drama Series", "2022", false),
		r("Golden Globe Awards", "Best Actor", "2020", false),
		r("Primetime Emmy Awards", "Outstanding Writing", "2019", true),
		r("Golden Globe Awards", "Best Television Series – Drama", "2022", true),
		r("Primetime Emmy Awards", "Outstanding Drama Series", "2023", false),
		r("Primetime Emmy Awards", "Outstanding Drama Series", "2020", true),
	])
	assert.deepEqual(
		groups.map((g) => g.award),
		["Primetime Emmy Awards", "Golden Globe Awards", "Critics' Choice Awards"],
	)
	assert.deepEqual(
		groups[0].results.map((x) => `${x.year} ${x.won}`),
		["2020 true", "2019 true", "2023 false"],
	)
	assert.equal(groups[0].nominations, 1)
	assert.equal(yearSpan(groups[0].from, groups[0].to), "2019 to 2023")
	assert.equal(yearSpan(groups[2].from, groups[2].to), "2022")
	assert.equal(
		categoryLabel("Best Television Series – Drama"),
		"Best Television Series, Drama",
	)
})

test("a body folds its nominations only with more than 4 nominations and more than 10 results", () => {
	const body = (wins: number, noms: number) =>
		byBody([
			...Array.from({ length: wins }, (_, i) =>
				r("Primetime Emmy Awards", `W${i}`, "2020", true),
			),
			...Array.from({ length: noms }, (_, i) =>
				r("Primetime Emmy Awards", `N${i}`, "2020", false),
			),
		])[0]
	assert.equal(foldsNominations(body(6, 5)), true)
	assert.equal(
		foldsNominations(body(5, 5)),
		false,
		"10 results is not more than 10",
	)
	assert.equal(
		foldsNominations(body(7, 4)),
		false,
		"4 nominations is not more than 4",
	)
	assert.equal(foldsNominations(body(0, 11)), true)
	assert.equal(nominationsLabel(5), "Show 5 nominations")
	assert.equal(nominationsLabel(1), "Show 1 nomination")
})

test("the row's line names won bodies, then major bodies with only nominations, else where it was nominated", () => {
	assert.equal(
		awardsRowValue([
			r("BAFTA Awards", "Editing", "2024", false),
			r("Golden Globe Awards", "Best Film", "2024", true),
			r("Academy Awards", "Directing", "2024", true),
			r("Critics' Choice Awards", "Best Film", "2024", true),
		]),
		"Oscar winner, Golden Globe winner, Critics' Choice winner",
	)
	assert.equal(
		awardsRowValue([
			r("Academy Awards", "Directing", "2024", false),
			r("César Awards", "Best Film", "2024", true),
		]),
		"César winner, Oscar nominee",
	)
	assert.equal(
		awardsRowValue([r("MTV Movie & TV Awards", "Best Kiss", "2010", false)]),
		"Nominated at the MTV Movie & TV Awards",
	)
})

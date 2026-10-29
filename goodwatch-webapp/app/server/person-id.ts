/** Person IDs must fit the catalog's Crate INTEGER columns before any profile work starts. */
export const validPersonId = (id: number) =>
	Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647

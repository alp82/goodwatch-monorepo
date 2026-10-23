/** Only verified provider IDs share an identity. A similar name alone never establishes an alias. */
const services: readonly [number, string, readonly number[]][] = [
	[8, "Netflix", [1796]],
	[9, "Amazon Prime Video", [119, 2100]],
	[1899, "HBO Max", [384, 1825, 2472]],
	[386, "Peacock", [387, 2553]],
	[350, "Apple TV+", [2243]],
	[531, "Paramount+", [582, 633, 1853, 2303, 2304, 2616]],
	[337, "Disney+", []],
	[11, "MUBI", [201]],
	[283, "Crunchyroll", [1968]],
	[99, "Shudder", [204, 2049]],
	[87, "Acorn TV", [196, 2034]],
	[151, "BritBox", [197, 1852]],
	[526, "AMC+", [528, 635, 1854]],
	[34, "MGM+", [583, 636, 2141, 2142]],
	[43, "Starz", [634, 1794, 1855]],
	[524, "Discovery+", [510, 520, 584]],
]

export const PROVIDER_ALIASES: ReadonlyMap<
	number,
	{ id: number; name: string }
> = new Map(
	services.flatMap(([id, name, aliases]) =>
		[id, ...aliases].map((alias) => [alias, { id, name }]),
	),
)

export function providerIdentity(id: number | undefined, name: string) {
	return (
		(id === undefined ? undefined : PROVIDER_ALIASES.get(id)) ?? {
			id,
			name: name.trim(),
		}
	)
}

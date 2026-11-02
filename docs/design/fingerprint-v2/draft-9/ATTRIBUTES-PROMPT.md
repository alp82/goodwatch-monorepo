# Attributes generation

Generate stored attributes through the two disjoint calls defined in `request-contract.json`: `requests/targeted.PROMPT.md` and `requests/facts.PROMPT.md`. Each has its own exact definition and schema. The vector call owns fifteen additional presence flags which merge into stored attributes. Do not independently regenerate those flags.

The full stored `attributes.schema.json` is the assembly contract, not a fourth generation request.

# Research for a concise `/roadmap` skill

Researched 2026-09-16. Question: how should a reusable agent skill maintain a reasoned answer to “what deserves attention next?” without expanding every candidate into a planning project?

## Findings from reusable skills and projects

These are observations of published source instructions, not evidence that the skills produce better outcomes. No exact match was found for the combination of a persistent tracker roadmap, candidate-versus-ticket separation, and an explicit admission rule for evidence prerequisites.

| Source | What it actually does | Adopt or avoid here |
| --- | --- | --- |
| [shiquda/roadmap-skill: roadmap](https://github.com/shiquda/roadmap-skill/blob/main/skills/roadmap/SKILL.md) and [roadmap-task-flow](https://github.com/shiquda/roadmap-skill/blob/main/skills/roadmap-task-flow/SKILL.md) | A small entry skill routes to separate backlog, focused planning graph, and visualization workflows. Detailed tool behavior belongs to its MCP rather than the skill. Its task flow includes capture, enrichment, and reprioritization. | Borrow the separation between broad review and focused planning, and reliance on existing tool conventions. Its task-centric capture/enrichment model would reproduce our candidate-to-task drift if copied directly. A new MCP and four-skill suite are unnecessary for this use case. |
| [phuryn/pm-skills: outcome-roadmap](https://github.com/phuryn/pm-skills/blob/main/pm-execution/skills/outcome-roadmap/SKILL.md) | A compact skill rewrites existing initiatives around customer and business outcomes, adds assumptions and sequencing, and saves a document. It is a transformation workflow rather than an ongoing tracker lifecycle. | Ask what changes for whom and why it matters. Keep the desired outcome separate from a proposed feature. The source’s numerical examples are illustrations; a new skill should distinguish supported measures from proposed targets rather than manufacture precision. |
| [JK-0001/skills: product-roadmap](https://github.com/JK-0001/skills/blob/main/product-roadmap/SKILL.md) | A solo-business workflow gathers ideas, prioritizes, organizes horizons, integrates feedback, and reviews the roadmap. It recommends RICE or value/effort and specifies quarterly planning and capacity defaults. | Borrow gathering before prioritizing and revision as learning arrives. Avoid importing its fixed cadence, percentages, feature counts, or score-based decision rule into a general skill. Those are the author's prescriptions, not constraints established for this user. |
| [vm0-ai/vm0-skills: roadmap-planning](https://github.com/vm0-ai/vm0-skills/blob/main/roadmap-planning/SKILL.md) | A reference document covering roadmap formats, scoring frameworks, dependencies, capacity, and communicating changes. | Its revision pattern is useful: identify the catalyst, change, and displaced priority. Its framework catalogue and delivery dependency machinery would add unnecessary scope to a concise prioritization skill. |

## Relevant first-party approaches

| Source | Finding | Implication for this skill |
| --- | --- | --- |
| [Basecamp: Bets, Not Backlogs](https://basecamp.com/shapeup/2.1-chapter-07) | Shape Up limits a betting discussion to a few shaped proposals; it argues that repeatedly maintaining a huge central backlog wastes attention. Ideas can survive separately without automatically entering the betting process. | A retained idea need not be active work. Compare a small shortlist. This is an adaptation, not adoption of Shape Up: its candidates are already shaped, whereas our choice can be which area deserves focused discovery. |
| [Product Talk: Opportunity Solution Trees](https://www.producttalk.org/2016/08/opportunity-solution-tree/) | The method separates outcome, customer opportunities, solutions, and assumption tests; selecting a target opportunity precedes solution exploration. It also calls for real interview inputs rather than invented opportunities. | Preserve outcome/problem/solution distinctions. A full tree and its interview prerequisites are unnecessary for every roadmap review; use available evidence and label uncertainty. |
| [ProdPad: Now-Next-Later Roadmap](https://www.prodpad.com/glossary/now-next-later-roadmap/) | The format expresses confidence horizons and changing understanding, rather than date commitments or an automatic delivery queue. Its author distinguishes strategic roadmapping from execution tracking. | Make commitment state explicit. For this user's simpler workflow, “current focus” and “candidates” may communicate that distinction more clearly than three columns requiring interpretation. |

## Original Reddit discussions

These threads are first-person anecdotes and opinions, not representative research or proof of consensus. Only the original discussions were used, not summaries of Reddit.

- [How do you make roadmaps actually useful?](https://www.reddit.com/r/ProductManagement/comments/1jcy21y/how_do_you_make_roadmaps_actually_useful/): the original question contrasts business decisions with project tracking. Commenters describe priority alignment, strategic narrative, and explicit uncertainty as sources of usefulness. Others emphasize context and the need to expose deeper detail when it already exists. **Design inference:** maintain a readable decision summary and links to detail; do not require producing detailed plans merely to populate the roadmap.
- [Presented roadmap / prioritization to the dev team today…](https://www.reddit.com/r/ProductManagement/comments/1jb6dmo/presented_roadmap_prioritization_to_the_dev_team/): the author reports that “Now/Next/Later” was interpreted as a schedule despite a verbal caveat. A respondent describes a similar presentation and concern that named solutions become perceived commitments; other respondents describe legitimate architectural needs for directional information. **Design inference:** labels and prose disclaimers alone are weak. Keep tentative candidates structurally separate from actionable work, while retaining known constraints and dependencies that genuinely affect the choice.

## Proposed synthesis

The following is our design recommendation, not a workflow claimed by any single source:

1. Keep one living artifact for direction, constraints, current focus, candidate comparisons, and a short decision history. Reuse the project's tracker conventions.
2. Review the breadth of known opportunities before expanding any one. Candidate entries explain the problem/outcome, evidence, rough cost or constraints, and why now; existing detail is linked.
3. Compare a small shortlist in plain language. Numerical scoring is optional when inputs support it. The user owns value judgments and the actual selection.
4. Admit an evidence ticket only when it names the choice its answer could change and a bounded stopping condition. Useful-but-nonessential knowledge stays as uncertainty in the candidate. A prototype can qualify under the same rule; its method alone does not justify a ticket.
5. When such evidence is required before choosing, make the priority decision depend on it and release its claim while blocked. Keep tentative candidates out of the active decision frontier.
6. After a choice, record why it won, what was deferred, and what would prompt reconsideration. Hand off a bounded effort to `/wayfinder` when it needs deeper planning; straightforward work needs no new map. Return when results or circumstances could change priorities.

The principal departure from Wayfinder is structural: an ongoing roadmap can be current without becoming complete. The session ends with a supported priority choice or an explicit, bounded information prerequisite—not with all candidate areas fully investigated.

## Limits

- This was a focused search of directly relevant skills, original framework descriptions, and two original practitioner threads; it is not an exhaustive survey.
- Repository instructions demonstrate available approaches, not their adoption, reliability, or measured quality. Mutable source URLs were inspected on the research date.
- No source independently validates the exact ticket admission, claiming, or blocking rules proposed above. Those address failures observed in this conversation.
- The report does not establish which GoodWatch opportunity should win, change tracker state, or install third-party skills.

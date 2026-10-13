# Review and research brief: taste, recommendations and score prediction on GoodWatch

You are one of three independent reviewers (different models, working separately). Do not coordinate; a
different view is the point.

## Read first

- `/home/alper/projects/goodwatch-monorepo/docs/research/taste-prediction/README.md`: the report under review. Three
  rounds of experiments on predicting a member's rating of an unrated title, and on describing their taste.
- `docs/research/taste-prediction/lab/`: harness (`harness.py`, its docstring is the predictor contract), the round
  briefs, every agent's code, `ledger.jsonl` with every scored run.
- `docs/research/taste-prediction/owner-taste.md`: the readable taste the experiments produced for the owner.
- Product context in the same repository: `CONTEXT.md` (the glossary: Taste, Taste match, Side of you, Fingerprint,
  Mood, For you), `docs/implementation/recommendation-experience/README.md` (how recommendations work today),
  `goodwatch-webapp/app/server/taste/` (today's taste: one vector) and `goodwatch-webapp/app/server/taste-portrait/`
  (Sides of you).

## Data you may use

- The local data file, read only: `<scratchpad>/lab/pack.pkl`, loaded with `harness.Data()` from
  `<scratchpad>/lab/harness.py` (run python from `<scratchpad>/lab`). It holds 4,446 titles and about
  7,200 development ratings from 231 members. You may run small read-only analyses on it to test an idea before you
  recommend it. Do not write into that folder or into the repository, and do not look for the locked ratings.
- Do NOT query production databases or any paid API. You may search the web for prior work and for data sources.
- What production holds beyond the data file (Crate tables, for judging what could be obtained): user_score,
  user_wishlist, user_skipped, user_not_interested, user_favorite, user_watch_state (show status incl. Dropped),
  user_watch_log (per-episode watch events with timestamps), user_import and user_import_item (ratings imported from
  other services), user_list, user_setting (country, streaming services), search_history, movie, show, season,
  episode, imdb_episode / imdb_season / metacritic_season / rotten_tomatoes_season (per-season and per-episode
  scores), person and credits, trope (TV Tropes text), streaming_availability, release_event, translation,
  alternative_title. Per title: 74 fingerprint attribute scores from an LLM title analysis, essence text and tags,
  suitability and viewing-context flags, content advisories, age certifications, TMDB recommendation and similar ids.
  Qdrant holds two text embeddings per title. PostHog holds product analytics (page views, clicks).
- Scale today: about 230 members with ratings, about 9,000 ratings, one member with about 1,000.

## What to deliver

Your final message is the deliverable (markdown, complete, no preamble). Three parts:

1. **Review.** Where is the report wrong, overconfident, or unproven? Check the methodology (the locked split and its
   three looks, cross-validation, the measures, one dominant member, selection effects: members only rate what they
   chose to watch), the conclusions drawn from null results, and anything you can test yourself on the data file. Say
   what you verified and what you only reasoned about. Rank issues by how much they change what should be built.
2. **New branches to explore.** The goal: improve (a) taste profiles a member reads about themselves, (b)
   recommendations, meaning which unseen titles to show and in what order, which the report never measured, and (c)
   predicted scores, including bad ones. For each branch give: the hypothesis and why you believe it (prior work with
   links where it exists, or evidence from the data file); the data it needs and whether we have it, can derive it, or
   must obtain it and how (asking members, imports from other services, public datasets, product instrumentation, an
   LLM pass over titles); a concrete experiment that fits the existing harness or the new measurement it needs; the
   gain you expect and how sure you are; cost and risk. Go beyond the report's own "next steps"; be specific enough
   that an engineer could start. Include ideas that change what is measured (ranking quality on unseen titles,
   offline replay, re-rating consistency to find the error floor, eliciting preferences directly) and ideas that
   change what data exists.
3. **Ranking.** Your top five branches in order, each with one sentence on why it beats the next, and the two things
   you would stop doing.

Write plainly: short sentences, define terms, numbers with what they measure. Be concrete and willing to disagree
with the report.

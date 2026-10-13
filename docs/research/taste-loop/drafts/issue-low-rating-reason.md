# Issue: ask why after a low rating

Filed as https://github.com/alp82/goodwatch-monorepo/issues/526. Drafted by the taste research loop on October 13, 2026 (`docs/research/taste-loop/PLAN.md`, section 2.7).

## What to build

After a member rates a title 5 or less, offer one optional tap for why.

## Why

Some low ratings look unpredictable from everything GoodWatch knows about a title: 15 of the owner's 70 low-rated
titles in the research data score well on every measure. Nothing stored says why they disappointed. A reason tells
whether the cause is in the title (a kind the member dislikes, a bad ending), which better title data could capture,
or in the evening (wrong mood, expected more), which no prediction will find. About 200 answers are enough to see
which dominates.

## Scope

- Shown once, right after a rating of 5 or less is saved, where the rating was made. Dismissible; never blocks.
- One tap, one of: Not my kind · Boring · Expected more · Too long · Bad ending · Wrong mood · Something else.
- Stored per member and title beside the rating, with the time. Changing the rating to 6 or more keeps the stored
  reason but stops showing it. A new low rating of the same title may replace it.
- Not a taste signal for now: it changes no recommendation, no taste match and no description.

Not in scope: free text; reasons for high ratings; reasons on Dropped or Not interested (those keep their own
meaning and may get their own question later).

## Acceptance

- Rating a title 5 or less shows the row once; tapping stores the reason; dismissing stores nothing.
- Rating 6 or more shows nothing.
- The reason is readable beside the rating in Crate (a column on `user_score` or a small table).
- Guests are not asked, or their answer transfers with their guest progress at sign-up (implementer's choice,
  stated in the pull request).
- The wording uses the terms in `CONTEXT.md`.

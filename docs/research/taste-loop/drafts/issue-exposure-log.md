# Issue: record which titles a member was shown

Filed as https://github.com/alp82/goodwatch-monorepo/issues/525. Drafted by the taste research loop on October 13, 2026 (`docs/research/taste-loop/PLAN.md`, section 2.7).

## What to build

For signed-in members, record each list a member is shown on Discover and Watch next: which titles, in which
position, under which sort.

## Why

Today GoodWatch stores what a member acted on (a rating, Want to See, Not interested) but not what they saw. So a
title a member looked at and passed over cannot be told apart from a title they never saw. That difference is what
separates a bad suggestion from an untested one, and it is the only way to check a new ordering against what members
do without showing it to everyone first. It cannot be reconstructed afterwards: every week without it is evidence
that is gone.

## Scope

One record per list render for a member, written by the server when it has built the list:

- member id, time, surface (Discover, Watch next), sort (Best match, or the sort chosen), For you on or off
- the filters in force (media type, On my services, moods, taste match filter), country
- the version of the taste that ordered the list (`TASTE_KEY_VERSION`) and the flag states that change ordering
- the first 30 titles: title key, position, and the taste match shown
- a list id, so later actions can be joined to it

Later actions on a title from that list (open, Want to See, Not interested, rating) carry the list id and position
where the client knows them.

Not in scope: guests; any change to what members see; the randomised slot (a follow-up once this has run for a
month: fill one position at random from ranks 5 to 30 and record the probability).

## Open choices for the implementer

- Storage: a Crate table (`user_list_exposure`) or a PostHog event. A Crate table keeps it joinable with ratings
  and inside the read path research already uses. PostHog is less work but harder to join and sampled by consent.
- Volume: one row per render with the 30 titles as an array keeps it to one write per page of results.
- The existing poster-impression endpoint serves title processing priority and should stay separate.

## Acceptance

- Loading Discover and Watch next as a member writes one record per page of results with the fields above.
- Changing sort, a filter or For you writes a new record with the changed values.
- A rating or Want to See made from a list card can be joined to the record that showed it.
- No record is written for guests. Nothing a member sees changes.
- The write does not add a request to the first view and does not delay the response (written after the response,
  or batched).

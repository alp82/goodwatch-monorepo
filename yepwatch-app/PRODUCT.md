# Product

<!-- impeccable:product-schema 1 -->

YepWatch: a group picks one thing to watch together. Inherits the shared product record in `../PRODUCT.md`. This file adds only what is specific to YepWatch.

## Platform

adaptive

<!-- Open decision: recorded as `adaptive` because the app ships one design on iOS and Android while following each OS's conventions (back gesture, hardware back, keyboard handling). Browser guests join through the same Expo app on the web. Confirm or change. -->

## Users

A group in the same room (friends, a couple, a family) who can't agree on what to watch. One person creates a room, the others join from their own phones, natively or in a browser as guests without installing anything.

## Product Purpose

Turn a group's disagreement into one confirmed watch pick that everyone agreed to and that is available on the room's services.

## Positioning

Each person answers Yep or Nope privately, so nobody is pressured by the others. Matches come from overlap, are checked against the room's country and services, and need everyone's explicit agreement. Members' GoodWatch taste can shape the candidates.

## Operating Context

- A room has one shared country and service selection, a prompt or preset, and a Movies and Shows choice.
- Voting happens at the same time on several phones in one room, usually in the evening.
- Guests can take part without an account. Continuing a show requires the member's real linked GoodWatch progress.

## Capabilities and Constraints

- Individual Yep and Nope answers stay private. Only server-confirmed matches are shown to the group.
- Everyone agreeing triggers a fresh availability check before the decision is confirmed.
- Built with Expo and React Native. Updates reach installed apps over the air.

## Brand Commitments

- The app is named YepWatch and presents itself as running on GoodWatch.

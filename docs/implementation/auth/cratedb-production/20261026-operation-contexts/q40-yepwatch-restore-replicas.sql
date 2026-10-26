-- PLANNED ONLY. Requires owner go, current-policy match and per-statement readback.
-- Submit one statement at a time through crate_sql; stop on any error.
ALTER TABLE "doc"."yepwatch_agreement" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_candidate" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_command_receipt" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_control" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_decision" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_invitation" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_member_grant" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_member_intent" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_participant" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_proposal" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_room" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_runtime" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_ticket" SET (number_of_replicas='2');
ALTER TABLE "doc"."yepwatch_vote" SET (number_of_replicas='2');

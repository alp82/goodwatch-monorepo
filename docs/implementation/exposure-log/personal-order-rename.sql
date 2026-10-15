-- Owner-applied rename for CrateDB 5.10.16. No table copy or row deletion.
-- Stop/drain ALL exposure writers and pause schema initialization before running.
-- See ../personal-order-rename.md for the complete deployment and rollback order.
-- The owner reported 64 existing rows; compare before/after with writers stopped.
-- RENAME COLUMN requires a table created on CrateDB >= 5.5.
SELECT column_policy, version FROM information_schema.tables
WHERE table_schema = 'doc' AND table_name = 'user_list_exposure';
SELECT COUNT(*) AS rows_before FROM doc.user_list_exposure;

-- Run once, in order, stopping on any error. These statements are not a transaction.
ALTER TABLE doc.user_list_exposure RENAME COLUMN g1_flag_mode TO personal_order_flag_mode;
ALTER TABLE doc.user_list_exposure RENAME COLUMN g1_fallback_reason TO personal_order_fallback_reason;
ALTER TABLE doc.user_list_exposure RENAME COLUMN g1_payload_build_time TO personal_order_payload_build_time;
ALTER TABLE doc.user_list_exposure RENAME COLUMN g1_model_hash TO personal_order_model_hash;
ALTER TABLE doc.user_list_exposure RENAME COLUMN g1_snapshot_version TO personal_order_snapshot_version;
ALTER TABLE doc.user_list_exposure RENAME COLUMN g1_groups TO personal_order_groups;
ALTER TABLE doc.user_list_exposure RENAME COLUMN g1_mix_placed TO personal_order_mix_placed;
ALTER TABLE doc.user_list_exposure RENAME COLUMN g1_first_100 TO personal_order_first_100;

UPDATE doc.user_list_exposure SET ordering = 'personal-order' WHERE ordering = 'g1';
REFRESH TABLE doc.user_list_exposure;

SELECT COUNT(*) AS rows_after FROM doc.user_list_exposure;
SELECT COUNT(*) AS old_ordering_rows FROM doc.user_list_exposure WHERE ordering = 'g1';
-- Expect no old top-level columns and all eight renamed columns with their original types.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'doc' AND table_name = 'user_list_exposure'
  AND (column_name LIKE 'g1%' OR column_name LIKE 'personal_order%')
ORDER BY column_name;

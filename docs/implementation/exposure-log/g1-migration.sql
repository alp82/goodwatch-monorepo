-- Owner applies before deploying stage 2. All fields are nullable.
ALTER TABLE doc.user_list_exposure ADD COLUMN g1_flag_mode TEXT;
ALTER TABLE doc.user_list_exposure ADD COLUMN g1_fallback_reason TEXT;
ALTER TABLE doc.user_list_exposure ADD COLUMN g1_payload_build_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE doc.user_list_exposure ADD COLUMN g1_model_hash TEXT;
ALTER TABLE doc.user_list_exposure ADD COLUMN g1_snapshot_version TEXT;
ALTER TABLE doc.user_list_exposure ADD COLUMN g1_groups ARRAY(INTEGER);
ALTER TABLE doc.user_list_exposure ADD COLUMN g1_mix_placed ARRAY(BOOLEAN);
ALTER TABLE doc.user_list_exposure ADD COLUMN watch_next_tiers ARRAY(TEXT);
ALTER TABLE doc.user_list_exposure ADD COLUMN today_first_100 ARRAY(BIGINT);
ALTER TABLE doc.user_list_exposure ADD COLUMN g1_first_100 ARRAY(BIGINT);

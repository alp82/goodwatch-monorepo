-- #758: Imported collections use the existing list store, with order in items and notes/provenance in this JSON text.
-- Apply before enabling imported lists; existing list reads/writes tolerate an unmigrated schema. Existing five-title share cards leave this column NULL.
ALTER TABLE doc.user_list ADD COLUMN collection_metadata TEXT INDEX OFF STORAGE WITH (columnstore = false);

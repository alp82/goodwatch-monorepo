-- Additive migration for the import and Undo result (#664).
-- Run once against CrateDB before deploying the webapp change: Undo writes this column and the import routes read it.
ALTER TABLE doc.user_import_item ADD COLUMN undo_outcome TEXT;

REFRESH TABLE doc.user_import_item;

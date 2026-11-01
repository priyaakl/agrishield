-- =====================================================================
-- AgriShield | 08_alter_drop_demo.sql   ALTER / DROP examples (schema evolution)
-- =====================================================================

-- ALTER: new requirement — record how each parcel is irrigated
ALTER TABLE land_parcels ADD COLUMN irrigation_type VARCHAR(12) DEFAULT 'RAINFED';
ALTER TABLE land_parcels ADD CONSTRAINT chk_irrigation
      CHECK (irrigation_type IN ('RAINFED','CANAL','BOREWELL','DRIP','SPRINKLER'));
UPDATE land_parcels SET irrigation_type = 'CANAL' WHERE parcel_id IN (1, 2);

-- ALTER: widen a column and add a comment (shows up in the data dictionary)
ALTER TABLE disease_knowledgebase ALTER COLUMN source_reference TYPE VARCHAR(300);
COMMENT ON COLUMN disease_knowledgebase.disease_vector IS '384-d all-MiniLM-L6-v2 embedding of name + crop + symptoms';

-- ALTER: rename and back (demonstration)
ALTER TABLE land_parcels RENAME COLUMN survey_number TO survey_no;
ALTER TABLE land_parcels RENAME COLUMN survey_no TO survey_number;

-- DROP: a staging table used for a one-off CSV import
CREATE TABLE staging_disease_import (name TEXT, crop TEXT, symptoms TEXT);
DROP TABLE staging_disease_import;

-- DROP: remove an index/view that is no longer needed, then recreate
DROP INDEX IF EXISTS idx_disease_crop_lower;
CREATE INDEX idx_disease_crop_lower ON disease_knowledgebase (lower(affected_crop));

-- DROP COLUMN (undo the irrigation demo)
ALTER TABLE land_parcels DROP CONSTRAINT chk_irrigation;
ALTER TABLE land_parcels DROP COLUMN irrigation_type;

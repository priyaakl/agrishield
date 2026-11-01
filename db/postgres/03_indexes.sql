-- =====================================================================
-- AgriShield | 03_indexes.sql
-- PostgreSQL does NOT auto-index foreign keys, so the common lookups get
-- B-tree indexes. Vector + full-text get their own index types.
-- =====================================================================

-- B-tree: foreign-key lookups used on every dashboard
CREATE INDEX idx_parcels_farmer      ON land_parcels (farmer_id);
CREATE INDEX idx_policies_parcel     ON insurance_policies (parcel_id);
CREATE INDEX idx_claims_policy       ON insurance_claims (policy_id);
CREATE INDEX idx_reports_parcel_time ON disease_reports (parcel_id, reported_at DESC);

-- Composite: admin queue "pending claims, oldest first"
CREATE INDEX idx_claims_status_filed ON insurance_claims (status, filed_at);

-- Composite: eligibility / expiry checks
CREATE INDEX idx_policies_status_end ON insurance_policies (status, end_date);

-- Partial index: inspector queue only ever looks at unreviewed reports
CREATE INDEX idx_reports_unreviewed  ON disease_reports (reported_at)
    WHERE review_status = 'SUBMITTED';

-- Expression index: case-insensitive crop filter used by vector search
CREATE INDEX idx_disease_crop_lower  ON disease_knowledgebase (lower(affected_crop));

-- HNSW vector indexes for approximate nearest-neighbour search (cosine)
CREATE INDEX idx_disease_vector_hnsw ON disease_knowledgebase
    USING hnsw (disease_vector vector_cosine_ops);
CREATE INDEX idx_report_vector_hnsw  ON disease_reports
    USING hnsw (symptom_vector vector_cosine_ops);

-- GIN index for full-text search
CREATE INDEX idx_disease_fts         ON disease_knowledgebase USING gin (search_tsv);

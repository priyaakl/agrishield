-- =====================================================================
-- AgriShield | 01_schema.sql
-- Relational core (PostgreSQL 15+) + pgvector columns.
-- Run on a fresh database. Re-running drops and recreates everything.
-- =====================================================================

SET client_min_messages = warning;

CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: VECTOR type + similarity operators
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- lets "=" on plain columns sit inside an EXCLUDE constraint
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- bcrypt hashing for seed passwords

-- DROP (child tables first, CASCADE also removes dependent views/triggers)
DROP TABLE IF EXISTS claim_status_history  CASCADE;
DROP TABLE IF EXISTS payout_ledger         CASCADE;
DROP TABLE IF EXISTS insurance_claims      CASCADE;
DROP TABLE IF EXISTS disease_match_history CASCADE;
DROP TABLE IF EXISTS disease_reports       CASCADE;
DROP TABLE IF EXISTS disease_knowledgebase CASCADE;
DROP TABLE IF EXISTS insurance_policies    CASCADE;
DROP TABLE IF EXISTS land_parcels          CASCADE;
DROP TABLE IF EXISTS farmers               CASCADE;
DROP TABLE IF EXISTS users                 CASCADE;

-- ---------------------------------------------------------------------
-- USERS: every login (farmer, inspector, admin). Passwords are bcrypt hashes.
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name      VARCHAR(100) NOT NULL CHECK (length(trim(full_name)) >= 2),
    email          VARCHAR(120) NOT NULL UNIQUE
                   CHECK (email = lower(email) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    password_hash  TEXT         NOT NULL CHECK (password_hash LIKE '$2%'),   -- must look like bcrypt, never plain text
    role           VARCHAR(10)  NOT NULL CHECK (role IN ('FARMER','INSPECTOR','ADMIN')),
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- FARMERS: farmer profile, 1:1 with a FARMER user account.
-- ---------------------------------------------------------------------
CREATE TABLE farmers (
    farmer_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            BIGINT      NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    phone              VARCHAR(10) NOT NULL UNIQUE CHECK (phone ~ '^[6-9][0-9]{9}$'),  -- Indian mobile
    location_district  VARCHAR(60) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- LAND_PARCELS
-- ---------------------------------------------------------------------
CREATE TABLE land_parcels (
    parcel_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    farmer_id      BIGINT       NOT NULL REFERENCES farmers(farmer_id) ON DELETE RESTRICT,
    parcel_name    VARCHAR(60)  NOT NULL,
    survey_number  VARCHAR(30),
    acres          NUMERIC(8,2) NOT NULL CHECK (acres > 0 AND acres <= 1000),
    soil_type      VARCHAR(10)  NOT NULL
                   CHECK (soil_type IN ('RED','BLACK','ALLUVIAL','LATERITE','SANDY','CLAY','LOAMY')),
    gps_latitude   NUMERIC(9,6) CHECK (gps_latitude  BETWEEN -90  AND 90),
    gps_longitude  NUMERIC(9,6) CHECK (gps_longitude BETWEEN -180 AND 180),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_parcel_name_per_farmer UNIQUE (farmer_id, parcel_name)
);

-- ---------------------------------------------------------------------
-- INSURANCE_POLICIES
-- Status is the policy lifecycle only (claim status lives on the claim).
-- EXCLUDE constraint: no two non-cancelled policies for the same parcel+crop
-- may have overlapping coverage periods.
-- ---------------------------------------------------------------------
CREATE TABLE insurance_policies (
    policy_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parcel_id        BIGINT        NOT NULL REFERENCES land_parcels(parcel_id) ON DELETE RESTRICT,
    crop_type        VARCHAR(40)   NOT NULL,
    season           VARCHAR(6)    NOT NULL CHECK (season IN ('KHARIF','RABI','ZAID')),
    coverage_amount  NUMERIC(12,2) NOT NULL CHECK (coverage_amount > 0),
    premium_amount   NUMERIC(12,2) NOT NULL CHECK (premium_amount >= 0),
    start_date       DATE          NOT NULL,
    end_date         DATE          NOT NULL,
    status           VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE'
                     CHECK (status IN ('ACTIVE','EXPIRED','CANCELLED')),
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_policy_dates   CHECK (end_date > start_date),
    CONSTRAINT chk_premium_sane   CHECK (premium_amount <= coverage_amount),
    CONSTRAINT no_overlapping_policies EXCLUDE USING gist (
        parcel_id WITH =,
        crop_type WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    ) WHERE (status <> 'CANCELLED')
);

-- ---------------------------------------------------------------------
-- DISEASE_KNOWLEDGEBASE: curated catalogue + 384-d embedding + full-text column
-- ---------------------------------------------------------------------
CREATE TABLE disease_knowledgebase (
    disease_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    disease_name           VARCHAR(80)  NOT NULL,
    affected_crop          VARCHAR(40)  NOT NULL,
    pathogen_type          VARCHAR(10)  NOT NULL
                           CHECK (pathogen_type IN ('FUNGAL','BACTERIAL','VIRAL','PEST','NUTRIENT','OTHER')),
    symptom_description    TEXT         NOT NULL CHECK (length(symptom_description) >= 20),
    recommended_treatment  TEXT         NOT NULL,
    source_reference       VARCHAR(200),
    disease_vector         VECTOR(384),                 -- all-MiniLM-L6-v2 output size
    embedding_model        VARCHAR(60),
    search_tsv             TSVECTOR GENERATED ALWAYS AS (
                               to_tsvector('english', disease_name || ' ' || affected_crop || ' ' || symptom_description)
                           ) STORED,                    -- for full-text search (keyword baseline)
    created_by             BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_disease_per_crop UNIQUE (disease_name, affected_crop)
);

-- ---------------------------------------------------------------------
-- DISEASE_REPORTS: farmer's symptom report, independent of insurance.
-- ---------------------------------------------------------------------
CREATE TABLE disease_reports (
    report_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parcel_id           BIGINT       NOT NULL REFERENCES land_parcels(parcel_id) ON DELETE RESTRICT,
    reported_by         BIGINT       NOT NULL REFERENCES users(user_id),
    crop_type           VARCHAR(40)  NOT NULL,
    symptom_text        TEXT         NOT NULL CHECK (length(trim(symptom_text)) >= 15),
    affected_area_pct   NUMERIC(5,2) CHECK (affected_area_pct > 0 AND affected_area_pct <= 100),
    evidence_uri        TEXT,
    symptom_vector      VECTOR(384),
    review_status       VARCHAR(10)  NOT NULL DEFAULT 'SUBMITTED'
                        CHECK (review_status IN ('SUBMITTED','REVIEWED','DISMISSED')),
    matched_disease_id  BIGINT REFERENCES disease_knowledgebase(disease_id),
    reviewed_by         BIGINT REFERENCES users(user_id),
    inspector_notes     TEXT,
    reported_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    reviewed_at         TIMESTAMPTZ,
    CONSTRAINT chk_review_complete CHECK (
        review_status = 'SUBMITTED'
        OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
    CONSTRAINT chk_reviewed_has_disease CHECK (
        review_status <> 'REVIEWED' OR matched_disease_id IS NOT NULL
    )
);

-- ---------------------------------------------------------------------
-- DISEASE_MATCH_HISTORY: associative entity (M:N report <-> disease).
-- Stores what the vector search returned, with score and model, for audit.
-- ---------------------------------------------------------------------
CREATE TABLE disease_match_history (
    report_id         BIGINT       NOT NULL REFERENCES disease_reports(report_id) ON DELETE CASCADE,
    disease_id        BIGINT       NOT NULL REFERENCES disease_knowledgebase(disease_id) ON DELETE CASCADE,
    match_rank        SMALLINT     NOT NULL CHECK (match_rank BETWEEN 1 AND 10),
    similarity_score  NUMERIC(5,4) NOT NULL CHECK (similarity_score BETWEEN -1 AND 1),
    model_version     VARCHAR(60)  NOT NULL,
    matched_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (report_id, disease_id)
);

-- ---------------------------------------------------------------------
-- INSURANCE_CLAIMS: one claim per report, filed under one policy.
-- ---------------------------------------------------------------------
CREATE TABLE insurance_claims (
    claim_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    policy_id        BIGINT        NOT NULL REFERENCES insurance_policies(policy_id) ON DELETE RESTRICT,
    report_id        BIGINT        NOT NULL UNIQUE REFERENCES disease_reports(report_id) ON DELETE RESTRICT,
    claim_amount     NUMERIC(12,2) NOT NULL CHECK (claim_amount > 0),
    status           VARCHAR(8)    NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    decision_reason  TEXT,
    decided_by       BIGINT REFERENCES users(user_id),
    filed_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    decided_at       TIMESTAMPTZ,
    CONSTRAINT chk_decision_recorded CHECK (
        status = 'PENDING' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL)
    ),
    CONSTRAINT chk_reject_reason CHECK (status <> 'REJECTED' OR decision_reason IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- PAYOUT_LEDGER: 0..1 payout per claim (UNIQUE claim_id).
-- ---------------------------------------------------------------------
CREATE TABLE payout_ledger (
    payout_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    claim_id           BIGINT        NOT NULL UNIQUE REFERENCES insurance_claims(claim_id) ON DELETE RESTRICT,
    amount_paid        NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0),
    payment_reference  VARCHAR(40)   NOT NULL UNIQUE,
    payment_mode       VARCHAR(6)    NOT NULL DEFAULT 'DBT' CHECK (payment_mode IN ('DBT','NEFT','UPI','CHEQUE')),
    payout_date        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    recorded_by        BIGINT        NOT NULL REFERENCES users(user_id)
);

-- ---------------------------------------------------------------------
-- CLAIM_STATUS_HISTORY: WEAK ENTITY.
-- Identified only through its owner claim + partial key seq_no.
-- Rows are written by a trigger, never by the application.
-- ---------------------------------------------------------------------
CREATE TABLE claim_status_history (
    claim_id    BIGINT      NOT NULL REFERENCES insurance_claims(claim_id) ON DELETE CASCADE,
    seq_no      INT         NOT NULL CHECK (seq_no > 0),
    old_status  VARCHAR(8),
    new_status  VARCHAR(8)  NOT NULL,
    changed_by  BIGINT REFERENCES users(user_id),
    note        TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (claim_id, seq_no)
);

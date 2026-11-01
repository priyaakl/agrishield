-- =====================================================================
-- AgriShield | 02_functions_triggers.sql
-- Stored functions + triggers that enforce the business rules in the DB,
-- so they hold no matter which client writes the data.
-- =====================================================================

-- Who is acting? The API sets this per transaction:
--   SELECT set_config('app.current_user_id', '<id>', true);
CREATE OR REPLACE FUNCTION fn_app_user() RETURNS BIGINT
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
$$;

-- ---------------------------------------------------------------------
-- Is a policy eligible for a claim on a given date?
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_policy_is_eligible(p_policy_id BIGINT, p_on DATE DEFAULT current_date)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM insurance_policies
        WHERE policy_id = p_policy_id
          AND status = 'ACTIVE'
          AND p_on BETWEEN start_date AND end_date
    );
$$;

-- Coverage still available on a policy = coverage - (approved claims)
CREATE OR REPLACE FUNCTION fn_policy_remaining_cover(p_policy_id BIGINT)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
    SELECT p.coverage_amount - COALESCE((
        SELECT SUM(c.claim_amount) FROM insurance_claims c
        WHERE c.policy_id = p.policy_id AND c.status = 'APPROVED'), 0)
    FROM insurance_policies p WHERE p.policy_id = p_policy_id;
$$;

-- ---------------------------------------------------------------------
-- TRIGGER 1: validate a new claim (BEFORE INSERT)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_claim_validate() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    pol insurance_policies%ROWTYPE;
    rep disease_reports%ROWTYPE;
BEGIN
    SELECT * INTO pol FROM insurance_policies WHERE policy_id = NEW.policy_id;
    SELECT * INTO rep FROM disease_reports    WHERE report_id = NEW.report_id;

    IF NOT fn_policy_is_eligible(NEW.policy_id) THEN
        RAISE EXCEPTION 'Policy % is not active today, so a claim cannot be filed under it', NEW.policy_id;
    END IF;
    IF rep.parcel_id <> pol.parcel_id THEN
        RAISE EXCEPTION 'The symptom report is for a different parcel than the policy';
    END IF;
    IF lower(rep.crop_type) <> lower(pol.crop_type) THEN
        RAISE EXCEPTION 'Report crop (%) does not match the insured crop (%)', rep.crop_type, pol.crop_type;
    END IF;
    IF rep.reported_at::date NOT BETWEEN pol.start_date AND pol.end_date THEN
        RAISE EXCEPTION 'The damage was reported outside the policy period';
    END IF;
    IF rep.review_status = 'DISMISSED' THEN
        RAISE EXCEPTION 'This report was dismissed by an inspector and cannot back a claim';
    END IF;
    IF NEW.claim_amount > fn_policy_remaining_cover(NEW.policy_id) THEN
        RAISE EXCEPTION 'Claim amount exceeds the remaining cover (%) on this policy',
              fn_policy_remaining_cover(NEW.policy_id);
    END IF;

    -- a new claim always starts PENDING, whatever the client sent
    NEW.status := 'PENDING';
    NEW.decided_by := NULL; NEW.decided_at := NULL; NEW.decision_reason := NULL;
    RETURN NEW;
END $$;

CREATE TRIGGER claim_validate
BEFORE INSERT ON insurance_claims
FOR EACH ROW EXECUTE FUNCTION trg_claim_validate();

-- ---------------------------------------------------------------------
-- TRIGGER 2: guard claim status changes (BEFORE UPDATE)
-- Only PENDING -> APPROVED / REJECTED is allowed. Decisions are final.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_claim_status_guard() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status <> 'PENDING' THEN
            RAISE EXCEPTION 'Claim % is already %; decisions cannot be changed', OLD.claim_id, OLD.status;
        END IF;
        NEW.decided_at := now();
        NEW.decided_by := COALESCE(NEW.decided_by, fn_app_user());
    ELSIF OLD.status <> 'PENDING' AND (NEW.claim_amount <> OLD.claim_amount OR NEW.policy_id <> OLD.policy_id) THEN
        RAISE EXCEPTION 'A decided claim cannot be edited';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER claim_status_guard
BEFORE UPDATE ON insurance_claims
FOR EACH ROW EXECUTE FUNCTION trg_claim_status_guard();

-- ---------------------------------------------------------------------
-- TRIGGER 3: audit trail into the weak entity CLAIM_STATUS_HISTORY
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_claim_history() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE next_seq INT;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;
    SELECT COALESCE(MAX(seq_no), 0) + 1 INTO next_seq
    FROM claim_status_history WHERE claim_id = NEW.claim_id;

    INSERT INTO claim_status_history (claim_id, seq_no, old_status, new_status, changed_by, note)
    VALUES (NEW.claim_id, next_seq,
            CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
            NEW.status,
            COALESCE(fn_app_user(), NEW.decided_by),
            CASE WHEN TG_OP = 'INSERT' THEN 'Claim filed' ELSE NEW.decision_reason END);
    RETURN NEW;
END $$;

CREATE TRIGGER claim_history
AFTER INSERT OR UPDATE OF status ON insurance_claims
FOR EACH ROW EXECUTE FUNCTION trg_claim_history();

-- ---------------------------------------------------------------------
-- TRIGGER 4: a payout is only allowed for an APPROVED claim,
-- and never more than the claimed amount.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_payout_validate() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE c insurance_claims%ROWTYPE;
BEGIN
    SELECT * INTO c FROM insurance_claims WHERE claim_id = NEW.claim_id;
    IF c.status <> 'APPROVED' THEN
        RAISE EXCEPTION 'Payout refused: claim % is %, not APPROVED', NEW.claim_id, c.status;
    END IF;
    IF NEW.amount_paid > c.claim_amount THEN
        RAISE EXCEPTION 'Payout (%) cannot exceed the claimed amount (%)', NEW.amount_paid, c.claim_amount;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER payout_validate
BEFORE INSERT OR UPDATE ON payout_ledger
FOR EACH ROW EXECUTE FUNCTION trg_payout_validate();

-- ---------------------------------------------------------------------
-- TRIGGER 5: when a disease's text changes, its old embedding is stale.
-- Clear it so the embedding script regenerates it.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_disease_touch() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF (NEW.disease_name, NEW.affected_crop, NEW.symptom_description)
       IS DISTINCT FROM (OLD.disease_name, OLD.affected_crop, OLD.symptom_description)
       AND NEW.disease_vector IS NOT DISTINCT FROM OLD.disease_vector THEN
        NEW.disease_vector := NULL;
        NEW.embedding_model := NULL;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER disease_touch
BEFORE UPDATE ON disease_knowledgebase
FOR EACH ROW EXECUTE FUNCTION trg_disease_touch();

-- ---------------------------------------------------------------------
-- STORED FUNCTION: approve a claim and record its payout atomically.
-- Both steps happen in one transaction; if the payout insert fails
-- (duplicate reference, amount too high...) the approval is rolled back too.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_approve_claim_and_pay(
    p_claim_id   BIGINT,
    p_admin_id   BIGINT,
    p_amount     NUMERIC,
    p_reference  VARCHAR,
    p_mode       VARCHAR DEFAULT 'DBT',
    p_note       TEXT    DEFAULT 'Approved after review'
) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    c          insurance_claims%ROWTYPE;
    new_payout BIGINT;
BEGIN
    -- lock the claim row so two admins can't approve it at the same time
    SELECT * INTO c FROM insurance_claims WHERE claim_id = p_claim_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim % does not exist', p_claim_id;
    END IF;
    IF c.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Claim % is already %', p_claim_id, c.status;
    END IF;
    IF c.claim_amount > fn_policy_remaining_cover(c.policy_id) THEN
        RAISE EXCEPTION 'Approving this claim would exceed the policy coverage';
    END IF;

    UPDATE insurance_claims
       SET status = 'APPROVED', decided_by = p_admin_id, decision_reason = p_note
     WHERE claim_id = p_claim_id;

    INSERT INTO payout_ledger (claim_id, amount_paid, payment_reference, payment_mode, recorded_by)
    VALUES (p_claim_id, p_amount, p_reference, p_mode, p_admin_id)
    RETURNING payout_id INTO new_payout;

    RETURN new_payout;
END $$;

CREATE OR REPLACE FUNCTION fn_reject_claim(p_claim_id BIGINT, p_admin_id BIGINT, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A rejection needs a reason of at least 5 characters';
    END IF;
    UPDATE insurance_claims
       SET status = 'REJECTED', decided_by = p_admin_id, decision_reason = p_reason
     WHERE claim_id = p_claim_id AND status = 'PENDING';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim % is not pending', p_claim_id;
    END IF;
END $$;

-- ---------------------------------------------------------------------
-- STORED FUNCTION: semantic disease search (pgvector, cosine distance <=>)
-- similarity = 1 - cosine distance. Optional crop filter.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_match_diseases(p_query VECTOR(384), p_crop TEXT DEFAULT NULL, p_k INT DEFAULT 5)
RETURNS TABLE (disease_id BIGINT, disease_name VARCHAR, affected_crop VARCHAR, pathogen_type VARCHAR,
               symptom_description TEXT, recommended_treatment TEXT, similarity NUMERIC)
LANGUAGE sql STABLE AS $$
    SELECT d.disease_id, d.disease_name, d.affected_crop, d.pathogen_type,
           d.symptom_description, d.recommended_treatment,
           ROUND((1 - (d.disease_vector <=> p_query))::numeric, 4) AS similarity
    FROM disease_knowledgebase d
    WHERE d.disease_vector IS NOT NULL
      AND (p_crop IS NULL OR lower(d.affected_crop) = lower(p_crop))
    ORDER BY d.disease_vector <=> p_query
    LIMIT LEAST(GREATEST(p_k, 1), 10);
$$;

-- ---------------------------------------------------------------------
-- Housekeeping: mark policies past their end date as EXPIRED
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_expire_policies() RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
    UPDATE insurance_policies SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND end_date < current_date;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n;
END $$;

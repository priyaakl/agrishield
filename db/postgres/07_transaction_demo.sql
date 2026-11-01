-- =====================================================================
-- AgriShield | 07_transaction_demo.sql
-- Shows that "approve claim" and "record payout" succeed or fail together.
-- Run in psql:  \i 07_transaction_demo.sql
-- =====================================================================

-- A. Successful transaction (explicit BEGIN/COMMIT, same as the API does)
BEGIN;
  SELECT set_config('app.current_user_id', '1', true);   -- actor for the audit trigger
  UPDATE insurance_claims SET status = 'APPROVED', decided_by = 1,
         decision_reason = 'Damage verified in field visit'
   WHERE claim_id = 2 AND status = 'PENDING';
  INSERT INTO payout_ledger (claim_id, amount_paid, payment_reference, payment_mode, recorded_by)
  VALUES (2, 30000, 'DBT-2026-000102', 'DBT', 1);
COMMIT;
SELECT claim_id, status FROM insurance_claims WHERE claim_id = 2;      -- APPROVED
SELECT * FROM payout_ledger WHERE claim_id = 2;                         -- 1 row

-- B. Failing transaction: payment reference already used -> whole thing rolls back
BEGIN;
  UPDATE insurance_claims SET status = 'APPROVED', decided_by = 1,
         decision_reason = 'Approved' WHERE claim_id = 4;
  INSERT INTO payout_ledger (claim_id, amount_paid, payment_reference, recorded_by)
  VALUES (4, 50000, 'DBT-2026-000101', 1);                             -- duplicate! ERROR
ROLLBACK;
SELECT claim_id, status FROM insurance_claims WHERE claim_id = 4;      -- still PENDING
SELECT COUNT(*) AS payouts_for_claim_4 FROM payout_ledger WHERE claim_id = 4;  -- 0

-- C. Same rule through the stored function (the function body is one atomic unit)
SELECT fn_approve_claim_and_pay(4, 1, 99999, 'DBT-2026-000104');       -- ERROR: payout > claim
SELECT claim_id, status FROM insurance_claims WHERE claim_id = 4;      -- still PENDING

-- D. SAVEPOINT: keep the good part of a batch, undo only the bad part
BEGIN;
  UPDATE insurance_policies SET premium_amount = premium_amount + 100 WHERE policy_id = 8;
  SAVEPOINT before_bad_update;
  UPDATE insurance_policies SET premium_amount = -5 WHERE policy_id = 3;   -- violates CHECK
  ROLLBACK TO SAVEPOINT before_bad_update;
COMMIT;
SELECT policy_id, premium_amount FROM insurance_policies WHERE policy_id IN (3, 8);

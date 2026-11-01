-- =====================================================================
-- AgriShield | 09_integrity_tests.sql
-- Each test tries something the database must refuse. Prints PASS/FAIL.
-- Everything runs inside a transaction that is rolled back at the end,
-- so the data is left untouched.
-- =====================================================================
BEGIN;

CREATE FUNCTION pg_temp.expect_fail(p_label TEXT, p_sql TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE p_sql;
    RETURN 'FAIL  ' || p_label || '  (statement was accepted)';
EXCEPTION WHEN OTHERS THEN
    RETURN 'PASS  ' || p_label || '  -> ' || SQLERRM;
END $$;

SELECT result FROM (VALUES
 (pg_temp.expect_fail('T01 parcel for unknown farmer',
   $q$INSERT INTO land_parcels (farmer_id, parcel_name, acres, soil_type) VALUES (999, 'X', 1, 'RED')$q$)),
 (pg_temp.expect_fail('T02 negative acres',
   $q$INSERT INTO land_parcels (farmer_id, parcel_name, acres, soil_type) VALUES (1, 'Neg', -2, 'RED')$q$)),
 (pg_temp.expect_fail('T03 latitude out of range',
   $q$INSERT INTO land_parcels (farmer_id, parcel_name, acres, soil_type, gps_latitude) VALUES (1, 'Lat', 1, 'RED', 123)$q$)),
 (pg_temp.expect_fail('T04 duplicate farmer phone',
   $q$INSERT INTO farmers (user_id, phone, location_district) VALUES (1, '9845012345', 'Mysuru')$q$)),
 (pg_temp.expect_fail('T05 invalid phone format',
   $q$INSERT INTO farmers (user_id, phone, location_district) VALUES (1, '12345', 'Mysuru')$q$)),
 (pg_temp.expect_fail('T06 plain-text password',
   $q$INSERT INTO users (full_name, email, password_hash, role) VALUES ('Eve', 'eve@x.com', 'secret', 'FARMER')$q$)),
 (pg_temp.expect_fail('T07 policy end before start',
   $q$INSERT INTO insurance_policies (parcel_id, crop_type, season, coverage_amount, premium_amount, start_date, end_date)
      VALUES (4, 'Mango', 'ZAID', 1000, 10, current_date, current_date - 1)$q$)),
 (pg_temp.expect_fail('T08 overlapping policy, same parcel+crop',
   $q$INSERT INTO insurance_policies (parcel_id, crop_type, season, coverage_amount, premium_amount, start_date, end_date)
      VALUES (1, 'Rice', 'KHARIF', 5000, 100, current_date, current_date + 10)$q$)),
 (pg_temp.expect_fail('T09 claim under unknown policy',
   $q$INSERT INTO insurance_claims (policy_id, report_id, claim_amount) VALUES (999, 6, 100)$q$)),
 (pg_temp.expect_fail('T10 claim under expired policy',
   $q$INSERT INTO insurance_claims (policy_id, report_id, claim_amount) VALUES (5, 4, 100)$q$)),
 (pg_temp.expect_fail('T11 claim under policy not started yet',
   $q$INSERT INTO insurance_claims (policy_id, report_id, claim_amount) VALUES (6, 6, 100)$q$)),
 (pg_temp.expect_fail('T12 claim with report from another parcel',
   $q$INSERT INTO insurance_claims (policy_id, report_id, claim_amount) VALUES (1, 5, 100)$q$)),
 (pg_temp.expect_fail('T13 claim larger than coverage',
   $q$INSERT INTO insurance_claims (policy_id, report_id, claim_amount) VALUES (2, 5, 999999)$q$)),
 (pg_temp.expect_fail('T14 second claim on the same report',
   $q$INSERT INTO insurance_claims (policy_id, report_id, claim_amount) VALUES (1, 1, 100)$q$)),
 (pg_temp.expect_fail('T15 payout on a PENDING claim',
   $q$INSERT INTO payout_ledger (claim_id, amount_paid, payment_reference, recorded_by) VALUES (4, 100, 'T15-REF', 1)$q$)),
 (pg_temp.expect_fail('T16 second payout for a claim',
   $q$INSERT INTO payout_ledger (claim_id, amount_paid, payment_reference, recorded_by) VALUES (1, 100, 'T16-REF', 1)$q$)),
 (pg_temp.expect_fail('T17 changing a decided claim',
   $q$UPDATE insurance_claims SET status = 'PENDING' WHERE claim_id = 1$q$)),
 (pg_temp.expect_fail('T18 reject without reason',
   $q$SELECT fn_reject_claim(4, 1, '')$q$)),
 (pg_temp.expect_fail('T19 delete parcel that has policies (FK RESTRICT)',
   $q$DELETE FROM land_parcels WHERE parcel_id = 1$q$)),
 (pg_temp.expect_fail('T20 report marked REVIEWED with no disease',
   $q$UPDATE disease_reports SET review_status = 'REVIEWED', reviewed_by = 2, reviewed_at = now() WHERE report_id = 6$q$)),
 (pg_temp.expect_fail('T21 duplicate disease for same crop',
   $q$INSERT INTO disease_knowledgebase (disease_name, affected_crop, pathogen_type, symptom_description, recommended_treatment)
      VALUES ('Rice blast', 'Rice', 'FUNGAL', 'duplicate entry used only for testing', 'none')$q$))
) AS t(result);

ROLLBACK;

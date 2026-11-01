-- =====================================================================
-- AgriShield | 04_views.sql   (dashboards read from these)
-- =====================================================================

-- One row per farmer: parcels, cover, claims and money paid.
-- Each aggregate is computed in its own sub-select so joins don't multiply rows.
CREATE OR REPLACE VIEW v_farmer_dashboard AS
SELECT f.farmer_id,
       u.full_name,
       f.location_district,
       (SELECT COUNT(*)           FROM land_parcels lp WHERE lp.farmer_id = f.farmer_id) AS parcel_count,
       (SELECT COALESCE(SUM(acres),0) FROM land_parcels lp WHERE lp.farmer_id = f.farmer_id) AS total_acres,
       (SELECT COUNT(*) FROM insurance_policies p JOIN land_parcels lp USING (parcel_id)
         WHERE lp.farmer_id = f.farmer_id AND p.status = 'ACTIVE')                         AS active_policies,
       (SELECT COALESCE(SUM(p.coverage_amount),0) FROM insurance_policies p JOIN land_parcels lp USING (parcel_id)
         WHERE lp.farmer_id = f.farmer_id AND p.status = 'ACTIVE')                         AS active_coverage,
       (SELECT COUNT(*) FROM disease_reports r JOIN land_parcels lp USING (parcel_id)
         WHERE lp.farmer_id = f.farmer_id)                                                 AS report_count,
       (SELECT COUNT(*) FILTER (WHERE c.status = 'PENDING')  FROM insurance_claims c
          JOIN insurance_policies p USING (policy_id) JOIN land_parcels lp USING (parcel_id)
         WHERE lp.farmer_id = f.farmer_id)                                                 AS pending_claims,
       (SELECT COUNT(*) FILTER (WHERE c.status = 'APPROVED') FROM insurance_claims c
          JOIN insurance_policies p USING (policy_id) JOIN land_parcels lp USING (parcel_id)
         WHERE lp.farmer_id = f.farmer_id)                                                 AS approved_claims,
       (SELECT COUNT(*) FILTER (WHERE c.status = 'REJECTED') FROM insurance_claims c
          JOIN insurance_policies p USING (policy_id) JOIN land_parcels lp USING (parcel_id)
         WHERE lp.farmer_id = f.farmer_id)                                                 AS rejected_claims,
       (SELECT COALESCE(SUM(pl.amount_paid),0) FROM payout_ledger pl
          JOIN insurance_claims c USING (claim_id) JOIN insurance_policies p USING (policy_id)
          JOIN land_parcels lp USING (parcel_id)
         WHERE lp.farmer_id = f.farmer_id)                                                 AS total_paid
FROM farmers f
JOIN users u ON u.user_id = f.user_id;

-- Everything about a claim in one row (used by admin and farmer claim pages)
CREATE OR REPLACE VIEW v_claim_details AS
SELECT c.claim_id, c.status, c.claim_amount, c.filed_at, c.decided_at, c.decision_reason,
       p.policy_id, p.crop_type, p.season, p.coverage_amount,
       fn_policy_remaining_cover(p.policy_id) AS remaining_cover,
       lp.parcel_id, lp.parcel_name, lp.acres,
       f.farmer_id, u.full_name AS farmer_name, f.location_district,
       r.report_id, r.symptom_text, r.affected_area_pct, r.review_status,
       d.disease_name AS confirmed_disease,
       pl.payout_id, pl.amount_paid, pl.payment_reference, pl.payout_date
FROM insurance_claims c
JOIN insurance_policies p  ON p.policy_id  = c.policy_id
JOIN land_parcels lp       ON lp.parcel_id = p.parcel_id
JOIN farmers f             ON f.farmer_id  = lp.farmer_id
JOIN users u               ON u.user_id    = f.user_id
JOIN disease_reports r     ON r.report_id  = c.report_id
LEFT JOIN disease_knowledgebase d ON d.disease_id = r.matched_disease_id
LEFT JOIN payout_ledger pl ON pl.claim_id  = c.claim_id;

-- Inspector-confirmed disease cases by district (outbreak watch)
CREATE OR REPLACE VIEW v_disease_hotspots AS
SELECT f.location_district, d.disease_name, d.affected_crop,
       COUNT(*)                     AS confirmed_reports,
       ROUND(AVG(r.affected_area_pct), 1) AS avg_area_affected_pct,
       MAX(r.reported_at)           AS last_reported
FROM disease_reports r
JOIN disease_knowledgebase d ON d.disease_id = r.matched_disease_id
JOIN land_parcels lp ON lp.parcel_id = r.parcel_id
JOIN farmers f       ON f.farmer_id  = lp.farmer_id
WHERE r.review_status = 'REVIEWED'
GROUP BY f.location_district, d.disease_name, d.affected_crop;

-- How much of each policy's cover has been used
CREATE OR REPLACE VIEW v_policy_utilisation AS
SELECT p.policy_id, p.crop_type, p.season, p.status, p.coverage_amount,
       COALESCE(SUM(pl.amount_paid), 0) AS paid_out,
       ROUND(100.0 * COALESCE(SUM(pl.amount_paid), 0) / p.coverage_amount, 1) AS utilisation_pct,
       COUNT(c.claim_id) AS claim_count
FROM insurance_policies p
LEFT JOIN insurance_claims c ON c.policy_id = p.policy_id
LEFT JOIN payout_ledger pl   ON pl.claim_id = c.claim_id
GROUP BY p.policy_id;

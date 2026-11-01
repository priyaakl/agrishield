-- =====================================================================
-- AgriShield | 06_queries.sql   Important queries for the report/demo
-- Note: Q15 changes data. Re-run `npm run db:setup` to get a clean demo state.
-- (each one is also used somewhere in the app)
-- =====================================================================

-- Q1  JOIN: claims with their policy, parcel and farmer
SELECT c.claim_id, u.full_name AS farmer, lp.parcel_name, p.crop_type,
       c.claim_amount, c.status, c.filed_at
FROM insurance_claims c
JOIN insurance_policies p ON p.policy_id = c.policy_id
JOIN land_parcels lp      ON lp.parcel_id = p.parcel_id
JOIN farmers f            ON f.farmer_id = lp.farmer_id
JOIN users u              ON u.user_id = f.user_id
ORDER BY c.filed_at DESC;

-- Q2  LEFT JOIN + GROUP BY: parcels per farmer (farmers with zero parcels still appear)
SELECT f.farmer_id, u.full_name, COUNT(lp.parcel_id) AS parcel_count, COALESCE(SUM(lp.acres),0) AS acres
FROM farmers f
JOIN users u ON u.user_id = f.user_id
LEFT JOIN land_parcels lp ON lp.farmer_id = f.farmer_id
GROUP BY f.farmer_id, u.full_name
ORDER BY acres DESC;

-- Q3  GROUP BY + HAVING: farmers with more than one parcel
SELECT f.farmer_id, u.full_name, COUNT(*) AS parcel_count
FROM farmers f
JOIN users u ON u.user_id = f.user_id
JOIN land_parcels lp ON lp.farmer_id = f.farmer_id
GROUP BY f.farmer_id, u.full_name
HAVING COUNT(*) > 1;

-- Q4  Aggregates by status: number of claims, amount claimed, amount paid
SELECT c.status, COUNT(*) AS claims, SUM(c.claim_amount) AS claimed,
       COALESCE(SUM(pl.amount_paid), 0) AS paid
FROM insurance_claims c
LEFT JOIN payout_ledger pl ON pl.claim_id = c.claim_id
GROUP BY c.status
ORDER BY claims DESC;

-- Q5  Subquery (NOT EXISTS): active policies that have never had a claim
SELECT p.policy_id, p.crop_type, p.coverage_amount
FROM insurance_policies p
WHERE p.status = 'ACTIVE'
  AND NOT EXISTS (SELECT 1 FROM insurance_claims c WHERE c.policy_id = p.policy_id);

-- Q6  Correlated subquery: claims larger than the average claim for the same crop
SELECT c.claim_id, p.crop_type, c.claim_amount
FROM insurance_claims c
JOIN insurance_policies p ON p.policy_id = c.policy_id
WHERE c.claim_amount > (SELECT AVG(c2.claim_amount)
                        FROM insurance_claims c2
                        JOIN insurance_policies p2 ON p2.policy_id = c2.policy_id
                        WHERE p2.crop_type = p.crop_type);

-- Q7  Subquery with IN: districts that have at least one pending claim
SELECT DISTINCT f.location_district
FROM farmers f
WHERE f.farmer_id IN (SELECT lp.farmer_id
                      FROM land_parcels lp
                      JOIN insurance_policies p ON p.parcel_id = lp.parcel_id
                      JOIN insurance_claims c  ON c.policy_id = p.policy_id
                      WHERE c.status = 'PENDING');

-- Q8  Window function: claims ranked by amount within each district
SELECT location_district, claim_id, claim_amount,
       RANK() OVER (PARTITION BY location_district ORDER BY claim_amount DESC) AS rank_in_district
FROM v_claim_details;

-- Q9  Eligible policies for a farmer (used by the "File a claim" form)
SELECT p.policy_id, p.crop_type, lp.parcel_name, fn_policy_remaining_cover(p.policy_id) AS remaining
FROM insurance_policies p
JOIN land_parcels lp ON lp.parcel_id = p.parcel_id
WHERE lp.farmer_id = 1 AND fn_policy_is_eligible(p.policy_id);

-- Q10 Admin queue: oldest pending claims first (uses idx_claims_status_filed)
SELECT claim_id, farmer_name, crop_type, claim_amount, filed_at
FROM v_claim_details WHERE status = 'PENDING' ORDER BY filed_at LIMIT 20;

-- Q11 Full-text search (keyword baseline) — ranks by ts_rank
SELECT disease_name, affected_crop,
       ts_rank(search_tsv, websearch_to_tsquery('english', 'yellow stripe rust')) AS rank
FROM disease_knowledgebase
WHERE search_tsv @@ websearch_to_tsquery('english', 'yellow stripe rust')
ORDER BY rank DESC;
-- Same idea, farmer's wording: 0 rows, because "leaves" and "leaf" don't share a stem
-- and keyword search needs every word. This gap is why we also use vector search.
SELECT disease_name FROM disease_knowledgebase
WHERE search_tsv @@ websearch_to_tsquery('english', 'yellow stripes leaves');

-- Q12 Vector similarity: diseases most similar to "Rice blast" (needs `npm run embed` first)
SELECT d2.disease_name, d2.affected_crop,
       ROUND((1 - (d2.disease_vector <=> d1.disease_vector))::numeric, 3) AS cosine_similarity
FROM disease_knowledgebase d1, disease_knowledgebase d2
WHERE d1.disease_id = 1 AND d2.disease_id <> 1 AND d2.disease_vector IS NOT NULL
ORDER BY d2.disease_vector <=> d1.disease_vector
LIMIT 5;

-- Q13 Vector similarity between reports: other farmers reporting similar symptoms (possible outbreak)
SELECT r2.report_id, lp.parcel_name, r2.crop_type,
       ROUND((1 - (r2.symptom_vector <=> r1.symptom_vector))::numeric, 3) AS similarity
FROM disease_reports r1
JOIN disease_reports r2 ON r2.report_id <> r1.report_id AND r2.symptom_vector IS NOT NULL
JOIN land_parcels lp ON lp.parcel_id = r2.parcel_id
WHERE r1.report_id = 5
ORDER BY r2.symptom_vector <=> r1.symptom_vector
LIMIT 3;

-- Q14 Views
SELECT * FROM v_farmer_dashboard;
SELECT * FROM v_disease_hotspots ORDER BY confirmed_reports DESC;
SELECT * FROM v_policy_utilisation ORDER BY utilisation_pct DESC;

-- Q15 DML examples
-- UPDATE: admin cancels a policy that never started
UPDATE insurance_policies SET status = 'CANCELLED' WHERE policy_id = 6 AND start_date > current_date;
-- DELETE: farmer removes a parcel that has no policies/reports (FK RESTRICT blocks the others)
INSERT INTO land_parcels (farmer_id, parcel_name, acres, soil_type) VALUES (3, 'Temp plot', 0.5, 'RED');
DELETE FROM land_parcels WHERE farmer_id = 3 AND parcel_name = 'Temp plot';
-- Housekeeping function
SELECT fn_expire_policies() AS policies_expired;

-- Q16 Index evidence: compare plans (run on a bigger dataset for a visible difference)
EXPLAIN ANALYZE SELECT * FROM insurance_claims WHERE status = 'PENDING' ORDER BY filed_at;
SET enable_seqscan = off;   -- force the planner to show the index path on tiny demo data
EXPLAIN SELECT * FROM land_parcels WHERE farmer_id = 2;
EXPLAIN SELECT disease_name FROM disease_knowledgebase
        WHERE search_tsv @@ to_tsquery('english', 'rust');
RESET enable_seqscan;

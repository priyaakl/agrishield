import { handler, ok, parse, requireRole, HttpError } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { claimSchema } from '@/lib/validators';

export const GET = handler(async (req) => {
  const s = await requireRole('FARMER', 'ADMIN', 'INSPECTOR');
  const status = new URL(req.url).searchParams.get('status');
  const { rows } = await query(
    `SELECT * FROM v_claim_details
     WHERE ($1::bigint IS NULL OR farmer_id = $1)
       AND ($2::text IS NULL OR status = $2)
     ORDER BY CASE status WHEN 'PENDING' THEN 0 ELSE 1 END, filed_at`,
    [s.role === 'FARMER' ? s.fid : null, status || null]
  );
  return ok({ claims: rows });
});

// Farmer files a claim. Ownership is checked here; eligibility, crop match,
// policy period and remaining cover are enforced by the claim_validate trigger.
export const POST = handler(async (req) => {
  const s = await requireRole('FARMER');
  const b = parse(claimSchema, await req.json());
  const own = await query(
    `SELECT 1 FROM insurance_policies p JOIN land_parcels lp USING (parcel_id)
     WHERE p.policy_id = $1 AND lp.farmer_id = $2`, [b.policy_id, s.fid]);
  const ownReport = await query(
    `SELECT 1 FROM disease_reports r JOIN land_parcels lp USING (parcel_id)
     WHERE r.report_id = $1 AND lp.farmer_id = $2`, [b.report_id, s.fid]);
  if (!own.rowCount || !ownReport.rowCount) throw new HttpError(404, 'Policy or report not found');

  const claim = await withTransaction(s.uid, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO insurance_claims (policy_id, report_id, claim_amount) VALUES ($1, $2, $3)
       RETURNING claim_id, status, claim_amount, filed_at`,
      [b.policy_id, b.report_id, b.claim_amount]
    );
    return rows[0];
  });
  return ok({ claim }, 201);
});

import { handler, ok, requireRole } from '@/lib/api';
import { query } from '@/lib/db';

export const GET = handler(async () => {
  const s = await requireRole('FARMER');
  const [summary, claims, reports] = await Promise.all([
    query('SELECT * FROM v_farmer_dashboard WHERE farmer_id = $1', [s.fid]),
    query(`SELECT claim_id, crop_type, parcel_name, claim_amount, status, filed_at, amount_paid
           FROM v_claim_details WHERE farmer_id = $1 ORDER BY filed_at DESC LIMIT 5`, [s.fid]),
    query(`SELECT r.report_id, r.crop_type, r.review_status, r.reported_at, lp.parcel_name
           FROM disease_reports r JOIN land_parcels lp USING (parcel_id)
           WHERE lp.farmer_id = $1 ORDER BY r.reported_at DESC LIMIT 5`, [s.fid]),
  ]);
  return ok({ summary: summary.rows[0] || null, claims: claims.rows, reports: reports.rows });
});

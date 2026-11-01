import { handler, ok, requireRole } from '@/lib/api';
import { query } from '@/lib/db';
import { telemetryCollection } from '@/lib/mongo';
import { riskSignalsPipeline, sourceBreakdownPipeline } from '@/lib/telemetryPipelines.mjs';

export const GET = handler(async () => {
  await requireRole('ADMIN');
  const [byStatus, byCrop, monthly, hotspots, utilisation, parcels] = await Promise.all([
    query(`SELECT c.status, COUNT(*)::int AS claims, SUM(c.claim_amount) AS claimed,
                  COALESCE(SUM(pl.amount_paid), 0) AS paid
           FROM insurance_claims c LEFT JOIN payout_ledger pl USING (claim_id)
           GROUP BY c.status ORDER BY claims DESC`),
    query(`SELECT p.crop_type, COUNT(c.claim_id)::int AS claims, COALESCE(SUM(c.claim_amount), 0) AS claimed
           FROM insurance_policies p LEFT JOIN insurance_claims c USING (policy_id)
           GROUP BY p.crop_type HAVING COUNT(c.claim_id) > 0 ORDER BY claimed DESC`),
    query(`SELECT to_char(date_trunc('month', payout_date), 'Mon YYYY') AS month,
                  COUNT(*)::int AS payouts, SUM(amount_paid) AS total
           FROM payout_ledger GROUP BY date_trunc('month', payout_date) ORDER BY date_trunc('month', payout_date)`),
    query('SELECT * FROM v_disease_hotspots ORDER BY confirmed_reports DESC, last_reported DESC LIMIT 10'),
    query('SELECT * FROM v_policy_utilisation WHERE claim_count > 0 ORDER BY utilisation_pct DESC LIMIT 10'),
    query(`SELECT lp.parcel_id, lp.parcel_name, u.full_name AS farmer_name
           FROM land_parcels lp JOIN farmers f USING (farmer_id) JOIN users u ON u.user_id = f.user_id`),
  ]);

  // Telemetry is optional: analytics still work if MongoDB is down.
  let telemetry = { risk: [], sources: [], error: null };
  try {
    const col = await telemetryCollection();
    const ids = parcels.rows.map((p) => p.parcel_id);
    const names = Object.fromEntries(parcels.rows.map((p) => [p.parcel_id, p]));
    const [risk, sources] = await Promise.all([
      col.aggregate(riskSignalsPipeline(ids, 14)).toArray(),
      col.aggregate(sourceBreakdownPipeline()).toArray(),
    ]);
    telemetry = { risk: risk.map((r) => ({ ...r, ...names[r.parcel_id] })), sources, error: null };
  } catch (e) {
    telemetry.error = 'Telemetry database unavailable';
  }

  return ok({
    byStatus: byStatus.rows, byCrop: byCrop.rows, monthly: monthly.rows,
    hotspots: hotspots.rows, utilisation: utilisation.rows, telemetry,
  });
});

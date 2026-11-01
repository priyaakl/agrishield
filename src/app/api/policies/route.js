import { handler, ok, parse, requireRole } from '@/lib/api';
import { query } from '@/lib/db';
import { policySchema } from '@/lib/validators';

// ?eligible=1 -> only policies a claim can be filed under today (uses fn_policy_is_eligible)
export const GET = handler(async (req) => {
  const s = await requireRole('FARMER', 'INSPECTOR', 'ADMIN');
  const eligibleOnly = new URL(req.url).searchParams.get('eligible') === '1';
  const { rows } = await query(
    `SELECT p.*, lp.parcel_name, u.full_name AS farmer_name,
            fn_policy_is_eligible(p.policy_id) AS eligible,
            fn_policy_remaining_cover(p.policy_id) AS remaining_cover
     FROM insurance_policies p
     JOIN land_parcels lp ON lp.parcel_id = p.parcel_id
     JOIN farmers f ON f.farmer_id = lp.farmer_id
     JOIN users u ON u.user_id = f.user_id
     WHERE ($1::bigint IS NULL OR lp.farmer_id = $1)
       AND (NOT $2 OR fn_policy_is_eligible(p.policy_id))
     ORDER BY p.status, p.end_date DESC`,
    [s.role === 'FARMER' ? s.fid : null, eligibleOnly]
  );
  return ok({ policies: rows });
});

export const POST = handler(async (req) => {
  await requireRole('ADMIN');
  const p = parse(policySchema, await req.json());
  const { rows } = await query(
    `INSERT INTO insurance_policies (parcel_id, crop_type, season, coverage_amount, premium_amount, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [p.parcel_id, p.crop_type, p.season, p.coverage_amount, p.premium_amount, p.start_date, p.end_date]
  );
  return ok({ policy: rows[0] }, 201);
});

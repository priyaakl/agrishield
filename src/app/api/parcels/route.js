import { handler, ok, parse, requireRole } from '@/lib/api';
import { query } from '@/lib/db';
import { parcelSchema } from '@/lib/validators';

// Farmers see their own parcels; inspectors/admins see all.
export const GET = handler(async () => {
  const s = await requireRole('FARMER', 'INSPECTOR', 'ADMIN');
  const own = s.role === 'FARMER';
  const { rows } = await query(
    `SELECT lp.*, u.full_name AS farmer_name, f.location_district,
            (SELECT COUNT(*) FROM insurance_policies p WHERE p.parcel_id = lp.parcel_id)::int AS policy_count,
            (SELECT COUNT(*) FROM disease_reports r WHERE r.parcel_id = lp.parcel_id)::int AS report_count
     FROM land_parcels lp
     JOIN farmers f ON f.farmer_id = lp.farmer_id
     JOIN users u   ON u.user_id = f.user_id
     WHERE ($1::bigint IS NULL OR lp.farmer_id = $1)
     ORDER BY lp.parcel_id`,
    [own ? s.fid : null]
  );
  return ok({ parcels: rows });
});

export const POST = handler(async (req) => {
  const s = await requireRole('FARMER');
  const p = parse(parcelSchema, await req.json());
  const { rows } = await query(
    `INSERT INTO land_parcels (farmer_id, parcel_name, survey_number, acres, soil_type, gps_latitude, gps_longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [s.fid, p.parcel_name, p.survey_number || null, p.acres, p.soil_type, p.gps_latitude ?? null, p.gps_longitude ?? null]
  );
  return ok({ parcel: rows[0] }, 201);
});

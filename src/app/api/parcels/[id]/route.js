import { handler, ok, requireRole, idParam, HttpError } from '@/lib/api';
import { query } from '@/lib/db';

// DELETE: only the owner, and the FK (ON DELETE RESTRICT) blocks parcels that have policies/reports.
export const DELETE = handler(async (req, ctx) => {
  const s = await requireRole('FARMER');
  const id = await idParam(ctx);
  const { rowCount } = await query('DELETE FROM land_parcels WHERE parcel_id = $1 AND farmer_id = $2', [id, s.fid]);
  if (!rowCount) throw new HttpError(404, 'Parcel not found');
  return ok({ deleted: id });
});

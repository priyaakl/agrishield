import { handler, ok, requireRole, idParam, HttpError } from '@/lib/api';
import { query } from '@/lib/db';

// Audit trail written by the claim_history trigger (weak entity CLAIM_STATUS_HISTORY)
export const GET = handler(async (req, ctx) => {
  const s = await requireRole('FARMER', 'ADMIN', 'INSPECTOR');
  const id = await idParam(ctx);
  if (s.role === 'FARMER') {
    const own = await query('SELECT 1 FROM v_claim_details WHERE claim_id = $1 AND farmer_id = $2', [id, s.fid]);
    if (!own.rowCount) throw new HttpError(404, 'Claim not found');
  }
  const { rows } = await query(
    `SELECT h.seq_no, h.old_status, h.new_status, h.note, h.changed_at, u.full_name AS changed_by
     FROM claim_status_history h LEFT JOIN users u ON u.user_id = h.changed_by
     WHERE h.claim_id = $1 ORDER BY h.seq_no`, [id]);
  return ok({ history: rows });
});

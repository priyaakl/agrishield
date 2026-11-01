import { handler, ok, requireRole, idParam, HttpError } from '@/lib/api';
import { query } from '@/lib/db';

// Admin cancels a policy (UPDATE). Policies with pending claims can't be cancelled.
export const PATCH = handler(async (req, ctx) => {
  await requireRole('ADMIN');
  const id = await idParam(ctx);
  const { rows } = await query(
    `UPDATE insurance_policies SET status = 'CANCELLED'
     WHERE policy_id = $1 AND status = 'ACTIVE'
       AND NOT EXISTS (SELECT 1 FROM insurance_claims c WHERE c.policy_id = $1 AND c.status = 'PENDING')
     RETURNING *`,
    [id]
  );
  if (!rows.length) throw new HttpError(400, 'Only active policies without pending claims can be cancelled');
  return ok({ policy: rows[0] });
});

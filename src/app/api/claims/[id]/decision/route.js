import { handler, ok, parse, requireRole, idParam } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { decisionSchema } from '@/lib/validators';

// Approve = update claim + insert payout in ONE transaction (fn_approve_claim_and_pay).
// If the payout fails (duplicate reference, amount above claim...) the approval is rolled back.
export const PATCH = handler(async (req, ctx) => {
  const s = await requireRole('ADMIN');
  const id = await idParam(ctx);
  const b = parse(decisionSchema, await req.json());

  if (b.action === 'approve') {
    const payoutId = await withTransaction(s.uid, async (c) => {
      const { rows } = await c.query(
        'SELECT fn_approve_claim_and_pay($1, $2, $3, $4, $5, $6) AS payout_id',
        [id, s.uid, b.amount_paid, b.payment_reference, b.payment_mode, b.note || 'Approved after review']
      );
      return rows[0].payout_id;
    });
    return ok({ claim_id: id, status: 'APPROVED', payout_id: payoutId });
  }

  await withTransaction(s.uid, (c) => c.query('SELECT fn_reject_claim($1, $2, $3)', [id, s.uid, b.reason]));
  return ok({ claim_id: id, status: 'REJECTED' });
});

import { handler, ok, requireRole } from '@/lib/api';

export const GET = handler(async () => {
  const s = await requireRole();
  return ok({ user: { id: s.uid, name: s.name, role: s.role, farmer_id: s.fid } });
});

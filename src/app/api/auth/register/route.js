import bcrypt from 'bcryptjs';
import { handler, ok, parse } from '@/lib/api';
import { withTransaction } from '@/lib/db';
import { registerSchema } from '@/lib/validators';
import { signSession, SESSION_COOKIE, cookieOptions } from '@/lib/session';

// Self-registration is for farmers only. Inspector/admin accounts are created by an admin (seed).
export const POST = handler(async (req) => {
  const b = parse(registerSchema, await req.json());
  const hash = await bcrypt.hash(b.password, 12);

  // users + farmers rows must both exist or neither -> one transaction
  const user = await withTransaction(null, async (c) => {
    const u = await c.query(
      `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'FARMER')
       RETURNING user_id, full_name, role`,
      [b.full_name, b.email, hash]
    );
    const f = await c.query(
      'INSERT INTO farmers (user_id, phone, location_district) VALUES ($1, $2, $3) RETURNING farmer_id',
      [u.rows[0].user_id, b.phone, b.location_district]
    );
    return { ...u.rows[0], farmer_id: f.rows[0].farmer_id };
  });

  const token = await signSession({ uid: user.user_id, role: user.role, fid: user.farmer_id, name: user.full_name });
  const res = ok({ user: { name: user.full_name, role: user.role } }, 201);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return res;
});

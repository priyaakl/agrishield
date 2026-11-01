import bcrypt from 'bcryptjs';
import { handler, ok, parse, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { loginSchema } from '@/lib/validators';
import { signSession, SESSION_COOKIE, cookieOptions } from '@/lib/session';

export const POST = handler(async (req) => {
  const { email, password } = parse(loginSchema, await req.json());
  const { rows } = await query(
    `SELECT u.user_id, u.full_name, u.role, u.password_hash, u.is_active, f.farmer_id
     FROM users u LEFT JOIN farmers f ON f.user_id = u.user_id WHERE u.email = $1`,
    [email]
  );
  const u = rows[0];
  // same message for "no such user" and "wrong password" so emails can't be probed
  if (!u || !u.is_active || !(await bcrypt.compare(password, u.password_hash))) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  const token = await signSession({ uid: u.user_id, role: u.role, fid: u.farmer_id, name: u.full_name });
  const res = ok({ user: { name: u.full_name, role: u.role } });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions);
  return res;
});

// Small helpers so every route handler validates input, checks the role,
// and turns database errors into clear messages.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from './session';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const ok = (data, status = 200) => NextResponse.json(data, { status });

export async function getSession() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function requireRole(...roles) {
  const s = await getSession();
  if (!s) throw new HttpError(401, 'Please log in first');
  if (roles.length && !roles.includes(s.role)) throw new HttpError(403, 'You do not have access to this');
  return s;
}

export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, `${first.path.join('.') || 'input'}: ${first.message}`);
  }
  return r.data;
}

// Map PostgreSQL error codes to HTTP responses
function fromPg(err) {
  switch (err.code) {
    case '23505': return [409, `Already exists: ${err.detail || err.constraint}`];
    case '23503': return [400, 'Linked record not found or still in use'];
    case '23514': return [400, `Value not allowed (${err.constraint})`];
    case '23P01': return [409, 'This overlaps an existing policy for the same parcel and crop'];
    case '22P02': return [400, 'Invalid value format'];
    case 'P0001': return [400, err.message]; // RAISE EXCEPTION from our triggers/functions
    default: return null;
  }
}

export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return ok({ error: err.message }, err.status);
      const mapped = err?.code && fromPg(err);
      if (mapped) return ok({ error: mapped[1] }, mapped[0]);
      console.error(err);
      return ok({ error: 'Something went wrong on the server' }, 500);
    }
  };
}

export const idParam = async (ctx) => {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid id');
  return n;
};

import pg from 'pg';

// BIGINT ids and NUMERIC amounts arrive as strings by default; convert for the UI.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => parseFloat(v));
// DATE stays a plain 'YYYY-MM-DD' string so no timezone shift moves it by a day
pg.types.setTypeParser(1082, (v) => v);

// One pool per server process (re-used across hot reloads in dev)
function makePool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
}
function pool() {
  if (!globalThis.__agrishieldPg) globalThis.__agrishieldPg = makePool();
  return globalThis.__agrishieldPg;
}

// Always parameterised ($1, $2...) - never string-concatenate user input into SQL
export async function query(text, params = []) {
  return pool().query(text, params);
}

// Runs fn(client) inside BEGIN/COMMIT; any error => ROLLBACK.
// Also tells the database who is acting (used by the audit trigger).
export async function withTransaction(userId, fn) {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    if (userId) await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(userId)]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

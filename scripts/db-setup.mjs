// Creates the PostgreSQL schema and sample data by running the SQL files in order.
//   npm run db:setup      -> 01..05 (fresh database, wipes existing tables)
//   npm run db:test       -> 09 integrity tests only (read-only, rolled back)
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { need } from './env.mjs';

const dir = path.resolve('db/postgres');
const testsOnly = process.argv.includes('--tests-only');
const files = testsOnly
  ? ['09_integrity_tests.sql']
  : ['01_schema.sql', '02_functions_triggers.sql', '03_indexes.sql', '04_views.sql', '05_seed.sql'];

const client = new pg.Client({ connectionString: need('DATABASE_URL') });
await client.connect();
try {
  for (const f of files) {
    process.stdout.write(`Running ${f} ... `);
    const res = await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    console.log('done');
    if (testsOnly) {
      const results = (Array.isArray(res) ? res : [res]).flatMap((r) => r.rows || []).filter((r) => r.result);
      results.forEach((r) => console.log(r.result));
      const failed = results.filter((r) => r.result.startsWith('FAIL')).length;
      console.log(`\n${results.length - failed}/${results.length} integrity tests passed`);
      if (failed) process.exitCode = 1;
    }
  }
  if (!testsOnly) console.log('\nPostgreSQL ready. Next: npm run mongo:setup && npm run embed');
} catch (e) {
  console.error('\nFAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

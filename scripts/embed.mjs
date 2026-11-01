// Fills every missing embedding (diseases + reports) and stores top-5 matches for
// reports that have none yet. Safe to run again any time.
import pg from 'pg';
import { need } from './env.mjs';
import { embed, toPgVector, diseaseText, reportText, EMBED_MODEL } from '../src/lib/embed.mjs';
import { matchAndStore } from '../src/lib/matching.mjs';

const client = new pg.Client({ connectionString: need('DATABASE_URL') });
await client.connect();
try {
  console.log(`Loading ${EMBED_MODEL} (first run downloads ~25 MB)...`);

  const { rows: diseases } = await client.query(
    'SELECT disease_id, disease_name, affected_crop, symptom_description FROM disease_knowledgebase WHERE disease_vector IS NULL'
  );
  for (const d of diseases) {
    const v = await embed(diseaseText(d));
    await client.query(
      'UPDATE disease_knowledgebase SET disease_vector = $1::vector, embedding_model = $2 WHERE disease_id = $3',
      [toPgVector(v), EMBED_MODEL, d.disease_id]
    );
  }
  console.log(`Embedded ${diseases.length} disease records`);

  const { rows: reports } = await client.query(
    'SELECT report_id, crop_type, symptom_text FROM disease_reports WHERE symptom_vector IS NULL'
  );
  for (const r of reports) {
    const v = await embed(reportText(r));
    await client.query('UPDATE disease_reports SET symptom_vector = $1::vector WHERE report_id = $2', [toPgVector(v), r.report_id]);
  }
  console.log(`Embedded ${reports.length} symptom reports`);

  const { rows: unmatched } = await client.query(
    `SELECT r.report_id, r.crop_type, r.symptom_vector::text AS vec FROM disease_reports r
     WHERE r.symptom_vector IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM disease_match_history m WHERE m.report_id = r.report_id)`
  );
  for (const r of unmatched) {
    const { matches } = await matchAndStore(client, r.report_id, r.vec, r.crop_type);
    console.log(`  report ${r.report_id}: top match ${matches[0]?.disease_name} (${matches[0]?.similarity})`);
  }
  console.log('Vector setup complete.');
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

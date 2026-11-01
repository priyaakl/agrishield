import { handler, ok, parse, requireRole } from '@/lib/api';
import { query } from '@/lib/db';
import { searchSchema } from '@/lib/validators';
import { embed, toPgVector, EMBED_MODEL } from '@/lib/embed.mjs';

// Runs the same question two ways so users (and examiners) can compare:
// semantic (pgvector cosine) vs keyword (PostgreSQL full-text search).
export const POST = handler(async (req) => {
  await requireRole('FARMER', 'INSPECTOR', 'ADMIN');
  const { query: text, crop, k } = parse(searchSchema, await req.json());
  const cropFilter = crop || null;

  const t0 = performance.now();
  const vec = toPgVector(await embed(cropFilter ? `Crop: ${cropFilter}. ${text}` : text));
  const t1 = performance.now();
  const semantic = await query('SELECT * FROM fn_match_diseases($1::vector, $2, $3)', [vec, cropFilter, k]);
  const t2 = performance.now();
  const keyword = await query(
    `SELECT disease_id, disease_name, affected_crop, pathogen_type,
            ROUND(ts_rank(search_tsv, websearch_to_tsquery('english', $1))::numeric, 4) AS rank
     FROM disease_knowledgebase
     WHERE search_tsv @@ websearch_to_tsquery('english', $1)
       AND ($2::text IS NULL OR lower(affected_crop) = lower($2))
     ORDER BY rank DESC LIMIT $3`,
    [text, cropFilter, k]
  );
  return ok({
    model: EMBED_MODEL, metric: 'cosine similarity (1 - cosine distance)',
    timings_ms: { embed: Math.round(t1 - t0), vector_query: Math.round(t2 - t1) },
    semantic: semantic.rows, keyword: keyword.rows,
  });
});

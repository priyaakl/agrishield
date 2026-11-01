// Runs the pgvector search for a report and stores the top matches in
// DISEASE_MATCH_HISTORY (with score + model), so results are auditable later.
import { EMBED_MODEL } from './embed.mjs';

export async function matchAndStore(client, reportId, vectorLiteral, crop, k = 5) {
  // Search within the reported crop; if the catalogue has nothing for that crop, search all crops.
  const { rows: cnt } = await client.query(
    'SELECT COUNT(*)::int AS n FROM disease_knowledgebase WHERE lower(affected_crop) = lower($1) AND disease_vector IS NOT NULL',
    [crop]
  );
  const cropFilter = cnt[0].n > 0 ? crop : null;

  const { rows } = await client.query(
    'SELECT * FROM fn_match_diseases($1::vector, $2, $3)',
    [vectorLiteral, cropFilter, k]
  );
  for (let i = 0; i < rows.length; i++) {
    await client.query(
      `INSERT INTO disease_match_history (report_id, disease_id, match_rank, similarity_score, model_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (report_id, disease_id) DO UPDATE
         SET match_rank = EXCLUDED.match_rank, similarity_score = EXCLUDED.similarity_score,
             model_version = EXCLUDED.model_version, matched_at = now()`,
      [reportId, rows[i].disease_id, i + 1, rows[i].similarity, EMBED_MODEL]
    );
  }
  return { matches: rows, searchedAllCrops: cropFilter === null };
}

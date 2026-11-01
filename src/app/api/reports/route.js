import { handler, ok, parse, requireRole, HttpError } from '@/lib/api';
import { query, withTransaction } from '@/lib/db';
import { reportSchema } from '@/lib/validators';
import { embed, toPgVector, reportText } from '@/lib/embed.mjs';
import { matchAndStore } from '@/lib/matching.mjs';

export const GET = handler(async (req) => {
  const s = await requireRole('FARMER', 'INSPECTOR', 'ADMIN');
  const status = new URL(req.url).searchParams.get('status');
  const { rows } = await query(
    `SELECT r.report_id, r.parcel_id, r.crop_type, r.symptom_text, r.affected_area_pct, r.review_status,
            r.reported_at, r.reviewed_at, r.inspector_notes,
            lp.parcel_name, u.full_name AS farmer_name, f.location_district,
            d.disease_name AS confirmed_disease,
            (SELECT k.disease_name || ' (' || m.similarity_score || ')'
               FROM disease_match_history m JOIN disease_knowledgebase k USING (disease_id)
              WHERE m.report_id = r.report_id AND m.match_rank = 1) AS top_suggestion,
            EXISTS (SELECT 1 FROM insurance_claims c WHERE c.report_id = r.report_id) AS has_claim
     FROM disease_reports r
     JOIN land_parcels lp ON lp.parcel_id = r.parcel_id
     JOIN farmers f ON f.farmer_id = lp.farmer_id
     JOIN users u ON u.user_id = f.user_id
     LEFT JOIN disease_knowledgebase d ON d.disease_id = r.matched_disease_id
     WHERE ($1::bigint IS NULL OR lp.farmer_id = $1)
       AND ($2::text IS NULL OR r.review_status = $2)
     ORDER BY r.reported_at DESC`,
    [s.role === 'FARMER' ? s.fid : null, status || null]
  );
  return ok({ reports: rows });
});

// Farmer reports symptoms -> text is embedded -> pgvector finds similar diseases
// -> report, vector and top matches are saved in one transaction.
export const POST = handler(async (req) => {
  const s = await requireRole('FARMER');
  const b = parse(reportSchema, await req.json());

  const own = await query('SELECT 1 FROM land_parcels WHERE parcel_id = $1 AND farmer_id = $2', [b.parcel_id, s.fid]);
  if (!own.rowCount) throw new HttpError(404, 'Parcel not found');

  const vec = toPgVector(await embed(reportText(b)));   // done before the transaction (it's slow)

  const result = await withTransaction(s.uid, async (c) => {
    const { rows } = await c.query(
      `INSERT INTO disease_reports (parcel_id, reported_by, crop_type, symptom_text, affected_area_pct, symptom_vector)
       VALUES ($1, $2, $3, $4, $5, $6::vector)
       RETURNING report_id, parcel_id, crop_type, symptom_text, affected_area_pct, review_status, reported_at`,
      [b.parcel_id, s.uid, b.crop_type, b.symptom_text, b.affected_area_pct, vec]
    );
    const m = await matchAndStore(c, rows[0].report_id, vec, b.crop_type);
    return { report: rows[0], ...m };
  });
  return ok(result, 201);
});

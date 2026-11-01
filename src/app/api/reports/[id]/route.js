import { handler, ok, parse, requireRole, idParam, HttpError } from '@/lib/api';
import { query } from '@/lib/db';
import { reviewSchema } from '@/lib/validators';

export const GET = handler(async (req, ctx) => {
  const s = await requireRole('FARMER', 'INSPECTOR', 'ADMIN');
  const id = await idParam(ctx);
  const { rows } = await query(
    `SELECT r.report_id, r.crop_type, r.symptom_text, r.affected_area_pct, r.review_status, r.reported_at,
            r.inspector_notes, r.matched_disease_id, lp.parcel_name, lp.farmer_id, f.location_district
     FROM disease_reports r JOIN land_parcels lp USING (parcel_id) JOIN farmers f USING (farmer_id)
     WHERE r.report_id = $1`, [id]);
  const report = rows[0];
  if (!report || (s.role === 'FARMER' && report.farmer_id !== Number(s.fid))) throw new HttpError(404, 'Report not found');

  const matches = await query(
    `SELECT m.match_rank, m.similarity_score, m.model_version, d.disease_id, d.disease_name, d.affected_crop,
            d.pathogen_type, d.symptom_description, d.recommended_treatment
     FROM disease_match_history m JOIN disease_knowledgebase d USING (disease_id)
     WHERE m.report_id = $1 ORDER BY m.match_rank`, [id]);

  // Inspectors also see other reports with similar symptoms (possible spread between farms)
  let similar = [];
  if (s.role !== 'FARMER') {
    similar = (await query(
      `SELECT r2.report_id, r2.crop_type, f.location_district, r2.reported_at,
              ROUND((1 - (r2.symptom_vector <=> r1.symptom_vector))::numeric, 3) AS similarity
       FROM disease_reports r1
       JOIN disease_reports r2 ON r2.report_id <> r1.report_id AND r2.symptom_vector IS NOT NULL
       JOIN land_parcels lp ON lp.parcel_id = r2.parcel_id JOIN farmers f ON f.farmer_id = lp.farmer_id
       WHERE r1.report_id = $1 AND r1.symptom_vector IS NOT NULL
       ORDER BY r2.symptom_vector <=> r1.symptom_vector LIMIT 3`, [id])).rows;
  }
  return ok({ report, matches: matches.rows, similar });
});

// Inspector review: confirm a disease (REVIEWED) or dismiss the report.
export const PATCH = handler(async (req, ctx) => {
  const s = await requireRole('INSPECTOR', 'ADMIN');
  const id = await idParam(ctx);
  const b = parse(reviewSchema, await req.json());
  if (b.review_status === 'REVIEWED' && !b.matched_disease_id) throw new HttpError(400, 'Pick the confirmed disease');
  const { rows } = await query(
    `UPDATE disease_reports
        SET review_status = $2, matched_disease_id = $3, inspector_notes = $4,
            reviewed_by = $5, reviewed_at = now()
      WHERE report_id = $1 AND review_status = 'SUBMITTED'
      RETURNING report_id, review_status`,
    [id, b.review_status, b.review_status === 'REVIEWED' ? b.matched_disease_id : null, b.inspector_notes || null, s.uid]
  );
  if (!rows.length) throw new HttpError(400, 'Report not found or already reviewed');
  return ok({ report: rows[0] });
});

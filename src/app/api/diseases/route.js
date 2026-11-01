import { handler, ok, parse, requireRole } from '@/lib/api';
import { query } from '@/lib/db';
import { diseaseSchema } from '@/lib/validators';
import { embed, toPgVector, diseaseText, EMBED_MODEL } from '@/lib/embed.mjs';

export const GET = handler(async () => {
  await requireRole('FARMER', 'INSPECTOR', 'ADMIN');
  const { rows } = await query(
    `SELECT disease_id, disease_name, affected_crop, pathogen_type, symptom_description,
            recommended_treatment, source_reference, (disease_vector IS NOT NULL) AS embedded
     FROM disease_knowledgebase ORDER BY affected_crop, disease_name`
  );
  return ok({ diseases: rows });
});

// Inspectors/admins curate the knowledge base; new entries are embedded immediately.
export const POST = handler(async (req) => {
  const s = await requireRole('INSPECTOR', 'ADMIN');
  const d = parse(diseaseSchema, await req.json());
  const vec = toPgVector(await embed(diseaseText(d)));
  const { rows } = await query(
    `INSERT INTO disease_knowledgebase
       (disease_name, affected_crop, pathogen_type, symptom_description, recommended_treatment,
        source_reference, disease_vector, embedding_model, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9)
     RETURNING disease_id, disease_name, affected_crop`,
    [d.disease_name, d.affected_crop, d.pathogen_type, d.symptom_description, d.recommended_treatment,
     d.source_reference || null, vec, EMBED_MODEL, s.uid]
  );
  return ok({ disease: rows[0] }, 201);
});

// Text -> 384-number vector, computed locally with all-MiniLM-L6-v2 (no API key needed).
// The model (~25 MB) downloads from Hugging Face on first use and is cached.
export const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBED_DIM = 384;

let extractorPromise = null;

export async function embed(text) {
  if (!extractorPromise) {
    extractorPromise = import('@xenova/transformers').then(({ pipeline }) =>
      pipeline('feature-extraction', EMBED_MODEL)
    );
  }
  const extractor = await extractorPromise;
  // mean pooling + L2 normalisation => cosine similarity behaves well
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  const vector = Array.from(output.data);
  if (vector.length !== EMBED_DIM) throw new Error(`Expected ${EMBED_DIM} dims, got ${vector.length}`);
  return vector;
}

// pgvector accepts the text form '[0.1,0.2,...]'
export const toPgVector = (arr) => `[${arr.join(',')}]`;

// What we embed for each kind of record (keep these identical everywhere)
export const diseaseText = (d) => `${d.disease_name}. Crop: ${d.affected_crop}. ${d.symptom_description}`;
export const reportText = (r) => `Crop: ${r.crop_type}. ${r.symptom_text}`;

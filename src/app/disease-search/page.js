'use client';
import { useState } from 'react';
import { api, formData, useSubmit, Msg } from '@/components/client';
import MatchList from '@/components/MatchList';

// The same question answered two ways: meaning-based (pgvector) and word-based (full-text search).
export default function DiseaseSearch() {
  const s = useSubmit();
  const [res, setRes] = useState(null);
  return (
    <>
      <h1>Disease library</h1>
      <p className="lede">Describe the symptoms in everyday words. Results are ranked by how close their
        description is to yours. Use them as a starting point and confirm with an inspector.</p>
      <section className="panel">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; s.run(async () => {
          setRes(await api('/api/disease-search', { method: 'POST', body: formData(f) }));
        }); }}>
          <label>Symptoms<textarea name="query" required minLength={5}
            placeholder="e.g. yellow powder in lines on the leaves, comes off on my fingers" /></label>
          <div className="row">
            <label>Crop (optional)<input name="crop" placeholder="Leave empty to search all crops" /></label>
            <label>Results<select name="k" defaultValue="5"><option>3</option><option>5</option><option>10</option></select></label>
          </div>
          <Msg error={s.error} />
          <div><button disabled={s.busy}>{s.busy ? 'Searching…' : 'Search'}</button></div>
        </form>
      </section>
      {res && (
        <div className="split">
          <section className="panel">
            <h3>Similar in meaning</h3>
            <p className="note">{res.model}, {res.metric}. Embedding {res.timings_ms.embed} ms, database search {res.timings_ms.vector_query} ms.</p>
            <MatchList matches={res.semantic} />
          </section>
          <section className="panel">
            <h3>Same words (keyword search)</h3>
            <p className="note">PostgreSQL full-text search. Finds only entries that share your words.</p>
            {res.keyword.length === 0 ? <p className="empty">No entry uses these exact words. The meaning-based search above still works.</p> : (
              <table><tbody>{res.keyword.map((k) => (
                <tr key={k.disease_id}><td>{k.disease_name}<div className="note">{k.affected_crop}</div></td><td className="num note">rank {k.rank}</td></tr>))}
              </tbody></table>)}
          </section>
        </div>)}
    </>
  );
}

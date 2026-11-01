'use client';
// Shows vector-search results. Similarity is a retrieval score, not a probability.
export default function MatchList({ matches, scoreKey = 'similarity', onPick, picked }) {
  if (!matches?.length) return <p className="empty">No similar diseases found.</p>;
  return (
    <div>
      {matches.map((m) => {
        const score = Number(m[scoreKey]);
        return (
          <div className="match" key={m.disease_id}>
            <div className="match-head">
              <strong>{m.disease_name}</strong>
              <span className="note">{m.affected_crop}, {m.pathogen_type?.toLowerCase()}, similarity {score.toFixed(2)}</span>
            </div>
            <div className="bar" aria-hidden="true"><i style={{ width: `${Math.max(0, score) * 100}%` }} /></div>
            <p className="note" style={{ margin: 0 }}>{m.symptom_description}</p>
            <details><summary>What to do</summary><p className="note">{m.recommended_treatment}</p></details>
            {onPick && (
              <label style={{ display: 'flex', gap: '.4rem', alignItems: 'center', marginTop: '.4rem' }}>
                <input type="radio" name="pick" style={{ width: 'auto' }} checked={picked === m.disease_id}
                  onChange={() => onPick(m.disease_id)} /> Confirm this disease
              </label>)}
          </div>);
      })}
    </div>
  );
}

'use client';
import { useLoad, dayTime } from './client';

// Audit trail written by the database trigger
export default function History({ claimId }) {
  const { data } = useLoad(`/api/claims/${claimId}/history`);
  if (!data) return null;
  return (
    <ol className="timeline">
      {data.history.map((h) => (
        <li key={h.seq_no}><strong>{h.old_status ? `${h.old_status.toLowerCase()} to ${h.new_status.toLowerCase()}` : 'Filed'}</strong>
          <div className="note">{dayTime(h.changed_at)}{h.changed_by ? `, by ${h.changed_by}` : ''}</div>
          {h.note && h.old_status && <div className="note">{h.note}</div>}</li>))}
    </ol>
  );
}


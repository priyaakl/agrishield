'use client';
import { useState } from 'react';
import { api, useLoad, useSubmit, Msg, Stamp, day } from '@/components/client';
import MatchList from '@/components/MatchList';

export default function ReviewReports() {
  const [status, setStatus] = useState('SUBMITTED');
  const list = useLoad(`/api/reports${status ? `?status=${status}` : ''}`);
  const [open, setOpen] = useState(null);
  const detail = useLoad(open ? `/api/reports/${open}` : null);
  const [picked, setPicked] = useState(null);
  const [notes, setNotes] = useState('');
  const act = useSubmit();

  const decide = (review_status) => act.run(async () => {
    await api(`/api/reports/${open}`, { method: 'PATCH',
      body: { review_status, matched_disease_id: picked, inspector_notes: notes } });
    act.setOk(`Report #${open} ${review_status === 'REVIEWED' ? 'confirmed' : 'dismissed'}`);
    setOpen(null); setPicked(null); setNotes(''); list.reload();
  });

  const rep = detail.data?.report;
  return (
    <>
      <h1>Symptom reports</h1>
      <p className="lede">Check each farmer’s report against the suggested diseases, then confirm the disease or dismiss the report.
        A confirmed disease is what the insurance administrator sees when deciding a claim.</p>
      <div className="actions" style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>Show
          <select value={status} onChange={(e) => { setStatus(e.target.value); setOpen(null); }} style={{ width: 'auto' }}>
            <option value="SUBMITTED">Awaiting review</option><option value="REVIEWED">Confirmed</option>
            <option value="DISMISSED">Dismissed</option><option value="">All</option>
          </select></label>
      </div>
      <Msg error={list.error || act.error} ok={act.okMsg} />
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Report</th><th>Farmer</th><th>Crop</th><th>Symptoms</th><th>Top suggestion</th><th>Status</th></tr></thead>
          <tbody>{list.data?.reports.map((r) => (
            <tr key={r.report_id} className={`clickable${open === r.report_id ? ' selected' : ''}`}
              onClick={() => { setOpen(r.report_id); setPicked(null); setNotes(''); }}>
              <td>#{r.report_id}<div className="note">{day(r.reported_at)}</div></td>
              <td>{r.farmer_name}<div className="note">{r.location_district}, {r.parcel_name}</div></td>
              <td>{r.crop_type}<div className="note">{r.affected_area_pct}% of parcel</div></td>
              <td className="note" style={{ maxWidth: '32ch' }}>{r.symptom_text}</td>
              <td className="note">{r.top_suggestion || '—'}</td>
              <td><Stamp status={r.review_status} />{r.confirmed_disease && <div className="note">{r.confirmed_disease}</div>}</td>
            </tr>))}
          </tbody>
        </table>
        {list.data?.reports.length === 0 && <p className="empty">Nothing here. New reports from farmers appear in this list.</p>}
      </section>

      {rep && (
        <div className="split">
          <section className="panel">
            <h3>Report #{rep.report_id}: suggested diseases</h3>
            <p>{rep.symptom_text}</p>
            <MatchList matches={detail.data.matches} scoreKey="similarity_score"
              onPick={rep.review_status === 'SUBMITTED' ? setPicked : undefined} picked={picked} />
          </section>
          <section className="panel">
            <h3>Similar reports from other farms</h3>
            {detail.data.similar.length === 0 ? <p className="empty">No other reports to compare yet.</p> : (
              <table><tbody>{detail.data.similar.map((s) => (
                <tr key={s.report_id}><td>#{s.report_id} {s.crop_type}<div className="note">{s.location_district}, {day(s.reported_at)}</div></td>
                  <td className="num note">similarity {Number(s.similarity).toFixed(2)}</td></tr>))}</tbody></table>)}
            {rep.review_status === 'SUBMITTED' ? (
              <div className="stack" style={{ display: 'grid', gap: '.8rem', marginTop: '1rem' }}>
                <label>Notes from the field visit<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
                <div className="actions">
                  <button disabled={act.busy || !picked} onClick={() => decide('REVIEWED')}>Confirm selected disease</button>
                  <button className="danger" disabled={act.busy} onClick={() => decide('DISMISSED')}>Dismiss report</button>
                </div>
                {!picked && <p className="note">Pick a disease on the left to confirm it.</p>}
              </div>
            ) : <p><Stamp status={rep.review_status} /> {rep.inspector_notes}</p>}
          </section>
        </div>)}
    </>
  );
}

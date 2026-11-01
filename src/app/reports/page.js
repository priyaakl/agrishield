'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, formData, useLoad, useSubmit, Msg, Stamp, day } from '@/components/client';
import MatchList from '@/components/MatchList';

export default function Reports() {
  const parcels = useLoad('/api/parcels');
  const policies = useLoad('/api/policies');
  const reports = useLoad('/api/reports');
  const form = useSubmit();
  const [result, setResult] = useState(null);
  const [parcelId, setParcelId] = useState('');
  const [open, setOpen] = useState(null);
  const detail = useLoad(open ? `/api/reports/${open}` : null);

  // suggest the insured crop for the chosen parcel
  const cropsForParcel = policies.data?.policies.filter((p) => String(p.parcel_id) === parcelId).map((p) => p.crop_type) || [];

  return (
    <>
      <h1>Report crop damage</h1>
      <p className="lede">Describe what you see in your own words. We look up diseases with similar symptoms
        to help you and the inspector. This is a suggestion, not a diagnosis.</p>

      <div className="split">
        <section className="panel">
          <form className="stack" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; form.run(async () => {
            const r = await api('/api/reports', { method: 'POST', body: formData(f) });
            setResult(r); f.reset(); setParcelId(''); reports.reload();
          }); }}>
            <div className="row">
              <label>Parcel<select name="parcel_id" required value={parcelId} onChange={(e) => setParcelId(e.target.value)}>
                <option value="">Choose…</option>
                {parcels.data?.parcels.map((p) => <option key={p.parcel_id} value={p.parcel_id}>{p.parcel_name}</option>)}
              </select></label>
              <label>Crop<input name="crop_type" list="crop-options" required placeholder="e.g. Tomato" />
                <datalist id="crop-options">{[...new Set(cropsForParcel)].map((c) => <option key={c} value={c} />)}</datalist></label>
              <label>Area affected (%)<input name="affected_area_pct" type="number" min="1" max="100" required /></label>
            </div>
            <label>What do you see?
              <textarea name="symptom_text" required minLength={15}
                placeholder="e.g. Brown spots with rings on the lower leaves, leaves turning yellow and falling" /></label>
            <Msg error={form.error} />
            <div><button disabled={form.busy}>{form.busy ? 'Finding similar diseases…' : 'Send report'}</button></div>
          </form>
        </section>

        <section className="panel" aria-live="polite">
          <h3>Possible matches</h3>
          {!result ? <p className="empty">Results appear here after you send a report.</p> : (
            <>
              <p className="note">Report #{result.report.report_id} saved and sent to an inspector.
                {result.searchedAllCrops && ' No diseases for this crop in our library yet, so all crops were searched.'}</p>
              <MatchList matches={result.matches} />
              <p className="note">If the damage is covered by a policy, you can now <Link href="/claims">file a claim</Link> with this report.</p>
            </>)}
        </section>
      </div>

      <h2>My reports</h2>
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Report</th><th>Parcel</th><th>Symptoms</th><th>Top suggestion</th><th>Inspector</th><th>Claim</th></tr></thead>
          <tbody>
            {reports.data?.reports.map((r) => (
              <tr key={r.report_id} className={`clickable${open === r.report_id ? ' selected' : ''}`}
                onClick={() => setOpen(open === r.report_id ? null : r.report_id)}>
                <td>#{r.report_id}<div className="note">{day(r.reported_at)}</div></td>
                <td>{r.parcel_name}<div className="note">{r.crop_type}, {r.affected_area_pct}%</div></td>
                <td className="note" style={{ maxWidth: '30ch' }}>{r.symptom_text}</td>
                <td className="note">{r.top_suggestion || '—'}</td>
                <td><Stamp status={r.review_status} />{r.confirmed_disease && <div className="note">{r.confirmed_disease}</div>}</td>
                <td>{r.has_claim ? 'Filed' : '—'}</td>
              </tr>))}
          </tbody>
        </table>
        {reports.data?.reports.length === 0 && <p className="empty">No reports yet.</p>}
      </section>
      {open && detail.data && (
        <section className="panel">
          <h3>Report #{open}: saved matches</h3>
          {detail.data.report.inspector_notes && <p><strong>Inspector:</strong> {detail.data.report.inspector_notes}</p>}
          <MatchList matches={detail.data.matches} scoreKey="similarity_score" />
        </section>)}
    </>
  );
}

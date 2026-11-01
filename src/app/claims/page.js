'use client';
import { useState } from 'react';
import { api, formData, useLoad, useSubmit, Msg, Stamp, inr, day } from '@/components/client';
import History from '@/components/ClaimHistory';

export default function Claims() {
  const claims = useLoad('/api/claims');
  const reports = useLoad('/api/reports');
  const policies = useLoad('/api/policies?eligible=1');
  const form = useSubmit();
  const [reportId, setReportId] = useState('');
  const [open, setOpen] = useState(null);

  const usable = reports.data?.reports.filter((r) => !r.has_claim && r.review_status !== 'DISMISSED') || [];
  const report = usable.find((r) => String(r.report_id) === reportId);
  const matching = policies.data?.policies.filter((p) => report && p.parcel_id === report.parcel_id
    && p.crop_type.toLowerCase() === report.crop_type.toLowerCase()) || [];

  return (
    <>
      <h1>My claims</h1>
      <section className="panel">
        <h3>File a claim</h3>
        <p className="note">Pick the damage report, then the policy covering that parcel and crop.</p>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; form.run(async () => {
          const r = await api('/api/claims', { method: 'POST', body: formData(f) });
          form.setOk(`Claim #${r.claim.claim_id} filed. You'll see the decision here.`);
          f.reset(); setReportId(''); claims.reload(); reports.reload();
        }); }}>
          <div className="row">
            <label>Damage report<select name="report_id" required value={reportId} onChange={(e) => setReportId(e.target.value)}>
              <option value="">Choose…</option>
              {usable.map((r) => <option key={r.report_id} value={r.report_id}>#{r.report_id} {r.crop_type}, {r.parcel_name} ({day(r.reported_at)})</option>)}
            </select></label>
            <label>Policy<select name="policy_id" required disabled={!report}>
              {matching.map((p) => <option key={p.policy_id} value={p.policy_id}>#{p.policy_id} {p.crop_type}, {inr(p.remaining_cover)} cover left</option>)}
            </select>
              {report && matching.length === 0 && <span className="note">No active policy covers {report.crop_type} on this parcel today.</span>}</label>
            <label>Amount claimed (₹)<input name="claim_amount" type="number" min="1" required /></label>
          </div>
          <Msg error={form.error} ok={form.okMsg} />
          <div><button disabled={form.busy || !matching.length}>File claim</button></div>
        </form>
      </section>

      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Claim</th><th>Crop and parcel</th><th className="num">Claimed</th><th>Status</th><th>Payment</th></tr></thead>
          <tbody>
            {claims.data?.claims.map((c) => (
              <tr key={c.claim_id} className={`clickable${open === c.claim_id ? ' selected' : ''}`} onClick={() => setOpen(open === c.claim_id ? null : c.claim_id)}>
                <td>#{c.claim_id}<div className="note">filed {day(c.filed_at)}</div></td>
                <td>{c.crop_type}<div className="note">{c.parcel_name}{c.confirmed_disease ? `, ${c.confirmed_disease}` : ''}</div></td>
                <td className="num">{inr(c.claim_amount)}</td>
                <td><Stamp status={c.status} />{c.status === 'REJECTED' && <div className="note">{c.decision_reason}</div>}</td>
                <td>{c.payment_reference ? <>{inr(c.amount_paid)}<div className="note">{c.payment_reference}, {day(c.payout_date)}</div></> : '—'}</td>
              </tr>))}
          </tbody>
        </table>
        {claims.data?.claims.length === 0 && <p className="empty">No claims filed yet.</p>}
      </section>
      {open && <section className="panel"><h3>Claim #{open} history</h3><History claimId={open} /></section>}
    </>
  );
}

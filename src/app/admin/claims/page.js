'use client';
import { useState } from 'react';
import { api, formData, useLoad, useSubmit, Msg, Stamp, inr, day } from '@/components/client';
import History from '@/components/ClaimHistory';

// A payment reference the admin can accept or overwrite
const newRef = () => `DBT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;

export default function AdminClaims() {
  const [status, setStatus] = useState('PENDING');
  const list = useLoad(`/api/claims${status ? `?status=${status}` : ''}`);
  const [open, setOpen] = useState(null);
  const act = useSubmit();
  const c = list.data?.claims.find((x) => x.claim_id === open);

  const decide = (body) => act.run(async () => {
    await api(`/api/claims/${open}/decision`, { method: 'PATCH', body });
    act.setOk(`Claim #${open} ${body.action === 'approve' ? 'approved and payout recorded' : 'rejected'}`);
    setOpen(null); list.reload();
  });

  return (
    <>
      <h1>Claims</h1>
      <p className="lede">Approving records the payout in the same step. If the payment can’t be recorded, the approval is undone too.</p>
      <div className="actions" style={{ marginBottom: '1rem' }}>
        {[['PENDING', 'Waiting for a decision'], ['APPROVED', 'Approved'], ['REJECTED', 'Rejected'], ['', 'All']].map(([v, t]) => (
          <button key={v} className={status === v ? '' : 'secondary'} onClick={() => { setStatus(v); setOpen(null); }}>{t}</button>))}
      </div>
      <Msg error={list.error || act.error} ok={act.okMsg} />
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Claim</th><th>Farmer</th><th>Crop</th><th>Inspector’s finding</th><th className="num">Claimed</th><th className="num">Cover left</th><th>Status</th></tr></thead>
          <tbody>{list.data?.claims.map((x) => (
            <tr key={x.claim_id} className={`clickable${open === x.claim_id ? ' selected' : ''}`} onClick={() => setOpen(x.claim_id)}>
              <td>#{x.claim_id}<div className="note">{day(x.filed_at)}</div></td>
              <td>{x.farmer_name}<div className="note">{x.location_district}</div></td>
              <td>{x.crop_type}<div className="note">{x.parcel_name}, {x.affected_area_pct}% affected</div></td>
              <td>{x.confirmed_disease || <span className="note">{x.review_status === 'DISMISSED' ? 'Report dismissed' : 'Not reviewed yet'}</span>}</td>
              <td className="num">{inr(x.claim_amount)}</td><td className="num">{inr(x.remaining_cover)}</td>
              <td><Stamp status={x.status} /></td>
            </tr>))}
          </tbody>
        </table>
        {list.data?.claims.length === 0 && <p className="empty">No claims in this list.</p>}
      </section>

      {c && (
        <div className="split">
          <section className="panel">
            <h3>Claim #{c.claim_id}</h3>
            <p><strong>Farmer’s report:</strong> {c.symptom_text}</p>
            <p className="note">Policy #{c.policy_id}, {c.crop_type} ({c.season.toLowerCase()}), cover {inr(c.coverage_amount)}, {inr(c.remaining_cover)} left.</p>
            <h3>History</h3>
            <History claimId={c.claim_id} key={`${c.claim_id}-${c.status}`} />
          </section>
          <section className="panel">
            {c.status !== 'PENDING' ? (
              <><Stamp status={c.status} big />
                <p>{c.decision_reason}</p>
                {c.payment_reference && <p>{inr(c.amount_paid)} paid, reference {c.payment_reference}, {day(c.payout_date)}</p>}</>
            ) : (
              <>
                <h3>Approve and pay</h3>
                {c.review_status !== 'REVIEWED' && <p className="msg error">The inspector hasn’t confirmed a disease for this report yet.</p>}
                <form className="stack" key={`approve-${c.claim_id}`} onSubmit={(e) => { e.preventDefault(); decide({ action: 'approve', ...formData(e.currentTarget) }); }}>
                  <div className="row">
                    <label>Amount to pay (₹)<input name="amount_paid" type="number" min="1" max={c.claim_amount} defaultValue={c.claim_amount} required /></label>
                    <label>Payment mode<select name="payment_mode"><option>DBT</option><option>NEFT</option><option>UPI</option><option>CHEQUE</option></select></label>
                  </div>
                  <label>Payment reference<input name="payment_reference" defaultValue={newRef()} required /></label>
                  <label>Note<input name="note" defaultValue="Approved after review" /></label>
                  <div><button disabled={act.busy}>Approve and record payout</button></div>
                </form>
                <h3 style={{ marginTop: '1.5rem' }}>Reject</h3>
                <form className="stack" key={`reject-${c.claim_id}`} onSubmit={(e) => { e.preventDefault(); decide({ action: 'reject', ...formData(e.currentTarget) }); }}>
                  <label>Reason the farmer will see<textarea name="reason" required minLength={5} /></label>
                  <div><button className="danger" disabled={act.busy}>Reject claim</button></div>
                </form>
              </>)}
          </section>
        </div>)}
    </>
  );
}

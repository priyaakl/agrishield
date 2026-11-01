'use client';
import Link from 'next/link';
import { useLoad, inr, day, Stamp, Msg } from '@/components/client';

export default function Dashboard() {
  const { data, error, loading } = useLoad('/api/dashboard');
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <Msg error={error} />;
  const s = data.summary;
  return (
    <>
      <h1>Namaskara, {s.full_name.split(' ')[0]}</h1>
      <p className="lede">{s.location_district} district</p>

      <div className="figures">
        <div className="figure"><b>{s.parcel_count}</b><span>parcels, {s.total_acres} acres</span></div>
        <div className="figure"><b>{s.active_policies}</b><span>active policies</span></div>
        <div className="figure"><b>{inr(s.active_coverage)}</b><span>total cover</span></div>
        <div className="figure"><b>{s.pending_claims}</b><span>claims waiting</span></div>
        <div className="figure"><b>{inr(s.total_paid)}</b><span>received so far</span></div>
      </div>

      <div className="actions" style={{ marginBottom: '1.25rem' }}>
        <Link className="btn" href="/reports">Report crop damage</Link>
        <Link href="/claims">File a claim</Link>
      </div>

      <div className="split">
        <section className="panel">
          <h3>Recent claims</h3>
          {data.claims.length === 0 ? <p className="empty">No claims yet.</p> : (
            <table><tbody>
              {data.claims.map((c) => (
                <tr key={c.claim_id}>
                  <td>{c.crop_type} claim #{c.claim_id}<div className="note">{c.parcel_name}, {day(c.filed_at)}</div></td>
                  <td className="num">{inr(c.claim_amount)}{c.amount_paid ? <div className="note">paid {inr(c.amount_paid)}</div> : null}</td>
                  <td><Stamp status={c.status} /></td>
                </tr>))}
            </tbody></table>)}
        </section>
        <section className="panel">
          <h3>Recent symptom reports</h3>
          {data.reports.length === 0 ? <p className="empty">Nothing reported yet.</p> : (
            <table><tbody>
              {data.reports.map((r) => (
                <tr key={r.report_id}>
                  <td>{r.crop_type}<div className="note">{r.parcel_name}, {day(r.reported_at)}</div></td>
                  <td><Stamp status={r.review_status} /></td>
                </tr>))}
            </tbody></table>)}
        </section>
      </div>
    </>
  );
}

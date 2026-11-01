'use client';
import { useLoad, Msg, inr, day } from '@/components/client';

function Table({ rows, cols, empty }) {
  if (!rows?.length) return <p className="empty">{empty}</p>;
  return (
    <div className="table-wrap"><table>
      <thead><tr>{cols.map(([, h, num]) => <th key={h} className={num ? 'num' : ''}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}>{cols.map(([k, h, num, f]) => <td key={h} className={num ? 'num' : ''}>{f ? f(r[k]) : r[k] ?? '—'}</td>)}</tr>))}</tbody>
    </table></div>);
}

export default function Analytics() {
  const { data, error, loading } = useLoad('/api/analytics');
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <Msg error={error} />;
  const total = (k) => data.byStatus.reduce((a, r) => a + Number(r[k] || 0), 0);
  return (
    <>
      <h1>Analytics</h1>
      <div className="figures">
        <div className="figure"><b>{data.byStatus.reduce((a, r) => a + r.claims, 0)}</b><span>claims filed</span></div>
        <div className="figure"><b>{inr(total('claimed'))}</b><span>amount claimed</span></div>
        <div className="figure"><b>{inr(total('paid'))}</b><span>amount paid out</span></div>
      </div>
      <div className="split">
        <section className="panel"><h3>Claims by status</h3>
          <Table rows={data.byStatus} empty="No claims yet." cols={[['status', 'Status'], ['claims', 'Claims', 1], ['claimed', 'Claimed', 1, inr], ['paid', 'Paid', 1, inr]]} /></section>
        <section className="panel"><h3>Claims by crop</h3>
          <Table rows={data.byCrop} empty="No claims yet." cols={[['crop_type', 'Crop'], ['claims', 'Claims', 1], ['claimed', 'Claimed', 1, inr]]} /></section>
      </div>
      <section className="panel"><h3>Confirmed disease cases by district</h3>
        <Table rows={data.hotspots} empty="No confirmed cases yet."
          cols={[['location_district', 'District'], ['disease_name', 'Disease'], ['affected_crop', 'Crop'],
            ['confirmed_reports', 'Cases', 1], ['avg_area_affected_pct', 'Avg % of parcel', 1], ['last_reported', 'Last report', 0, day]]} /></section>
      <div className="split">
        <section className="panel"><h3>Policy cover used</h3>
          <Table rows={data.utilisation} empty="No claims against policies yet."
            cols={[['policy_id', 'Policy'], ['crop_type', 'Crop'], ['coverage_amount', 'Cover', 1, inr], ['paid_out', 'Paid', 1, inr], ['utilisation_pct', '% used', 1]]} /></section>
        <section className="panel"><h3>Payouts by month</h3>
          <Table rows={data.monthly} empty="No payouts yet." cols={[['month', 'Month'], ['payouts', 'Payouts', 1], ['total', 'Total', 1, inr]]} /></section>
      </div>
      <section className="panel"><h3>Field sensor risk signals, last 14 days</h3>
        {data.telemetry.error ? <Msg error={`${data.telemetry.error}. The rest of this page still works.`} /> : (
          <Table rows={data.telemetry.risk} empty="No telemetry yet. Run npm run mongo:setup."
            cols={[['parcel_name', 'Parcel'], ['farmer_name', 'Farmer'], ['fungal_risk_readings', 'Humid, wet-leaf readings', 1],
              ['dry_soil_readings', 'Dry soil readings', 1], ['min_ndvi', 'Lowest NDVI', 1], ['total_readings', 'Readings', 1]]} />)}
      </section>
    </>
  );
}

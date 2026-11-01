'use client';
import { useState } from 'react';
import { api, formData, useLoad, useSubmit, Msg, day, dayTime } from '@/components/client';

const fmt = (v) => (v == null ? '—' : v);

export default function Telemetry() {
  const parcels = useLoad('/api/parcels');
  const [parcelId, setParcelId] = useState('');
  const [days, setDays] = useState('14');
  const t = useLoad(parcelId ? `/api/telemetry?parcel_id=${parcelId}&days=${days}` : null);
  const form = useSubmit();
  const r = t.data?.risk;

  return (
    <>
      <h1>Field sensors</h1>
      <p className="lede">Soil sensor, weather station and drone readings for each parcel. Each device sends
        different readings, so these are stored as flexible documents in MongoDB.</p>
      <div className="row" style={{ maxWidth: 520, marginBottom: '1rem' }}>
        <label>Parcel<select value={parcelId} onChange={(e) => setParcelId(e.target.value)}>
          <option value="">Choose…</option>
          {parcels.data?.parcels.map((p) => <option key={p.parcel_id} value={p.parcel_id}>{p.parcel_name}</option>)}
        </select></label>
        <label>Period<select value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option>
        </select></label>
      </div>
      <Msg error={t.error} />
      {t.data && (
        <>
          <div className="figures">
            <div className="figure"><b>{fmt(r?.total_readings)}</b><span>readings</span></div>
            <div className="figure"><b>{fmt(r?.fungal_risk_readings)}</b><span>humid, wet-leaf readings (fungal risk)</span></div>
            <div className="figure"><b>{fmt(r?.dry_soil_readings)}</b><span>dry soil readings</span></div>
            <div className="figure"><b>{fmt(r?.min_ndvi)}</b><span>lowest drone NDVI</span></div>
          </div>
          <section className="panel table-wrap">
            <h3>Daily averages</h3>
            <table>
              <thead><tr><th>Day</th><th className="num">Soil moisture %</th><th className="num">Soil pH</th><th className="num">Air °C</th>
                <th className="num">Humidity %</th><th className="num">Rain mm</th><th className="num">Readings</th></tr></thead>
              <tbody>{t.data.daily.map((d) => (
                <tr key={d.day}><td>{day(d.day)}</td><td className="num">{fmt(d.avg_soil_moisture)}</td><td className="num">{fmt(d.avg_soil_ph)}</td>
                  <td className="num">{fmt(d.avg_air_temp)}</td><td className="num">{fmt(d.avg_humidity)}</td>
                  <td className="num">{fmt(d.rainfall_mm)}</td><td className="num">{d.readings}</td></tr>))}
              </tbody>
            </table>
            {t.data.daily.length === 0 && <p className="empty">No readings in this period. Add one below.</p>}
          </section>
          <section className="panel">
            <h3>Latest documents</h3>
            {t.data.latest.map((d, i) => (
              <div key={i} className="match"><strong>{d.source.replace('_', ' ').toLowerCase()}</strong>
                <span className="note"> {d.device_id}, {dayTime(d.timestamp)}</span>
                <pre className="note" style={{ margin: '.3rem 0 0', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(d.sensor_readings || d.drone_scan_metadata)}</pre></div>))}
          </section>
        </>)}
      {parcelId && (
        <section className="panel">
          <h3>Add a manual reading</h3>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; form.run(async () => {
            await api('/api/telemetry', { method: 'POST', body: { ...formData(f), parcel_id: parcelId, source: 'MANUAL' } });
            form.setOk('Reading saved'); f.reset(); t.reload();
          }); }}>
            <div className="row">
              <label>Device or note<input name="device_id" required defaultValue="HAND-METER" /></label>
              <label>Soil moisture %<input name="soil_moisture" type="number" step="0.1" min="0" max="100" /></label>
              <label>Soil pH<input name="soil_ph" type="number" step="0.01" min="0" max="14" /></label>
              <label>Air °C<input name="air_temp" type="number" step="0.1" /></label>
              <label>Humidity %<input name="humidity" type="number" step="0.1" min="0" max="100" /></label>
            </div>
            <Msg error={form.error} ok={form.okMsg} />
            <div><button disabled={form.busy}>Save reading</button></div>
          </form>
        </section>)}
    </>
  );
}

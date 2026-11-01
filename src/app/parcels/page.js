'use client';
import { useEffect, useState } from 'react';
import { api, formData, useLoad, useSubmit, Msg } from '@/components/client';

const SOILS = ['RED', 'BLACK', 'ALLUVIAL', 'LATERITE', 'SANDY', 'CLAY', 'LOAMY'];

export default function Parcels() {
  const { data, error, reload } = useLoad('/api/parcels');
  const me = useLoad('/api/auth/me');
  const isFarmer = me.data?.user.role === 'FARMER';
  const form = useSubmit();
  const del = useSubmit();

  return (
    <>
      <h1>{isFarmer ? 'My parcels' : 'All parcels'}</h1>
      <Msg error={error || del.error} ok={del.okMsg} />
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Parcel</th>{!isFarmer && <th>Farmer</th>}<th>Survey no.</th><th className="num">Acres</th>
            <th>Soil</th><th>Location</th><th className="num">Policies</th><th className="num">Reports</th>{isFarmer && <th />}</tr></thead>
          <tbody>
            {data?.parcels.map((p) => (
              <tr key={p.parcel_id}>
                <td>{p.parcel_name}</td>{!isFarmer && <td>{p.farmer_name}<div className="note">{p.location_district}</div></td>}
                <td>{p.survey_number || '—'}</td><td className="num">{p.acres}</td>
                <td>{p.soil_type.toLowerCase()}</td>
                <td className="note">{p.gps_latitude ? `${p.gps_latitude}, ${p.gps_longitude}` : '—'}</td>
                <td className="num">{p.policy_count}</td><td className="num">{p.report_count}</td>
                {isFarmer && <td>{p.policy_count + p.report_count === 0 && (
                  <button className="danger" disabled={del.busy} onClick={() => del.run(async () => {
                    await api(`/api/parcels/${p.parcel_id}`, { method: 'DELETE' });
                    del.setOk('Parcel removed'); reload();
                  })}>Remove</button>)}</td>}
              </tr>))}
          </tbody>
        </table>
        {data?.parcels.length === 0 && <p className="empty">No parcels yet. Add your first one below.</p>}
      </section>

      {isFarmer && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Add a parcel</h2>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; form.run(async () => {
            await api('/api/parcels', { method: 'POST', body: formData(f) });
            f.reset(); form.setOk('Parcel added'); reload();
          }); }}>
            <div className="row">
              <label>Name<input name="parcel_name" required placeholder="e.g. Well-side field" /></label>
              <label>Survey number<input name="survey_number" placeholder="optional" /></label>
              <label>Area (acres)<input name="acres" type="number" step="0.01" min="0.01" max="1000" required /></label>
              <label>Soil<select name="soil_type" required>{SOILS.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</select></label>
            </div>
            <div className="row">
              <label>Latitude<input name="gps_latitude" type="number" step="0.000001" min="-90" max="90" /></label>
              <label>Longitude<input name="gps_longitude" type="number" step="0.000001" min="-180" max="180" /></label>
            </div>
            <Msg error={form.error} ok={form.okMsg} />
            <div><button disabled={form.busy}>Add parcel</button></div>
          </form>
        </section>
      )}
    </>
  );
}

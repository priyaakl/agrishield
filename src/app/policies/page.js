'use client';
import { api, formData, useLoad, useSubmit, Msg, Stamp, inr, day } from '@/components/client';

export default function Policies() {
  const me = useLoad('/api/auth/me');
  const role = me.data?.user.role;
  const { data, error, reload } = useLoad('/api/policies');
  const parcels = useLoad(role === 'ADMIN' ? '/api/parcels' : null);
  const form = useSubmit();
  const cancel = useSubmit();

  return (
    <>
      <h1>{role === 'FARMER' ? 'My policies' : 'Policies'}</h1>
      <p className="lede">A claim can only be filed under a policy that is active today.</p>
      <Msg error={error || cancel.error} ok={cancel.okMsg} />
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Policy</th>{role !== 'FARMER' && <th>Farmer</th>}<th>Crop</th><th>Parcel</th><th>Period</th>
            <th className="num">Cover</th><th className="num">Cover left</th><th className="num">Premium</th><th>Status</th><th>Claimable today</th>{role === 'ADMIN' && <th />}</tr></thead>
          <tbody>
            {data?.policies.map((p) => (
              <tr key={p.policy_id}>
                <td>#{p.policy_id}</td>{role !== 'FARMER' && <td>{p.farmer_name}</td>}
                <td>{p.crop_type}<div className="note">{p.season.toLowerCase()}</div></td>
                <td>{p.parcel_name}</td><td className="note">{day(p.start_date)} to {day(p.end_date)}</td>
                <td className="num">{inr(p.coverage_amount)}</td><td className="num">{inr(p.remaining_cover)}</td>
                <td className="num">{inr(p.premium_amount)}</td>
                <td><Stamp status={p.status} /></td><td>{p.eligible ? 'Yes' : 'No'}</td>
                {role === 'ADMIN' && <td>{p.status === 'ACTIVE' && (
                  <button className="danger" disabled={cancel.busy} onClick={() => cancel.run(async () => {
                    await api(`/api/policies/${p.policy_id}`, { method: 'PATCH' });
                    cancel.setOk(`Policy #${p.policy_id} cancelled`); reload();
                  })}>Cancel</button>)}</td>}
              </tr>))}
          </tbody>
        </table>
        {data?.policies.length === 0 && <p className="empty">No policies on record.</p>}
      </section>

      {role === 'ADMIN' && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Issue a policy</h2>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; form.run(async () => {
            await api('/api/policies', { method: 'POST', body: formData(f) });
            f.reset(); form.setOk('Policy issued'); reload();
          }); }}>
            <div className="row">
              <label>Parcel<select name="parcel_id" required>
                {parcels.data?.parcels.map((p) => <option key={p.parcel_id} value={p.parcel_id}>{p.parcel_name} ({p.farmer_name})</option>)}
              </select></label>
              <label>Crop<input name="crop_type" required placeholder="e.g. Rice" /></label>
              <label>Season<select name="season"><option>KHARIF</option><option>RABI</option><option>ZAID</option></select></label>
            </div>
            <div className="row">
              <label>Cover (₹)<input name="coverage_amount" type="number" min="1" required /></label>
              <label>Premium (₹)<input name="premium_amount" type="number" min="0" required /></label>
              <label>Starts<input name="start_date" type="date" required /></label>
              <label>Ends<input name="end_date" type="date" required /></label>
            </div>
            <Msg error={form.error} ok={form.okMsg} />
            <div><button disabled={form.busy}>Issue policy</button></div>
          </form>
        </section>
      )}
    </>
  );
}

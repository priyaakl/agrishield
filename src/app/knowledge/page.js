'use client';
import { api, formData, useLoad, useSubmit, Msg } from '@/components/client';

export default function Knowledge() {
  const me = useLoad('/api/auth/me');
  const list = useLoad('/api/diseases');
  const form = useSubmit();
  const canEdit = ['INSPECTOR', 'ADMIN'].includes(me.data?.user.role);
  return (
    <>
      <h1>Knowledge base</h1>
      <p className="lede">The disease catalogue the search runs on. Each entry is turned into a 384-number
        embedding when it is saved.</p>
      {canEdit && (
        <section className="panel">
          <h3>Add a disease</h3>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; form.run(async () => {
            const r = await api('/api/diseases', { method: 'POST', body: formData(f) });
            form.setOk(`${r.disease.disease_name} added and embedded`); f.reset(); list.reload();
          }); }}>
            <div className="row">
              <label>Disease name<input name="disease_name" required /></label>
              <label>Crop<input name="affected_crop" required /></label>
              <label>Cause<select name="pathogen_type">
                {['FUNGAL', 'BACTERIAL', 'VIRAL', 'PEST', 'NUTRIENT', 'OTHER'].map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
              </select></label>
            </div>
            <label>Symptoms<textarea name="symptom_description" required minLength={20} /></label>
            <label>Advice<textarea name="recommended_treatment" required /></label>
            <label>Source<input name="source_reference" placeholder="Where this advice comes from" /></label>
            <Msg error={form.error} ok={form.okMsg} />
            <div><button disabled={form.busy}>{form.busy ? 'Saving and embedding…' : 'Add disease'}</button></div>
          </form>
        </section>)}
      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Disease</th><th>Crop</th><th>Cause</th><th>Symptoms</th><th>Searchable</th></tr></thead>
          <tbody>{list.data?.diseases.map((d) => (
            <tr key={d.disease_id}><td>{d.disease_name}</td><td>{d.affected_crop}</td><td>{d.pathogen_type.toLowerCase()}</td>
              <td className="note" style={{ maxWidth: '45ch' }}>{d.symptom_description}</td>
              <td>{d.embedded ? 'Yes' : <span className="note">Run npm run embed</span>}</td></tr>))}
          </tbody>
        </table>
      </section>
    </>
  );
}

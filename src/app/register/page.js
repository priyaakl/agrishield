'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, formData, Msg, useSubmit } from '@/components/client';

export default function Register() {
  const router = useRouter();
  const { busy, error, run } = useSubmit();
  return (
    <div className="auth">
      <div className="panel">
        <h1>Create a farmer account</h1>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => {
          await api('/api/auth/register', { method: 'POST', body: formData(e.currentTarget) });
          router.push('/'); router.refresh();
        }); }}>
          <label>Full name<input name="full_name" required minLength={2} maxLength={100} /></label>
          <label>Email<input name="email" type="email" required /></label>
          <div className="row">
            <label>Mobile number<input name="phone" inputMode="numeric" pattern="[6-9][0-9]{9}" title="10-digit mobile number" required /></label>
            <label>District<input name="location_district" required /></label>
          </div>
          <label>Password<input name="password" type="password" minLength={8} required autoComplete="new-password" />
            <span className="note">At least 8 characters with a letter and a number.</span></label>
          <Msg error={error} />
          <button disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="note">Already registered? <Link href="/login">Log in</Link></p>
      </div>
    </div>
  );
}

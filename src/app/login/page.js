'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, formData, Msg, useSubmit } from '@/components/client';

export default function Login() {
  const router = useRouter();
  const { busy, error, run } = useSubmit();
  return (
    <div className="auth">
      <div className="panel">
        <h1>AgriShield</h1>
        <p className="lede">Report crop damage, find out what it might be, and track your insurance claim.</p>
        <form className="stack" onSubmit={(e) => { e.preventDefault(); run(async () => {
          await api('/api/auth/login', { method: 'POST', body: formData(e.currentTarget) });
          router.push('/'); router.refresh();
        }); }}>
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <Msg error={error} />
          <button disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="note">New farmer? <Link href="/register">Create an account</Link></p>
        {process.env.NODE_ENV !== 'production' && (
          <p className="note">Demo logins (password Agri@1234): ravi@example.com, lakshmi@example.com,
            inspector@agrishield.in, admin@agrishield.in</p>
        )}
      </div>
    </div>
  );
}

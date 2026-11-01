import { redirect } from 'next/navigation';
import { getSession } from '@/lib/api';

export default async function Home() {
  const s = await getSession();
  if (!s) redirect('/login');
  redirect({ FARMER: '/dashboard', INSPECTOR: '/inspector/reports', ADMIN: '/admin/claims' }[s.role]);
}

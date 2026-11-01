import './globals.css';
import Link from 'next/link';
import { getSession } from '@/lib/api';
import LogoutButton from '@/components/LogoutButton';

export const dynamic = 'force-dynamic'; // every page depends on the login cookie
export const metadata = { title: 'AgriShield', description: 'Crop disease reports and crop insurance claims in one place' };

const NAV = {
  FARMER: [['/dashboard', 'Overview'], ['/parcels', 'My parcels'], ['/policies', 'My policies'],
    ['/reports', 'Report crop damage'], ['/claims', 'My claims'], ['/telemetry', 'Field sensors'],
    ['/disease-search', 'Disease library']],
  INSPECTOR: [['/inspector/reports', 'Reports to review'], ['/knowledge', 'Knowledge base'],
    ['/disease-search', 'Disease library'], ['/parcels', 'All parcels']],
  ADMIN: [['/admin/claims', 'Claims to decide'], ['/admin/analytics', 'Analytics'], ['/policies', 'Policies'],
    ['/inspector/reports', 'Symptom reports'], ['/knowledge', 'Knowledge base'], ['/disease-search', 'Disease library']],
};
const ROLE_NAME = { FARMER: 'Farmer', INSPECTOR: 'Agricultural inspector', ADMIN: 'Insurance administrator' };

export default async function RootLayout({ children }) {
  const s = await getSession();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bitter:wght@500;600;700&family=Public+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        {s ? (
          <div className="shell">
            <aside className="sidebar">
              <Link href="/" className="brand">AgriShield<small>Crop health and insurance</small></Link>
              <nav className="nav" aria-label="Main">
                {NAV[s.role].map(([href, text]) => <Link key={href} href={href}>{text}</Link>)}
              </nav>
              <div className="who"><strong>{s.name}</strong>{ROLE_NAME[s.role]}<br /><LogoutButton /></div>
            </aside>
            <main>{children}</main>
          </div>
        ) : children}
      </body>
    </html>
  );
}

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="auth"><div className="panel">
      <h1>Page not found</h1>
      <p>This page doesn’t exist. <Link href="/">Go to your home page</Link>.</p>
    </div></div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Empty fields are dropped so optional numbers aren't sent as ""
export function formData(form) {
  const o = {};
  for (const [k, v] of new FormData(form)) if (String(v).trim() !== '') o[k] = v;
  return o;
}

export function useLoad(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(async () => {
    if (!path) return setState({ data: null, error: null, loading: false });
    setState((s) => ({ ...s, loading: true }));
    try { setState({ data: await api(path), error: null, loading: false }); }
    catch (e) { setState({ data: null, error: e.message, loading: false }); }
  }, [path]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

export const inr = (n) => (n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }));
export const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dayTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const label = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', SUBMITTED: 'Awaiting review',
  REVIEWED: 'Confirmed', DISMISSED: 'Dismissed', ACTIVE: 'Active', EXPIRED: 'Expired', CANCELLED: 'Cancelled' };

export function Stamp({ status, big }) {
  return <span className={`stamp ${status}${big ? ' big' : ''}`}>{label[status] || status}</span>;
}

export function Msg({ error, ok }) {
  if (error) return <div className="msg error" role="alert">{error}</div>;
  if (ok) return <div className="msg ok" role="status">{ok}</div>;
  return null;
}

// Wraps a form submit: handles busy state + error/success messages
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOk] = useState(null);
  const run = async (fn) => {
    setBusy(true); setError(null); setOk(null);
    try { const r = await fn(); return r; }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return { busy, error, okMsg, setOk, setError, run };
}

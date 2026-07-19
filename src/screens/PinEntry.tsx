import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { panelApi } from '../api/client';
import { deviceConfig } from '../config';

const MAX_DIGITS = 6;

function reasonMessage(reason?: 'not_found' | 'already_used' | 'expired' | 'outside_window'): string {
  switch (reason) {
    case 'already_used':
      return 'This code has already been used';
    case 'expired':
      return 'This code has expired';
    case 'outside_window':
      return 'This code isn\u2019t active right now — check its scheduled window';
    default:
      return 'Incorrect code — try again';
  }
}

export default function PinEntry({
  title, verifyMode,
}: {
  title: string;
  // Both Delivery Pass and Door PIN are now real, checked against the
  // backend. Door PIN used to be a hardcoded mock ("1234") that never
  // actually reached the backend at all — that was the real bug behind
  // "PIN doesn't work" reports, not a flaky verification issue.
  verifyMode: 'delivery' | 'door';
}) {
  const navigate = useNavigate();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  function press(d: string) {
    if (checking) return;
    setError(null);
    if (d === 'del') {
      setDigits((prev) => prev.slice(0, -1));
      return;
    }
    if (digits.length >= MAX_DIGITS) return;
    setDigits((prev) => prev + d);
  }

  async function submit() {
    setChecking(true);
    setError(null);
    const siteId = deviceConfig.current?.siteId ?? '';

    try {
      if (verifyMode === 'delivery') {
        const result = await panelApi.verifyVisitorPin(siteId, digits);
        setChecking(false);
        if (result.valid) {
          navigate('/unlocked');
        } else {
          setError(reasonMessage(result.reason));
          setDigits('');
        }
      } else {
        const result = await panelApi.verifyDoorPin(siteId, digits);
        setChecking(false);
        if (result.valid) {
          navigate('/unlocked');
        } else {
          setError('Incorrect code — try again');
          setDigits('');
        }
      }
    } catch {
      setChecking(false);
      setError('Could not reach the server — check connection');
      setDigits('');
    }
  }

  const pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="back-btn" onClick={() => navigate('/')}>←</div>
        <div className="screen-title">{title}</div>
      </div>

      <div className="keypad-display">
        {Array.from({ length: MAX_DIGITS }).map((_, i) => (
          <div key={i} className={`keypad-dot ${i < digits.length ? 'filled' : ''}`} />
        ))}
      </div>
      {error && <p className="muted" style={{ textAlign: 'center', color: 'var(--danger)' }}>{error}</p>}

      <div className="keypad-grid">
        {pad.map((k) =>
          k === 'clear' ? (
            <button key={k} className="keypad-btn action" onClick={() => setDigits('')}>Clear</button>
          ) : k === 'del' ? (
            <button key={k} className="keypad-btn action" onClick={() => press('del')}>⌫</button>
          ) : (
            <button key={k} className="keypad-btn" onClick={() => press(k)}>{k}</button>
          ),
        )}
      </div>

      <button className="keypad-submit" disabled={digits.length < 4 || checking} onClick={submit}>
        {checking ? 'Checking…' : 'Unlock'}
      </button>
    </div>
  );
}

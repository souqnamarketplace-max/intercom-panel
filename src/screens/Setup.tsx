import { useState } from 'react';
import { panelApi } from '../api/client';
import { saveDeviceConfig } from '../config';
import OnScreenKeyboard from '../components/OnScreenKeyboard';
import { useScrollIntoViewOnOpen } from '../hooks/useScrollIntoViewOnOpen';

type EntryPointOption = { id: string; name: string; hasPanel: boolean; hasPiController: boolean };

export default function Setup({ onProvisioned }: { onProvisioned: () => void }) {
  const [mode, setMode] = useState<'site-code' | 'advanced'>('site-code');

  return mode === 'site-code'
    ? <SiteCodeFlow onProvisioned={onProvisioned} onUseAdvanced={() => setMode('advanced')} />
    : <AdvancedFlow onProvisioned={onProvisioned} onBack={() => setMode('site-code')} />;
}

// Primary flow: site code (reusable, like a Wi-Fi password) + pick this
// panel's door from the site's existing entry points. No ad-hoc entry point
// creation here -- those are created ahead of time in the dashboard.
function SiteCodeFlow({ onProvisioned, onUseAdvanced }: { onProvisioned: () => void; onUseAdvanced: () => void }) {
  const [step, setStep] = useState<'code' | 'door'>('code');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [site, setSite] = useState<{ id: string; name: string } | null>(null);
  const [entryPoints, setEntryPoints] = useState<EntryPointOption[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const inputRef = useScrollIntoViewOnOpen<HTMLInputElement>(keyboardOpen);

  async function submitCode() {
    if (!code.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const result = await panelApi.resolveSiteCode(code.trim().toUpperCase());
      if (!result.valid) {
        setError('That code isn\u2019t valid \u2014 check the dashboard\u2019s Sites screen for the current code');
        setCode('');
        return;
      }
      setSite({ id: result.siteId, name: result.siteName });
      setEntryPoints(result.entryPoints);
      setStep('door');
    } catch {
      setError('Could not reach the server \u2014 check the connection and try again');
    } finally {
      setChecking(false);
    }
  }

  async function selectDoor(entryPointId: string) {
    if (!site) return;
    setClaiming(entryPointId);
    setError(null);
    try {
      const result = await panelApi.claimEntryPoint(site.id, entryPointId);
      if (!result.valid) {
        setError('Could not pair with that door \u2014 try again');
        setClaiming(null);
        return;
      }
      saveDeviceConfig({ siteId: result.siteId, entryPointId: result.entryPointId, entryPointName: result.entryPointName, deviceId: result.deviceId });
      onProvisioned();
    } catch {
      setError('Could not reach the server \u2014 check the connection and try again');
      setClaiming(null);
    }
  }

  if (step === 'door') {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div style={{ maxWidth: 420, width: '100%', padding: 24 }}>
          <h1 style={{ marginBottom: 4, textAlign: 'center' }}>Which door is this?</h1>
          <p className="muted" style={{ marginBottom: 20, textAlign: 'center' }}>{site?.name}</p>

          {entryPoints.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center' }}>
              No entry points exist for this site yet \u2014 create one in the dashboard's Devices screen first.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entryPoints.map((ep) => (
                <button
                  key={ep.id}
                  className="keypad-submit"
                  style={{ margin: 0, textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
                  disabled={!!claiming}
                  onClick={() => selectDoor(ep.id)}
                >
                  <span>{ep.name}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {claiming === ep.id ? 'Pairing\u2026' : ep.hasPanel ? 'Has a panel already' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginTop: 12 }}>{error}</p>}

          <button
            className="btn-text"
            style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 13, marginTop: 16, display: 'block', width: '100%', textAlign: 'center' }}
            onClick={() => { setStep('code'); setSite(null); setEntryPoints([]); }}
          >
            {'\u2190'} Use a different site code
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center', padding: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Panel Setup</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Enter this site's setup code, shown on the dashboard's Sites screen.
          One code works for every panel installed at this site.
        </p>

        <input
          ref={inputRef}
          value={code}
          readOnly
          onClick={() => setKeyboardOpen(true)}
          placeholder="e.g. A1B2C3D4"
          style={{
            width: '100%', boxSizing: 'border-box', textAlign: 'center', fontSize: 22,
            letterSpacing: '0.15em', fontFamily: "'IBM Plex Mono', monospace",
            padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)',
            background: 'var(--plate)', color: 'var(--bone)', marginBottom: 12,
          }}
        />

        {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>}

        <button className="keypad-submit" disabled={!code.trim() || checking} onClick={submitCode}>
          {checking ? 'Checking\u2026' : 'Continue'}
        </button>

        <button
          className="btn-text"
          style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 13, marginTop: 16 }}
          onClick={onUseAdvanced}
        >
          Re-pairing a specific device? Use a device code instead
        </button>
      </div>

      {keyboardOpen && (
        <div className="osk-anchor">
          <div className="osk-done-row">
            <button className="btn-text" onClick={() => setKeyboardOpen(false)}>Done</button>
          </div>
          <OnScreenKeyboard
            onKey={(char) => { setError(null); setCode((c) => (c + char).toUpperCase()); }}
            onBackspace={() => setCode((c) => c.slice(0, -1))}
            onSpace={() => {}}
          />
        </div>
      )}
    </div>
  );
}

// Secondary flow: a one-time per-device code from the dashboard's Devices
// screen, for re-pairing one exact existing device without going through
// the site-code + door-picker flow (e.g. after a hardware swap where you
// want to keep that entry point's device identity/history).
function AdvancedFlow({ onProvisioned, onBack }: { onProvisioned: () => void; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const inputRef = useScrollIntoViewOnOpen<HTMLInputElement>(keyboardOpen);

  async function submit() {
    if (!code.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const result = await panelApi.provision(code.trim().toUpperCase());
      if (result.valid) {
        saveDeviceConfig({ siteId: result.siteId, entryPointId: result.entryPointId, entryPointName: result.entryPointName, deviceId: result.deviceId });
        onProvisioned();
      } else {
        setError('That code isn\u2019t valid \u2014 check the dashboard\u2019s Devices screen for the current code');
        setCode('');
      }
    } catch {
      setError('Could not reach the server \u2014 check the connection and try again');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <div style={{ maxWidth: 360, width: '100%', textAlign: 'center', padding: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Re-pair Device</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Enter the one-time device code shown for this exact device in the dashboard's Devices screen.
        </p>

        <input
          ref={inputRef}
          value={code}
          readOnly
          onClick={() => setKeyboardOpen(true)}
          placeholder="e.g. A1B2C3D4E5"
          style={{
            width: '100%', boxSizing: 'border-box', textAlign: 'center', fontSize: 22,
            letterSpacing: '0.15em', fontFamily: "'IBM Plex Mono', monospace",
            padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line)',
            background: 'var(--plate)', color: 'var(--bone)', marginBottom: 12,
          }}
        />

        {error && <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>}

        <button className="keypad-submit" disabled={!code.trim() || checking} onClick={submit}>
          {checking ? 'Verifying\u2026' : 'Pair this panel'}
        </button>

        <button
          className="btn-text"
          style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 13, marginTop: 16 }}
          onClick={onBack}
        >
          {'\u2190'} Back to site setup
        </button>
      </div>

      {keyboardOpen && (
        <div className="osk-anchor">
          <div className="osk-done-row">
            <button className="btn-text" onClick={() => setKeyboardOpen(false)}>Done</button>
          </div>
          <OnScreenKeyboard
            onKey={(char) => { setError(null); setCode((c) => (c + char).toUpperCase()); }}
            onBackspace={() => setCode((c) => c.slice(0, -1))}
            onSpace={() => {}}
          />
        </div>
      )}
    </div>
  );
}

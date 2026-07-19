import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { panelApi } from '../api/client';
import { deviceConfig, clearDeviceConfig } from '../config';
import { getBrightness, setBrightness as persistBrightness } from '../displaySettings';
import BottomNav from '../components/BottomNav';
import NumericKeypad from '../components/NumericKeypad';
import { useScrollIntoViewOnOpen } from '../hooks/useScrollIntoViewOnOpen';

export default function Settings() {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);

  const [brightness, setBrightness] = useState(getBrightness);
  const [contrast, setContrast] = useState(50);
  const [volume, setVolume] = useState(70);

  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [pinChangeSaving, setPinChangeSaving] = useState(false);
  const [pinChanged, setPinChanged] = useState(false);
  // Kiosk has no system keyboard, so these three PIN fields share one
  // on-screen numeric keypad via a tap-to-select "active field" instead of
  // each field bringing up its own keyboard.
  const [activeField, setActiveField] = useState<'current' | 'new' | 'confirm' | null>(null);
  const keypadRef = useScrollIntoViewOnOpen<HTMLDivElement>(activeField !== null);

  function appendDigit(d: string) {
    if (activeField === 'current' && currentPin.length < 8) setCurrentPin((p) => p + d);
    if (activeField === 'new' && newPin.length < 8) setNewPin((p) => p + d);
    if (activeField === 'confirm' && newPinConfirm.length < 8) setNewPinConfirm((p) => p + d);
  }
  function backspaceDigit() {
    if (activeField === 'current') setCurrentPin((p) => p.slice(0, -1));
    if (activeField === 'new') setNewPin((p) => p.slice(0, -1));
    if (activeField === 'confirm') setNewPinConfirm((p) => p.slice(0, -1));
  }
  function clearDigit() {
    if (activeField === 'current') setCurrentPin('');
    if (activeField === 'new') setNewPin('');
    if (activeField === 'confirm') setNewPinConfirm('');
  }

  async function handleChangePin() {
    setPinChangeError(null);
    if (!/^\d{4,8}$/.test(newPin)) {
      setPinChangeError('New PIN must be 4-8 digits');
      return;
    }
    if (newPin !== newPinConfirm) {
      setPinChangeError('New PIN doesn\u2019t match confirmation');
      return;
    }
    setPinChangeSaving(true);
    try {
      await panelApi.changeSettingsPin((deviceConfig.current?.siteId ?? ''), currentPin, newPin);
      setPinChanged(true);
      setShowChangePin(false);
      setActiveField(null);
      setCurrentPin('');
      setNewPin('');
      setNewPinConfirm('');
      setTimeout(() => setPinChanged(false), 3000);
    } catch (err) {
      setPinChangeError(err instanceof Error ? err.message : 'Could not change PIN');
    } finally {
      setPinChangeSaving(false);
    }
  }

  async function handleUnlock() {
    setChecking(true);
    setError(false);
    try {
      const res = await panelApi.verifySettingsPin((deviceConfig.current?.siteId ?? ''), pin);
      if (res.valid) {
        setUnlocked(true);
      } else {
        setError(true);
        setPin('');
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="screen">
        <div className="pin-gate">
          <div className="screen-title">Enter Settings PIN</div>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            readOnly
            maxLength={8}
            style={{ textAlign: 'center', fontSize: 22, letterSpacing: 6, maxWidth: 180 }}
          />
          {error && <p style={{ color: 'var(--danger)', fontSize: 13.5 }}>Incorrect PIN</p>}
          <div className="keypad-grid" style={{ flex: 'none', padding: '8px 32px' }}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button key={d} className="keypad-btn" onClick={() => pin.length < 8 && setPin((p) => p + d)}>{d}</button>
            ))}
            <button className="keypad-btn action" onClick={() => setPin('')}>Clear</button>
            <button className="keypad-btn" onClick={() => pin.length < 8 && setPin((p) => p + '0')}>0</button>
            <button className="keypad-btn action" onClick={() => setPin((p) => p.slice(0, -1))}>⌫</button>
          </div>
          <button className="keypad-submit" style={{ margin: 0, minWidth: 180 }} disabled={!pin || checking} onClick={handleUnlock}>
            {checking ? 'Checking…' : 'Unlock'}
          </button>
          <button className="btn-text" style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 13 }} onClick={() => navigate('/')}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="back-btn" onClick={() => navigate('/')}>←</div>
        <div className="screen-title">Settings</div>
      </div>
      <div className="simple-section">
        <div className="table-card-like">
          <div className="settings-row">
            <span className="settings-label">Brightness</span>
            <input
              className="settings-slider" type="range" min={10} max={100} value={brightness}
              onChange={(e) => { const v = +e.target.value; setBrightness(v); persistBrightness(v); }}
            />
          </div>
          <div className="settings-row">
            <span className="settings-label">Contrast <span className="muted" style={{ fontSize: 11 }}>(needs native app)</span></span>
            <input className="settings-slider" type="range" min={0} max={100} value={contrast} onChange={(e) => setContrast(+e.target.value)} />
          </div>
          <div className="settings-row">
            <span className="settings-label">Volume <span className="muted" style={{ fontSize: 11 }}>(needs native app)</span></span>
            <input className="settings-slider" type="range" min={0} max={100} value={volume} onChange={(e) => setVolume(+e.target.value)} />
          </div>
          <div className="settings-row">
            <span className="settings-label">Network</span>
            <span className="muted" style={{ fontSize: 13 }}>Wi-Fi — Connected</span>
          </div>

          {/* Diagnostics - previously nothing on the panel showed which
              door/device this actually was, which matters for an installer
              standing in front of multiple panels, or during a support
              call ("what device ID do you see?"). */}
          <div style={{ padding: '10px 20px 4px' }}>
            <div className="muted" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Device Info
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-label">Entry point</span>
            <span className="muted" style={{ fontSize: 13 }}>{deviceConfig.current?.entryPointName ?? '—'}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Device ID</span>
            <span className="muted" style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {deviceConfig.current?.deviceId ? `${deviceConfig.current.deviceId.slice(0, 8)}…` : '—'}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Site ID</span>
            <span className="muted" style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {deviceConfig.current?.siteId ? `${deviceConfig.current.siteId.slice(0, 8)}…` : '—'}
            </span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Settings PIN</span>
            <button
              className="btn-text"
              style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 13 }}
              onClick={() => { setShowChangePin((v) => !v); setPinChangeError(null); setActiveField(null); }}
            >
              {showChangePin ? 'Cancel' : 'Change'}
            </button>
          </div>
          {showChangePin && (
            <div style={{ padding: '4px 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="password" inputMode="numeric" placeholder="Current PIN" maxLength={8}
                value={currentPin} readOnly
                className={activeField === 'current' ? 'active-field' : ''}
                onClick={() => setActiveField('current')}
              />
              <input
                type="password" inputMode="numeric" placeholder="New PIN (4-8 digits)" maxLength={8}
                value={newPin} readOnly
                className={activeField === 'new' ? 'active-field' : ''}
                onClick={() => setActiveField('new')}
              />
              <input
                type="password" inputMode="numeric" placeholder="Confirm new PIN" maxLength={8}
                value={newPinConfirm} readOnly
                className={activeField === 'confirm' ? 'active-field' : ''}
                onClick={() => setActiveField('confirm')}
              />
              {activeField && (
                <div ref={keypadRef}>
                  <NumericKeypad onDigit={appendDigit} onBackspace={backspaceDigit} onClear={clearDigit} />
                </div>
              )}
              {pinChangeError && <p style={{ color: 'var(--danger)', fontSize: 12.5, margin: 0 }}>{pinChangeError}</p>}
              <button
                className="keypad-submit" style={{ margin: 0 }}
                disabled={!currentPin || !newPin || !newPinConfirm || pinChangeSaving}
                onClick={handleChangePin}
              >
                {pinChangeSaving ? 'Saving\u2026' : 'Save new PIN'}
              </button>
            </div>
          )}
          {pinChanged && (
            <p style={{ color: 'var(--patina)', fontSize: 12.5, padding: '0 20px 8px' }}>PIN changed successfully.</p>
          )}
          <div className="settings-row">
            <span className="settings-label">Activity Log</span>
            <button
              className="btn-text"
              style={{ background: 'none', border: 'none', color: 'var(--slate)', fontSize: 13 }}
              onClick={() => navigate('/activity')}
            >
              View →
            </button>
          </div>
          <div className="settings-row">
            <span className="settings-label">Device pairing</span>
            <button
              className="btn-text"
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13 }}
              onClick={() => {
                if (!confirm('Unpair this panel? It will need a new setup code from the dashboard before it works again.')) return;
                clearDeviceConfig();
                window.location.reload();
              }}
            >
              Unpair & reset
            </button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
          Use "Unpair & reset" after the dashboard shows this device as re-paired
          (e.g. after a factory reset or hardware swap) — the panel will ask for
          a fresh setup code on next launch.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}

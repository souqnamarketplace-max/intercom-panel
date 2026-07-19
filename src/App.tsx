import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './screens/Home';
import Directory from './screens/Directory';
import Calling from './screens/Calling';
import PinEntry from './screens/PinEntry';
import VirtualKeyScan from './screens/VirtualKeyScan';
import Unlocked from './screens/Unlocked';
import Security from './screens/Security';
import BuildingInfo from './screens/BuildingInfo';
import Messages from './screens/Messages';
import Settings from './screens/Settings';
import Activity from './screens/Activity';
import Setup from './screens/Setup';
import { deviceConfig } from './config';
import { panelApi } from './api/client';
import { refreshKeyCache } from './keyCache';
import { getBrightness } from './displaySettings';

const HEARTBEAT_INTERVAL_MS = 20_000;

export default function App() {
  const [provisioned, setProvisioned] = useState(!!deviceConfig.current);
  // Kiosk hardware doesn't expose real backlight control from a web view,
  // so "brightness" here is a dim overlay rather than actual screen
  // brightness - good enough for glare/night use, not true hardware dimming.
  const [brightness, setBrightnessState] = useState(getBrightness);

  useEffect(() => {
    const onChange = () => setBrightnessState(getBrightness());
    window.addEventListener('brightness-changed', onChange);
    return () => window.removeEventListener('brightness-changed', onChange);
  }, []);

  useEffect(() => {
    if (!provisioned || !deviceConfig.current) return;
    const { deviceId, siteId } = deviceConfig.current;
    // Fire immediately so the dashboard shows "online" right after pairing,
    // and the QR-verification key cache is populated without waiting a
    // full interval.
    panelApi.heartbeat(deviceId).catch(() => {});
    refreshKeyCache(siteId);
    const timer = setInterval(() => {
      panelApi.heartbeat(deviceId).catch(() => {});
      refreshKeyCache(siteId);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [provisioned]);

  if (!provisioned) {
    return <Setup onProvisioned={() => setProvisioned(true)} />;
  }

  return (
    <BrowserRouter>
      {brightness < 100 && (
        <div
          style={{
            position: 'fixed', inset: 0, background: '#000',
            opacity: (100 - brightness) / 130, // caps out well short of fully black
            pointerEvents: 'none', zIndex: 9999,
          }}
        />
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/call/:residentId/:name" element={<Calling />} />
        <Route path="/pin" element={<PinEntry title="Door PIN" verifyMode="door" />} />
        <Route path="/delivery-pin" element={<PinEntry title="Delivery PIN" verifyMode="delivery" />} />
        <Route path="/scan" element={<VirtualKeyScan />} />
        <Route path="/unlocked" element={<Unlocked />} />
        <Route path="/security" element={<Security />} />
        <Route path="/building-info" element={<BuildingInfo />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/activity" element={<Activity />} />
      </Routes>
    </BrowserRouter>
  );
}

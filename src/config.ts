// The panel used to get its site ID from a build-time env var
// (VITE_SITE_ID), which meant one Vercel deployment per site and couldn't
// tell two panels on the same site apart. Now it's provisioned at runtime:
// staff generates a one-time setup code per device in the dashboard, the
// panel exchanges it once (see screens/Setup.tsx), and the resolved
// identity is persisted here so the same deployed app works for any site.
//
// This is a real standalone deployed web app (not a claude.ai in-chat
// artifact), so localStorage is the right tool here — it persists across
// reloads on the physical/kiosk device the way a native app's local storage
// would.
export interface DeviceConfig {
  siteId: string;
  entryPointId: string;
  entryPointName: string;
  deviceId: string;
}

const STORAGE_KEY = 'intercom_panel_device_config';

function loadConfig(): DeviceConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DeviceConfig) : null;
  } catch {
    return null;
  }
}

// A mutable holder (not a plain const) so every importer sees updates after
// provisioning, without needing React context just for this.
export const deviceConfig: { current: DeviceConfig | null } = { current: loadConfig() };

export function saveDeviceConfig(config: DeviceConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  deviceConfig.current = config;
}

export function clearDeviceConfig() {
  localStorage.removeItem(STORAGE_KEY);
  deviceConfig.current = null;
}

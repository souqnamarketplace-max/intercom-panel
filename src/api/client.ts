import { deviceConfig } from '../config';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface SiteInfo {
  id: string;
  name: string;
  address: string | null;
  directoryPrivacyMode: boolean;
  brandingLogoUrl: string | null;
  buildingInfo: string | null;
  frontDeskLabel: string;
  customButtonLabels: Record<string, string>;
  frontDeskResident: { id: string; name: string } | null;
  securityTileEnabled: boolean;
  screensaverType?: string | null;
  screensaverUrl?: string | null;
  screensaverDelaySeconds?: number;
}

export interface DirectoryEntry {
  unitNumber: string;
  displayName: string;
  residentId: string;
}

export interface ActivityEvent {
  id: string;
  eventType: string;
  method: string | null;
  result: string;
  createdAt: string;
  residentName: string | null;
  carrierName: string | null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const panelApi = {
  getSiteInfo: (siteId: string) => request<SiteInfo>(`/panel-api/v1/sites/${siteId}`),
  getDirectory: (siteId: string) => request<DirectoryEntry[]>(`/panel-api/v1/sites/${siteId}/directory`),
  getEntryPointActivity: (entryPointId: string, cursor?: string) =>
    request<{ events: ActivityEvent[]; nextCursor: string | null }>(
      `/panel-api/v1/entry-points/${entryPointId}/activity${cursor ? `?cursor=${cursor}` : ''}`,
    ),
  verifySettingsPin: (siteId: string, pin: string) =>
    request<{ valid: boolean }>(`/panel-api/v1/sites/${siteId}/verify-settings-pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }),
  changeSettingsPin: (siteId: string, currentPin: string, newPin: string) =>
    request<{ success: boolean }>(`/panel-api/v1/sites/${siteId}/change-settings-pin`, {
      method: 'POST',
      body: JSON.stringify({ currentPin, newPin }),
    }),
  sendMessage: (siteId: string, residentId: string, body: string, photoUrl?: string) =>
    request<{ id: string }>(`/panel-api/v1/sites/${siteId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ residentId, body, photoUrl }),
    }),
  // Closes the gap where calls happen entirely peer-to-peer and the
  // backend never otherwise learns about them.
  logCallEvent: (siteId: string, dto: { residentId: string; eventType: 'call_answered' | 'call_missed' | 'call_declined' }) =>
    request<{ id: string }>(`/panel-api/v1/sites/${siteId}/log-call-event`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  // QR scans verify fully offline on the panel — this is the only way the
  // backend otherwise learns an unlock happened via that path at all.
  logUnlockEvent: (siteId: string, dto: { entryPointId: string; unitId?: string; method?: string }) =>
    request<{ id: string }>(`/panel-api/v1/sites/${siteId}/log-unlock-event`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  // Delivery Pass PIN check — verifies a code a resident generated in the
  // app against the real backend, replacing the previous hardcoded mock.
  verifyVisitorPin: (siteId: string, pin: string) =>
    request<{
      valid: boolean; keyId?: string; recipientName?: string; carrierName?: string;
      reason?: 'not_found' | 'already_used' | 'expired' | 'outside_window';
    }>(
      `/panel-api/v1/sites/${siteId}/verify-visitor-pin`,
      { method: 'POST', body: JSON.stringify({ pin, entryPointId: deviceConfig.current?.entryPointId }) },
    ),

  // Real Door PIN verification, replacing the previous hardcoded mock —
  // searches active residents at the site by PIN hash, since the panel
  // doesn't know which resident is typing.
  verifyDoorPin: (siteId: string, pin: string) =>
    request<{ valid: boolean; residentId?: string; residentName?: string; unitId?: string }>(
      `/panel-api/v1/sites/${siteId}/verify-door-pin`,
      { method: 'POST', body: JSON.stringify({ pin, entryPointId: deviceConfig.current?.entryPointId }) },
    ),

  // Primary pairing flow, step 1 — validates the site's reusable code and
  // lists its existing entry points so the installer can pick the right
  // door (no ad-hoc entry point creation from the panel itself).
  resolveSiteCode: (code: string) =>
    request<
      | { valid: true; siteId: string; siteName: string; entryPoints: { id: string; name: string; hasPanel: boolean; hasPiController: boolean }[] }
      | { valid: false }
    >('/panel-api/v1/resolve-site-code', { method: 'POST', body: JSON.stringify({ code }) }),

  // Pairing flow, step 2 — claims a specific entry point for this panel.
  claimEntryPoint: (siteId: string, entryPointId: string) =>
    request<
      | { valid: true; deviceId: string; entryPointId: string; entryPointName: string; siteId: string }
      | { valid: false }
    >('/panel-api/v1/claim-entry-point', {
      method: 'POST',
      body: JSON.stringify({ siteId, entryPointId, deviceType: 'panel' }),
    }),

  // Secondary pairing flow — exchanges a one-time per-device setup code
  // (from the dashboard's Devices screen) for this panel's full identity.
  // Kept for re-pairing a specific existing device without going through
  // the site-code + door-picker flow above.
  provision: (setupCode: string) =>
    request<
      | { valid: true; deviceId: string; entryPointId: string; entryPointName: string; siteId: string }
      | { valid: false }
    >('/panel-api/v1/provision', { method: 'POST', body: JSON.stringify({ setupCode }) }),

  // Called every ~20-30s once provisioned so the dashboard's Devices screen
  // can show real online/offline status instead of a static assumption.
  heartbeat: (deviceId: string) =>
    request<{ id: string }>(`/panel-api/v1/devices/${deviceId}/heartbeat`, { method: 'POST' }),

  // Visitor Pass QR verification — the public half of the signing keypair
  // (safe to cache indefinitely) and the site's revoked-key list (synced
  // periodically), together let the panel verify a scanned pass fully
  // offline without ever contacting the backend at scan time.
  getVirtualKeyPublicKey: () =>
    request<{ publicKey: string }>('/panel-api/v1/virtual-key-public-key'),
  getRevokedKeys: (siteId: string) =>
    request<string[]>(`/panel-api/v1/sites/${siteId}/revoked-keys`),
};

// Simple online/offline check — the panel considers itself "online" only if
// it can actually reach the backend, not just if the OS reports network up.
export async function checkBackendOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export { API_URL };

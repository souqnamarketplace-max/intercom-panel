import { panelApi } from './api/client';
import type { SiteInfo } from './api/client';

const PUBLIC_KEY_STORAGE_KEY = 'intercom_panel_vk_public_key';
const REVOKED_KEYS_STORAGE_KEY = 'intercom_panel_vk_revoked_ids';
const SITE_INFO_CACHE_KEY = 'intercom_panel_site_info_cache';

export function getCachedPublicKey(): string | null {
  return localStorage.getItem(PUBLIC_KEY_STORAGE_KEY);
}

export function getCachedRevokedIds(): string[] {
  try {
    const raw = localStorage.getItem(REVOKED_KEYS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// Site info (branding, building info, front desk config, custom labels)
// changes rarely — cached the same way the directory is, so screens show
// data instantly on repeat visits instead of a loading flash every time.
export function getCachedSiteInfo(): SiteInfo | null {
  try {
    const raw = localStorage.getItem(SITE_INFO_CACHE_KEY);
    return raw ? (JSON.parse(raw) as SiteInfo) : null;
  } catch {
    return null;
  }
}

export async function fetchAndCacheSiteInfo(siteId: string): Promise<SiteInfo | null> {
  try {
    const site = await panelApi.getSiteInfo(siteId);
    localStorage.setItem(SITE_INFO_CACHE_KEY, JSON.stringify(site));
    return site;
  } catch {
    return null;
  }
}

// Called after provisioning and periodically thereafter (piggybacking on
// the heartbeat cadence). The public key rarely changes so failures there
// aren't critical; the revoked-keys list is what actually needs to stay
// fresh so a revoked pass stops working promptly once the panel is online.
export async function refreshKeyCache(siteId: string): Promise<void> {
  try {
    const { publicKey } = await panelApi.getVirtualKeyPublicKey();
    if (publicKey) localStorage.setItem(PUBLIC_KEY_STORAGE_KEY, publicKey);
  } catch {
    // Keep whatever was cached before — offline-first, don't wipe a working key.
  }

  try {
    const revokedIds = await panelApi.getRevokedKeys(siteId);
    localStorage.setItem(REVOKED_KEYS_STORAGE_KEY, JSON.stringify(revokedIds));
  } catch {
    // Same — keep the last-known revocation list rather than treating a
    // network blip as "nothing is revoked."
  }
}

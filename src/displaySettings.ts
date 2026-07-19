const BRIGHTNESS_KEY = 'intercom_panel_brightness';

export function getBrightness(): number {
  const raw = localStorage.getItem(BRIGHTNESS_KEY);
  const value = raw ? Number(raw) : 100;
  return Number.isFinite(value) ? Math.min(100, Math.max(10, value)) : 100;
}

export function setBrightness(value: number): void {
  localStorage.setItem(BRIGHTNESS_KEY, String(Math.min(100, Math.max(10, value))));
  window.dispatchEvent(new CustomEvent('brightness-changed'));
}

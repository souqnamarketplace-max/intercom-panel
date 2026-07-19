# Intercom Panel

The web prototype of the touchscreen device mounted at the building's front
door. React + Vite + TypeScript. Redesigned this session to match a
tile-based reference layout (status bar, visitor card, colored category
tiles, bottom nav) while staying in the same Fraunces/Inter/IBM Plex Mono
type family as the rest of the product.

Verified: `npx tsc --noEmit` zero errors, `npm run build` succeeds
(470KB / 151KB gzipped).

## Setup

```bash
npm install
cp .env.example .env
```
Edit `.env`:
```
VITE_API_URL=https://your-backend.up.railway.app
VITE_SITE_ID=<a real site UUID from the dashboard>
```
```bash
npm run dev
```

## What's real

- **Status bar** — "Online/Offline" reflects an actual poll of the backend's
  `/health` endpoint every 15s, not a hardcoded value.
- **Motion-activated camera** — the camera runs continuously in the
  background; frames are diffed at low resolution to detect real motion.
  The live feed only surfaces to the visitor card when motion is detected;
  otherwise the screensaver (site logo + clock) is shown. This is a software
  approximation — the real Android panel should use its motion sensor
  instead of frame-diffing.
- **Branding** — the idle screensaver's logo and the building's name come
  from the site's real `brandingLogoUrl` in the database (set via the
  dashboard's new Branding & Panel Settings screen).
- **Building Info** — pulls the site's real `buildingInfo` text.
- **Front Desk tile** — dynamically shows whichever resident is configured
  as the front-desk contact for this site (dashboard-configurable), and
  calls them directly via the same real WebRTC flow as the Directory.
- **Custom button labels** — Door PIN / Delivery PIN tile labels pull from
  the site's `customButtonLabels`, falling back to defaults if unset.
- **Messages** — sending a message to a resident is a real, persisted write
  (`POST /panel-api/v1/sites/:siteId/messages`) to a new `resident_messages`
  table. The resident app doesn't have an inbox screen to *read* these yet
  (backend endpoint `GET /residents/me/messages` exists and is ready for it)
  — that's the natural next step, not built this session.
- **Settings PIN gate** — checks the entered PIN against the site's real
  `panelSettingsPin` (default `1234`, configurable from the dashboard) via
  a real backend call, not a hardcoded check.
- **Directory, Calling, QR scan** — unchanged from before, still real (see
  below for what's mocked within them).

## What's mocked (intentionally — there's no Pi yet)

- **Door PIN / Delivery PIN validation** — UI is real, but checks against a
  hardcoded demo code (`1234` / `9999`), not a real Pi-side whitelist.
- **Virtual Key verification** — any successfully-scanned QR is treated as
  valid; no signature/expiry check yet.
- **Unlock** — visual state change only, no relay fires.
- **Security/Cameras, Activity** — placeholder screens. Multi-camera and a
  device-scoped activity feed both need small backend additions (endpoints
  don't exist yet) before these can show real data.
- **Settings sliders** (brightness/contrast/volume) — UI-only; there's no
  real display/audio hardware in a browser tab to apply them to. On the
  actual Android panel these would map to real system settings.
- **Site provisioning** — still a manual `VITE_SITE_ID` env var.

## Next steps toward the real thing

1. Build the resident app's Messages inbox screen against the already-ready
   `GET /residents/me/messages` endpoint.
2. Add a device-scoped Activity endpoint (e.g.
   `GET /panel-api/v1/sites/:siteId/recent-events`) so the Activity screen
   can show something real.
3. Replace the PIN/QR mocks with real Pi validation once that hardware
   integration exists.
4. Wrap in Capacitor for the actual Android kiosk build.
5. Consider a real motion sensor on the Android build instead of frame
   diffing, which is CPU-costly for an always-on kiosk device.

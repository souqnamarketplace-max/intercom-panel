import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { importSPKI, jwtVerify } from 'jose';
import { panelApi, type SiteInfo } from '../api/client';
import { deviceConfig } from '../config';
import { getCachedSiteInfo, fetchAndCacheSiteInfo, getCachedPublicKey, getCachedRevokedIds } from '../keyCache';
import StatusBar from '../components/StatusBar';
import BottomNav from '../components/BottomNav';

// MJPEG stream from the Pi's local camera service (picamera2 HTTP stream).
// This replaces the getUserMedia approach which couldn't access the CSI
// ribbon camera on the Pi (libcamera uses a raw Bayer format that Chromium's
// getUserMedia can't consume). The MJPEG stream is served by
// mjpeg-stream.service (python3 picamera2) on port 8090.
// Falls back gracefully if the stream isn't available (e.g. Mac dev mode).
const MJPEG_STREAM_URL = 'http://192.168.1.150:8090';

type ScanState = 'idle' | 'scanning' | 'checking' | 'invalid';

export default function Home() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [site, setSite] = useState<SiteInfo | null>(getCachedSiteInfo);
  const [mjpegAvailable, setMjpegAvailable] = useState(false);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanReason, setScanReason] = useState<string | null>(null);
  const scanRafRef = useRef<number | undefined>(undefined);

  // Check if the MJPEG stream is available (Pi camera service running)
  useEffect(() => {
    const img = new Image();
    img.onload = () => setMjpegAvailable(true);
    img.onerror = () => setMjpegAvailable(false);
    img.src = MJPEG_STREAM_URL;
    // Re-check every 10s in case the service restarts
    const interval = setInterval(() => {
      const probe = new Image();
      probe.onload = () => setMjpegAvailable(true);
      probe.onerror = () => setMjpegAvailable(false);
      probe.src = MJPEG_STREAM_URL + '?' + Date.now();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // For QR scanning: still need getUserMedia to get video frames for jsQR.
  // This is separate from the display stream — the video element stays hidden.
  const [cameraReady, setCameraReady] = useState(false);
  void cameraReady; // used via setCameraReady in the getUserMedia effect below

  // Idle timer for the screensaver - previously it appeared the instant
  // motion detection reported nothing, with no configurable delay at all.
  // Now it waits for the dashboard-configured number of idle seconds, and
  // any touch anywhere on the panel (not just detected motion) resets it.
  const [screensaverActive, setScreensaverActive] = useState(false);
  const lastActivityRef = useRef(Date.now());

  function resetIdleTimer() {
    lastActivityRef.current = Date.now();
    setScreensaverActive(false);
  }

  useEffect(() => {
    const delayMs = (site?.screensaverDelaySeconds ?? 20) * 1000;
    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= delayMs) setScreensaverActive(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [site?.screensaverDelaySeconds]);

  // MJPEG stream availability counts as activity (camera is live = someone may be there).
  useEffect(() => {
    if (mjpegAvailable) resetIdleTimer();
  }, [mjpegAvailable]);

  useEffect(() => {
    const siteId = deviceConfig.current?.siteId ?? '';
    fetchAndCacheSiteInfo(siteId).then((fresh) => { if (fresh) setSite(fresh); });
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      })
      .catch(() => setCameraReady(false));
  }, []);

  // Scans directly off the same camera feed already running for motion
  // detection — previously this required navigating to a separate /scan
  // page and starting a second camera stream from scratch.
  useEffect(() => {
    if (scanState !== 'scanning') return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    function tick() {
      const video = videoRef.current;
      if (video && ctx && video.readyState >= video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) {
          handleDecoded(code.data);
          return;
        }
      }
      scanRafRef.current = requestAnimationFrame(tick);
    }
    scanRafRef.current = requestAnimationFrame(tick);
    return () => { if (scanRafRef.current) cancelAnimationFrame(scanRafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanState]);

  // Same verification VirtualKeyScan.tsx used - signature against the
  // cached public key, site match, and revocation check, all fully offline.
  async function handleDecoded(token: string) {
    setScanState('checking');
    setScanReason(null);

    const publicKeyPem = getCachedPublicKey();
    if (!publicKeyPem) {
      setScanState('invalid');
      setScanReason('No verification key cached yet — needs to be online at least once');
      return;
    }

    try {
      const key = await importSPKI(publicKeyPem, 'RS256');
      const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'] });

      const siteId = deviceConfig.current?.siteId;
      if (siteId && payload.siteId !== siteId) {
        setScanState('invalid');
        setScanReason('This pass isn\u2019t valid for this building');
        return;
      }

      const revokedIds = getCachedRevokedIds();
      if (typeof payload.keyId === 'string' && revokedIds.includes(payload.keyId)) {
        setScanState('invalid');
        setScanReason('This pass has been revoked');
        return;
      }

      const entryPointId = deviceConfig.current?.entryPointId;
      if (entryPointId && siteId) {
        panelApi.logUnlockEvent(siteId, {
          entryPointId,
          unitId: typeof payload.unitId === 'string' ? payload.unitId : undefined,
          method: 'virtual_key_qr',
        }).catch(() => {}); // logging failure shouldn't block the actual unlock
      }

      navigate('/unlocked');
    } catch {
      setScanState('invalid');
      setScanReason('This code isn\u2019t valid or has expired');
    }
  }

  const buttonLabel = (key: string, fallback: string) => site?.customButtonLabels?.[key] || fallback;
  const showLiveView = mjpegAvailable || scanState !== 'idle';

  return (
    <div className="panel-shell" onClick={resetIdleTimer}>
      <StatusBar />

      <div className="idle-body">
        <div className="visitor-card">
          {/* MJPEG stream from the Pi's local camera service — shown as a
              simple <img> tag which works with any MJPEG HTTP stream without
              needing getUserMedia or libcamera V4L2 compatibility. The hidden
              <video> below is still used for QR code scanning (jsQR needs
              video frames), but is never shown to the visitor. */}
          {mjpegAvailable && scanState === 'idle' && (
            <img
              src={MJPEG_STREAM_URL}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              alt="Camera feed"
            />
          )}
          {/* Hidden video for QR scanning — getUserMedia, never displayed */}
          <video ref={videoRef} autoPlay muted playsInline style={{ display: 'none' }} />

          {scanState !== 'idle' ? (
            <div className="visitor-caption" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', padding: 20 }}>
              {scanState === 'scanning' && (
                <div style={{ border: '3px solid var(--brass-bright)', borderRadius: 16, width: '60%', aspectRatio: 1, marginBottom: 16 }} />
              )}
              <div className="title" style={{ marginBottom: 4 }}>
                {scanState === 'scanning' && 'Hold the QR code up to the camera'}
                {scanState === 'checking' && 'Checking\u2026'}
                {scanState === 'invalid' && (scanReason ?? 'Invalid code')}
              </div>
              <button
                className="vc-btn talk"
                onClick={() => {
                  if (scanState === 'invalid') { setScanState('scanning'); setScanReason(null); }
                  else { setScanState('idle'); setScanReason(null); }
                }}
              >
                {scanState === 'invalid' ? 'Try again' : 'Cancel'}
              </button>
            </div>
          ) : showLiveView ? (
            <>
              <div className="visitor-live-badge"><span className="dot" /> Live</div>
              <div className="visitor-caption">
                <div className="label">{deviceConfig.current?.entryPointName ?? 'Entrance'}</div>
                <div className="title">Visitor detected</div>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
                  Use Residents or Front Desk below to answer.
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="tile-grid">
          <div className="tile tile-blue" onClick={() => navigate('/directory')}>
            <div className="tile-icon">👥</div>
            <div>
              <div className="tile-label">Residents</div>
              <div className="tile-sub">Directory →</div>
            </div>
          </div>
          {site?.securityTileEnabled && (
            <div className="tile tile-green" onClick={() => navigate('/security')}>
              <div className="tile-icon">🛡</div>
              <div>
                <div className="tile-label">Security</div>
                <div className="tile-sub">Cameras →</div>
              </div>
            </div>
          )}
          <div className="tile tile-blue" onClick={() => navigate('/pin')}>
            <div className="tile-icon">🔢</div>
            <div>
              <div className="tile-label">{buttonLabel('doorPin', 'Door PIN')}</div>
              <div className="tile-sub">Entry →</div>
            </div>
          </div>
          <div className="tile tile-green" onClick={() => navigate('/delivery-pin')}>
            <div className="tile-icon">📦</div>
            <div>
              <div className="tile-label">{buttonLabel('deliveryPin', 'Delivery PIN')}</div>
              <div className="tile-sub">Access →</div>
            </div>
          </div>
          <div className="tile tile-blue" onClick={() => { setScanState('scanning'); setScanReason(null); }}>
            <div className="tile-icon">🔑</div>
            <div>
              <div className="tile-label">{buttonLabel('virtualKey', 'Virtual Key')}</div>
              <div className="tile-sub">Scan →</div>
            </div>
          </div>
          <div
            className="tile tile-orange"
            onClick={() => {
              if (site?.frontDeskResident) {
                navigate(`/call/${site.frontDeskResident.id}/${encodeURIComponent(site.frontDeskResident.name)}`);
              }
            }}
          >
            <div className="tile-icon">🔔</div>
            <div>
              <div className="tile-label">{site?.frontDeskLabel ?? 'Front Desk'}</div>
              <div className="tile-sub">{site?.frontDeskResident ? 'Call →' : 'Not configured'}</div>
            </div>
          </div>
          <div className="tile tile-slate" onClick={() => navigate('/building-info')}>
            <div className="tile-icon">🏢</div>
            <div>
              <div className="tile-label">Building Info</div>
              <div className="tile-sub">Announcements →</div>
            </div>
          </div>
        </div>
      </div>

      {/* True full-panel screensaver - previously this rendered inside the
          small camera-preview box (.visitor-card), so it looked contained
          rather than taking over the display the way a real screensaver
          should. Covers status bar and tiles too now, dismissed the moment
          motion is detected or a scan/call starts (showLiveView/scanState
          already drive that). */}
      {scanState === 'idle' && !showLiveView && screensaverActive && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          {site?.screensaverUrl && site.screensaverType === 'video' ? (
            <video
              src={site.screensaverUrl}
              autoPlay muted loop playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : site?.screensaverUrl && site.screensaverType === 'image' ? (
            <img
              src={site.screensaverUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div className="screensaver" style={{ width: '100%', height: '100%' }}>
              {site?.brandingLogoUrl ? (
                <img src={site.brandingLogoUrl} alt={site.name} />
              ) : (
                <div className="building-mark" style={{ width: 64, height: 64, fontSize: 24 }}>
                  {(site?.name ?? 'IC').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
              )}
              <div className="clock-big">{new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
              <div className="date">{site?.name ?? 'Loading…'}</div>
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

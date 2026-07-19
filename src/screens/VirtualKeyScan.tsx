import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { importSPKI, jwtVerify } from 'jose';
import { deviceConfig } from '../config';
import { getCachedPublicKey, getCachedRevokedIds } from '../keyCache';

type Status = 'scanning' | 'checking' | 'error' | 'invalid';

export default function VirtualKeyScan() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>('scanning');
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf: number;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
      stream = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
      tick();
    }).catch(() => setStatus('error'));

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            // Default only tries the image as-is. 'attemptBoth' also tries
            // an inverted-contrast pass, which meaningfully helps with
            // glare/reflection washing out part of the code (a real issue
            // photographed during testing) or a bright light source behind
            // the phone.
            inversionAttempts: 'attemptBoth',
          });
          if (code && code.data) {
            handleDecoded(code.data);
            return; // stop scanning loop
          }
        }
      }
      raf = requestAnimationFrame(tick);
    }

    // Real offline verification: checks the token's RS256 signature against
    // the cached public key (proves the backend actually issued it -- a
    // photo of a random QR won't have a valid signature), confirms it's
    // scoped to this panel's site, and checks it against the cached
    // revocation list (catches a pass revoked before its natural expiry,
    // which the signature alone can't know about). jose's jwtVerify also
    // rejects an expired token automatically via the standard `exp` claim.
    async function handleDecoded(token: string) {
      setStatus('checking');
      setReason(null);

      const publicKeyPem = getCachedPublicKey();
      if (!publicKeyPem) {
        setStatus('error');
        setReason('No verification key cached yet \u2014 needs to be online at least once');
        return;
      }

      try {
        const key = await importSPKI(publicKeyPem, 'RS256');
        const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'] });

        const siteId = deviceConfig.current?.siteId;
        if (siteId && payload.siteId !== siteId) {
          setStatus('invalid');
          setReason('This pass isn\u2019t valid for this building');
          return;
        }

        const revokedIds = getCachedRevokedIds();
        if (typeof payload.keyId === 'string' && revokedIds.includes(payload.keyId)) {
          setStatus('invalid');
          setReason('This pass has been revoked');
          return;
        }

        navigate('/unlocked');
      } catch {
        // Covers bad signature, malformed token, and expired token (jose
        // throws on an expired `exp` claim) -- all collapse to the same
        // user-facing message since the distinction doesn't matter here.
        setStatus('invalid');
        setReason('This code isn\u2019t valid or has expired');
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retry() {
    setStatus('scanning');
    setReason(null);
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="back-btn" onClick={() => navigate('/')}>←</div>
        <div className="screen-title">Scan Virtual Key</div>
      </div>
      <div className="scan-frame">
        {status === 'error' ? (
          <div className="preview-placeholder" style={{ height: '100%' }}>
            {reason ?? 'Camera unavailable'}
          </div>
        ) : status === 'invalid' ? (
          <div className="preview-placeholder" style={{ height: '100%', flexDirection: 'column', gap: 12 }}>
            <p>{reason}</p>
            <button className="keypad-submit" style={{ margin: 0 }} onClick={retry}>Try again</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} muted playsInline />
            <div className="scan-guide" />
            <p className="scan-hint">{status === 'checking' ? 'Verifying\u2026' : 'Hold the QR code up to the camera'}</p>
          </>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

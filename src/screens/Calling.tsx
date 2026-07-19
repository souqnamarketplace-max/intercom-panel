import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PanelCaller, type LocalMediaMode } from '../calling/PanelCaller';
import { deviceConfig } from '../config';
import { panelApi } from '../api/client';

type CallState = 'connecting' | 'ringing' | 'connected' | 'ended' | 'error';

export default function Calling() {
  const { residentId, name } = useParams();
  const navigate = useNavigate();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callerRef = useRef<PanelCaller | null>(null);
  const [state, setState] = useState<CallState>('connecting');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [mediaMode, setMediaMode] = useState<LocalMediaMode>('video+audio');

  useEffect(() => {
    const caller = new PanelCaller();
    callerRef.current = caller;
    let cancelled = false;

    (async () => {
      try {
        await caller.init((deviceConfig.current?.siteId ?? '') || 'demo');
        if (cancelled) return;
        setState('ringing');

        if (localVideoRef.current) localVideoRef.current.srcObject = caller.getLocalStream();

        await caller.callResident(
          residentId!,
          (remoteStream) => {
            if (cancelled) return;
            // Same bug as the resident app's original IncomingCall fix: the
            // remote <video> element only exists once state === 'connected',
            // but this callback fires before that re-render happens, so
            // writing to remoteVideoRef.current here was a no-op. Stash the
            // stream and let the effect below attach it once the element
            // actually mounts.
            remoteStreamRef.current = remoteStream;
            setHasRemoteVideo(remoteStream.getVideoTracks().length > 0);
            setState('connected');
            logCallEvent('call_answered');
          },
          (reason) => {
            if (cancelled) return;
            if (reason === 'door_opened') {
              logCallEvent('call_answered');
              navigate('/unlocked');
              return;
            }
            setState((prev) => {
              if (prev !== 'connected') logCallEvent('call_missed');
              return 'ended';
            });
          },
          {
            from: deviceConfig.current?.entryPointName ?? 'Entrance',
            entryPointId: deviceConfig.current?.entryPointId,
          },
        );
        if (!cancelled) setMediaMode(caller.localMediaMode);

        // Show our own preview once local stream is actually attached
        if (localVideoRef.current) localVideoRef.current.srcObject = caller.getLocalStream();
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
      caller.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [residentId]);

  // Attaches the stashed remote stream once the video element exists, with
  // the same autoplay-policy fallback used on the resident app side.
  useEffect(() => {
    if (state !== 'connected') return;
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => setNeedsTapToPlay(true));
  }, [state]);

  // A call ending used to leave a static "Call ended" screen requiring a
  // manual tap on the X — now auto-returns to Home after a moment, whether
  // the resident hung up or the call simply failed to connect.
  useEffect(() => {
    if (state !== 'ended') return;
    const timer = setTimeout(() => navigate('/'), 1800);
    return () => clearTimeout(timer);
  }, [state, navigate]);

  function resumePlayback() {
    remoteVideoRef.current?.play()
      .then(() => setNeedsTapToPlay(false))
      .catch(() => {});
  }

  function logCallEvent(eventType: 'call_answered' | 'call_missed' | 'call_declined') {
    const siteId = deviceConfig.current?.siteId;
    if (!siteId || !residentId) return;
    panelApi.logCallEvent(siteId, { residentId, eventType }).catch(() => {});
  }

  async function handleEnd() {
    if (state !== 'connected') {
      logCallEvent('call_missed');
      await callerRef.current?.sendControlAndWait('cancelled');
    } else {
      await callerRef.current?.sendControlAndWait('ended');
    }
    callerRef.current?.destroy();
    navigate('/');
  }

  const displayName = name ? decodeURIComponent(name) : 'Resident';

  return (
    <div className="call-screen">
      {state === 'connected' ? (
        <>
          <div className="call-video-wrap">
            <video ref={remoteVideoRef} autoPlay playsInline />
            {!hasRemoteVideo && (
              <div className="preview-placeholder" style={{ position: 'absolute', inset: 0 }}>
                {displayName} enabled audio only
              </div>
            )}
            {needsTapToPlay && (
              <button
                className="call-action-btn"
                style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 'auto', padding: '10px 20px', borderRadius: 24 }}
                onClick={resumePlayback}
              >
                Tap to enable audio
              </button>
            )}
          </div>
          <p className="call-status">Connected · {displayName}</p>
        </>
      ) : (
        <>
          <div className="caller-avatar">{displayName[0]?.toUpperCase() ?? '?'}</div>
          <div className="caller-name">{displayName}</div>
          <p className="call-status">
            {state === 'connecting' && 'Connecting…'}
            {state === 'ringing' && 'Ringing…'}
            {state === 'ended' && 'Call ended'}
            {state === 'error' && 'Could not reach this resident'}
          </p>
          {(state === 'ringing' || state === 'connecting') && mediaMode !== 'video+audio' && (
            <p className="call-status" style={{ fontSize: 12, opacity: 0.65 }}>
              {mediaMode === 'audio-only' && 'Camera unavailable — audio-only call'}
              {mediaMode === 'video-only' && 'Microphone unavailable — video without sound'}
              {mediaMode === 'none' && 'Camera and microphone unavailable on this panel'}
            </p>
          )}
        </>
      )}

      <video ref={localVideoRef} autoPlay muted playsInline style={{ display: 'none' }} />

      <div className="call-actions">
        <button className="call-action-btn end" onClick={handleEnd}>✕</button>
      </div>
    </div>
  );
}

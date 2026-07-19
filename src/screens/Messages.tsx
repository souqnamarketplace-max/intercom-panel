import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { panelApi, type DirectoryEntry } from '../api/client';
import { deviceConfig } from '../config';
import BottomNav from '../components/BottomNav';
import OnScreenKeyboard from '../components/OnScreenKeyboard';
import { useScrollIntoViewOnOpen } from '../hooks/useScrollIntoViewOnOpen';

export default function Messages() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [composeKeyboardOpen, setComposeKeyboardOpen] = useState(false);
  const searchInputRef = useScrollIntoViewOnOpen<HTMLInputElement>(keyboardOpen);
  const composeInputRef = useScrollIntoViewOnOpen<HTMLTextAreaElement>(composeKeyboardOpen);
  const [selected, setSelected] = useState<DirectoryEntry | null>(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    panelApi.getDirectory((deviceConfig.current?.siteId ?? '')).then(setEntries).catch(() => setEntries([]));
  }, []);

  // Starts the camera only once a resident is picked (compose view) -
  // a snapshot is captured right before sending so the resident sees who
  // left the note, the same way calls show the visitor's photo.
  useEffect(() => {
    if (!selected) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }).catch(() => {
      // No camera available — message still sends, just without a photo.
    });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [selected]);

  function captureSnapshot(): string | undefined {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_CURRENT_DATA) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  // Search-first, same pattern as Directory — the old flat list (every
  // resident shown at once with no filter) didn't scale past a couple of
  // units and made picking the right person tedious.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return entries.filter((e) =>
      e.displayName.toLowerCase().includes(q) || e.unitNumber.toLowerCase().includes(q),
    );
  }, [entries, query]);

  async function handleSend() {
    if (!selected || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const photoUrl = captureSnapshot();
      await panelApi.sendMessage((deviceConfig.current?.siteId ?? ''), selected.residentId, body.trim(), photoUrl);
      setSent(true);
      setBody('');
      setSelected(null);
      setQuery('');
      setTimeout(() => setSent(false), 3000);
    } catch {
      setError('Could not send message — try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <div
          className="back-btn"
          onClick={() => {
            if (selected) {
              setSelected(null);
              setComposeKeyboardOpen(false);
            } else {
              navigate('/');
            }
          }}
        >←</div>
        <div className="screen-title">Messages</div>
      </div>
      <div className="simple-section" style={{ paddingBottom: 0 }}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          Send a note to a resident's app — for things that don't need a live call.
        </p>

        {!selected ? (
          <>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by name or unit…"
              value={query}
              readOnly
              onClick={() => setKeyboardOpen(true)}
              style={{ marginBottom: 10 }}
            />
            <div className="message-picker">
              {query.trim() === '' && (
                <p className="muted" style={{ fontSize: 13, padding: '8px 4px' }}>
                  Start typing a name or unit number to find a resident.
                </p>
              )}
              {query.trim() !== '' && filtered.length === 0 && (
                <p className="muted" style={{ fontSize: 13, padding: '8px 4px' }}>No matches.</p>
              )}
              {filtered.map((e) => (
                <div
                  key={e.residentId}
                  className="message-picker-row"
                  onClick={() => { setSelected(e); setError(null); }}
                >
                  <span>{e.displayName}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>Unit {e.unitNumber}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="message-picker-row selected" style={{ marginBottom: 14 }}>
              <span>{selected.displayName}</span>
              <span className="muted" style={{ fontSize: 12.5 }}>Unit {selected.unitNumber}</span>
            </div>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ width: '100%', maxWidth: 220, borderRadius: 12, margin: '0 auto 12px', display: 'block' }}
            />
            <textarea
              ref={composeInputRef}
              className="message-textarea"
              placeholder={`Message to ${selected.displayName}…`}
              value={body}
              readOnly
              onClick={() => setComposeKeyboardOpen(true)}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}
            <button
              className="keypad-submit"
              style={{ margin: '14px 0' }}
              disabled={!body.trim() || sending}
              onClick={handleSend}
            >
              {sending ? 'Sending…' : sent ? 'Sent ✓' : 'Send message'}
            </button>
          </>
        )}
      </div>
      {keyboardOpen && !selected ? (
        <div className="osk-anchor">
          <div className="osk-done-row">
            <button className="btn-text" onClick={() => setKeyboardOpen(false)}>Done</button>
          </div>
          <OnScreenKeyboard
            onKey={(char) => setQuery((q) => q + char)}
            onBackspace={() => setQuery((q) => q.slice(0, -1))}
            onSpace={() => setQuery((q) => q + ' ')}
          />
        </div>
      ) : composeKeyboardOpen && selected ? (
        <div className="osk-anchor">
          <div className="osk-done-row">
            <button className="btn-text" onClick={() => setComposeKeyboardOpen(false)}>Done</button>
          </div>
          <OnScreenKeyboard
            onKey={(char) => setBody((b) => b + char)}
            onBackspace={() => setBody((b) => b.slice(0, -1))}
            onSpace={() => setBody((b) => b + ' ')}
          />
        </div>
      ) : (
        <BottomNav />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { panelApi, type DirectoryEntry } from '../api/client';
import { deviceConfig } from '../config';
import BottomNav from '../components/BottomNav';
import OnScreenKeyboard from '../components/OnScreenKeyboard';
import { useScrollIntoViewOnOpen } from '../hooks/useScrollIntoViewOnOpen';

const DIRECTORY_CACHE_KEY = 'intercom_panel_directory_cache';

function loadCachedDirectory(): DirectoryEntry[] {
  try {
    const raw = localStorage.getItem(DIRECTORY_CACHE_KEY);
    return raw ? (JSON.parse(raw) as DirectoryEntry[]) : [];
  } catch {
    return [];
  }
}

export default function Directory() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DirectoryEntry[]>(loadCachedDirectory);
  const [query, setQuery] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const inputRef = useScrollIntoViewOnOpen<HTMLInputElement>(keyboardOpen);
  // Only show a loading state if we have nothing cached yet — a returning
  // visitor sees the directory instantly while it silently refreshes,
  // instead of "resident name loads slowly" every single time.
  const [loading, setLoading] = useState(loadCachedDirectory().length === 0);

  useEffect(() => {
    panelApi.getDirectory((deviceConfig.current?.siteId ?? ''))
      .then((fresh) => {
        setEntries(fresh);
        localStorage.setItem(DIRECTORY_CACHE_KEY, JSON.stringify(fresh));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.displayName.toLowerCase().includes(q) || e.unitNumber.includes(q));
  }, [entries, query]);

  return (
    <div className="screen">
      <div className="screen-header">
        <div className="back-btn" onClick={() => navigate('/')}>←</div>
        <div className="screen-title">Directory</div>
      </div>
      <input
        ref={inputRef}
        className="search-box"
        placeholder="Search by name or unit…"
        value={query}
        readOnly
        onClick={() => setKeyboardOpen(true)}
      />
      <div className="directory-list">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="muted">No matches.</p>
        ) : (
          filtered.map((e) => (
            <div
              key={e.residentId}
              className="directory-row"
              onClick={() => navigate(`/call/${e.residentId}/${encodeURIComponent(e.displayName)}`)}
            >
              <div>
                <div className="name">{e.displayName}</div>
                <div className="unit">Unit {e.unitNumber}</div>
              </div>
              <div className="call-icon-btn">📞</div>
            </div>
          ))
        )}
      </div>
      {keyboardOpen ? (
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
      ) : (
        <BottomNav />
      )}
    </div>
  );
}
